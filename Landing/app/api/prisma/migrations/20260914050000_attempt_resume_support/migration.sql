-- AlterTable
ALTER TABLE "attempts" ADD COLUMN     "last_question_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_attempt_id_question_id_key" ON "attempt_answers"("attempt_id", "question_id");
