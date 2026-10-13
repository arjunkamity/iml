-- CreateTable
CREATE TABLE "message_templates" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "smsBody" VARCHAR(320),
    "emailSubject" VARCHAR(190),
    "emailBody" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" SERIAL NOT NULL,
    "template_key" VARCHAR(50) NOT NULL,
    "channel" VARCHAR(10) NOT NULL,
    "recipient" VARCHAR(190) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "provider_response" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_key_key" ON "message_templates"("key");

-- CreateIndex
CREATE INDEX "message_logs_template_key_idx" ON "message_logs"("template_key");

-- CreateIndex
CREATE INDEX "message_logs_recipient_idx" ON "message_logs"("recipient");
