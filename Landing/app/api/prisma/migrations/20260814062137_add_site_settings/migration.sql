-- CreateTable
CREATE TABLE "site_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "logo_light_url" VARCHAR(300),
    "logo_dark_url" VARCHAR(300),
    "logo_mobile_url" VARCHAR(300),
    "favicon_url" VARCHAR(300),
    "contact_email" VARCHAR(190),
    "contact_phone" VARCHAR(30),
    "ga_script" TEXT,
    "loading_text" VARCHAR(120),
    "loading_image_url" VARCHAR(300),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);
