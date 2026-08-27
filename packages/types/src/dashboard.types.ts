import type { Appointment } from './appointment.types';
import type { Patient } from './patient.types';

export interface DashboardStats {
  totalPatients: number;
  newPatientsThisMonth: number;
  appointmentsToday: number;
  appointmentsThisWeek: number;
  pendingAppointments: number;
  completedToday: number;
  vaccinesDueSoon: number;
  vaccinesOverdue: number;
  screeningsDueSoon: number;
  screeningsOverdue: number;
  activePrescriptions: number;
}

export interface DashboardOverview {
  stats: DashboardStats;
  upcomingAppointments: Appointment[];
  recentPatients: Patient[];
}
