import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReferralStatus } from '@peditrack/database';
import { calculateAge, daysUntilDue } from '@peditrack/utils';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { QueryScreeningsDto } from './dto/query-screenings.dto';
import { CreateReferralDto } from './dto/create-referral.dto';
import { UpdateReferralDto } from './dto/update-referral.dto';
import { paginate } from '../../common/dto/pagination.dto';

/** Statuses that mean the referral loop is closed, one way or another. */
const TERMINAL_REFERRAL_STATUSES: ReferralStatus[] = ['COMPLETED', 'DECLINED', 'LOST'];

const PATIENT_SUMMARY = {
  select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true },
} as const;

const INSTRUMENT_SUMMARY = {
  select: { id: true, code: true, name: true, type: true },
} as const;

/**
 * The AAP periodicity checkpoints before 36 months. 18 months requires two
 * separate instruments (general + autism) — they are two schedule entries,
 * not one, so a system can't accidentally collapse them into a single row.
 */
const SCREENING_SCHEDULE: { ageMonths: number; type: 'GENERAL' | 'AUTISM' }[] = [
  { ageMonths: 9, type: 'GENERAL' },
  { ageMonths: 18, type: 'GENERAL' },
  { ageMonths: 18, type: 'AUTISM' },
  { ageMonths: 24, type: 'AUTISM' },
  { ageMonths: 30, type: 'GENERAL' },
];

/** Bounded window guard, same pattern as VaccinationsService (SEC-020). */
const DUE_SOON_MAX_DAYS = 365;

/** The schedule says nothing past 36 months — bounds the dueSoon() working set. */
const SCREENING_AGE_CUTOFF_MONTHS = 36;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

