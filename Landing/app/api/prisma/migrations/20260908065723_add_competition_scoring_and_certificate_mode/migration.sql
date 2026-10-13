-- AlterTable
ALTER TABLE "competitions" ADD COLUMN     "certificate_mode" VARCHAR(20) NOT NULL DEFAULT 'INSTANT',
ADD COLUMN     "scoring_mode" VARCHAR(20) NOT NULL DEFAULT 'PERCENT';
