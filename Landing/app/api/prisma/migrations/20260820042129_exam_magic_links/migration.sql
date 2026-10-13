-- CreateTable
CREATE TABLE "exam_magic_links" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(24) NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_magic_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_magic_links_token_key" ON "exam_magic_links"("token");

-- CreateIndex
CREATE INDEX "exam_magic_links_registration_id_idx" ON "exam_magic_links"("registration_id");

-- CreateIndex
CREATE INDEX "exam_magic_links_exam_id_idx" ON "exam_magic_links"("exam_id");

-- AddForeignKey
ALTER TABLE "exam_magic_links" ADD CONSTRAINT "exam_magic_links_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_magic_links" ADD CONSTRAINT "exam_magic_links_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
