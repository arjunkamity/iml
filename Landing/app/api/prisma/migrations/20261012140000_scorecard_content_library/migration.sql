-- Scorecard content library: the wording reports use (strengths, growth text, profile
-- lines, challenge, disclaimer ...) as data, with a draft and immutable approved
-- versions per item, and a link from a season to its library.
-- Additive only: three new tables and one nullable column on scorecard_seasons.
-- A code-only rollback keeps working.

-- AlterTable
ALTER TABLE "scorecard_seasons" ADD COLUMN     "library_id" INTEGER;

-- CreateTable
CREATE TABLE "scorecard_libraries" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(190) NOT NULL,
    "default_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "languages" JSONB NOT NULL DEFAULT '["en"]',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorecard_libraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_texts" (
    "id" SERIAL NOT NULL,
    "library_id" INTEGER NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "key" VARCHAR(60) NOT NULL DEFAULT '',
    "level_key" VARCHAR(30) NOT NULL DEFAULT '',
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" VARCHAR(190),
    "draft_text" TEXT NOT NULL,
    "approved_version_id" INTEGER,
    "updated_by_id" INTEGER,
    "updated_by_name" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorecard_texts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_text_versions" (
    "id" SERIAL NOT NULL,
    "text_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(190),
    "text" TEXT NOT NULL,
    "approved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" INTEGER,
    "approved_by_name" VARCHAR(120),
    "note" VARCHAR(255),

    CONSTRAINT "scorecard_text_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_libraries_code_key" ON "scorecard_libraries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_texts_approved_version_id_key" ON "scorecard_texts"("approved_version_id");

-- CreateIndex
CREATE INDEX "scorecard_texts_library_id_kind_idx" ON "scorecard_texts"("library_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_texts_library_id_kind_key_level_key_language_posi_key" ON "scorecard_texts"("library_id", "kind", "key", "level_key", "language", "position");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_text_versions_text_id_version_key" ON "scorecard_text_versions"("text_id", "version");

-- AddForeignKey
ALTER TABLE "scorecard_seasons" ADD CONSTRAINT "scorecard_seasons_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "scorecard_libraries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_texts" ADD CONSTRAINT "scorecard_texts_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "scorecard_libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_texts" ADD CONSTRAINT "scorecard_texts_approved_version_id_fkey" FOREIGN KEY ("approved_version_id") REFERENCES "scorecard_text_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_text_versions" ADD CONSTRAINT "scorecard_text_versions_text_id_fkey" FOREIGN KEY ("text_id") REFERENCES "scorecard_texts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
