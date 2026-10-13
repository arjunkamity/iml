-- Assessments (Phase 1): unscored reflection tools beside the exam engine.
-- Additive only: two new tables and two columns on questions that are either
-- nullable (assessment_id) or defaulted (option_points), so a code-only
-- rollback (the deploy workflow does not revert the database) keeps working.

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "assessment_id" INTEGER,
ADD COLUMN     "option_points" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "assessments" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "title" VARCHAR(190) NOT NULL,
    "summary" TEXT,
    "grades" VARCHAR(40),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_submissions" (
    "id" SERIAL NOT NULL,
    "assessment_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "school_id" INTEGER,
    "grade" VARCHAR(6),
    "answers" JSONB NOT NULL,
    "scores" JSONB NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessments_code_key" ON "assessments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_slug_key" ON "assessments"("slug");

-- CreateIndex
CREATE INDEX "assessment_submissions_assessment_id_submitted_at_idx" ON "assessment_submissions"("assessment_id", "submitted_at");

-- CreateIndex
CREATE INDEX "assessment_submissions_student_id_assessment_id_idx" ON "assessment_submissions"("student_id", "assessment_id");

-- CreateIndex
CREATE INDEX "assessment_submissions_school_id_grade_idx" ON "assessment_submissions"("school_id", "grade");

-- CreateIndex
CREATE INDEX "questions_assessment_id_idx" ON "questions"("assessment_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_submissions" ADD CONSTRAINT "assessment_submissions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_submissions" ADD CONSTRAINT "assessment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

