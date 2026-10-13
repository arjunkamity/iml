-- Snapshot of the question's category on each exam answer, so per-area scores in
-- reports can never change when a question is later edited, re-tagged or deleted.
-- Additive: one nullable column. The backfill copies the category of the question
-- each existing answer still points at (answers whose question is already gone
-- stay NULL and are read as 'Other', exactly as before). A code-only rollback keeps
-- working: older code ignores the column.

-- AlterTable
ALTER TABLE "attempt_answers" ADD COLUMN     "category" VARCHAR(20);

-- Backfill from the live question (idempotent: only fills rows still NULL)
UPDATE "attempt_answers" AS a
SET "category" = q."category"
FROM "questions" AS q
WHERE a."question_id" = q."id" AND a."category" IS NULL;
