-- CreateTable
CREATE TABLE "certificates" (
    "id" SERIAL NOT NULL,
    "certificate_number" VARCHAR(40) NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "certificate_type" VARCHAR(30) NOT NULL DEFAULT 'PARTICIPATION',
    "template_code" VARCHAR(60) NOT NULL,
    "template_version" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    "event_name" VARCHAR(190) NOT NULL,
    "pdf_url" VARCHAR(500),
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificate_number_key" ON "certificates"("certificate_number");

-- CreateIndex
CREATE INDEX "certificates_registration_id_idx" ON "certificates"("registration_id");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
