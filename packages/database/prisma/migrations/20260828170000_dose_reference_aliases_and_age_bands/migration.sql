-- DropIndex
DROP INDEX "medicine_dose_references_generic_name_key";

-- AlterTable
ALTER TABLE "medicine_dose_references" ADD COLUMN     "age_max_months" INTEGER,
ADD COLUMN     "age_min_months" INTEGER,
ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "indication" TEXT;

-- CreateIndex
CREATE INDEX "medicine_dose_references_generic_name_idx" ON "medicine_dose_references"("generic_name");
