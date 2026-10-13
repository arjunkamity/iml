-- Admin-generated direct-login token for a student — bypasses OTP.
ALTER TABLE "students" ADD COLUMN "access_token" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "students_access_token_key" ON "students"("access_token");
