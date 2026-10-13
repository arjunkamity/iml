-- Assessments, round 2: one result per student per assessment (enforced by the
-- database), assessment categories, and lifecycle timestamps.
-- Additive apart from swapping one plain index for a unique one on a table
-- that has not been used in production yet; rollback-safe for existing code.

-- DropIndex
DROP INDEX "assessment_submissions_student_id_assessment_id_idx";

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "archived_at" TIMESTAMPTZ(6),
ADD COLUMN     "category_id" INTEGER,
ADD COLUMN     "published_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "assessment_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessment_categories_name_key" ON "assessment_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_submissions_student_id_assessment_id_key" ON "assessment_submissions"("student_id", "assessment_id");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "assessment_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

