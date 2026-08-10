# India Mind League — Database

SQL Server schema for the India Mind League (IML) digital qualifier platform.

## Apply

```powershell
# LocalDB (development - default)
.\apply.ps1

# A named/company server (Windows auth)
.\apply.ps1 -Server "SERVERNAME\INSTANCE"
```

Migrations are idempotent and run in order. `sqlcmd` is invoked with `-I`
(QUOTED_IDENTIFIER ON), which is required by the filtered indexes and views.

## Layout

| File | Contents |
|---|---|
| `migrations/001_create_database.sql` | Creates DB; enables `READ_COMMITTED_SNAPSHOT` for high-concurrency answer auto-save |
| `migrations/002_core_identity.sql`   | `Roles`, `Schools`, `Users`, `StudentProfiles`, `OtpRequests` |
| `migrations/003_quiz_content.sql`    | `Categories`, `Quizzes`, `Questions`, `QuestionOptions`, `QuizQuestions` |
| `migrations/004_attempts_scoring.sql`| `Attempts`, `AttemptQuestions`, `Answers`, `Certificates` |
| `migrations/005_views.sql`           | `vw_QualifierLeaderboard`, `vw_SchoolParticipation` |
| `seed/010_seed_reference.sql`        | Roles, categories, a sample school, admin user, practice quiz |

## Key design points

- **One attempt per student per quiz** — enforced by `UQ_Attempts_Quiz_User`, not just UI.
- **Server-authoritative timer** — `Attempts.ServerDeadline`; the client timer is display only.
- **Three roles** — `Roles` (Admin / Coordinator / Student); coordinators and students are
  scoped to a `SchoolId` so a coordinator only sees their own school's data.
- **Leaderboard tie-break** — score desc, then faster completion, then earlier submission
  (`vw_QualifierLeaderboard`).
- **OTP** — `OtpRequests` is a dev/audit log; in production live codes belong in Redis with a TTL.

## Roles

| RoleId | Code | Who |
|---|---|---|
| 1 | ADMIN | Amity administrators |
| 2 | COORDINATOR | School coordinators |
| 3 | STUDENT | Participants |
