import {
  BadRequestException, Injectable, NotFoundException, Logger, OnModuleInit,
} from '@nestjs/common';
import { MedicineDoseReference, Prisma } from '@peditrack/database';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePrescriptionDto, CreatePrescriptionItemDto, UpdatePrescriptionItemsDto,
  UpdatePrescriptionStatusDto, PrescriptionStatusEnum,
} from './dto/create-prescription.dto';
import { QueryPrescriptionsDto } from './dto/query-prescriptions.dto';
import { paginate } from '../../common/dto/pagination.dto';

const PATIENT_SUMMARY = {
  select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true, allergies: true },
} as const;

const DOCTOR_SUMMARY = {
  select: { id: true, firstName: true, lastName: true, licenseNumber: true, specialty: true },
} as const;

// A weight this old is no longer a safe basis for a per-kg dose — an infant
// can roughly double its weight in a few months, so the staleness bound is
// tighter below one year old.
const INFANT_MAX_AGE_MONTHS = 12;
const INFANT_WEIGHT_STALENESS_DAYS = 30;
const CHILD_WEIGHT_STALENESS_DAYS = 90;

// Salt/form suffixes stripped before comparing a prescribed name against the
// reference table, so "Amoxicillin trihydrate" resolves to "amoxicillin".
const SALT_SUFFIXES = [
  'trihydrate', 'dihydrate', 'monohydrate', 'anhydrous', 'hydrochloride', 'hcl', 'sodium',
  'potassium', 'calcium', 'sulfate', 'sulphate', 'phosphate', 'acetate', 'citrate', 'besylate',
  'maleate', 'tartrate', 'succinate', 'mesylate', 'fumarate', 'palmitate', 'stearate', 'estolate',
];

@Injectable()
export class PrescriptionsService implements OnModuleInit {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** An empty reference table means the dose check silently never runs — that must be loud. */
  async onModuleInit() {
    const count = await this.prisma.medicineDoseReference.count({ where: { isActive: true } });
    if (count === 0) {
      this.logger.error(
        'MedicineDoseReference has no active rows — the weight-based dose check will not run ' +
          'for any prescription until this table is populated from a licensed reference.',
      );
    }
  }

  async create(dto: CreatePrescriptionDto, doctorId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const { items, validUntil, ...rest } = dto;

    // Surface a potential allergy conflict rather than silently writing the Rx.
    const conflicts = this.findAllergyConflicts(patient.allergies, items);
    if (conflicts.length > 0) {
      throw new BadRequestException(
        `This patient is recorded as allergic to: ${conflicts.join(', ')}. ` +
          'Update the allergy list or prescribe an alternative.',
      );
    }

    // Weight-based dose check — only runs for items that provided a structured
    // dose (doseAmountMg + dosesPerDay); free-text-only items can't be checked.
    const doseViolations = await this.findDoseViolations(patient.id, patient.dateOfBirth, items);
    if (doseViolations.length > 0) {
      throw new BadRequestException(doseViolations.join(' '));
    }

    const prescription = await this.prisma.prescription.create({
      data: {
        ...rest,
        doctorId,
        validUntil: validUntil ? new Date(validUntil) : this.defaultValidUntil(items),
        items: { create: items },
      },
      include: { items: true, patient: PATIENT_SUMMARY, doctor: DOCTOR_SUMMARY },
    });

    this.logger.log(`Prescription issued for patient ${patient.mrn} (${items.length} items)`);
    return prescription;
  }

