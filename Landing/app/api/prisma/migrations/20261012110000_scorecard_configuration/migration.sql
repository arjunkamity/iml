-- Future Readiness scorecard configuration: versioned frameworks (dimensions, level
-- scales, shared competency library), seasons (edition label, display-ID pattern),
-- a configuration audit log, and a season / scale link on competitions.
-- Additive only: three new tables and two nullable columns on competitions. Nothing
-- existing changes, so a code-only rollback keeps working.

-- AlterTable
ALTER TABLE "competitions" ADD COLUMN     "scale_key" VARCHAR(30),
ADD COLUMN     "season_id" INTEGER;

-- CreateTable
CREATE TABLE "scorecard_frameworks" (
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

    CONSTRAINT "scorecard_frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_seasons" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(190) NOT NULL,
    "edition_label" VARCHAR(120) NOT NULL,
    "id_pattern" VARCHAR(60) NOT NULL DEFAULT 'IML-{YYYY}-{#####}',
    "year" INTEGER,
    "framework_id" INTEGER NOT NULL,
    "scale_key" VARCHAR(30),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorecard_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_audit_log" (
    "id" SERIAL NOT NULL,
    "entity" VARCHAR(40) NOT NULL,
    "entity_code" VARCHAR(40),
    "action" VARCHAR(40) NOT NULL,
    "admin_id" INTEGER,
    "admin_name" VARCHAR(120),
    "summary" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_frameworks_code_key" ON "scorecard_frameworks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_seasons_code_key" ON "scorecard_seasons"("code");

-- CreateIndex
CREATE INDEX "config_audit_log_entity_entity_code_idx" ON "config_audit_log"("entity", "entity_code");

-- CreateIndex
CREATE INDEX "config_audit_log_created_at_idx" ON "config_audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "scorecard_seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_frameworks" ADD CONSTRAINT "scorecard_frameworks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "scorecard_frameworks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_seasons" ADD CONSTRAINT "scorecard_seasons_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "scorecard_frameworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
