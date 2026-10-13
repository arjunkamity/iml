-- AlterTable
ALTER TABLE "attempts" ADD COLUMN     "question_ids" JSONB;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "question_count" INTEGER;
