-- CreateTable
CREATE TABLE "grievance_messages" (
    "id" SERIAL NOT NULL,
    "grievance_id" INTEGER NOT NULL,
    "authorType" VARCHAR(10) NOT NULL,
    "authorName" VARCHAR(120) NOT NULL,
    "admin_id" INTEGER,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grievance_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grievance_messages_grievance_id_idx" ON "grievance_messages"("grievance_id");

-- AddForeignKey
ALTER TABLE "grievance_messages" ADD CONSTRAINT "grievance_messages_grievance_id_fkey" FOREIGN KEY ("grievance_id") REFERENCES "grievances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_messages" ADD CONSTRAINT "grievance_messages_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
