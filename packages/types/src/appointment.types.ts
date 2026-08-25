import type { Patient } from './patient.types';
import type { AuthUser } from './auth.types';

export type AppointmentType =
  | 'CHECKUP' | 'FOLLOW_UP' | 'VACCINATION'
  | 'SICK_VISIT' | 'CONSULTATION' | 'EMERGENCY';

export type AppointmentStatus =
  | 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS'
  | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface VitalSign {
  id: string;
  appointmentId: string;
  patientId: string;
  weightKg?: number | null;
  heightCm?: number | null;
  headCircumference?: number | null;
  temperatureC?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  bloodPressureSys?: number | null;
  bloodPressureDia?: number | null;
  bmi?: number | null;
  recordedAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  durationMinutes: number;
  type: AppointmentType;
  status: AppointmentStatus;
  chiefComplaint?: string | null;
  diagnosis?: string | null;
  reasonForVisit?: string | null;
  checkedInAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: Patient;
  doctor?: AuthUser;
  vitalSign?: VitalSign | null;
}
