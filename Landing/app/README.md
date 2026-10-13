# India Mind League — Application

Full-stack platform powering **[indiamindleague.com](https://indiamindleague.com)** — India's school
Intellectual & Leadership Championship. One Angular app with three surfaces (public site,
student account, admin CMS) backed by a single NestJS API and PostgreSQL database.

This repository replaces the earlier static multi-page HTML prototype with a single
deployable, database-backed application.

---

## Contents

1. [Architecture](#architecture)
2. [Tech stack](#tech-stack)
3. [Repository structure](#repository-structure)
4. [Application surfaces](#application-surfaces)
5. [API modules & data model](#api-modules--data-model)
6. [Local development](#local-development)
7. [Environment variables](#environment-variables)
8. [Database & Prisma](#database--prisma)
9. [Build](#build)
10. [Production infrastructure](#production-infrastructure)
11. [CI/CD — GitHub Actions](#cicd--github-actions)
12. [Automatic rollback](#automatic-rollback)
13. [Manual deployment](#manual-deployment-fallback)
14. [Operations & diagnostics](#operations--diagnostics)
15. [Security](#security)
16. [Roadmap](#roadmap)

---

## Architecture

```
Browser
   │
   ▼
https://indiamindleague.com
   │
   ▼
 NGINX  (TLS termination, static hosting, reverse proxy)
   │
   ├──────────────────────┬─────────────────────────┐
   ▼                      ▼                          │
Angular SPA           NestJS API                     │
served as static      /api/v1/*                      │
files at /            (proxied to 127.0.0.1:3000)     │
                           │                          │
                           ▼                          │
                         PM2  (process manager)        │
                           │                          │
                           ▼                          │
                         Prisma ORM                    │
                           │                          │
                           ▼                          │
                    PostgreSQL 16 (127.0.0.1:5432) ────┘
```

The Angular SPA is a **single app with three lazily-loaded surfaces**, all talking to one
API:

```
Angular SPA
  ├── /            public marketing site (home, register, login, leaderboard, rewards, legal)
  ├── /account/*   student portal — protected, STUDENT role   (JWT)
  └── /admin/*     admin CMS      — protected, ADMIN roles    (JWT)
          │
          └── HttpClient ──► /api/v1/*  (NestJS) ──► PostgreSQL (Prisma)
```

Frontend, API, database, NGINX, PM2, the GitHub Actions self-hosted runner, and Let's
Encrypt all run on a single Azure Ubuntu VM (see [Production infrastructure](#production-infrastructure)).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Angular ^22, TypeScript, lazy-loaded feature modules |
| Backend | NestJS ^11, Node.js 24 |
| ORM / migrations | Prisma ^6 |
| Database | PostgreSQL 16 |
| Auth | JWT access + refresh tokens, `argon2id` password hashing (`@node-rs/argon2`), student OTP login |
| Validation | `class-validator` / `class-transformer` |
| Process manager (prod) | PM2 |
| Web server (prod) | NGINX (static hosting + reverse proxy) |
| TLS | Let's Encrypt (Certbot, auto-renewing) |
| CI/CD | GitHub Actions, self-hosted runner on the production VM |
| Hosting | Azure VM (Ubuntu 24.04 LTS) |

---

## Repository structure

```
.
├── api/                    NestJS backend — serves /api/v1/*
│   ├── src/
│   │   ├── admin/          admin CMS modules (see below)
│   │   ├── auth/           JWT + OTP auth, guards, decorators
│   │   ├── common/         shared DTOs (list query/result), utils
│   │   ├── prisma/         PrismaService / PrismaModule
│   │   ├── public/         public-site endpoints
│   │   ├── student/        student-account endpoints
│   │   └── main.ts         entry point → compiles to dist/src/main.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── package.json
├── web/                    Angular workspace
│   └── src/app/
│       ├── core/           auth guard, HTTP/auth service, JWT interceptor, role guard
│       ├── shared/         shared UI (badges, tabs, tables, etc.)
│       └── features/
│           ├── public/     home, register, login, leaderboard, rewards, legal
│           ├── account/    dashboard, exam, results, schedules, payments, profile, help-desk
│           └── admin/      admin CMS shell, CRUD pages, dashboard, leaderboard, results
├── .github/workflows/
│   └── deploy-production.yml   self-hosted CI/CD pipeline with automatic rollback
└── SCOPE.md                 living product/architecture scope document
```

---

## Application surfaces

### Public (`/`)
Home (splash, hero, about, visionary, pillars, how-it-works, stats, rewards, CTA,
footer/contact, leaderboard), `/register` (student registration), `/login` (email/phone
OTP login). Marketing content (announcements, news, gallery, sponsors, plans) is served
from the API/CMS rather than hardcoded.

### Account (`/account`) — protected, `STUDENT` role
Student dashboard (stage/rank/points/streak/badges, qualifier progress, exam countdown,
region leaderboard, certificate CTA), the qualifier exam player (timed IQ/EQ/Values MCQ
with question palette), results, schedules, payments, profile, help desk.

### Admin (`/admin`) — protected, `ADMIN` roles
CMS covering:

| Section | Pages |
|---|---|
| Overview | Dashboard |
| Competitions | Competitions, Prizes & Awards, Leaderboard, Results |
| Participants | Registrations, Payment History, Schools |
| Content | Question Bank, Exam Dates, Grievances, Notifications |
| Management | Announcements, News, Gallery |
| Administration | Sponsors, Sponsorship Plans, Admin Users |

---

## API modules & data model

All routes are served under the global prefix **`/api/v1`**.

**NestJS modules** (`api/src/`):

```
auth/       JWT login/refresh, student OTP request/verify, guards (jwt, roles, student, super-admin)
public/     public-site read endpoints
student/    student-account endpoints (protected)
admin/
  ├── admins/          admin user management
  ├── competitions/    competitions & stages
  ├── content/         announcements / news / gallery
  ├── dashboard/       admin dashboard aggregates
  ├── finance/         payments
  ├── grades/          grade lookups
  ├── registrations/   student registrations
  ├── results/         exam attempts & responses
  └── sponsorship/     sponsors, sponsor events, plans
```

**Prisma models** (`api/prisma/schema.prisma`):

```
Admin · AdminModule · RefreshToken · Otp
School · Grade · Student
Competition · CompetitionStage · StageRule
Registration · RegistrationStage
Question · Exam · Attempt · AttemptAnswer
Payment · Plan · Prize
Announcement · News · Gallery · Grievance · Notification
Sponsor · SponsorEvent
```

---

## Local development

**Prerequisites:** Node.js 24.x, PostgreSQL (local or Docker), npm.

```bash
git clone git@github.com:arjunkamity/iml-app.git
cd iml-app
```

### API

```bash
cd api
npm install
cp .env.example .env        # then fill in DATABASE_URL / JWT secrets
npx prisma migrate dev      # applies migrations to your local DB
npm run start:dev           # NestJS with watch mode — http://127.0.0.1:3000/api/v1
```

### Web

```bash
cd web
npm install
npm start                   # ng serve — http://localhost:4200
```

Angular's dev server proxies API calls — the app always calls the **relative** path
`/api/v1`, never a hardcoded `http://localhost:3000`, so the same build works locally,
behind NGINX, and in production.

---

## Environment variables

`api/.env` (never committed — see [Security](#security)):

```env
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/iml?schema=public"
JWT_ACCESS_SECRET="<generate-a-random-string>"
JWT_REFRESH_SECRET="<generate-a-random-string>"
PORT=3000
```

Template lives at `api/.env.example` — copy it, never edit `.env.example` with real values.

---

## Database & Prisma

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

| Task | Command |
|---|---|
| Generate client | `npx prisma generate` |
| Apply migrations locally (dev) | `npx prisma migrate dev` |
| Apply migrations in production | `npx prisma migrate deploy` |
| Seed | `npx prisma db seed` (see `prisma/seed.ts`) |

Production uses `prisma migrate deploy` only — **never** `migrate dev` against
production data. Automatic deploy rollback does **not** reverse database migrations
(migrations can be destructive/irreversible), so schema changes should follow an
**expand → deploy → contract** pattern:

```
Release 1: add the new column (nullable / with default)
Release 2: start using the new column in application code
Release 3: remove the old column, once nothing depends on it
```

Avoid combining a destructive schema change with the application code that first
depends on it in the same release.

---

## Build

### API

```bash
cd api
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build            # nest build → dist/src/main.js
```

Production start script (`api/package.json`):

```json
"start:prod": "node dist/src/main.js"
```

> The compiled entry point is under `dist/src/`, not `dist/`. Do not change this back
> to `node dist/main` — it will fail to start.

**PM2 launches the compiled entry point directly with `--env-file`, not `npm run start:prod`:**

```bash
pm2 start dist/src/main.js --name iml-api --node-args="--env-file=.env"
```

The app itself never loads `.env` (no `dotenv`/`ConfigModule` — only Prisma auto-loads it,
independently of the rest of the app). Using Node's native `--env-file` flag at the PM2
level means the process always has `DATABASE_URL`/`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`
regardless of how the process is started or recreated. Do not go back to
`pm2 start npm -- run start:prod` (or any launch path that skips `--env-file`) — the
process will boot and even connect to the DB via Prisma's own loading, but every request
that needs to sign a JWT (including admin/student login) will 500 with
`secretOrPrivateKey must have a value`.

For local testing against this same compiled build with a local, non-production `.env`,
see `npm run start:prod:local` (`api/.env.production.local`, git-ignored, port 3001).

### Web

```bash
cd web
npm ci
npm run build             # ng build → dist/iml-web/browser
```

Angular is never run with `ng serve` in production — NGINX serves the static build
output directly.

---

## Production infrastructure

Single Azure Ubuntu VM hosts the frontend, API, database, NGINX, PM2, the GitHub
Actions runner, and SSL tooling.

| Item | Value |
|---|---|
| VM hostname | `acip-vm-iml01` |
| OS | Ubuntu 24.04.4 LTS (x86_64) |
| SSH user | `azureuser` |
| Web ports | `80`, `443` |
| API internal port | `3000` (proxied by NGINX, not public) |
| PostgreSQL | `127.0.0.1:5432` (localhost only, not public) |
| Production checkout | `/var/www/iml` |
| Production branch | `main` |

```
/var/www/iml
├── api/                → dist/src/main.js, run under PM2 as "iml-api"
├── web/dist/iml-web/browser/   → served by NGINX at /
├── SCOPE.md
└── .git
```

**NGINX** (`/etc/nginx/sites-available/iml`) serves the Angular build as static files
at `/`, proxies `/api/` to `127.0.0.1:3000`, and (via Certbot) redirects HTTP → HTTPS.

**TLS** via Let's Encrypt / Certbot, auto-renewing (`sudo certbot renew --dry-run` to
test).

**Process management** via PM2 (`pm2 status`, `pm2 logs iml-api`, `pm2 restart iml-api`),
started at boot through a systemd unit (`pm2-azureuser`).

Production URLs:

- Frontend: `https://indiamindleague.com/`
- API: `https://indiamindleague.com/api/v1`

---

## CI/CD — GitHub Actions

Workflow: [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml)
Trigger: every push to `main`
Runner: self-hosted (`iml-prod`, labels `self-hosted`, `Linux`, `X64`), running as a
systemd service on the production VM — jobs run **on** the VM, nothing is SSH'd in from
GitHub's cloud runners.

```
git push main
      │
      ▼
GitHub Actions
      │
      ▼
Self-hosted runner (iml-prod, on the production VM)
      │
      ▼
/var/www/iml
      │
      ├── API:      npm ci → prisma generate → prisma migrate deploy → npm run build → pm2 restart
      ├── Angular:  npm ci → npm run build
      ├── nginx -t
      ├── nginx reload
      └── API health check (local + public HTTPS)
```

For normal deployments, SSH access to the VM is not required — push to `main` and the
runner does the rest. SSH is reserved for infrastructure maintenance: PostgreSQL
administration, NGINX config changes, PM2 diagnostics, SSL maintenance, or runner
maintenance.

---

## Automatic rollback

The deploy workflow wraps the whole deployment in a bash `ERR` trap. If **any** step
fails — build, `prisma migrate deploy`, PM2 restart, or either health check — it
automatically rolls back:

1. Records the currently-deployed commit before touching anything.
2. Backs up the current Angular build (`web/dist/iml-web/browser`) to
   `/var/www/iml-backups/web-current`.
3. Deploys the new commit: installs deps, generates the Prisma client, applies
   migrations, builds both API and web, restarts PM2, validates + reloads NGINX, then
   runs a local **and** a public HTTPS health check.
4. **On failure at any of those steps:** resets the git checkout to the previous
   commit, reinstalls + rebuilds the previous API, restarts PM2, restores the previous
   Angular build from the backup, reloads NGINX, and re-verifies health.

Database migrations are **not** auto-reversed (see [Database & Prisma](#database--prisma))
— rollback restores code and the compiled build, not schema state.

The deploy user has narrowly-scoped passwordless sudo, only for the two commands the
pipeline needs:

```
azureuser ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /usr/bin/systemctl reload nginx
```

(`/etc/sudoers.d/iml-deploy`) — no broader passwordless sudo is granted to the runner.

---

## Manual deployment (fallback)

If GitHub Actions is unavailable, deploy by hand on the VM:

```bash
cd /var/www/iml
git fetch origin main
git checkout main
git reset --hard origin/main

cd api
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart iml-api
pm2 save

cd ../web
npm ci
npm run build

sudo nginx -t
sudo systemctl reload nginx

curl http://127.0.0.1:3000/api/v1
curl https://indiamindleague.com/api/v1
```

---

## Operations & diagnostics

```bash
# API
curl http://127.0.0.1:3000/api/v1          # expect: Hello World!
curl https://indiamindleague.com/api/v1

# Frontend
curl -I https://indiamindleague.com/        # expect: HTTP/1.1 200

# PM2
pm2 status
pm2 logs iml-api --lines 100

# PostgreSQL
pg_lsclusters
sudo ss -lntp | grep 5432                   # should show 127.0.0.1:5432 only

# NGINX
sudo nginx -t
sudo systemctl status nginx

# GitHub Actions runner
cd ~/actions-runner && sudo ./svc.sh status # expect: Active (running) / Listening for Jobs

# SSL
sudo certbot certificates
sudo certbot renew --dry-run
```

**After a VM restart**, check that everything came back up automatically:

```bash
sudo systemctl status nginx
sudo systemctl status postgresql
systemctl status pm2-azureuser
cd ~/actions-runner && sudo ./svc.sh status
pm2 status
```

then re-run the health checks above.

---

## Security

**Never commit:**

```
api/.env
Database passwords
SSH private keys
GitHub runner registration tokens
GitHub personal access tokens
SSL private keys
JWT secrets
Production credentials
```

`api/.env` is git-ignored on the VM (`git check-ignore api/.env` should print the path)
and permission-restricted (`chmod 600`).

**Network exposure:**

| Port | Purpose | Exposure |
|---|---|---|
| 22 | SSH | Public (should be restricted to admin IP ranges where possible) |
| 80 / 443 | HTTP / HTTPS | Public |
| 3000 | NestJS | Internal only — proxied by NGINX, never exposed directly |
| 5432 | PostgreSQL | Internal only — bound to `127.0.0.1` |

---

## Roadmap

Planned infrastructure and process improvements, roughly in priority order:

1. Dedicated `/api/v1/health` endpoint (distinct from the root "Hello World!" response).
2. Move production secrets to a managed secrets store (e.g. Azure Key Vault).
3. Scheduled PostgreSQL backups with a tested restore procedure.
4. VM monitoring + disk/CPU/memory alerting.
5. Log rotation for PM2 and NGINX.
6. Application error monitoring.
7. **Release directories + atomic symlink switching** — deploy into
   `/var/www/iml-releases/<timestamp>/`, flip a `current` symlink, keep the last few
   releases so rollback is an instant symlink swap instead of a rebuild.
8. Deployment success/failure notifications.
9. Staging environment ahead of production.
10. Branch protection + required CI checks before merging to `main`.
11. Restrict SSH (port 22) to approved administrative IP ranges.
12. `www.indiamindleague.com` DNS + certificate, if required.
13. Periodic Certbot renewal and runner-recovery drills after VM reboot.
