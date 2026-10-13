-- Panel evaluation (#75-#83): panel-rated forms, panelists, per-stage panel setup and
-- lifecycle, ratings, adjudications, results and narratives.
-- Additive only (new tables, new columns with defaults). A code-only rollback keeps working.

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "kind" VARCHAR(10) NOT NULL DEFAULT 'self';

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "option_hints" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "weight" DECIMAL(5,2) NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "panelists" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(190) NOT NULL,
    "phone" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Invited',
    "password_hash" TEXT,
    "invite_token_hash" VARCHAR(64),
    "invite_expires_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panelists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_stages" (
    "id" SERIAL NOT NULL,
    "stage_id" INTEGER NOT NULL,
    "form_id" INTEGER,
    "required_raters" INTEGER NOT NULL DEFAULT 2,
    "state" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "form_snapshot" JSONB,
    "opened_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "finalized_at" TIMESTAMPTZ(6),
    "selected_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panel_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_enrolments" (
    "id" SERIAL NOT NULL,
    "panel_stage_id" INTEGER NOT NULL,
    "panelist_id" INTEGER NOT NULL,
    "conflict_schools" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panel_enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_ratings" (
    "id" SERIAL NOT NULL,
    "stage_id" INTEGER NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "panelist_id" INTEGER NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'Draft',
    "ratings" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "reopened_at" TIMESTAMPTZ(6),
    "reopened_by_name" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panel_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_adjudications" (
    "id" SERIAL NOT NULL,
    "stage_id" INTEGER NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "reason" VARCHAR(500) NOT NULL,
    "decided_by_id" INTEGER,
    "decided_by_name" VARCHAR(120),
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panel_adjudications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_results" (
    "id" SERIAL NOT NULL,
    "stage_id" INTEGER NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "status" VARCHAR(12) NOT NULL,
    "percent" DECIMAL(5,2),
    "level_key" VARCHAR(30),
    "competencies" JSONB NOT NULL DEFAULT '[]',
    "raters_count" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panel_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_narratives" (
    "id" SERIAL NOT NULL,
    "stage_id" INTEGER NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "system_draft" TEXT NOT NULL,
    "draft_text" TEXT NOT NULL,
    "approved_text" TEXT,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_id" INTEGER,
    "approved_by_name" VARCHAR(120),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panel_narratives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "panelists_code_key" ON "panelists"("code");

-- CreateIndex
CREATE UNIQUE INDEX "panelists_email_key" ON "panelists"("email");

-- CreateIndex
CREATE UNIQUE INDEX "panel_stages_stage_id_key" ON "panel_stages"("stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "panel_enrolments_panel_stage_id_panelist_id_key" ON "panel_enrolments"("panel_stage_id", "panelist_id");

-- CreateIndex
CREATE INDEX "panel_ratings_stage_id_registration_id_idx" ON "panel_ratings"("stage_id", "registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "panel_ratings_stage_id_registration_id_panelist_id_key" ON "panel_ratings"("stage_id", "registration_id", "panelist_id");

-- CreateIndex
CREATE UNIQUE INDEX "panel_adjudications_stage_id_registration_id_key" ON "panel_adjudications"("stage_id", "registration_id");

-- CreateIndex
CREATE INDEX "panel_results_stage_id_status_idx" ON "panel_results"("stage_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "panel_results_stage_id_registration_id_key" ON "panel_results"("stage_id", "registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "panel_narratives_stage_id_registration_id_key" ON "panel_narratives"("stage_id", "registration_id");

-- AddForeignKey
ALTER TABLE "panel_stages" ADD CONSTRAINT "panel_stages_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "competition_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_enrolments" ADD CONSTRAINT "panel_enrolments_panel_stage_id_fkey" FOREIGN KEY ("panel_stage_id") REFERENCES "panel_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_enrolments" ADD CONSTRAINT "panel_enrolments_panelist_id_fkey" FOREIGN KEY ("panelist_id") REFERENCES "panelists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_ratings" ADD CONSTRAINT "panel_ratings_panelist_id_fkey" FOREIGN KEY ("panelist_id") REFERENCES "panelists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

