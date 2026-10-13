-- AlterTable
ALTER TABLE "otps" ADD COLUMN     "phone" VARCHAR(20),
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "otps_phone_purpose_idx" ON "otps"("phone", "purpose");
