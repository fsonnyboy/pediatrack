import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@peditrack/database';
import { daysUntilDue } from '@peditrack/utils';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { QueryVaccinationsDto } from './dto/query-vaccinations.dto';
import { paginate } from '../../common/dto/pagination.dto';

const PATIENT_SUMMARY = {
  select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true },
} as const;

/**
 * SEC-020 fix: maximum window accepted for the due-soon query.
 *
 * An unbounded ?days parameter causes a full table scan of all vaccination
 * records (days=999999 sets a horizon year 4745 in the future), followed by
 * an N+1 query per result row.  This is a trivially exploitable DoS with a
 * single authenticated request.
 *
 * The hard cap of 365 days is enforced both here and via @Max(365) on the
 * query DTO so that invalid values are rejected before reaching the service.
 */
const DUE_SOON_MAX_DAYS = 365;

@Injectable()
export class VaccinationsService {
  private readonly logger = new Logger(VaccinationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Vaccine catalogue ──────────────────────────────────

  listVaccines() {
    return this.prisma.vaccine.findMany({
      where: { isActive: true },
      orderBy: [{ recommendedAgeMonths: 'asc' }, { name: 'asc' }],
    });
  }

  // ── Records ────────────────────────────────────────────

  async create(dto: CreateVaccinationDto, administeredById: string) {
    const [patient, vaccine] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: dto.patientId, deletedAt: null } }),
      this.prisma.vaccine.findUnique({ where: { id: dto.vaccineId } }),
    ]);

    if (!patient) throw new NotFoundException('Patient not found');
    if (!vaccine) throw new NotFoundException('Vaccine not found');

    const administeredAt = new Date(dto.administeredAt);
    const doseNumber = dto.doseNumber ?? (await this.nextDoseNumber(dto.patientId, dto.vaccineId));

    let nextDueDate: Date | null = dto.nextDueDate ? new Date(dto.nextDueDate) : null;
    if (!nextDueDate && vaccine.intervalDays && doseNumber < vaccine.totalDoses) {
      nextDueDate = new Date(administeredAt);
      nextDueDate.setDate(nextDueDate.getDate() + vaccine.intervalDays);
    }

    const record = await this.prisma.vaccinationRecord.create({
      data: {
        ...dto,
        doseNumber,
        administeredById,
        administeredAt,
        nextDueDate,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
      include: {
        vaccine: true,
        patient: PATIENT_SUMMARY,
        administeredBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(`${vaccine.code} dose ${doseNumber} recorded for patient ${patient.mrn}`);
    return record;
  }

  async findAll(query: QueryVaccinationsDto) {
    const { patientId, vaccineId, from, to, skip, limit, page } = query;

    const where: Prisma.VaccinationRecordWhereInput = {
      ...(patientId ? { patientId } : {}),
      ...(vaccineId ? { vaccineId } : {}),
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
      this.prisma.vaccinationRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { administeredAt: 'desc' },
        include: {
          vaccine: true,
          patient: PATIENT_SUMMARY,
          administeredBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.vaccinationRecord.count({ where }),
    ]);

    return paginate(records, total, page, limit);
  }

  async findOne(id: string) {
    const record = await this.prisma.vaccinationRecord.findUnique({
      where: { id },
      include: {
        vaccine: true,
        patient: PATIENT_SUMMARY,
        administeredBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!record) throw new NotFoundException(`Vaccination record ${id} was not found`);
    return record;
  }

  async update(id: string, dto: UpdateVaccinationDto) {
    await this.findOne(id);
    return this.prisma.vaccinationRecord.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.administeredAt ? { administeredAt: new Date(dto.administeredAt) } : {}),
        ...(dto.nextDueDate ? { nextDueDate: new Date(dto.nextDueDate) } : {}),
        ...(dto.expiryDate ? { expiryDate: new Date(dto.expiryDate) } : {}),
      },
      include: { vaccine: true, patient: PATIENT_SUMMARY },
    });
  }

  /**
   * Doses coming due inside the window, plus anything already overdue.
   * Sorted so the most overdue patients surface first.
   *
   * SEC-020 fix: the `days` parameter is clamped to [1, DUE_SOON_MAX_DAYS].
   * The @Min/@Max decorators on the DTO reject values outside this range before
   * the service is called, but we defensively clamp here as well so that direct
   * service calls (e.g. from DashboardService.getStats()) are also safe.
   */
  async dueSoon(days = 30) {
    // Defensive clamp — DTO validation is the primary guard.
    const safeDays = Math.min(Math.max(1, days), DUE_SOON_MAX_DAYS);

    const horizon = new Date();
    horizon.setDate(horizon.getDate() + safeDays);
    horizon.setHours(23, 59, 59, 999);

    const records = await this.prisma.vaccinationRecord.findMany({
      where: {
        nextDueDate: { not: null, lte: horizon },
        patient: { deletedAt: null, isActive: true },
      },
      include: { vaccine: true, patient: PATIENT_SUMMARY },
      orderBy: { nextDueDate: 'asc' },
    });

    // Drop any dose that has since been administered (N+1 — acceptable at ≤365 days).
    const results = [];
    for (const r of records) {
      const nextDose = r.doseNumber + 1;
      const alreadyGiven = await this.prisma.vaccinationRecord.findUnique({
        where: {
          patientId_vaccineId_doseNumber: {
            patientId: r.patientId,
            vaccineId: r.vaccineId,
            doseNumber: nextDose,
          },
        },
        select: { id: true },
      });
      if (alreadyGiven) continue;

      const remaining = daysUntilDue(r.nextDueDate!);
      results.push({
        patient: r.patient,
        vaccine: { id: r.vaccine.id, code: r.vaccine.code, name: r.vaccine.name },
        doseNumber: nextDose,
        dueDate: r.nextDueDate,
        daysUntilDue: remaining,
        daysOverdue: remaining < 0 ? Math.abs(remaining) : 0,
        isOverdue: remaining < 0,
      });
    }

    return results.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  /**
   * A patient's full immunization card: every catalogued vaccine with the doses
   * given so far and what remains outstanding.
   */
  async patientSchedule(patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const [vaccines, records] = await Promise.all([
      this.prisma.vaccine.findMany({
        where: { isActive: true },
        orderBy: { recommendedAgeMonths: 'asc' },
      }),
      this.prisma.vaccinationRecord.findMany({
        where: { patientId },
        orderBy: { doseNumber: 'asc' },
      }),
    ]);

    return vaccines.map((vaccine) => {
      const given = records.filter((r) => r.vaccineId === vaccine.id);
      const latest = given[given.length - 1];

      return {
        vaccine,
        dosesGiven: given.length,
        dosesRemaining: Math.max(0, vaccine.totalDoses - given.length),
        isComplete: given.length >= vaccine.totalDoses,
        records: given,
        nextDueDate: latest?.nextDueDate ?? null,
      };
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.vaccinationRecord.delete({ where: { id } });
    return { message: 'Vaccination record deleted' };
  }

  private async nextDoseNumber(patientId: string, vaccineId: string): Promise<number> {
    const last = await this.prisma.vaccinationRecord.findFirst({
      where: { patientId, vaccineId },
      orderBy: { doseNumber: 'desc' },
      select: { doseNumber: true },
    });
    return (last?.doseNumber ?? 0) + 1;
  }
}
