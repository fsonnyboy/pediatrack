-- CreateEnum
CREATE TYPE "MilestoneDomain" AS ENUM ('SOCIAL_EMOTIONAL', 'LANGUAGE_COMMUNICATION', 'COGNITIVE', 'MOVEMENT_PHYSICAL');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('ACHIEVED', 'EMERGING', 'NOT_YET', 'NOT_ASSESSED', 'REGRESSED');

-- CreateEnum
CREATE TYPE "ObservationSource" AS ENUM ('CLINICIAN_OBSERVED', 'CAREGIVER_REPORTED');

-- CreateEnum
CREATE TYPE "AgeBasis" AS ENUM ('CHRONOLOGICAL', 'CORRECTED');

-- CreateEnum
CREATE TYPE "ConcernSource" AS ENUM ('CAREGIVER', 'CLINICIAN', 'TEACHER', 'OTHER');

-- CreateTable
CREATE TABLE "milestone_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "checklist_age_months" INTEGER NOT NULL,
    "domain" "MilestoneDomain" NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_version" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_observations" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "observed_by_id" TEXT NOT NULL,
    "status" "MilestoneStatus" NOT NULL,
    "source" "ObservationSource" NOT NULL DEFAULT 'CLINICIAN_OBSERVED',
    "chronological_age_months" DOUBLE PRECISION NOT NULL,
    "corrected_age_months" DOUBLE PRECISION,
    "age_basis_used" "AgeBasis" NOT NULL,
    "note" TEXT,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developmental_concerns" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "source" "ConcernSource" NOT NULL,
    "domain" "MilestoneDomain",
    "description" TEXT NOT NULL,
    "action_taken" TEXT,
    "raised_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developmental_concerns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "milestone_definitions_code_key" ON "milestone_definitions"("code");

-- CreateIndex
CREATE INDEX "milestone_definitions_checklist_age_months_domain_idx" ON "milestone_definitions"("checklist_age_months", "domain");

-- CreateIndex
CREATE INDEX "milestone_observations_patient_id_observed_at_idx" ON "milestone_observations"("patient_id", "observed_at");

-- CreateIndex
CREATE INDEX "milestone_observations_status_idx" ON "milestone_observations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_observations_patient_id_definition_id_observed_at_key" ON "milestone_observations"("patient_id", "definition_id", "observed_at");

-- CreateIndex
CREATE INDEX "developmental_concerns_patient_id_raised_at_idx" ON "developmental_concerns"("patient_id", "raised_at");

-- AddForeignKey
ALTER TABLE "milestone_observations" ADD CONSTRAINT "milestone_observations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_observations" ADD CONSTRAINT "milestone_observations_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "milestone_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_observations" ADD CONSTRAINT "milestone_observations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_observations" ADD CONSTRAINT "milestone_observations_observed_by_id_fkey" FOREIGN KEY ("observed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developmental_concerns" ADD CONSTRAINT "developmental_concerns_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developmental_concerns" ADD CONSTRAINT "developmental_concerns_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developmental_concerns" ADD CONSTRAINT "developmental_concerns_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
