export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type BloodType =
  | 'A_POSITIVE' | 'A_NEGATIVE'
  | 'B_POSITIVE' | 'B_NEGATIVE'
  | 'AB_POSITIVE' | 'AB_NEGATIVE'
  | 'O_POSITIVE' | 'O_NEGATIVE'
  | 'UNKNOWN';

export interface Guardian {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
  isPrimary: boolean;
  isEmergencyContact: boolean;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  dateOfBirth: string;
  gender: Gender;
  bloodType: BloodType;
  birthWeightKg?: number | null;
  birthHeightCm?: number | null;
  gestationalAge?: number | null;
  allergies: string[];
  chronicConditions: string[];
  notes?: string | null;
  photoUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  guardians?: Guardian[];
  /** Computed server-side */
  age?: PatientAge;
}

export interface PatientAge {
  years: number;
  months: number;
  days: number;
  display: string;
}

export interface GrowthDataPoint {
  recordedAt: string;
  ageMonths: number;
  weightKg?: number | null;
  heightCm?: number | null;
  headCircumference?: number | null;
  bmi?: number | null;
}