  async findAll(query: QueryPrescriptionsDto) {
    const { patientId, doctorId, status, skip, limit, page } = query;

    const where: Prisma.PrescriptionWhereInput = {
      ...(patientId ? { patientId } : {}),
      ...(doctorId ? { doctorId } : {}),
      ...(status ? { status } : {}),
    };

    const [prescriptions, total] = await this.prisma.$transaction([
      this.prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issuedAt: 'desc' },
        include: { items: true, patient: PATIENT_SUMMARY, doctor: DOCTOR_SUMMARY },
      }),
      this.prisma.prescription.count({ where }),
    ]);

    return paginate(prescriptions, total, page, limit);
  }

  async findOne(id: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        items: true,
        patient: { include: { guardians: { where: { isPrimary: true }, take: 1 } } },
        doctor: DOCTOR_SUMMARY,
        appointment: { select: { id: true, scheduledAt: true, diagnosis: true } },
      },
    });
    if (!prescription) throw new NotFoundException(`Prescription ${id} was not found`);
    return prescription;
  }

  async updateStatus(id: string, dto: UpdatePrescriptionStatusDto) {
    const existing = await this.prisma.prescription.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Prescription ${id} was not found`);

    if (existing.status !== PrescriptionStatusEnum.ACTIVE) {
      throw new BadRequestException(
        `This prescription is already ${existing.status.toLowerCase()}`,
      );
    }

    return this.prisma.prescription.update({
      where: { id },
      data: { status: dto.status },
      include: { items: true, patient: PATIENT_SUMMARY },
    });
  }

  /**
   * Replaces every item on a prescription and re-runs the allergy and dose
   * checks against the patient's current data — the check at create() time
   * never re-fires once a prescription exists, and this is the one path that
   * lets a corrected dose or a newer weight actually get re-evaluated.
   */
  async updateItems(id: string, dto: UpdatePrescriptionItemsDto) {
    const existing = await this.prisma.prescription.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!existing) throw new NotFoundException(`Prescription ${id} was not found`);

    if (existing.status !== PrescriptionStatusEnum.ACTIVE) {
      throw new BadRequestException(
        `Cannot edit medicines on a prescription that is already ${existing.status.toLowerCase()}`,
      );
    }

    const conflicts = this.findAllergyConflicts(existing.patient.allergies, dto.items);
    if (conflicts.length > 0) {
      throw new BadRequestException(
        `This patient is recorded as allergic to: ${conflicts.join(', ')}. ` +
          'Update the allergy list or prescribe an alternative.',
      );
    }

    const doseViolations = await this.findDoseViolations(
      existing.patientId,
      existing.patient.dateOfBirth,
      dto.items,
    );
    if (doseViolations.length > 0) {
      throw new BadRequestException(doseViolations.join(' '));
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.prescriptionItem.deleteMany({ where: { prescriptionId: id } });
      return tx.prescription.update({
        where: { id },
        data: { items: { create: dto.items } },
        include: { items: true, patient: PATIENT_SUMMARY, doctor: DOCTOR_SUMMARY },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.prescription.delete({ where: { id } });
    return { message: 'Prescription deleted' };
  }

  // ── helpers ────────────────────────────────────────────

  /** Case-insensitive substring match between the allergy list and prescribed names. */
  private findAllergyConflicts(
    allergies: string[],
    items: { medicineName: string; genericName?: string }[],
  ): string[] {
    if (!allergies?.length) return [];

    const hits = new Set<string>();
    for (const allergy of allergies) {
      const needle = allergy.toLowerCase().trim();
      if (!needle) continue;

      for (const item of items) {
        const haystack = `${item.medicineName} ${item.genericName ?? ''}`.toLowerCase();
        if (haystack.includes(needle)) hits.add(allergy);
      }
    }
    return [...hits];
  }

  /**
   * Checks structured doses (doseAmountMg + dosesPerDay) against
   * MedicineDoseReference, plus a same-item consistency check between the
   * printed `dosage` label and `doseAmountMg`. Items without a structured
   * dose, medicines without a reference entry, and reference tables with no
   * active rows are all skipped rather than blocked — this only rejects
   * what it can actually compute, it never invents a range.
   */
  private async findDoseViolations(
    patientId: string,
    patientDateOfBirth: Date,
    items: CreatePrescriptionItemDto[],
  ): Promise<string[]> {
    const violations: string[] = [];

    // The printed label and the checked value are separate fields — nothing
    // else reconciles them, so a mismatch here would otherwise pass a sound
    // check while dispensing a different number.
    for (const item of items) {
      if (item.doseAmountMg == null) continue;
      const printedMg = this.parseDosageMg(item.dosage);
      if (printedMg != null && Math.abs(printedMg - item.doseAmountMg) > 0.01) {
        violations.push(
          `${item.medicineName}: the printed dosage ("${item.dosage}") states ${printedMg}mg but the ` +
            `structured dose is recorded as ${item.doseAmountMg}mg — these must match.`,
        );
      }
    }

    const candidates = items.filter(
      (item): item is typeof item & { doseAmountMg: number; dosesPerDay: number } =>
        item.doseAmountMg != null && item.dosesPerDay != null,
    );
    if (candidates.length === 0) return violations;

    const references = await this.prisma.medicineDoseReference.findMany({ where: { isActive: true } });
    if (references.length === 0) {
      this.logger.warn(
        'Dose check skipped for a prescription — MedicineDoseReference has no active rows.',
      );
      return violations;
    }

    const latestVital = await this.prisma.vitalSign.findFirst({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      select: { weightKg: true, recordedAt: true },
    });

    let weightKg: number | null = null;
    let weightStaleDays: number | null = null;
    if (latestVital?.weightKg != null) {
      weightKg = latestVital.weightKg;
      const ageDays = (Date.now() - latestVital.recordedAt.getTime()) / 86_400_000;
      const staleAfterDays =
        this.ageInMonths(patientDateOfBirth) < INFANT_MAX_AGE_MONTHS
          ? INFANT_WEIGHT_STALENESS_DAYS
          : CHILD_WEIGHT_STALENESS_DAYS;
      if (ageDays > staleAfterDays) weightStaleDays = Math.round(ageDays);
    }

    const ageMonths = this.ageInMonths(patientDateOfBirth);

    for (const item of candidates) {
      const matches = this.matchReferences(references, item);
      if (matches.length === 0) continue;
      const reference = this.selectNarrowestReference(matches, ageMonths);
      if (!reference) continue; // named drug matched, but no row covers this patient's age

      if (weightKg == null) {
        violations.push(
          `${item.medicineName} is dosed by weight and this patient has no recorded weight — ` +
            'record a vital sign before prescribing.',
        );
        continue;
      }
      if (weightStaleDays != null) {
        violations.push(
          `${item.medicineName} is dosed by weight, but the most recent recorded weight is ` +
            `${weightStaleDays} days old — record a current weight before prescribing.`,
        );
        continue;
      }

      const dailyMg = item.doseAmountMg * item.dosesPerDay;
      const mgPerKgDay = dailyMg / weightKg;

      if (mgPerKgDay < reference.mgPerKgDayMin || mgPerKgDay > reference.mgPerKgDayMax) {
        violations.push(
          `${item.medicineName}: ${mgPerKgDay.toFixed(1)} mg/kg/day is outside the recommended ` +
            `${reference.mgPerKgDayMin}–${reference.mgPerKgDayMax} mg/kg/day range (${reference.source} ${reference.sourceVersion}).`,
        );
      }
      if (reference.maxSingleDoseMg != null && item.doseAmountMg > reference.maxSingleDoseMg) {
        violations.push(
          `${item.medicineName}: single dose of ${item.doseAmountMg}mg exceeds the maximum single dose of ${reference.maxSingleDoseMg}mg.`,
        );
      }
      if (reference.maxDailyDoseMg != null && dailyMg > reference.maxDailyDoseMg) {
        violations.push(
          `${item.medicineName}: total daily dose of ${dailyMg}mg exceeds the maximum daily dose of ${reference.maxDailyDoseMg}mg.`,
        );
      }
    }
    return violations;
  }

  /** Whole months elapsed since dateOfBirth, floored — never negative. */
  private ageInMonths(dateOfBirth: Date, at: Date = new Date()): number {
    let months = (at.getFullYear() - dateOfBirth.getFullYear()) * 12 + (at.getMonth() - dateOfBirth.getMonth());
    if (at.getDate() < dateOfBirth.getDate()) months -= 1;
    return Math.max(months, 0);
  }

  /** Pulls the mg figure out of a free-text dosage label, e.g. "250mg/5ml" → 250. */
  private parseDosageMg(dosage: string): number | null {
    const match = dosage.match(/(\d+(?:\.\d+)?)\s*mg\b/i);
    return match ? Number(match[1]) : null;
  }

  /** Lowercases, strips punctuation, and strips known salt/form suffixes. */
  private normalizeMedicineName(name: string): string {
    let normalized = name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const suffix of SALT_SUFFIXES) {
      normalized = normalized.replace(new RegExp(`\\b${suffix}\\b`, 'g'), ' ');
    }
    return normalized.replace(/\s+/g, ' ').trim();
  }

  /** All reference rows whose genericName or aliases match the item's name, ignoring salts/case/punctuation. */
  private matchReferences(
    references: MedicineDoseReference[],
    item: { medicineName: string; genericName?: string },
  ): MedicineDoseReference[] {
    const itemNames = [item.genericName, item.medicineName]
      .filter((n): n is string => !!n)
      .map((n) => this.normalizeMedicineName(n));

    return references.filter((ref) => {
      const refNames = [ref.genericName, ...ref.aliases].map((n) => this.normalizeMedicineName(n));
      return itemNames.some((name) => refNames.includes(name));
    });
  }

  /**
   * Among rows for the same drug, picks the one whose age band both covers
   * the patient and is narrowest — a row with explicit bounds is more
   * specific than the null-bound fallback, so it wins when both apply.
   */
  private selectNarrowestReference(
    matches: MedicineDoseReference[],
    ageMonths: number,
  ): MedicineDoseReference | null {
    const applicable = matches.filter(
      (ref) =>
        (ref.ageMinMonths == null || ageMonths >= ref.ageMinMonths) &&
        (ref.ageMaxMonths == null || ageMonths <= ref.ageMaxMonths),
    );
    if (applicable.length === 0) return null;

    return applicable.reduce((narrowest, ref) => {
      const width = (ref.ageMaxMonths ?? Infinity) - (ref.ageMinMonths ?? -Infinity);
      const narrowestWidth = (narrowest.ageMaxMonths ?? Infinity) - (narrowest.ageMinMonths ?? -Infinity);
      return width < narrowestWidth ? ref : narrowest;
    });
  }

  /** Valid until the longest course finishes, plus a week of slack. */
  private defaultValidUntil(items: { durationDays: number }[]): Date {
    const longest = Math.max(...items.map((i) => i.durationDays), 1);
    const date = new Date();
    date.setDate(date.getDate() + longest + 7);
    return date;
  }
}
