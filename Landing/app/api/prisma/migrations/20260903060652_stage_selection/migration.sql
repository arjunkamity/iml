-- AlterTable
ALTER TABLE "attempt_answers" ADD COLUMN     "change_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "competition_stages" ADD COLUMN     "max_qualifiers" INTEGER;
