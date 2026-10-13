-- CreateTable
CREATE TABLE "certificate_jobs" (
    "id" SERIAL NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "eventName" VARCHAR(190) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "certificate_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificate_jobs_registration_id_key" ON "certificate_jobs"("registration_id");

-- AddForeignKey
ALTER TABLE "certificate_jobs" ADD CONSTRAINT "certificate_jobs_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
