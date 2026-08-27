import type { Patient } from './patient.types';

export type MilestoneDomain = 'SOCIAL_EMOTIONAL' | 'LANGUAGE_COMMUNICATION' | 'COGNITIVE' | 'MOVEMENT_PHYSICAL';
export type MilestoneStatus = 'ACHIEVED' | 'EMERGING' | 'NOT_YET' | 'NOT_ASSESSED' | 'REGRESSED';
export type ObservationSource = 'CLINICIAN_OBSERVED' | 'CAREGIVER_REPORTED';
export type AgeBasis = 'CHRONOLOGICAL' | 'CORRECTED';
export type ConcernSource = 'CAREGIVER' | 'CLINICIAN' | 'TEACHER' | 'OTHER';

/** The twelve CDC checklist ages, 2 months through 5 years. */
export const MILESTONE_CHECKLIST_AGES = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60] as const;

export interface MilestoneDefinition {
  id: string;
  code: string;
  checklistAgeMonths: number;
  domain: MilestoneDomain;
  description: string;
  source: string;
  sourceVersion: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MilestoneObservation {
  id: string;
  patientId: string;
  definitionId: string;
  appointmentId?: string | null;
  observedById: string;
  status: MilestoneStatus;
  source: ObservationSource;
  chronologicalAgeMonths: number;
  correctedAgeMonths?: number | null;
  ageBasisUsed: AgeBasis;
  note?: string | null;
  observedAt: string;
  definition?: MilestoneDefinition;
  observedBy?: { id: string; firstName: string; lastName: string };
}

export interface DevelopmentalConcern {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  recordedById: string;
  source: ConcernSource;
  domain?: MilestoneDomain | null;
  description: string;
  actionTaken?: string | null;
  raisedAt: string;
  resolvedAt?: string | null;
}

export interface PatientMilestones {
  observations: MilestoneObservation[];
  concerns: DevelopmentalConcern[];
}

/** A developmental concern still open, with its patient context attached. */
export interface OpenConcern extends DevelopmentalConcern {
  patient: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'dateOfBirth'>;
}