@Injectable()
export class ScreeningsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Instrument catalogue ────────────────────────────────

  listInstruments() {
    return this.prisma.screeningInstrument.findMany({
      where: { isActive: true },
      orderBy: [{ minAgeMonths: 'asc' }, { name: 'asc' }],
    });
  }

  // ── Records ────────────────────────────────────────────

  async create(dto: CreateScreeningDto, administeredById: string) {
    const [patient, instrument] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: dto.patientId, deletedAt: null } }),
      this.prisma.screeningInstrument.findUnique({ where: { id: dto.instrumentId } }),
    ]);

    if (!patient) throw new NotFoundException('Patient not found');
    if (!instrument) throw new NotFoundException('Screening instrument not found');

    const administeredAt = new Date(dto.administeredAt);
    // Never trust a client-supplied age — derive it server-side from the patient's DOB.
    const ageMonthsAtScreen = calculateAge(patient.dateOfBirth, administeredAt).totalMonths;

    const administration = await this.prisma.screeningAdministration.create({
      data: {
        patientId: dto.patientId,
        instrumentId: dto.instrumentId,
        appointmentId: dto.appointmentId,
        administeredById,
        scheduledAgeMonths: dto.scheduledAgeMonths,
        ageMonthsAtScreen,
        administeredAt,
        totalScore: dto.totalScore,
        domainScores: dto.domainScores as Prisma.InputJsonValue | undefined,
        outcome: dto.outcome,
        concernNote: dto.concernNote,
      },
      include: {
        instrument: true,
        patient: PATIENT_SUMMARY,
        administeredBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      userId: administeredById,
      action: 'CREATE',
      entity: 'ScreeningAdministration',
      entityId: administration.id,
      detail: `${instrument.code} @ ${dto.scheduledAgeMonths}mo recorded for patient ${patient.mrn}`,
    });

    return administration;
  }

  async findAll(query: QueryScreeningsDto) {
    const { patientId, instrumentId, outcome, from, to, skip, limit, page } = query;

    const where: Prisma.ScreeningAdministrationWhereInput = {
      ...(patientId ? { patientId } : {}),
      ...(instrumentId ? { instrumentId } : {}),
      ...(outcome ? { outcome } : {}),
      ...(from || to
        ? {
            administeredAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.screeningAdministration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { administeredAt: 'desc' },
        include: {
          instrument: true,
          patient: PATIENT_SUMMARY,
          administeredBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.screeningAdministration.count({ where }),
    ]);

    return paginate(records, total, page, limit);
  }

  async findOne(id: string) {
    const record = await this.prisma.screeningAdministration.findUnique({
      where: { id },
      include: {
        instrument: true,
        patient: PATIENT_SUMMARY,
        administeredBy: { select: { id: true, firstName: true, lastName: true } },
        referral: true,
      },
    });
    if (!record) throw new NotFoundException(`Screening administration ${id} was not found`);
    return record;
  }

  /**
   * Checkpoints coming due inside the window, plus anything already overdue.
   * Sorted so the most overdue patients surface first.
   *
   * Unlike vaccinations, there's no stored `nextDueDate` column to filter on —
   * a screening's due date is derived from the patient's date of birth plus
   * the fixed AAP schedule. So this walks active patients within the
   * screening-relevant age band (bounded — see SCREENING_AGE_CUTOFF_MONTHS)
   * against SCREENING_SCHEDULE, checking off what's already been administered
   * via a single batched lookup rather than a per-row query.
   */
  async dueSoon(days = 30) {
    const safeDays = Math.min(Math.max(1, days), DUE_SOON_MAX_DAYS);

    const horizon = new Date();
    horizon.setDate(horizon.getDate() + safeDays);
    horizon.setHours(23, 59, 59, 999);

    const cutoffDob = new Date();
    cutoffDob.setMonth(cutoffDob.getMonth() - SCREENING_AGE_CUTOFF_MONTHS);
    cutoffDob.setHours(0, 0, 0, 0);

    const [patients, instruments] = await Promise.all([
      this.prisma.patient.findMany({
        where: { deletedAt: null, isActive: true, dateOfBirth: { gte: cutoffDob } },
        select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true },
      }),
      this.prisma.screeningInstrument.findMany({ where: { isActive: true } }),
    ]);

    if (patients.length === 0) return [];

    const instrumentByType = new Map(instruments.map((i) => [i.type, i]));
    const patientIds = patients.map((p) => p.id);

    const existing = await this.prisma.screeningAdministration.findMany({
      where: { patientId: { in: patientIds } },
      select: { patientId: true, instrumentId: true, scheduledAgeMonths: true },
    });
    const done = new Set(existing.map((e) => `${e.patientId}:${e.instrumentId}:${e.scheduledAgeMonths}`));

    const results: {
      patient: (typeof patients)[number];
      instrument: { id: string; code: string; name: string; type: string };
      scheduledAgeMonths: number;
      dueDate: Date;
      daysUntilDue: number;
      daysOverdue: number;
      isOverdue: boolean;
    }[] = [];

    for (const patient of patients) {
      for (const entry of SCREENING_SCHEDULE) {
        const instrument = instrumentByType.get(entry.type);
        if (!instrument) continue; // catalogue doesn't (yet) cover this type

        if (done.has(`${patient.id}:${instrument.id}:${entry.ageMonths}`)) continue;

        const dueDate = addMonths(patient.dateOfBirth, entry.ageMonths);
        if (dueDate > horizon) continue; // not due within the window yet

        const remaining = daysUntilDue(dueDate);
        results.push({
          patient,
          instrument: { id: instrument.id, code: instrument.code, name: instrument.name, type: instrument.type },
          scheduledAgeMonths: entry.ageMonths,
          dueDate,
          daysUntilDue: remaining,
          daysOverdue: remaining < 0 ? Math.abs(remaining) : 0,
          isOverdue: remaining < 0,
        });
      }
    }

    return results.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  // ── Referral loop ────────────────────────────────────────
  //
  // A REFER outcome with no referral row is the failure mode this whole
  // feature exists to prevent — see unaddressedReferrals() below.

  async createReferral(administrationId: string, dto: CreateReferralDto, userId: string) {
    const administration = await this.prisma.screeningAdministration.findUnique({
      where: { id: administrationId },
      include: { referral: true, patient: PATIENT_SUMMARY },
    });
    if (!administration) throw new NotFoundException('Screening administration not found');
    if (administration.referral) {
      throw new ConflictException('This screening already has a referral on file');
    }

    const referral = await this.prisma.screeningReferral.create({
      data: {
        administrationId,
        referredTo: dto.referredTo,
        referredAt: new Date(dto.referredAt),
        outcomeNote: dto.outcomeNote,
      },
    });

    await this.audit.log({
      userId,
      action: 'CREATE',
      entity: 'ScreeningReferral',
      entityId: referral.id,
      detail: `referred to ${dto.referredTo} for patient ${administration.patient.mrn}`,
    });

    return referral;
  }

  async updateReferral(id: string, dto: UpdateReferralDto, userId: string) {
    const referral = await this.prisma.screeningReferral.findUnique({ where: { id } });
    if (!referral) throw new NotFoundException('Referral not found');

    const enteringTerminal =
      TERMINAL_REFERRAL_STATUSES.includes(dto.status) &&
      !TERMINAL_REFERRAL_STATUSES.includes(referral.status);
    const reopening = !TERMINAL_REFERRAL_STATUSES.includes(dto.status);

    const closedAt = enteringTerminal ? new Date() : reopening ? null : referral.closedAt;

    const updated = await this.prisma.screeningReferral.update({
      where: { id },
      data: { status: dto.status, outcomeNote: dto.outcomeNote, closedAt },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'ScreeningReferral',
      entityId: id,
      detail: `status -> ${dto.status}`,
    });

    return updated;
  }

  /** Referrals still in flight — the loop was started but hasn't closed yet. */
  openReferrals() {
    return this.prisma.screeningReferral.findMany({
      where: { status: { in: ['PENDING', 'SCHEDULED'] } },
      orderBy: { referredAt: 'asc' },
      include: {
        administration: {
          include: { instrument: true, patient: PATIENT_SUMMARY },
        },
      },
    });
  }

  /**
   * Positive screens with no referral at all — the loop was never started.
   * The artifact this feature was built from calls this "the single most
   * useful thing this feature can surface."
   */
  unaddressedReferrals() {
    return this.prisma.screeningAdministration.findMany({
      where: { outcome: 'REFER', referral: { is: null } },
      orderBy: { administeredAt: 'asc' },
      include: { instrument: true, patient: PATIENT_SUMMARY },
    });
  }
}
