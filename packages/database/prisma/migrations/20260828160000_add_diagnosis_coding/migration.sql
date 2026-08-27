-- CreateEnum
CREATE TYPE "CodeSystem" AS ENUM ('ICD10CM', 'SNOMEDCT', 'ICD11');

-- CreateEnum
CREATE TYPE "DiagnosisStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'RULED_OUT', 'CHRONIC');

-- CreateEnum
CREATE TYPE "DiagnosisCertainty" AS ENUM ('CONFIRMED', 'PROVISIONAL', 'DIFFERENTIAL');

-- CreateTable
CREATE TABLE "diagnosis_codes" (
    "id" TEXT NOT NULL,
    "system" "CodeSystem" NOT NULL,
    "code" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "is_pediatric" BOOLEAN NOT NULL DEFAULT false,
    "search_terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnosis_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_diagnoses" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "code_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "diagnosed_by_id" TEXT NOT NULL,
    "status" "DiagnosisStatus" NOT NULL DEFAULT 'ACTIVE',
    "certainty" "DiagnosisCertainty" NOT NULL DEFAULT 'CONFIRMED',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "onset_date" TIMESTAMP(3),
    "resolved_date" TIMESTAMP(3),
    "clinical_note" TEXT,
    "diagnosed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnosis_codes_system_is_pediatric_idx" ON "diagnosis_codes"("system", "is_pediatric");

-- CreateIndex
CREATE UNIQUE INDEX "diagnosis_codes_system_code_key" ON "diagnosis_codes"("system", "code");

-- CreateIndex
CREATE INDEX "patient_diagnoses_patient_id_diagnosed_at_idx" ON "patient_diagnoses"("patient_id", "diagnosed_at");

-- CreateIndex
CREATE INDEX "patient_diagnoses_code_id_diagnosed_at_idx" ON "patient_diagnoses"("code_id", "diagnosed_at");

-- CreateIndex
CREATE INDEX "patient_diagnoses_status_idx" ON "patient_diagnoses"("status");

-- AddForeignKey
ALTER TABLE "patient_diagnoses" ADD CONSTRAINT "patient_diagnoses_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_diagnoses" ADD CONSTRAINT "patient_diagnoses_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "diagnosis_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_diagnoses" ADD CONSTRAINT "patient_diagnoses_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_diagnoses" ADD CONSTRAINT "patient_diagnoses_diagnosed_by_id_fkey" FOREIGN KEY ("diagnosed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
