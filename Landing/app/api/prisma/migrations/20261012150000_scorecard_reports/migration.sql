-- Scorecard report templates and generated report PDFs (#73).
-- Additive only: three new tables and one nullable column on scorecard_seasons.
-- A code-only rollback keeps working.

-- AlterTable
ALTER TABLE "scorecard_seasons" ADD COLUMN     "template_id" INTEGER;

-- CreateTable
CREATE TABLE "scorecard_templates" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(190) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "parent_id" INTEGER,
    "notes" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorecard_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_reports" (
    "id" SERIAL NOT NULL,
    "verification_code" VARCHAR(20) NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "stage_position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "checksum" VARCHAR(64),
    "size_bytes" INTEGER,
    "page_count" INTEGER,
    "config_used" JSONB,
    "warnings" JSONB,
    "requested_by_id" INTEGER,
    "requested_by_name" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_at" TIMESTAMPTZ(6),
    "superseded_at" TIMESTAMPTZ(6),

    CONSTRAINT "scorecard_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_report_files" (
    "report_id" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "scorecard_report_files_pkey" PRIMARY KEY ("report_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_templates_code_key" ON "scorecard_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_reports_verification_code_key" ON "scorecard_reports"("verification_code");

-- CreateIndex
CREATE INDEX "scorecard_reports_status_idx" ON "scorecard_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_reports_registration_id_stage_position_version_key" ON "scorecard_reports"("registration_id", "stage_position", "version");

-- AddForeignKey
ALTER TABLE "scorecard_seasons" ADD CONSTRAINT "scorecard_seasons_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "scorecard_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_reports" ADD CONSTRAINT "scorecard_reports_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_report_files" ADD CONSTRAINT "scorecard_report_files_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "scorecard_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

