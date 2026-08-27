import type { Patient } from './patient.types';

export type ScreeningType = 'GENERAL' | 'AUTISM' | 'BEHAVIORAL';
export type ScreeningOutcome = 'PASS' | 'MONITOR' | 'REFER' | 'INCOMPLETE';
export type ReferralStatus = 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'DECLINED' | 'LOST';

export interface ScreeningInstrument {
  id: string;
  code: string;
  name: string;
  type: ScreeningType;
  minAgeMonths: number;
  maxAgeMonths: number;
  cutoffNote?: string | null;
  isActive: boolean;
}

export interface ScreeningReferral {
  id: string;
  administrationId: string;
  referredTo: string;
  referredAt: string;
  status: ReferralStatus;
  outcomeNote?: string | null;
  closedAt?: string | null;
}

export interface ScreeningAdministration {
  id: string;
  patientId: string;
  instrumentId: string;
  appointmentId?: string | null;
  administeredById: string;
  scheduledAgeMonths: number;
  ageMonthsAtScreen: number;
  administeredAt: string;
  totalScore?: number | null;
  domainScores?: Record<string, number> | null;
  outcome: ScreeningOutcome;
  concernNote?: string | null;
  instrument?: ScreeningInstrument;
  patient?: Patient;
  referral?: ScreeningReferral | null;
}

/** A referral still in flight, with its screening context attached. */
export interface OpenReferral extends ScreeningReferral {
  administration: Pick<
    ScreeningAdministration,
    'id' | 'scheduledAgeMonths' | 'administeredAt' | 'outcome' | 'concernNote'
  > & {
    instrument: Pick<ScreeningInstrument, 'id' | 'code' | 'name'>;
    patient: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'dateOfBirth'>;
  };
}

/** A REFER-outcome screening with no referral row yet — the loop never started. */
export interface UnaddressedScreening
  extends Pick<
    ScreeningAdministration,
    'id' | 'scheduledAgeMonths' | 'administeredAt' | 'outcome' | 'concernNote'
  > {
  instrument: Pick<ScreeningInstrument, 'id' | 'code' | 'name'>;
  patient: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'dateOfBirth'>;
}

export interface DueScreening {
  patient: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'dateOfBirth'>;
  instrument: Pick<ScreeningInstrument, 'id' | 'code' | 'name' | 'type'>;
  scheduledAgeMonths: number;
  dueDate: string;
  daysUntilDue: number;
  daysOverdue: number;
  isOverdue: boolean;
}
