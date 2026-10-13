-- Scorecard report release, audience variants, consent and parent share links (#74).
-- Additive only: four new tables and new nullable / defaulted columns. A code-only
-- rollback keeps working.

-- AlterTable
ALTER TABLE "scorecard_reports" ADD COLUMN     "released_at" TIMESTAMPTZ(6),
ADD COLUMN     "released_by_id" INTEGER,
ADD COLUMN     "released_by_name" VARCHAR(120),
ADD COLUMN     "withdrawn_at" TIMESTAMPTZ(6),
ADD COLUMN     "withdrawn_reason" VARCHAR(255);

-- AlterTable
ALTER TABLE "scorecard_seasons" ADD COLUMN     "delivery_settings" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "scorecard_report_variants" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "audience" VARCHAR(20) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "scorecard_report_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_consents" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "season_id" INTEGER,
    "audience" VARCHAR(20) NOT NULL,
    "library_code" VARCHAR(10),
    "text_version" INTEGER,
    "consent_text" TEXT NOT NULL,
    "accepted_by" VARCHAR(20) NOT NULL DEFAULT 'student',
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMPTZ(6),

    CONSTRAINT "scorecard_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_share_links" (
    "id" SERIAL NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "stage_position" INTEGER NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_opened_at" TIMESTAMPTZ(6),
    "created_by_name" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorecard_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_report_variants_report_id_audience_key" ON "scorecard_report_variants"("report_id", "audience");

-- CreateIndex
CREATE INDEX "scorecard_consents_student_id_audience_idx" ON "scorecard_consents"("student_id", "audience");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_share_links_token_hash_key" ON "scorecard_share_links"("token_hash");

-- CreateIndex
CREATE INDEX "scorecard_share_links_registration_id_stage_position_idx" ON "scorecard_share_links"("registration_id", "stage_position");

-- AddForeignKey
ALTER TABLE "scorecard_report_variants" ADD CONSTRAINT "scorecard_report_variants_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "scorecard_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

