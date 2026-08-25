import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@peditrack/database';
import { calculateAge } from '@peditrack/utils';

import { PrismaService } from '../../prisma/prisma.service';
import { VaccinationsService } from '../vaccinations/vaccinations.service';

/**
 * SEC-021 fix: cap the ?days parameter on getUpcoming() at 30 days.
 *
 * The original implementation accepted an unbounded integer. A RECEPTIONIST
 * calling ?days=3650 would receive a bulk export of 10 years of upcoming
 * appointments, including full patient demographics (name, DOB, MRN).
 * The take:50 was applied after the date filter, not before.
 *
 * The fix:
 *   1. Hard cap of UPCOMING_MAX_DAYS (30).
 *   2. Receptionist-facing projection strips patient demographics — they
 *      receive only scheduling data (time, doctor, appointment type).
 *      Clinical staff (DOCTOR, NURSE, ADMIN) continue to receive full data.
 */
const UPCOMING_MAX_DAYS = 30;

/** Scheduling-only projection — no patient demographics. */
const SCHEDULING_SELECT = {
  id: true,
  scheduledAt: true,
  type: true,
  status: true,
  chiefComplaint: true,
  durationMinutes: true,
  doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
} as const;

/** Clinical projection — full patient summary included. */
const CLINICAL_INCLUDE = {
  patient: {
    select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true },
  },
  doctor: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vaccinations: VaccinationsService,
  ) {}

  async getStats() {
    const { todayStart, todayEnd, weekEnd, monthStart } = this.boundaries();

    const [
      totalPatients,
      newPatientsThisMonth,
      appointmentsToday,
      appointmentsThisWeek,
      pendingAppointments,
      completedToday,
      activePrescriptions,
      dueVaccines,
    ] = await Promise.all([
      this.prisma.patient.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.patient.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } }),
      this.prisma.appointment.count({
        where: { scheduledAt: { gte: todayStart, lte: todayEnd }, status: { notIn: ['CANCELLED'] } },
      }),
      this.prisma.appointment.count({
        where: { scheduledAt: { gte: todayStart, lte: weekEnd }, status: { notIn: ['CANCELLED'] } },
      }),
      this.prisma.appointment.count({ where: { status: 'PENDING' } }),
      this.prisma.appointment.count({
        where: { status: 'COMPLETED', completedAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.prescription.count({ where: { status: 'ACTIVE' } }),
      this.vaccinations.dueSoon(30), // fixed 30-day window — already capped inside dueSoon()
    ]);

    return {
      totalPatients,
      newPatientsThisMonth,
      appointmentsToday,
      appointmentsThisWeek,
      pendingAppointments,
      completedToday,
      vaccinesDueSoon: dueVaccines.filter((v) => !v.isOverdue).length,
      vaccinesOverdue: dueVaccines.filter((v) => v.isOverdue).length,
      activePrescriptions,
    };
  }

  /**
   * Appointments from now through the end of the given window.
   *
   * SEC-021 fix:
   *   - `days` is capped at UPCOMING_MAX_DAYS (30).
   *   - `callerRole` controls which patient fields are returned:
   *       RECEPTIONIST  →  scheduling data only (no demographics)
   *       DOCTOR/NURSE/ADMIN  →  full patient summary
   *
   * Pass the requesting user's role from the controller via @CurrentUser().
   */
  async getUpcoming(days = 7, callerRole = 'RECEPTIONIST') {
    // SEC-021 fix: hard cap prevents bulk-export abuse.
    const safeDays = Math.min(Math.max(1, days), UPCOMING_MAX_DAYS);

    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + safeDays);
    to.setHours(23, 59, 59, 999);

    const isClinical = ['ADMIN', 'DOCTOR', 'NURSE'].includes(callerRole);

    const common = {
      where: {
        scheduledAt: { gte: from, lte: to },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
      orderBy: { scheduledAt: 'asc' as const },
      take: 50,
    };

    // SEC-021 fix: receptionists get scheduling-only data, not patient demographics.
    // Two concrete calls rather than a conditional spread — Prisma's generated
    // types model `include` and `select` as mutually exclusive overloads, so a
    // spread that could supply either fails to resolve to a single signature.
    return isClinical
      ? this.prisma.appointment.findMany({ ...common, include: CLINICAL_INCLUDE })
      : this.prisma.appointment.findMany({ ...common, select: SCHEDULING_SELECT });
  }

  async getRecentPatients(limit = 8) {
    const patients = await this.prisma.patient.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        guardians: { where: { isPrimary: true }, take: 1 },
        appointments: { orderBy: { scheduledAt: 'desc' }, take: 1, select: { scheduledAt: true, status: true } },
      },
    });

    return patients.map((p) => ({ ...p, age: calculateAge(p.dateOfBirth) }));
  }

  /** Today's schedule, grouped by status so the front desk can triage at a glance. */
  async getTodaySchedule() {
    const { todayStart, todayEnd } = this.boundaries();

    const appointments = await this.prisma.appointment.findMany({
      where: { scheduledAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { scheduledAt: 'asc' },
      include: {
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return {
      total: appointments.length,
      byStatus: {
        pending: appointments.filter((a) => a.status === 'PENDING'),
        confirmed: appointments.filter((a) => a.status === 'CONFIRMED'),
        inProgress: appointments.filter((a) => a.status === 'IN_PROGRESS'),
        completed: appointments.filter((a) => a.status === 'COMPLETED'),
      },
      appointments,
    };
  }

  async getOverview(callerRole = 'RECEPTIONIST') {
    const [stats, upcomingAppointments, recentPatients] = await Promise.all([
      this.getStats(),
      this.getUpcoming(7, callerRole),
      this.getRecentPatients(5),
    ]);
    return { stats, upcomingAppointments, recentPatients };
  }

  private boundaries() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return { todayStart, todayEnd, weekEnd, monthStart };
  }
}
