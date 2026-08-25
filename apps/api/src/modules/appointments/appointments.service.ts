import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException, Logger,
} from '@nestjs/common';
import { Prisma } from '@peditrack/database';
import { calculateBMI } from '@peditrack/utils';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppointmentDto, AppointmentStatusEnum } from './dto/create-appointment.dto';
import { UpdateAppointmentDto, UpdateStatusDto } from './dto/update-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { CreateVitalSignsDto } from './dto/vital-signs.dto';
import { CreateMedicalNoteDto } from './dto/medical-note.dto';
import { paginate } from '../../common/dto/pagination.dto';

const PATIENT_SUMMARY = {
  select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, allergies: true },
} as const;

const DOCTOR_SUMMARY = {
  select: { id: true, firstName: true, lastName: true, specialty: true },
} as const;

// SEC-008 fix: define which roles may transition to each target status.
// This prevents a RECEPTIONIST from marking a visit COMPLETED, or any user
// from moving an appointment backward to PENDING without admin privileges.
const STATUS_TRANSITION_ROLES: Record<string, string[]> = {
  [AppointmentStatusEnum.CONFIRMED]:   ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  [AppointmentStatusEnum.IN_PROGRESS]: ['ADMIN', 'DOCTOR', 'NURSE'],
  [AppointmentStatusEnum.COMPLETED]:   ['ADMIN', 'DOCTOR'],
  [AppointmentStatusEnum.CANCELLED]:   ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  [AppointmentStatusEnum.NO_SHOW]:     ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  [AppointmentStatusEnum.PENDING]:     ['ADMIN'],  // reverting to PENDING is admin-only
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAppointmentDto) {
    const scheduledAt = new Date(dto.scheduledAt);
    const duration = dto.durationMinutes ?? 30;

    const [patient, doctor] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: dto.patientId, deletedAt: null } }),
      // SEC-009 fix: verify the assigned user holds a clinical role.
      // Assigning a RECEPTIONIST or NURSE as the responsible "doctor" on a
      // prescription or visit creates a liability and HIPAA documentation issue.
      this.prisma.user.findFirst({
        where: {
          id: dto.doctorId,
          isActive: true,
          role: { in: ['DOCTOR', 'ADMIN'] },
        },
      }),
    ]);

    if (!patient) throw new NotFoundException('Patient not found');
    if (!doctor) throw new NotFoundException('Doctor not found or the assigned user does not hold a DOCTOR / ADMIN role');

    await this.assertSlotFree(dto.doctorId, scheduledAt, duration);

    const appointment = await this.prisma.appointment.create({
      data: { ...dto, scheduledAt, durationMinutes: duration },
      include: { patient: PATIENT_SUMMARY, doctor: DOCTOR_SUMMARY },
    });

    this.logger.log(`Appointment booked for patient ${patient.mrn} on ${scheduledAt.toISOString()}`);
    return appointment;
  }

  async findAll(query: QueryAppointmentsDto) {
    const { status, type, patientId, doctorId, from, to, skip, limit, page, sortBy, sortOrder } = query;

    const where: Prisma.AppointmentWhereInput = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(patientId ? { patientId } : {}),
      ...(doctorId ? { doctorId } : {}),
      ...(from || to
        ? {
            scheduledAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: this.endOfDay(to) } : {}),
            },
          }
        : {}),
    };

    const [appointments, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: sortBy ? { [sortBy]: sortOrder } : { scheduledAt: 'asc' },
        include: { patient: PATIENT_SUMMARY, doctor: DOCTOR_SUMMARY, vitalSign: true },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return paginate(appointments, total, page, limit);
  }

  async findOne(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { include: { guardians: { where: { isPrimary: true }, take: 1 } } },
        doctor: DOCTOR_SUMMARY,
        vitalSign: true,
        prescriptions: { include: { items: true } },
        medicalNotes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { id: true, firstName: true, lastName: true } } },
        },
        vaccinations: { include: { vaccine: true } },
      },
    });

    if (!appointment) throw new NotFoundException(`Appointment ${id} was not found`);
    return appointment;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const existing = await this.assertExists(id);

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new BadRequestException(
        `A ${existing.status.toLowerCase()} appointment can no longer be edited`,
      );
    }

    // Rescheduling needs a fresh conflict check against the doctor's calendar.
    if (dto.scheduledAt || dto.doctorId || dto.durationMinutes) {
      // SEC-009 fix: also validate the new doctor's role when rescheduling.
      if (dto.doctorId) {
        const newDoctor = await this.prisma.user.findFirst({
          where: { id: dto.doctorId, isActive: true, role: { in: ['DOCTOR', 'ADMIN'] } },
        });
        if (!newDoctor) {
          throw new NotFoundException('Assigned user does not hold a DOCTOR / ADMIN role');
        }
      }

      const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : existing.scheduledAt;
      const doctorId = dto.doctorId ?? existing.doctorId;
      const duration = dto.durationMinutes ?? existing.durationMinutes;
      await this.assertSlotFree(doctorId, scheduledAt, duration, id);
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { ...dto, ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}) },
      include: { patient: PATIENT_SUMMARY, doctor: DOCTOR_SUMMARY },
    });
  }

  /**
   * Status transitions also stamp the matching timestamp column.
   *
   * SEC-008 fix: the caller's role is validated against the allowed-roles
   * matrix before any database write.  The controller injects @CurrentUser()
   * and passes user.role here so the service doesn't need to re-fetch it.
   */
  async updateStatus(id: string, dto: UpdateStatusDto, callerRole: string) {
    await this.assertExists(id);

    const allowedRoles = STATUS_TRANSITION_ROLES[dto.status] ?? [];
    if (!allowedRoles.includes(callerRole)) {
      throw new ForbiddenException(
        `Your role (${callerRole}) is not permitted to move an appointment to ${dto.status}`,
      );
    }

    const now = new Date();
    const timestamps: Record<string, Prisma.AppointmentUpdateInput> = {
      [AppointmentStatusEnum.CONFIRMED]:   {},
      [AppointmentStatusEnum.IN_PROGRESS]: { startedAt: now, checkedInAt: now },
      [AppointmentStatusEnum.COMPLETED]:   { completedAt: now },
      [AppointmentStatusEnum.CANCELLED]:   { cancelledAt: now, cancellationReason: dto.cancellationReason },
      [AppointmentStatusEnum.NO_SHOW]:     {},
      [AppointmentStatusEnum.PENDING]:     {},
    };

    if (dto.status === AppointmentStatusEnum.CANCELLED && !dto.cancellationReason) {
      throw new BadRequestException('A cancellation reason is required');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: dto.status, ...timestamps[dto.status] },
      include: { patient: PATIENT_SUMMARY, doctor: DOCTOR_SUMMARY },
    });
  }

  /** Vitals are one-per-visit — recording again overwrites the existing row. */
  async recordVitals(appointmentId: string, dto: CreateVitalSignsDto, recordedById: string) {
    const appointment = await this.assertExists(appointmentId);
    const bmi = calculateBMI(dto.weightKg, dto.heightCm);

    return this.prisma.vitalSign.upsert({
      where: { appointmentId },
      create: {
        ...dto,
        appointmentId,
        patientId: appointment.patientId,
        recordedById,
        bmi,
        recordedAt: new Date(),
      },
      update: { ...dto, bmi, recordedAt: new Date() },
    });
  }

  async addNote(appointmentId: string, dto: CreateMedicalNoteDto, authorId: string) {
    const appointment = await this.assertExists(appointmentId);

    return this.prisma.medicalNote.create({
      data: { ...dto, appointmentId, patientId: appointment.patientId, authorId },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.appointment.delete({ where: { id } });
    return { message: 'Appointment deleted successfully' };
  }

  // ── helpers ────────────────────────────────────────────

  private async assertExists(id: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException(`Appointment ${id} was not found`);
    return appointment;
  }

  /**
   * Rejects a booking that overlaps an existing active appointment for the same
   * doctor. Two appointments overlap when each starts before the other ends.
   */
  private async assertSlotFree(
    doctorId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeId?: string,
  ) {
    const end = new Date(scheduledAt.getTime() + durationMinutes * 60_000);

    const sameDay = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        scheduledAt: {
          gte: this.startOfDay(scheduledAt),
          lte: this.endOfDay(scheduledAt),
        },
      },
      select: { id: true, scheduledAt: true, durationMinutes: true },
    });

    const clash = sameDay.find((a) => {
      const aEnd = new Date(a.scheduledAt.getTime() + a.durationMinutes * 60_000);
      return scheduledAt < aEnd && a.scheduledAt < end;
    });

    if (clash) {
      throw new ConflictException(
        'The doctor already has an appointment that overlaps this time slot',
      );
    }
  }

  private startOfDay(d: Date | string) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(d: Date | string) {
    const date = new Date(d);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}
