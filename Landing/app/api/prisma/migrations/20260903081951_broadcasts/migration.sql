-- CreateTable
CREATE TABLE "broadcasts" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "subject" VARCHAR(190) NOT NULL,
    "body" TEXT NOT NULL,
    "audience" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "created_by_admin_id" INTEGER,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_recipients" (
    "id" SERIAL NOT NULL,
    "broadcast_id" INTEGER NOT NULL,
    "school_id" INTEGER,
    "email" VARCHAR(190) NOT NULL,
    "vars" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "broadcasts_code_key" ON "broadcasts"("code");

-- CreateIndex
CREATE INDEX "broadcast_recipients_broadcast_id_status_idx" ON "broadcast_recipients"("broadcast_id", "status");

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
