-- These two views previously existed only as a side effect of running the
-- destructive `prisma db seed` script (which wipes and re-inserts every
-- table), so any environment that was migrated but never re-seeded after
-- the views were added — including production — never got them, and every
-- admin dashboard/leaderboard load raised:
--   relation "dashboard_summary" does not exist
-- Moving the definitions here makes them part of the normal, non-destructive
-- migration path. Safe to run against an environment that already has the
-- views (CREATE OR REPLACE), including prod where they were already
-- hotfixed manually on 2026-08-14.

CREATE OR REPLACE VIEW leaderboard AS
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

CREATE OR REPLACE VIEW dashboard_summary AS
SELECT
  (SELECT count(*) FROM registrations)                    AS registrations,
  (SELECT count(*) FROM competitions)                     AS competitions,
  (SELECT count(*) FROM questions)                        AS questions,
  (SELECT count(*) FROM exams WHERE status = 'Scheduled') AS upcoming_exams,
  (SELECT count(*) FROM students)                         AS students,
  (SELECT count(*) FROM payments WHERE status = 'Paid')   AS paid_payments;
