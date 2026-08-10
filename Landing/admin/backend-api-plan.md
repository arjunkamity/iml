# India Mind League — Admin Backend & API Technical Plan

**Version:** 3.0 (full Microsoft Azure stack)  
**Status:** Draft for review  
**Applies to:** `Landing/admin/` console (and by extension the public site)

---

## 1. Purpose

This document specifies the database schema and REST API required to replace the
current static, file-based admin console (HTML + inline JSON + `admin-app.js`)
with a real backend. The admin currently renders from embedded `data-json` rows
and `<script type="application/json">` datasets; every change is in-memory and
resets on refresh. This plan defines the persisted model and the endpoints that
the existing pages can be switched to, page by page, without redesigning the UI.

The plan also formalises the **multi-stage progression flow** introduced in the
competition editor: each stage may be **Free** or **Paid**, and qualifying
participants must **pay to accept** their spot in the next stage.

**Hosting decision (v3.0, per client):** the entire backend runs on **Microsoft
Azure**:
- **Web app / hosting:** Azure **Static Web Apps** (admin console + public site)
- **API:** Azure **Functions** (Hono-compatible or raw HTTP triggers)
- **Database:** Azure **Database for PostgreSQL Flexible Server** (JSONB,
  relational schema below)
- **Files (all uploads):** Azure **Blob Storage** — question media, gallery
  photos, news/announcement images, sponsor assets, payment receipts.

No servers to manage; pay-per-use; scales on demand.

---

## 2. Current State (as-is)

### 2.1 Sidebar modules and entities

| Section | Page | Entity | Fields (current) |
|---|---|---|---|
| Overview | Dashboard | — | aggregate counts only |
| Competitions | Competitions | `comp` | id, title, grades, start, end, enrolled, status, multi, desc, stages[] |
| | Prizes & Awards | `prize` | id, comp, rank, money, award, note |
| | Leaderboard | (derived) | name, grade, school, score, total, comp |
| | Results (+ detail) | `res` | id, student, grade, school, comp, date, startedAt, finishedAt, score, total, timing, answers[] |
| Participants | Registrations | `reg` | id, name, grade, school, parent, phone, email, date, comp, status |
| | Payment History | `pay` | id, name, reg, phone, mode, amount, status |
| | Schools (+ detail) | `sch` | id, name, city, contact, coordinator, students |
| Content | Question Bank | `q` | id, grade, cat (IQ/EQ/Values), type, media, mode, label, ref, limit, comp, q, opts[], correct |
| | Exam Dates | `ex` | id, title, grade, date, time, duration, timing{mode,secs}, comp, status |
| | Grievances | `gri` | id, type, name, contact, subject, message, date, status |
| | Notifications | (nt) | history + send form (channel, audience, comp, subject, message) |
| Management Options | Announcements | `ann` | id, title, category, audience, date, status, pinned, message |
| | News | `news` | id, title, category, author, date, status, photo, summary |
| | Gallery | `gal` | id, name, date, photos, visibility, cover, desc, status |
| Administration | Sponsors | `spon` | id, name, contact, email, phone, tier, status, amount, since, events[] |
| | Sponsorship Plans | `plan` | id, name, min, benefits, active, extras[] |
| | Admin Users | `ad` | id, name, email, role, status, modules[] |

### 2.2 Stage qualifiers

`qualifiers.js` holds `IML_QUALIFIERS` keyed by competition id, each with
`reg`, `desc`, and `stages[]` containing `{ name, mode, pass, desc, rows[] }`.
A participant is **Qualified** when `score >= pass`. The results-detail page
renders one tab per stage listing qualified participants.

### 2.3 Known gaps the backend must close

1. No persistence — all CRUD is in-memory / reset on reload.
2. `reg` (registration) is treated as the student row; a real student profile
   with `dob`, `gender`, `address`, `parentPhone` only exists in
   `student-detail.html`'s `studentData` dataset.
3. Payments reference a registration but not a specific stage.
4. Stage pricing (`price`, `free`) is stored but never enforced.
5. Admin roles/modules (`ad.modules`) are decorative — no authorization.
6. Notifications are not persisted as records.

