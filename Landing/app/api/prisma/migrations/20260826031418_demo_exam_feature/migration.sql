-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "demo_exam_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "demo_exam_duration_min" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "demo_exam_question_count" INTEGER,
ADD COLUMN     "demo_exam_title" VARCHAR(190) NOT NULL DEFAULT 'Try a Sample Test';

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "demo_prompt_seen" BOOLEAN NOT NULL DEFAULT false;
