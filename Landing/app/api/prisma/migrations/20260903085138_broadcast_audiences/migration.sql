-- AlterTable
ALTER TABLE "broadcast_recipients" ADD COLUMN     "student_id" INTEGER;

-- AlterTable
ALTER TABLE "broadcasts" ADD COLUMN     "custom_emails" TEXT;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
