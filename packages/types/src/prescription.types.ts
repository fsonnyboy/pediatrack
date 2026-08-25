import type { Patient } from './patient.types';
import type { AuthUser } from './auth.types';

export type PrescriptionStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  medicineName: string;
  genericName?: string | null;
  dosage: string;
  form?: string | null;
  frequency: string;
  durationDays: number;
  quantity?: string | null;
  instructions?: string | null;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string | null;
  status: PrescriptionStatus;
  notes?: string | null;
  issuedAt: string;
  validUntil?: string | null;
  items: PrescriptionItem[];
  patient?: Patient;
  doctor?: AuthUser;
}
