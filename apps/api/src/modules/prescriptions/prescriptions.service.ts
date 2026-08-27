import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@peditrack/database';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePrescriptionDto, UpdatePrescriptionStatusDto, PrescriptionStatusEnum,
} from './dto/create-prescription.dto';
import { QueryPrescriptionsDto } from './dto/query-prescriptions.dto';
import { paginate } from '../../common/dto/pagination.dto';

const PATIENT_SUMMARY = {
  select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true, allergies: true },
} as const;

const DOCTOR_SUMMARY = {
  select: { id: true, firstName: true, lastName: true, licenseNumber: true, specialty: true },
} as const;

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    const doseViolations = await this.findDoseViolations(patient.id, items);
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
   * MedicineDoseReference. Items without both fields, medicines without a
   * reference entry, and reference tables with no active rows are all
   * skipped rather than blocked — this only rejects what it can actually
   * compute, it never invents a range.
   */
  private async findDoseViolations(
    patientId: string,
    items: { medicineName: string; genericName?: string; doseAmountMg?: number; dosesPerDay?: number }[],
  ): Promise<string[]> {
    const candidates = items.filter(
      (item): item is typeof item & { doseAmountMg: number; dosesPerDay: number } =>
        item.doseAmountMg != null && item.dosesPerDay != null,
    );
    if (candidates.length === 0) return [];

    const references = await this.prisma.medicineDoseReference.findMany({ where: { isActive: true } });
    if (references.length === 0) return [];

    const latestVital = await this.prisma.vitalSign.findFirst({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      select: { weightKg: true },
    });
    const weightKg = latestVital?.weightKg ?? null;

    const violations: string[] = [];
    for (const item of candidates) {
      const nameMatch = (name?: string) => name?.toLowerCase().trim();
      const reference = references.find(
        (ref) =>
          ref.genericName.toLowerCase() === nameMatch(item.genericName) ||
          ref.genericName.toLowerCase() === nameMatch(item.medicineName),
      );
      if (!reference) continue;

      if (weightKg == null) {
        violations.push(
          `${item.medicineName} is dosed by weight and this patient has no recorded weight — ` +
            'record a vital sign before prescribing.',
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

  /** Valid until the longest course finishes, plus a week of slack. */
  private defaultValidUntil(items: { durationDays: number }[]): Date {
    const longest = Math.max(...items.map((i) => i.durationDays), 1);
    const date = new Date();
    date.setDate(date.getDate() + longest + 7);
    return date;
  }
}