---

## 3. Target Architecture

```
Azure Static Web Apps                Azure Functions                     Azure Database for PostgreSQL
  admin + public site  ──────────────►  REST API /api/v1 (Hono or        ──────────►  relational tables
  (static HTML/JS/CSS)                 plain HTTP triggers)                 (Flexible Server, JSONB)
        │                              routes → services → repositories      + views (leaderboard,
        │ fetch()/JSON                    │                                   dashboard_summary)
        │                                 │ Azure Blob Storage SDK / REST
        ▼                                 ▼
  Browser                            Microsoft Azure Blob Storage (files: photos, media, receipts)
```

- **Web app (files):** Azure **Static Web Apps** serves `Landing/` (admin
  console + public site). `staticwebapp.config.json` routes `/api/*` to the
  linked Functions app; the Functions app runs in the same SWA backend.
- **API:** Azure **Functions** (isolated-process .NET or Node) with HTTP
  triggers. Layered `routes → services → repositories`; connection string to
  the PostgreSQL DB and the Blob Storage account come from Function App
  settings / Key Vault. Blob uploads/downloads use the `@azure/storage-blob` SDK
  (or REST) with a SAS token or account key / managed identity.
- **DB:** Azure **Database for PostgreSQL Flexible Server** (managed Postgres,
  ACID, JSONB + rich SQL). Schema is written in PostgreSQL dialect below; no
  server or connection pool to manage (Azure handles HA/backups).
- **Files:** Microsoft **Azure Blob Storage** (single storage account; container
  per category, e.g. `question-media`, `gallery`, `news`, `announcements`,
  `sponsors`, `receipts`). Public read via Blob container public access or a
  CDN endpoint; private containers served through SAS/presigned URLs issued by
  the Functions app.
- **Auth:** JWT (access ~15 min) + rotating refresh token (7 days) in an
  `httpOnly` cookie. Passwords hashed with `argon2id`. Refresh tokens live in
  the PostgreSQL `refresh_tokens` table; optional Azure AD / Entra ID SSO for
  extra admin protection.
- **Validation:** request schemas validated at the route layer (Hono `z`-style
  validator or a small hand-rolled schema check).
- **AuthZ:** middleware resolves the admin role and module permissions from
  `admin_modules` before every write/read on protected resources.
- **Migrations:** `func azure functionapp publish` + a Flyway/migrations folder
  — numbered SQL files applied in order to the Postgres DB. A seed script ports
  the current static JSON into Postgres for parity testing.

---

## 4. Database Schema

### 4.1 Identity & access

```sql
CREATE TABLE admins (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(30) NOT NULL DEFAULT 'Editor',   -- Super Admin | Editor | Viewer
  status        VARCHAR(20) NOT NULL DEFAULT 'Active',   -- Active | Disabled
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- replaces ad.modules[]
CREATE TABLE admin_modules (
  admin_id  INT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  module_code VARCHAR(30) NOT NULL,   -- dash, comp, reg, sch, q, ex, nt, ad, lb, res, pay, spon, plan, prize, ann, news, gal, gri
  PRIMARY KEY (admin_id, module_code)
);

CREATE TABLE refresh_tokens (
  id         SERIAL PRIMARY KEY,
  admin_id   INT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_admin ON refresh_tokens(admin_id);
```

### 4.2 Participants

