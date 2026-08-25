import type { Patient } from './patient.types';
export interface Vaccine {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    manufacturer?: string | null;
    totalDoses: number;
    recommendedAgeMonths?: number | null;
    intervalDays?: number | null;
    isActive: boolean;
}
export interface VaccinationRecord {
    id: string;
    patientId: string;
    vaccineId: string;
    administeredById: string;
    appointmentId?: string | null;
    doseNumber: number;
    administeredAt: string;
    batchNumber?: string | null;
    expiryDate?: string | null;
    site?: string | null;
    route?: string | null;
    nextDueDate?: string | null;
    adverseReaction?: string | null;
    notes?: string | null;
    vaccine?: Vaccine;
    patient?: Patient;
}
export interface DueVaccination {
    patient: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'dateOfBirth'>;
    vaccine: Pick<Vaccine, 'id' | 'code' | 'name'>;
    doseNumber: number;
    dueDate: string;
    daysOverdue: number;
    isOverdue: boolean;
}
