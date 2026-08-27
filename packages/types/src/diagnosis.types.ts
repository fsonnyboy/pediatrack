export type CodeSystem = 'ICD10CM' | 'SNOMEDCT' | 'ICD11';
export type DiagnosisStatus = 'ACTIVE' | 'RESOLVED' | 'RULED_OUT' | 'CHRONIC';
export type DiagnosisCertainty = 'CONFIRMED' | 'PROVISIONAL' | 'DIFFERENTIAL';

export interface DiagnosisCode {
  id: string;
  system: CodeSystem;
  code: string;
  display: string;
  isBillable: boolean;
  isPediatric: boolean;
  searchTerms: string[];
}

/** A catalogue search result, ranked by how often this clinic has used the code. */
export interface DiagnosisCodeResult extends DiagnosisCode {
  usageCount: number;
}

/** A patient's problem-list entry — a diagnosis that outlives the appointment it was made in. */
export interface PatientDiagnosis {
  id: string;
  patientId: string;
  codeId: string;
  appointmentId?: string | null;
  diagnosedById: string;
  status: DiagnosisStatus;
  certainty: DiagnosisCertainty;
  isPrimary: boolean;
  onsetDate?: string | null;
  resolvedDate?: string | null;
  clinicalNote?: string | null;
  diagnosedAt: string;
  code?: DiagnosisCode;
  diagnosedBy?: { id: string; firstName: string; lastName: string };
}
