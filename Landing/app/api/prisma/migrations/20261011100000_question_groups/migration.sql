-- Question groups: a topic (title, description, image, video) with 2+ existing
-- questions as sub-questions, served together in an exam.
-- Additive only: one new table and two nullable columns on questions, no
-- backfill. Every existing question keeps group_id NULL and behaves exactly as
-- before, so a code-only rollback (the deploy workflow does not revert the
-- database) keeps working.

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "group_id" INTEGER,
ADD COLUMN     "group_position" INTEGER;

-- CreateTable
CREATE TABLE "question_groups" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "competition_id" INTEGER,
    "category" VARCHAR(20) NOT NULL,
    "title" VARCHAR(190) NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "video_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_groups_code_key" ON "question_groups"("code");

-- CreateIndex
CREATE INDEX "question_groups_competition_id_idx" ON "question_groups"("competition_id");

-- CreateIndex
CREATE INDEX "questions_group_id_idx" ON "questions"("group_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "question_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
