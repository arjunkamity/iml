-- Per-competition question mix (category + how many per student).
-- Additive only: a new table, nothing existing is altered, so a code-only
-- rollback (the deploy workflow does not revert the database) stays safe.

-- CreateTable
CREATE TABLE "competition_question_rules" (
    "id" SERIAL NOT NULL,
    "competition_id" INTEGER NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "count" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "competition_question_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competition_question_rules_competition_id_category_key" ON "competition_question_rules"("competition_id", "category");

-- AddForeignKey
ALTER TABLE "competition_question_rules" ADD CONSTRAINT "competition_question_rules_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
