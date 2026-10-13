-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "max_attempts" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "registration_stage" ADD COLUMN     "attempts_used" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "show_question_history" BOOLEAN NOT NULL DEFAULT true;
