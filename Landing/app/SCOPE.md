# India Mind League — Application Scope (v1)

> Living scope document for the rebuild of the India Mind League platform into a
> single deployable app, replacing the current static multi-page HTML site.
>
> **Stack (agreed):** Angular (single app, lazy feature modules) · NestJS + TypeScript · Prisma · PostgreSQL (Docker).

---

## 1. Goal

Turn the three existing static front-ends into **one app** with three surfaces,
backed by a single API and database:

| Surface | Audience | Today (static) | Target |
|---|---|---|---|
| **Web** | Public visitors | `D:\INDIA MIND LEAGUE\Landing\*.html` (4–5 pages) | Public marketing + info pages |
| **Account** | Students after login | `Landing\login.html` → `Landing\dashboard.html`, `exam.html` | Student dashboard & qualifier flow |
| **Admin** | Staff / coordinators (CMS) | `D:\INDIA MIND LEAGUE\Landing\admin\` (33 files) | Full CMS replacing `admin-*.html` |

New code lives in **`D:\INDIA MIND LEAGUE\Landing\app`**, split into:

```
app/
  web/          # Angular app (all three surfaces, lazy-loaded)
  api/          # NestJS REST API (PostgreSQL via Prisma)
```

---

## 2. Architecture Overview

```
Browser (Angular SPA)
   ├── /            → public marketing module   (public)
   ├── /login       → OTP login (email/phone)
   ├── /account/*   → student dashboard module  (protected, STUDENT role)
   ├── /admin/*     → CMS module                (protected, ADMIN roles)
   └── HttpClient ──► /api/v1/*  (NestJS)  ──►  PostgreSQL (Prisma)
                                                     ▲
                                          files (Blob) — phase 2
```

- **web/** — Angular workspace. One app shell (`browser-app`), feature modules
  lazy-loaded per surface so each area ships only its own code.
- **api/** — NestJS with modular layout `routes/controllers → services →
  repositories`, Prisma as the data layer. Serves `/api/v1/*`.
- **Auth:** JWT access token + refresh token (httpOnly cookie), passwords /
  OTP hashes with `argon2id`. Student OTP flow mirrors current `login.js`.
- Deployed on **Azure** (Static Web Apps + Functions or App Service hosting the
  NestJS API; DB = Azure Database for PostgreSQL; files = Azure Blob) — final
  hosting already decided in `admin/backend-api-plan.md`.

---

## 3. Surface Breakdown

### 3.1 Web — Public (`/`)
Routes (from current `index.html` sections + auth pages):
- `/` — Home: splash/onboarding, hero, about, visionary, pillars, how-it-works,
  stats, rewards, CTA, footer/contact, leaderboard section.
- `/register` — Student registration form (name, grade, phone, school, etc.).
- `/login` — Email/Phone OTP login (segmented toggle, 6-digit OTP, resend).
- Static content becomes seed data in the CMS (announcements, news, gallery,
  sponsors, plans) rendered from the API — no hardcoded HTML sections.

### 3.2 Account — Student (`/account`)  → **needs design**
Auth-gated. Replaces `dashboard.html`, `exam.html` + adds the missing pieces
listed in the old dashboard's user menu (My Profile, Settings):
- `/account` — Dashboard: welcome, stage/rank/points/streak/badges, qualifier
  progress, exam countdown, up-next list, region leaderboard, certificate CTA.
- `/account/qualifier` — The exam player (IQ/EQ/Values, timer, palette, save &
  exit) — port of `exam.html`/`exam.js`.
- `/account/results` — Attempt results, qualifier stage status.
- `/account/profile` — Student profile + settings.
- `/account/certificates` — Earned certificates/badges.

### 3.3 Admin — CMS (`/admin`)  → **protected, roles**
Port of `D:\INDIA MIND LEAGUE\Landing\admin\*` (33 files). Module map from the
current sidebar (`admin-app.js` `MODULES` + sidebar sections):

| Section | Pages | Module keys |
|---|---|---|
| Overview | Dashboard | `dash` |
| Competitions | Competitions (+ edit), Prizes & Awards, Leaderboard, Results (+ detail) | `comp`, `prize`, `lb`, `res` |
| Participants | Registrations, Payment History, Schools (+ detail) | `reg`, `pay`, `sch` |
| Content | Question Bank, Exam Dates, Grievances, Notifications | `q`, `ex`, `gri`, `nt` |
| Management | Announcements, News, Gallery | content |
| Administration | Sponsors (+ add/detail), Sponsorship Plans, Admin Users | `spon`, `plan`, `ad` |

Detail/edit pages (competition-edit, student-edit, school-detail, sponsor-add,
sponsor-detail, results-detail) become child routes / dialogs in the admin
module.

---

## 4. Angular App Structure (`web/`)

Single Angular app, lazy feature modules:

```
web/
  src/
    app/
      core/            # auth guard, http/auth service, jwt interceptor, roles
      shared/          # components, pipes, tokenizer-free UI (badges, tabs, tables)
      features/
        public/        # lazy — home, register, login, leaderboard
        account/       # lazy — student dashboard, qualifier, results, profile
        admin/         # lazy — all CMS modules (sub-lazy per section)
      app.routes.ts    # shell routing with guards
    assets/            # images, fonts, sprites (copied from Landing/)
    styles/            # global css ported from Landing/css + admin/css
```

Guards:
- `AuthGuard` — requires valid JWT.
- `RoleGuard` — ADMIN roles for `/admin/*`; STUDENT for `/account/*`.

---

## 5. API Structure (`api/`)

NestJS + Prisma. One Prisma schema (22 tables from `backend-api-plan.md` §4).
Module layout mirrors the admin module map so each CMS surface maps 1:1:

```
api/src/
  main.ts                  # bootstrap, global prefix /api/v1, cors, validation pipe
  prisma/                  # PrismaClient provider + migration files
  auth/                    # login (admin password), student OTP, refresh, guards
  admins/                  # CRUD admin users + modules
  competitions/            # CRUD competitions/stages; progression (accept-stage)
  registrations/           # student registrations
  students/                # students (name, grade, school, contact)
  schools/                 # schools CRUD
  payments/                # payment records
  questions/               # question bank (IQ/EQ/Values), multiselect
  exams/                   # exam dates/timing
  results/                 # attempts, leaderboard view
  notifications/           # notifications
  content/                 # announcements, news, gallery
  sponsors/                # sponsors + plans
  grievances/              # student grievances
  dashboard/               # aggregate stats for admin + student dashboards
  files/                   # phase 2 — Azure Blob upload/download (SAS URLs)
```

---

## 6. Auth & Roles

| Actor | Login | Role | Access |
|---|---|---|---|
| Student | OTP to email/phone | `STUDENT` | `/account/*`, public |
| Admin | Email + password | `SUPER_ADMIN` \| `EDITOR` \| `VIEWER` | `/admin/*` (module-scoped) |
| Public | — | guest | public pages only |

Admin module permissions (from `admin_modules` in the plan) enforce which CMS
sections an admin can open. Refresh tokens persisted in `refresh_tokens` table.

---

## 7. Data Model

Use `admin/backend-api-plan.md` §4 (PostgreSQL / Prisma-adapted):
- Identity & access: `admins`, `admin_modules`, `refresh_tokens`
- Participants: `students`, `schools`, `registrations`, `payments`
- Competitions: `competitions`, `stages`, `attempts`, `attempt_answers`,
  `questions`, `exams`
- Content: `announcements`, `news`, `gallery`
- Sponsorship: `sponsors`, `plans`, `prizes`
- `grievances`, `notifications`, views (`leaderboard`, `dashboard_summary`)

---

## 8. Build & Run

- DB: PostgreSQL in **Docker** (credentials TBD by user) — schema via Prisma
  `migrate dev`.
- `api/`: `npm i` → `.env` (DATABASE_URL, JWT secrets) → `npm run start:dev`.
- `web/`: `npm i` → `npm start` → Angular dev server, API proxied to
  `http://localhost:3000/api` (Angular proxy config).
- Seed: a script ports current static JSON (`competitions.js`, `qualifiers.js`,
  admin datasets) into Postgres for parity.

---

## 9. Phased Plan

1. **Scaffold:** create Angular workspace (`web/`) + NestJS app (`api/`),
   Prisma schema + first migration, Docker Postgres up.
2. **Auth core:** Prisma `auth` module (admin password, student OTP), JWT +
   refresh, guards wired into the Angular shell.
3. **Public module:** port home/register/login to Angular components + API data
   for content sections.
4. **Account module:** design + build student dashboard, qualifier player,
   results/profile (new design).
5. **Admin module:** port CMS pages section-by-section to Angular lazy modules
   against the API; retire static `admin/*.html`.
6. **Parity + files:** prove UI parity vs static (validate.js approach); add
   Azure Blob file handling; deploy to Azure.

---

## 10. Open Items

- [ ] Docker Postgres connection details (user will share) → `.env`/prisma.
- [ ] Student account design direction (visuals / layout) before building.
- [ ] Whether public pages stay fully Angular-rendered vs hybrid static+API.
- [ ] File storage scope for phase 1 (upload admin assets?) vs phase 2.
- [ ] OTP delivery: real email/SMS provider now vs dev stub.
