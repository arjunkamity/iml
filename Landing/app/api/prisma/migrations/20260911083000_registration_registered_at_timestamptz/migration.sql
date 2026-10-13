-- AlterTable
ALTER TABLE "registrations" ALTER COLUMN "registered_at" TYPE TIMESTAMPTZ(6) USING "registered_at"::timestamptz;
