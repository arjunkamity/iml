-- CreateTable
CREATE TABLE "faqs" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faqs_code_key" ON "faqs"("code");