```sql
CREATE TABLE schools (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(10) NOT NULL UNIQUE,        -- S01
  name        VARCHAR(190) NOT NULL,
  city        VARCHAR(90),
  contact     VARCHAR(40),
  coordinator VARCHAR(120)
);

CREATE TABLE students (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(10) NOT NULL UNIQUE,        -- R1001
  name        VARCHAR(120) NOT NULL,
  grade       VARCHAR(6) NOT NULL,                -- 9, 10, 11, 12
  school_id   INT REFERENCES schools(id),
  dob         DATE,
  gender      VARCHAR(12),
  phone       VARCHAR(20),
  email       VARCHAR(190),
  parent      VARCHAR(120),
  parent_phone VARCHAR(20),
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.3 Competitions & stages

```sql
CREATE TABLE competitions (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(10) NOT NULL UNIQUE,        -- C01
  title       VARCHAR(190) NOT NULL,
  grades      VARCHAR(20) NOT NULL,               -- 9-12
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'Draft',-- Draft | Open | Live | Closed
  is_multi    BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE competition_stages (
  id            SERIAL PRIMARY KEY,
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  position      INT NOT NULL,                     -- 1-based
  name          VARCHAR(120) NOT NULL,
  mode          VARCHAR(30) NOT NULL,             -- Online | Offline | Hybrid | Peer Interview
  pass_mark     NUMERIC(5,2) NOT NULL,            -- percentage 0-100
  is_free       BOOLEAN NOT NULL DEFAULT TRUE,    -- replaces free flag
  price         NUMERIC(10,2) NOT NULL DEFAULT 0, -- payable when is_free = FALSE
  description   TEXT,
  UNIQUE (competition_id, position)
);

CREATE TABLE stage_rules (
  id       SERIAL PRIMARY KEY,
  stage_id INT NOT NULL REFERENCES competition_stages(id) ON DELETE CASCADE,
  rule     TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0
);
```

**Migration note:** in the current seed a stage is `{ name, mode, pass, price, free, desc, rules[] }`.
`price`/`free` map directly to `competition_stages.price`/`is_free`.

### 4.4 Registrations & progression (pay-to-accept)

```sql
CREATE TABLE registrations (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(10) NOT NULL UNIQUE,     -- R1001
  student_id     INT NOT NULL REFERENCES students(id),
  competition_id INT NOT NULL REFERENCES competitions(id),
  status         VARCHAR(30) NOT NULL DEFAULT 'Registered', -- Registered | Test Taken | Qualified | Eliminated
  registered_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (student_id, competition_id)
);

-- The per-stage journey of one participant.
CREATE TABLE registration_stage (
  registration_id INT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  stage_id        INT NOT NULL REFERENCES competition_stages(id) ON DELETE CASCADE,
  status          VARCHAR(30) NOT NULL DEFAULT 'Locked',
  -- Locked (next stage not yet paid/unlocked) | Paid | Attempted | Qualified | Eliminated
  score           NUMERIC(5,2),
  qualified       BOOLEAN,
  unlocked_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  PRIMARY KEY (registration_id, stage_id)
);
```

Business rules (enforced in `POST /registrations/:id/accept-stage`):
1. The participant must be **Qualified** on stage *N* (score ≥ pass_mark).
2. Stage *N+1* must still be **Locked** (no double pay).
3. If stage *N+1* is free, unlock with `paid_at = NULL`; otherwise require a
   successful payment for `competition_stages.price` in the same DB transaction.
4. On success: insert/update `registration_stage` row → `Paid`/`unlocked_at`,
   insert a `payments` row.

### 4.5 Assessments

```sql
CREATE TABLE questions (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(12) NOT NULL UNIQUE,      -- Q1
  competition_id INT REFERENCES competitions(id),
  grade         VARCHAR(6) NOT NULL,
  category      VARCHAR(20) NOT NULL,             -- IQ | EQ | Values
  qtype         VARCHAR(12) NOT NULL DEFAULT 'text', -- text | video | image
  media         TEXT,
  mode          VARCHAR(10) NOT NULL DEFAULT 'single', -- single | multi
  label         VARCHAR(60),
  ref           VARCHAR(30),
  time_limit_secs INT,
  prompt        TEXT NOT NULL,
  options       JSONB NOT NULL DEFAULT '[]',      -- opts[]
  correct       JSONB NOT NULL DEFAULT '[]',      -- correct index(es)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exams (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(10) NOT NULL UNIQUE,     -- E01
  competition_id INT REFERENCES competitions(id),
  title          VARCHAR(190) NOT NULL,
  grade          VARCHAR(20),
  date           DATE,
  time           TIME,
  duration_min   INT,
  timing         JSONB NOT NULL DEFAULT '{}',     -- {mode:'common',secs:60} | {mode:'custom'}
  status         VARCHAR(20) NOT NULL DEFAULT 'Scheduled' -- Draft | Scheduled | Live | Closed
);

CREATE TABLE attempts (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(10) NOT NULL UNIQUE,     -- T01
  registration_id INT NOT NULL REFERENCES registrations(id),
  stage_id       INT REFERENCES competition_stages(id),
  started_at     TIMESTAMPTZ NOT NULL,
  finished_at    TIMESTAMPTZ,
  score          NUMERIC(5,2) NOT NULL DEFAULT 0,
  total          NUMERIC(5,2) NOT NULL DEFAULT 0,
  timing         JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE attempt_answers (
  id          SERIAL PRIMARY KEY,
  attempt_id  INT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id INT REFERENCES questions(id),
  answer      JSONB,
  is_correct  BOOLEAN,
  taken_secs  INT,
  time_up     BOOLEAN NOT NULL DEFAULT FALSE,
  started_at  TIMESTAMPTZ,
  answered_at TIMESTAMPTZ
);
CREATE INDEX idx_attempt_answers_attempt ON attempt_answers(attempt_id);
```

### 4.6 Payments

```sql
CREATE TABLE payments (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(20) NOT NULL UNIQUE,      -- PAY-1001
  registration_id INT NOT NULL REFERENCES registrations(id),
  stage_id      INT REFERENCES competition_stages(id),  -- stage being paid for
  amount        NUMERIC(10,2) NOT NULL,
  mode          VARCHAR(30) NOT NULL,             -- UPI | Card | Net Banking | Offline
  status        VARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending | Paid | Failed
  provider_txn  VARCHAR(120),
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.7 Content & comms

```sql
CREATE TABLE announcements (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(10) NOT NULL UNIQUE,        -- AN1
  title       VARCHAR(190) NOT NULL,
  category    VARCHAR(40),
  audience    VARCHAR(60),
  publish_on  DATE,
  status      VARCHAR(20) NOT NULL DEFAULT 'Draft', -- Draft | Active
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  message     TEXT
);

CREATE TABLE news (
  id       SERIAL PRIMARY KEY,
  code     VARCHAR(10) NOT NULL UNIQUE,           -- NW1
  title    VARCHAR(190) NOT NULL,
  category VARCHAR(40),
  author   VARCHAR(90),
  publish_on DATE,
  status   VARCHAR(20) NOT NULL DEFAULT 'Draft',  -- Draft | Published
  photo    TEXT,
  summary  TEXT
);

CREATE TABLE gallery (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(10) NOT NULL UNIQUE,         -- GA1
  name       VARCHAR(190) NOT NULL,
  date       DATE,
  visibility VARCHAR(20) NOT NULL DEFAULT 'Public', -- Public | Private
  cover      TEXT,
  description TEXT,
  photos     JSONB NOT NULL DEFAULT '[]',
  status     VARCHAR(20) NOT NULL DEFAULT 'Active'
);

CREATE TABLE grievances (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(10) NOT NULL UNIQUE,        -- GV1
  gtype       VARCHAR(30) NOT NULL,               -- Complaint | Feedback | Suggestion
  student_id  INT REFERENCES students(id),
  name        VARCHAR(120),
  contact     VARCHAR(40),
  subject     VARCHAR(190),
  message     TEXT NOT NULL,
  status      VARCHAR(30) NOT NULL DEFAULT 'New', -- New | In Progress | Resolved
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by INT REFERENCES admins(id),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE notifications (
  id             SERIAL PRIMARY KEY,
  channel        VARCHAR(12) NOT NULL,            -- EMAIL | SMS
  audience       VARCHAR(60) NOT NULL,
  competition_id INT REFERENCES competitions(id),
  subject        VARCHAR(190),
  message        TEXT NOT NULL,
  html           BOOLEAN NOT NULL DEFAULT FALSE,
  status         VARCHAR(20) NOT NULL DEFAULT 'Draft', -- Draft | Sent | Failed
  sent_at        TIMESTAMPTZ,
  created_by     INT REFERENCES admins(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.8 Sponsorship

```sql
CREATE TABLE sponsors (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(10) NOT NULL UNIQUE,          -- SP01
  name      VARCHAR(190) NOT NULL,
  contact   VARCHAR(120),
  email     VARCHAR(190),
  phone     VARCHAR(20),
  tier      VARCHAR(30),                          -- Gold | Silver | Bronze
  status    VARCHAR(20) NOT NULL DEFAULT 'Active',-- Active | Disabled | Pending
  amount    NUMERIC(12,2),
  since     VARCHAR(4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sponsor_events (
  sponsor_id      INT NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  competition_id  INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  PRIMARY KEY (sponsor_id, competition_id)
);

CREATE TABLE plans (
  id       SERIAL PRIMARY KEY,
  code     VARCHAR(10) NOT NULL UNIQUE,           -- PL1
  name     VARCHAR(60) NOT NULL,
  min_amount NUMERIC(12,2) NOT NULL,
  benefits TEXT,
  extras   JSONB NOT NULL DEFAULT '[]',
  active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE prizes (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(10) NOT NULL UNIQUE,     -- PR1
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  rank_label     VARCHAR(30) NOT NULL,            -- 1st | 2nd | 3rd | Consolation
  money          NUMERIC(12,2),
  award          VARCHAR(60),
  note           TEXT
);
```

### 4.9 Views

```sql
CREATE VIEW leaderboard AS
SELECT
  a.code          AS attempt_code,
  r.competition_id,
  a.score,
  a.total,
  s.name          AS student,
  s.grade,
  sc.name         AS school
FROM attempts a
JOIN registrations r ON r.id = a.registration_id
JOIN students s     ON s.id = r.student_id
LEFT JOIN schools sc ON sc.id = s.school_id;

CREATE VIEW dashboard_summary AS
SELECT
  (SELECT count(*) FROM registrations)                   AS registrations,
  (SELECT count(*) FROM competitions)                    AS competitions,
  (SELECT count(*) FROM questions)                       AS questions,
  (SELECT count(*) FROM exams WHERE status = 'Scheduled') AS upcoming_exams,
  (SELECT count(*) FROM students)                        AS students,
  (SELECT count(*) FROM payments WHERE status = 'Paid')  AS paid_payments;
```

### 4.10 File storage (Microsoft Azure Blob Storage)

Files are stored in **Azure Blob Storage**, never in Postgres. Columns that hold media
URLs (`questions.media`, `news.photo`, `gallery.photos` + `cover`, announcement
attachments, payment receipts) store the blob key (or public URL), not the bytes.

| Container | Contents | Access |
|---|---|---|
| `iml-public` (public / CDN) | question media (image/video), gallery photos, news/announcement images, sponsor logos | public read via `<storage-account>.blob.core.windows.net/iml-public/...` or CDN endpoint |
| `iml-private` (private) | coordinator uploads, draft documents, payment receipts | SAS URLs issued per-request by the API |

Endpoints (added to section 5):
| Method | Path | Notes |
|---|---|---|
| POST | `/files/upload` | multipart → Azure Blob; returns `{ key, url, size, contentType }` |
| GET | `/files/:key` | redirect to public URL or short-lived SAS URL |
| DELETE | `/files/:key` | delete blob |
| POST | `/files/presign` | temporary SAS upload URL for the private container |

The API authenticates to Azure with the connection string / account key or a
managed identity token stored in a Functions secret; uploads are streamed to Blob
(no local persistence). Size/type checks (max ~25 MB, images/video/pdf) are
enforced in the API; blob keys are namespaced by entity, e.g.
`questions/Q1.mp4`, `gallery/GA2/01.jpg`, `receipts/PAY-1001.pdf`.

---

## 5. REST API — Endpoint Catalogue (`/api/v1`)

Conventions:
- JSON bodies; errors as `{ "error": { "code": "...", "message": "..." } }`.
- List endpoints support `?page=&limit=&search=&comp=&status=` + `?fields=`.
- Mutations return the persisted resource.
- Auth header: `Authorization: Bearer <access>` (or httpOnly cookie).

### 5.1 Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | body `{email, password}` → `{accessToken, admin}` |
| POST | `/auth/refresh` | rotates refresh token |
| POST | `/auth/logout` | revokes refresh token |

### 5.2 Dashboard
| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard/summary` | from `dashboard_summary` view |

### 5.3 Competitions
| Method | Path | Notes |
|---|---|---|
| GET | `/competitions` | list, filters |
| POST | `/competitions` | create |
| GET | `/competitions/:id` | detail incl. `stages` |
| PUT | `/competitions/:id` | update (title, dates, status, stages) |
| DELETE | `/competitions/:id` | soft delete |
| GET | `/competitions/:id/stages` | stage list with price/free |
| GET | `/competitions/:id/qualifiers` | per-stage qualified rows (score ≥ pass) — powers the results-detail stage tabs |

### 5.4 Participants
| Method | Path | Notes |
|---|---|---|
| GET | `/registrations` | list w/ competition filter |
| POST | `/registrations` | create (student + competition) |
| GET | `/registrations/:id` | detail: student, comp, stages, payments |
| PUT | `/registrations/:id` | update status/contact |
| DELETE | `/registrations/:id` | |
| **POST** | **`/registrations/:id/accept-stage`** | **business rule: qualify on stage N → pay price of stage N+1 → unlock. Transactional.** |
| GET | `/students/:id` | profile + competitions + payments + results |
| PUT | `/students/:id` | edit profile |
| GET | `/schools` | list |
| GET | `/schools/:id` | detail + participants + payments |

### 5.5 Payments
| Method | Path | Notes |
|---|---|---|
| GET | `/payments` | list w/ status filter |
| GET | `/payments/:id` | detail |
| POST | `/payments` | record payment |
| GET | `/payments/:id/receipt` | receipt payload (PDF/HTML) |
| POST | `/payments/:id/send-receipt` | email/SMS receipt |

### 5.6 Results
| Method | Path | Notes |
|---|---|---|
| GET | `/results` | attempt list w/ comp filter |
| GET | `/results/:id` | attempt + answers |
| GET | `/leaderboard?comp=` | ranked by score desc |

### 5.7 Content
| Method | Path | Notes |
|---|---|---|
| CRUD | `/questions` | incl. `?cat=&grade=&comp=` |
| CRUD | `/exams` | |
| CRUD | `/announcements` | |
| CRUD | `/news` | |
| CRUD | `/gallery` | |
| CRUD | `/grievances` | + `PATCH /grievances/:id` status transition |
| POST | `/notifications/send` | persists + sends EMAIL/SMS |
| GET | `/notifications` | history |

### 5.8 Sponsorship & Admin
| Method | Path | Notes |
|---|---|---|
| CRUD | `/sponsors` | |
| CRUD | `/plans` | |
| CRUD | `/prizes` | |
| CRUD | `/admins` | Super Admin only; manages role + `admin_modules` |
| GET | `/admins/me` | current admin + permissions |

### 5.9 Example request/response

`POST /api/v1/registrations/R1002/accept-stage`
```json
{
  "stage": "Stage 2",
  "payment": { "mode": "UPI", "provider_txn": "UPI-88234" }
}
```
```json
{
  "registrationId": "R1002",
  "acceptedStage": { "name": "Stage 2", "position": 2, "isFree": false, "price": 150 },
  "status": "Paid",
  "payment": { "code": "PAY-1009", "amount": 150, "status": "Paid" }
}
```

`GET /api/v1/competitions/C02/qualifiers`
```json
{
  "competitionId": "C02",
  "stages": [
    { "name": "Stage 1", "mode": "Online", "pass": 40, "rows": [
      { "student": "Aarav Mehta", "grade": "9", "school": "Amity International School, Saket", "score": 55, "qualified": true } ] }
  ]
}
```

---

## 6. Auth & Authorization

- **Login:** verify `admins.email` + argon2id password. Issue access (15 min) +
  refresh (7 d) tokens. Refresh token stored hashed in `refresh_tokens`.
- **RBAC:** `requireRole('Super Admin')` for admin-user management. All other
  routes pass `requireModule('comp')`-style middleware that checks
  `admin_modules` for the authenticated admin.
- **Viewer** role: read-only enforcement at the service layer.

---

## 7. Security

- Password hashing: argon2id; password reset via signed one-time link.
- SQL: parameterized queries only (no string interpolation).
- Input: schema validation on every body/query param; HTML escaping retained in
  UI (existing `esc()` pattern).
- Rate limiting on `/auth/*`; audit log table for destructive operations
  (recommended addition: `audit_log(id, admin_id, action, target, created_at)`).
- Payments: amounts are server-authoritative (client never sets `amount` on
  accept-stage); webhook/refund flow to be designed with the payment gateway.

---

## 8. Migration Strategy (static → Azure)

1. **Provision:** create the Azure Static Web App, Function App, PostgreSQL
   Flexible Server (DB `iml`, `utf8`), and Storage Account in the chosen region.
   Store DB + Blob connection strings / keys in the Function App settings (or
   Azure Key Vault).
2. **Schema:** versioned PostgreSQL DDL files (section 4) in a `migrations/`
   folder; apply in order via Flyway (or `psql -f`) to dev and prod DBs.
3. **Seed:** a one-time script reads the current static JSON from the HTML files
   and `qualifiers.js` and inserts into Postgres → parity fixture.
4. **Files:** upload question media / gallery photos / sponsor assets to **Azure
   Blob Storage** (`az storage blob upload-batch` to the `iml-public` container,
   or the API upload route); rewrite the hardcoded `picsum.photos`/Youtube
   media URLs to Azure blob URLs (or keep external URLs).
5. **API:** scaffold the Azure Functions app (`func new` HTTP triggers), wire the
   PostgreSQL connection pool and Blob credentials in `local.settings.json` /
   app settings; run locally with `func start`; deploy with
   `func azure functionapp publish <name>`.
6. **Prove parity:** a test compares UI-rendered numbers (dashboard counts,
   leaderboard, qualifier tabs) between static and API responses.
7. **Page-by-page switch:** introduce an `api.js` fetch layer in `admin-app.js`;
   each page's `init` branch reads from `GET /...` instead of inline JSON, with
   a `MOCK` flag to fall back to static data during transition.
8. **Writes first:** CRUD endpoints for competitions, registrations, payments,
   questions, exams, content modules; then the progression endpoint
   (`accept-stage`); notifications last (external email/SMS integration via
   `fetch` to the mail/SMS provider, or a queued "outbox" table for async sends).
9. **Retire static data:** remove inline `data-json`/datasets once parity is
   confirmed.

---

## 9. Open Questions

1. Should a student be able to register for the same competition more than once
   (re-attempt)? Current model assumes one registration per student+competition.
2. Do stage fees apply only from Stage 2 onward (Stage 1 always free), or can
   every stage — including Stage 1 — be paid?
3. Payment gateway vendor (Razorpay / PayU / offline collection)? Determines the
   provider fields on `payments` and webhook design.
4. Notification delivery — real EMAIL/SMS provider now (`fetch` to the provider
   API from the Functions app), or a queued "outbox" table for a later phase?
5. Public-site API surface (student portal: register, take quiz, see results) —
   separate scope from this admin document, or shared `/api/v1`?
6. Azure details: which Azure subscription + region? Storage account name and
   auth method for the Functions app (storage account key vs SAS vs managed
   identity / Entra ID)? PostgreSQL SKU/size?
7. Functions language/runtime: Node.js vs .NET isolated — pick based on team
   familiarity (recommend Node + TypeScript to match the existing JS codebase).
8. Database engine confirm: **Azure Database for PostgreSQL** (recommended,
   matches the JSONB schema below) vs Azure SQL Database — affects DDL dialect.
