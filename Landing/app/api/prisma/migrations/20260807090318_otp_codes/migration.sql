-- CreateTable
CREATE TABLE "otps" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(190) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "purpose" VARCHAR(30) NOT NULL DEFAULT 'login',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otps_email_purpose_idx" ON "otps"("email", "purpose");
