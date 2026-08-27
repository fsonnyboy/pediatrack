-- AlterTable
ALTER TABLE "prescription_items" ADD COLUMN     "dose_amount_mg" DOUBLE PRECISION,
ADD COLUMN     "doses_per_day" INTEGER;

-- CreateTable
CREATE TABLE "medicine_dose_references" (
    "id" TEXT NOT NULL,
    "generic_name" TEXT NOT NULL,
    "mg_per_kg_day_min" DOUBLE PRECISION NOT NULL,
    "mg_per_kg_day_max" DOUBLE PRECISION NOT NULL,
    "max_single_dose_mg" DOUBLE PRECISION,
    "max_daily_dose_mg" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "source_version" TEXT NOT NULL,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_dose_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medicine_dose_references_generic_name_key" ON "medicine_dose_references"("generic_name");

-- CreateIndex
CREATE INDEX "medicine_dose_references_is_active_idx" ON "medicine_dose_references"("is_active");
