-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(190) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(30) NOT NULL DEFAULT 'Editor',
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_modules" (
    "admin_id" INTEGER NOT NULL,
    "module_code" VARCHAR(30) NOT NULL,

    CONSTRAINT "admin_modules_pkey" PRIMARY KEY ("admin_id","module_code")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(190) NOT NULL,
    "city" VARCHAR(90),
    "contact" VARCHAR(40),
    "coordinator" VARCHAR(120),

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "grade" VARCHAR(6) NOT NULL,
    "school_id" INTEGER,
    "dob" DATE,
    "gender" VARCHAR(12),
    "phone" VARCHAR(20),
    "email" VARCHAR(190),
    "parent" VARCHAR(120),
    "parent_phone" VARCHAR(20),
    "address" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "title" VARCHAR(190) NOT NULL,
    "grades" VARCHAR(20) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "is_multi" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_stages" (
    "id" SERIAL NOT NULL,
    "competition_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "mode" VARCHAR(30) NOT NULL,
    "pass_mark" DECIMAL(5,2) NOT NULL,
    "is_free" BOOLEAN NOT NULL DEFAULT true,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "competition_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_rules" (
    "id" SERIAL NOT NULL,
    "stage_id" INTEGER NOT NULL,
    "rule" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stage_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "student_id" INTEGER NOT NULL,
    "competition_id" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Registered',
    "registered_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_stage" (
    "registration_id" INTEGER NOT NULL,
    "stage_id" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Locked',
    "score" DECIMAL(5,2),
    "qualified" BOOLEAN,
    "unlocked_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),

    CONSTRAINT "registration_stage_pkey" PRIMARY KEY ("registration_id","stage_id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "competition_id" INTEGER,
    "grade" VARCHAR(6) NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "qtype" VARCHAR(12) NOT NULL DEFAULT 'text',
    "media" TEXT,
    "mode" VARCHAR(10) NOT NULL DEFAULT 'single',
    "label" VARCHAR(60),
    "ref" VARCHAR(30),
    "time_limit_secs" INTEGER,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "correct" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "competition_id" INTEGER,
    "title" VARCHAR(190) NOT NULL,
    "grade" VARCHAR(20),
    "date" DATE,
    "time" TIME(0),
    "duration_min" INTEGER,
    "timing" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'Scheduled',

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "stage_id" INTEGER,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "timing" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answers" (
    "id" SERIAL NOT NULL,
    "attempt_id" INTEGER NOT NULL,
    "question_id" INTEGER,
    "answer" JSONB,
    "is_correct" BOOLEAN,
    "taken_secs" INTEGER,
    "time_up" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(6),
    "answered_at" TIMESTAMPTZ(6),

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "stage_id" INTEGER,
    "amount" DECIMAL(10,2) NOT NULL,
    "mode" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "provider_txn" VARCHAR(120),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "title" VARCHAR(190) NOT NULL,
    "category" VARCHAR(40),
    "audience" VARCHAR(60),
    "publish_on" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "title" VARCHAR(190) NOT NULL,
    "category" VARCHAR(40),
    "author" VARCHAR(90),
    "publish_on" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "photo" TEXT,
    "summary" TEXT,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(190) NOT NULL,
    "date" DATE,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'Public',
    "cover" TEXT,
    "description" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',

    CONSTRAINT "gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grievances" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "gtype" VARCHAR(30) NOT NULL,
    "student_id" INTEGER,
    "name" VARCHAR(120),
    "contact" VARCHAR(40),
    "subject" VARCHAR(190),
    "message" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'New',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_by" INTEGER,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "grievances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "channel" VARCHAR(12) NOT NULL,
    "audience" VARCHAR(60) NOT NULL,
    "competition_id" INTEGER,
    "subject" VARCHAR(190),
    "message" TEXT NOT NULL,
    "html" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "sent_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(190) NOT NULL,
    "contact" VARCHAR(120),
    "email" VARCHAR(190),
    "phone" VARCHAR(20),
    "tier" VARCHAR(30),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "amount" DECIMAL(12,2),
    "since" VARCHAR(4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsor_events" (
    "sponsor_id" INTEGER NOT NULL,
    "competition_id" INTEGER NOT NULL,

    CONSTRAINT "sponsor_events_pkey" PRIMARY KEY ("sponsor_id","competition_id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "min_amount" DECIMAL(12,2) NOT NULL,
    "benefits" TEXT,
    "extras" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prizes" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "competition_id" INTEGER NOT NULL,
    "rank_label" VARCHAR(30) NOT NULL,
    "money" DECIMAL(12,2),
    "award" VARCHAR(60),
    "note" TEXT,

    CONSTRAINT "prizes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_admin_id_idx" ON "refresh_tokens"("admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "schools_code_key" ON "schools"("code");

-- CreateIndex
CREATE UNIQUE INDEX "students_code_key" ON "students"("code");

-- CreateIndex
CREATE UNIQUE INDEX "competitions_code_key" ON "competitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "competition_stages_competition_id_position_key" ON "competition_stages"("competition_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_code_key" ON "registrations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_student_id_competition_id_key" ON "registrations"("student_id", "competition_id");

-- CreateIndex
CREATE UNIQUE INDEX "questions_code_key" ON "questions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "exams_code_key" ON "exams"("code");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_code_key" ON "attempts"("code");

-- CreateIndex
CREATE INDEX "attempt_answers_attempt_id_idx" ON "attempt_answers"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_code_key" ON "payments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "announcements_code_key" ON "announcements"("code");

-- CreateIndex
CREATE UNIQUE INDEX "news_code_key" ON "news"("code");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_code_key" ON "gallery"("code");

-- CreateIndex
CREATE UNIQUE INDEX "grievances_code_key" ON "grievances"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sponsors_code_key" ON "sponsors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "prizes_code_key" ON "prizes"("code");

-- AddForeignKey
ALTER TABLE "admin_modules" ADD CONSTRAINT "admin_modules_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_stages" ADD CONSTRAINT "competition_stages_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_rules" ADD CONSTRAINT "stage_rules_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "competition_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_stage" ADD CONSTRAINT "registration_stage_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_stage" ADD CONSTRAINT "registration_stage_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "competition_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "competition_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "competition_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor_events" ADD CONSTRAINT "sponsor_events_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor_events" ADD CONSTRAINT "sponsor_events_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prizes" ADD CONSTRAINT "prizes_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
