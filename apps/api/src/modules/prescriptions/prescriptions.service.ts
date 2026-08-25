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

  /** Valid until the longest course finishes, plus a week of slack. */
  private defaultValidUntil(items: { durationDays: number }[]): Date {
    const longest = Math.max(...items.map((i) => i.durationDays), 1);
    const date = new Date();
    date.setDate(date.getDate() + longest + 7);
    return date;
  }
}
