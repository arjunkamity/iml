-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "participate_btn_link" VARCHAR(300),
ADD COLUMN     "participate_btn_text" VARCHAR(60),
ADD COLUMN     "participate_bullets" TEXT,
ADD COLUMN     "participate_intro" TEXT,
ADD COLUMN     "participate_photo_url" VARCHAR(300),
ADD COLUMN     "participate_title" VARCHAR(120),
ADD COLUMN     "video_caption" VARCHAR(120),
ADD COLUMN     "video_url" VARCHAR(300),
ADD COLUMN     "why_join_btn_link" VARCHAR(300),
ADD COLUMN     "why_join_btn_text" VARCHAR(60),
ADD COLUMN     "why_join_bullets" TEXT,
ADD COLUMN     "why_join_title" VARCHAR(120);
