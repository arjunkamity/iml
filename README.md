# India Mind League (IML)

Digital Qualifier platform for the Amity Group of Schools — a timed online
assessment testing IQ, EQ and core values, with three roles (Admin, School
Coordinator, Participant).

## Stack

| Part | Tech |
|---|---|
| Database | Microsoft SQL Server (2022 Express locally) |
| Backend | NestJS (Node + TypeScript), `mssql` over TCP |
| Frontend | Angular 22 (standalone components + signals) |
| Auth | JWT + role guards; OTP for students, password for Admin/Coordinator |
| Certificates | pdfkit (server-rendered PDF) |

```
db/         SQL schema + migrations + setup scripts  (source of truth)
backend/    NestJS API  (http://localhost:3000/api)
frontend/   Angular app (http://localhost:4200)
```

## First-time setup (Windows)

1. **Database** — in an **Administrator** PowerShell:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
   & "D:\INDIA MIND LEAGUE\db\setup-sqlexpress.ps1"
   ```
   Installs SQL Server Express, enables TCP + mixed auth, applies the schema,
   creates the `iml_app` login. (Re-runnable.)

2. **Backend**
   ```powershell
   cd backend
   npm install
   npm run start:dev
   ```

3. **Frontend**
   ```powershell
   cd frontend
   npm install
   npm start
   ```

Open http://localhost:4200.

## API documentation (Swagger / OpenAPI)

With the backend running:

- **Interactive docs:** http://localhost:3000/docs (Swagger UI — click **Authorize**, paste a JWT from `/auth/login`, then "Try it out")
- **OpenAPI spec file:** `backend/openapi.json` — regenerated on every backend start. Import it into **Postman** (Import → File) or **Insomnia** to get a ready-made request collection.

33 endpoints grouped by tag: Auth, Schools, Students, Quizzes, Questions, Attempts, Reports, Leaderboard, Certificates, Health.

## Dev credentials (local only)

- **Admin:** `admin@indiamindleague.in` / `Admin@123`
- **Coordinator:** created when an admin onboards a school
- **Student:** registers via the public form; OTP is returned in the API
  response as `devCode` (no SMS provider wired yet)

Set/reset a password: `node backend/scripts/set-password.js <email> <password>`

## User journeys

- **Public:** landing page + live leaderboard → register (school code + OTP) or login
- **Admin:** dashboard, onboard schools (+ coordinator logins), build quizzes &
  question bank, publish, view participation / shortlist
- **Coordinator:** own-school dashboard, student roster, results
- **Student:** see available quizzes, take the timed quiz (auto-save, server
  timer, one attempt), view result, download participation certificate (PDF)

## Deploying to the company SQL Server

The SQL schema is database-agnostic within SQL Server. To target the company
server, apply the migrations and point the API at it:

```powershell
db\apply.ps1 -Server "SERVERNAME\INSTANCE"
```
Then update `backend/.env` (DB connection) and `frontend/src/app/core/config.ts`
(`API_URL`). No code changes required.

## Production TODO (before launch)

- Wire a real SMS/email OTP provider (e.g. MSG91) — stop returning `devCode`
- Add Redis for live timers / leaderboard / OTP / answer-buffering at scale
- Load-test the qualifier window; consider staggered start times
- School self-onboarding form, pagination, edit/delete flows
- Secrets management + HTTPS + DPDP (minors' data) consent handling
