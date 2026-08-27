import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@peditrack/database';
import { randomBytes } from 'crypto';
import { calculateAge, generateMRN, calculateBMI, calculateGrowthPercentiles } from '@peditrack/utils';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { QueryPatientsDto } from './dto/query-patients.dto';
import { paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreatePatientDto, requestingUserId: string) {
    const mrn = await this.nextMRN();
    const { guardians, ...patientData } = dto;

    const patient = await this.prisma.patient.create({
      data: {
        ...patientData,
        mrn,
        dateOfBirth: new Date(dto.dateOfBirth),
        allergies: dto.allergies ?? [],
        chronicConditions: dto.chronicConditions ?? [],
        ...(guardians?.length
          ? {
              guardians: {
                create: guardians.map((g, i) => ({
                  ...g,
                  isPrimary: g.isPrimary ?? i === 0,
                  isEmergencyContact: g.isEmergencyContact ?? i === 0,
                })),
              },
            }
          : {}),
      },
      include: { guardians: true },
    });

    // SEC-016 fix: audit PHI creation.
    await this.audit.log({
      userId: requestingUserId,
      action: 'CREATE',
      entity: 'Patient',
      entityId: patient.id,
      detail: `MRN: ${patient.mrn}`,
    });

    this.logger.log(`Patient created: ${patient.mrn}`);
    return this.withAge(patient);
  }

  async findAll(query: QueryPatientsDto, requestingUserId: string) {
    const { search, gender, ageGroup, skip, limit, page, sortBy, sortOrder } = query;

    const where: Prisma.PatientWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(gender ? { gender } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { mrn: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(ageGroup ? { dateOfBirth: this.ageGroupRange(ageGroup) } : {}),
    };

    // SEC-010 fix: sortBy is validated by @IsIn() in QueryPatientsDto — safe to use as key.
    const orderBy: Prisma.PatientOrderByWithRelationInput = sortBy
      ? { [sortBy]: sortOrder ?? 'desc' }
      : { createdAt: 'desc' };

    const [patients, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          guardians: { where: { isPrimary: true }, take: 1 },
          _count: { select: { appointments: true, vaccinationRecords: true } },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    // SEC-016 fix: audit list access (bulk PHI read).
    await this.audit.log({
      userId: requestingUserId,
      action: 'READ',
      entity: 'Patient',
      detail: `list query — ${total} results`,
    });

    return paginate(patients.map((p) => this.withAge(p)), total, page, limit);
  }

  async findOne(id: string, requestingUserId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, deletedAt: null },
      include: {
        guardians: { orderBy: { isPrimary: 'desc' } },
        _count: {
          select: { appointments: true, vaccinationRecords: true, prescriptions: true },
        },
      },
    });

    if (!patient) throw new NotFoundException(`Patient ${id} was not found`);

    // SEC-016 fix: audit individual PHI read access.
    await this.audit.log({
      userId: requestingUserId,
      action: 'READ',
      entity: 'Patient',
      entityId: id,
    });

    return this.withAge(patient);
  }

  async update(id: string, dto: UpdatePatientDto, requestingUserId: string) {
    await this.assertExists(id);

    const patient = await this.prisma.patient.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
      },
      include: { guardians: true },
    });

    await this.audit.log({
      userId: requestingUserId,
      action: 'UPDATE',
      entity: 'Patient',
      entityId: id,
    });

    return this.withAge(patient);
  }

  /** Soft delete — clinical records must remain auditable. */
  async remove(id: string, requestingUserId: string) {
    await this.assertExists(id);
    await this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      userId: requestingUserId,
      action: 'DELETE',
      entity: 'Patient',
      entityId: id,
    });

    return { message: 'Patient archived successfully' };
  }

  async getAppointments(id: string, requestingUserId: string) {
    await this.assertExists(id);

    await this.audit.log({
      userId: requestingUserId,
      action: 'READ',
      entity: 'Appointment',
      detail: `via patient ${id}`,
    });

    return this.prisma.appointment.findMany({
      where: { patientId: id },
      orderBy: { scheduledAt: 'desc' },
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        vitalSign: true,
      },
    });
  }

  async getVaccinations(id: string, requestingUserId: string) {
    await this.assertExists(id);

    await this.audit.log({
      userId: requestingUserId,
      action: 'READ',
      entity: 'VaccinationRecord',
      detail: `via patient ${id}`,
    });

    return this.prisma.vaccinationRecord.findMany({
      where: { patientId: id },
      orderBy: { administeredAt: 'desc' },
      include: {
        vaccine: true,
        administeredBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getScreenings(id: string, requestingUserId: string) {
    await this.assertExists(id);

    await this.audit.log({
      userId: requestingUserId,
      action: 'READ',
      entity: 'ScreeningAdministration',
      detail: `via patient ${id}`,
    });

    return this.prisma.screeningAdministration.findMany({
      where: { patientId: id },
      orderBy: { administeredAt: 'desc' },
      include: {
        instrument: true,
        referral: true,
        administeredBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getPrescriptions(id: string, requestingUserId: string) {
    await this.assertExists(id);

    await this.audit.log({
      userId: requestingUserId,
      action: 'READ',
      entity: 'Prescription',
      detail: `via patient ${id}`,
    });

    return this.prisma.prescription.findMany({
      where: { patientId: id },
      orderBy: { issuedAt: 'desc' },
      include: {
        items: true,
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getGrowthChart(id: string, requestingUserId: string) {
    const patient = await this.assertExists(id);

    await this.audit.log({
      userId: requestingUserId,
      action: 'READ',
      entity: 'VitalSign',
      detail: `growth chart for patient ${id}`,
    });

    const vitals = await this.prisma.vitalSign.findMany({
      where: { patientId: id },
      orderBy: { recordedAt: 'asc' },
      select: {
        recordedAt: true, weightKg: true, heightCm: true,
        headCircumference: true, bmi: true,
      },
    });

    /**
     * The Prisma model field is `gender` (enum Gender: MALE | FEMALE | OTHER).
     * WHO 2006 publishes separate standards for boys and girls only, so OTHER
     * is charted against the boys' standard and flagged via `sexInferred` so
     * the UI can surface a caveat rather than silently implying a match.
     */
    const sex: 'MALE' | 'FEMALE' = patient.gender === 'FEMALE' ? 'FEMALE' : 'MALE';
    const sexInferred = patient.gender !== 'MALE' && patient.gender !== 'FEMALE';

    const toPoint = (v: {
      recordedAt: Date;
      weightKg: number | null;
      heightCm: number | null;
      headCircumference: number | null;
      bmi: number | null;
    }, ageMonths: number) => {
      const bmi = v.bmi ?? calculateBMI(v.weightKg, v.heightCm);
      const percentiles = calculateGrowthPercentiles(
        {
          weightKg: v.weightKg ?? undefined,
          heightCm: v.heightCm ?? undefined,
          headCircumference: v.headCircumference ?? undefined,
          bmi: bmi ?? undefined,
        },
        sex,
        ageMonths,
      );
      return {
        recordedAt: v.recordedAt,
        ageMonths,
        weightKg: v.weightKg,
        heightCm: v.heightCm,
        headCircumference: v.headCircumference,
        bmi,
        percentiles,
      };
    };

    const points = vitals.map((v) =>
      toPoint(v, calculateAge(patient.dateOfBirth, v.recordedAt).totalMonths),
    );

    if (patient.birthWeightKg || patient.birthHeightCm) {
      points.unshift(
        toPoint(
          {
            recordedAt: patient.dateOfBirth,
            weightKg: patient.birthWeightKg ?? null,
            heightCm: patient.birthHeightCm ?? null,
            headCircumference: null,
            bmi: null,
          },
          0,
        ),
      );
    }

    return {
      patientId: id,
      sex,
      sexInferred,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth,
      points,
    };
  }

  async getMedicalNotes(id: string, requestingUserId: string) {
    await this.assertExists(id);

    await this.audit.log({
      userId: requestingUserId,
      action: 'READ',
      entity: 'MedicalNote',
      detail: `via patient ${id}`,
    });

    return this.prisma.medicalNote.findMany({
      where: { patientId: id },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
  }

  // ── helpers ────────────────────────────────────────────

  private async assertExists(id: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) throw new NotFoundException(`Patient ${id} was not found`);
    return patient;
  }

  private withAge<T extends { dateOfBirth: Date }>(patient: T) {
    return { ...patient, age: calculateAge(patient.dateOfBirth) };
  }

  /**
   * Sequential MRN scoped to the current year, with a 4-hex-char random suffix.
   *
   * SEC-022 fix: appends randomBytes(2).toString('hex') so that knowing one MRN
   * does not allow an attacker to enumerate the sequential component and predict
   * (or iterate through) other patient records.
   * Example: PT-2026-00007-A3F2
   */
  private async nextMRN(): Promise<string> {
    const year = new Date().getFullYear();
    const latest = await this.prisma.patient.findFirst({
      where: { mrn: { startsWith: `PT-${year}-` } },
      orderBy: { mrn: 'desc' },
      select: { mrn: true },
    });

    // Extract the sequence portion only (position 2 after splitting on '-').
    const lastSeq = latest ? Number(latest.mrn.split('-')[2]) : 0;
    const base = generateMRN(lastSeq + 1, year);
    const suffix = randomBytes(2).toString('hex').toUpperCase();
    return `${base}-${suffix}`;
  }

  private ageGroupRange(group: string): Prisma.DateTimeFilter {
    const monthsAgo = (m: number) => {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      return d;
    };

    switch (group) {
      case 'infant':     return { gt: monthsAgo(12) };
      case 'toddler':    return { gt: monthsAgo(36), lte: monthsAgo(12) };
      case 'preschool':  return { gt: monthsAgo(60), lte: monthsAgo(36) };
      case 'school':     return { gt: monthsAgo(144), lte: monthsAgo(60) };
      case 'adolescent': return { gt: monthsAgo(216), lte: monthsAgo(144) };
      default:           return {};
    }
  }
}
