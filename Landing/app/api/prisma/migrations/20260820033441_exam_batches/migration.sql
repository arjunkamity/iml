-- CreateTable
CREATE TABLE "exam_batches" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_batch_assignments" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_batch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_batches_exam_id_idx" ON "exam_batches"("exam_id");

-- CreateIndex
CREATE INDEX "exam_batch_assignments_batch_id_idx" ON "exam_batch_assignments"("batch_id");

-- CreateIndex
CREATE INDEX "exam_batch_assignments_registration_id_idx" ON "exam_batch_assignments"("registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_batch_assignments_exam_id_registration_id_key" ON "exam_batch_assignments"("exam_id", "registration_id");

-- AddForeignKey
ALTER TABLE "exam_batches" ADD CONSTRAINT "exam_batches_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_batch_assignments" ADD CONSTRAINT "exam_batch_assignments_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_batch_assignments" ADD CONSTRAINT "exam_batch_assignments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "exam_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_batch_assignments" ADD CONSTRAINT "exam_batch_assignments_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
