-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "email" VARCHAR(190),
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "phone" VARCHAR(20);
