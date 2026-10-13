-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "cert_amity_logo_url" VARCHAR(300),
ADD COLUMN     "cert_badge_url" VARCHAR(300),
ADD COLUMN     "cert_iml_logo_url" VARCHAR(300),
ADD COLUMN     "cert_sig_left_image_url" VARCHAR(300),
ADD COLUMN     "cert_sig_left_name" VARCHAR(120),
ADD COLUMN     "cert_sig_left_role" VARCHAR(120),
ADD COLUMN     "cert_sig_right_image_url" VARCHAR(300),
ADD COLUMN     "cert_sig_right_name" VARCHAR(120),
ADD COLUMN     "cert_sig_right_role" VARCHAR(120);
