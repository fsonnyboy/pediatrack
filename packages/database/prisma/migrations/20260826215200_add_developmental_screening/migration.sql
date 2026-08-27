-- CreateEnum
CREATE TYPE "ScreeningType" AS ENUM ('GENERAL', 'AUTISM', 'BEHAVIORAL');

-- CreateEnum
CREATE TYPE "ScreeningOutcome" AS ENUM ('PASS', 'MONITOR', 'REFER', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'DECLINED', 'LOST');

-- CreateTable
CREATE TABLE "screening_instruments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ScreeningType" NOT NULL,
    "min_age_months" INTEGER NOT NULL,
    "max_age_months" INTEGER NOT NULL,
    "cutoff_note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screening_instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_administrations" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "instrument_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "administered_by_id" TEXT NOT NULL,
    "scheduled_age_months" INTEGER NOT NULL,
    "age_months_at_screen" DOUBLE PRECISION NOT NULL,
    "administered_at" TIMESTAMP(3) NOT NULL,
    "total_score" INTEGER,
    "domain_scores" JSONB,
    "outcome" "ScreeningOutcome" NOT NULL,
    "concern_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screening_administrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_referrals" (
    "id" TEXT NOT NULL,
    "administration_id" TEXT NOT NULL,
    "referred_to" TEXT NOT NULL,
    "referred_at" TIMESTAMP(3) NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "outcome_note" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screening_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "screening_instruments_code_key" ON "screening_instruments"("code");

-- CreateIndex
CREATE INDEX "screening_instruments_type_idx" ON "screening_instruments"("type");

-- CreateIndex
CREATE INDEX "screening_administrations_patient_id_administered_at_idx" ON "screening_administrations"("patient_id", "administered_at");

-- CreateIndex
CREATE INDEX "screening_administrations_outcome_idx" ON "screening_administrations"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "screening_administrations_patient_id_instrument_id_schedule_key" ON "screening_administrations"("patient_id", "instrument_id", "scheduled_age_months");

-- CreateIndex
CREATE UNIQUE INDEX "screening_referrals_administration_id_key" ON "screening_referrals"("administration_id");

-- CreateIndex
CREATE INDEX "screening_referrals_status_referred_at_idx" ON "screening_referrals"("status", "referred_at");

-- AddForeignKey
ALTER TABLE "screening_administrations" ADD CONSTRAINT "screening_administrations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_administrations" ADD CONSTRAINT "screening_administrations_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "screening_instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_administrations" ADD CONSTRAINT "screening_administrations_administered_by_id_fkey" FOREIGN KEY ("administered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_administrations" ADD CONSTRAINT "screening_administrations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_referrals" ADD CONSTRAINT "screening_referrals_administration_id_fkey" FOREIGN KEY ("administration_id") REFERENCES "screening_administrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
