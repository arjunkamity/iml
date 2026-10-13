# Future Readiness Scorecard and Panel Evaluation: QA results and rollout runbook

Epic: arjunkamity/iml-app#66. Tasks #68–#88. Client decisions are tracked in #67.

The scorecard turns a student's results across the competition stages into the Future Readiness report: dimensions, levels, strengths, growth areas, a leadership style, and a PDF with a verification code. Stages 2–4 (offline, hybrid, peer interview) are rated by a panel through their own portal; Stage 1 and written assessments are scored by the system. Everything that shapes the outcome (dimensions, level scales, competencies, the roll-up rules, wording, report layout, forms, who rates what) is configuration edited in the admin panel and versioned; nothing needs a code change to run or to scale.

**Status: built and tested locally. Nothing is deployed.** The legal and privacy review and the client sign-off (section 6) are human steps and are not done.

## 1. What is in the release

**Database.** Five additive migrations, no drops, no backfill, every new column nullable or defaulted:

| Migration | Adds |
|---|---|
| `20261012110000_scorecard_configuration` | frameworks, seasons, config audit log; `competitions.season_id`, `scale_key` |
| `20261012140000_scorecard_content_library` | wording libraries, texts and approved versions; `seasons.library_id` |
| `20261012150000_scorecard_reports` | report templates, reports and PDF files; `seasons.template_id` |
| `20261013100000_scorecard_release` | release, withdraw, audience variants, consent, parent links; `seasons.delivery_settings` |
| `20261013120000_panel_evaluation` | panelists, panel stages, enrolments, ratings, adjudications, results, notes; `assessments.kind`, `questions.option_hints`, `weight` |

**Admin screens (Module Access).** Scorecard setup (`sc`): frameworks, seasons, report templates, content library, reports, stage reports, change history, export and import. New module codes: Panels (`pn`), Report Release (`rl`), Wording Approvals (`scap`). Panel evaluation forms live under Assessments (`asm`) as "panel forms". After deploy, grant each module to the right people; a person with none of them sees none of these screens and the server refuses their calls.

**Panel portal.** `/panel/login` (user ID and password, then a one-time code to email and phone), dashboard, student list, rating form with autosave, observer notes.

**Students, schools and parents.** "My reports" (student), school reports, a parent link with a code, and a public verification page `/report/<code>`. A report is invisible to everyone until an admin releases it.

**Seeds** (run once after deploy, from `Landing/app/api`; each skips what already exists, so re-running is safe):

    npm run seed:scorecard            # the client-sample framework, as a draft
    npm run seed:scorecard-content    # the client-sample wording, as a draft library
    npm run seed:scorecard-template   # the Stage 1 and the full-scorecard layouts, as drafts
    npm run seed:scorecard-messages   # report-ready and panel e-mail/SMS templates

**Environment.** No new variables. `JWT_ACCESS_SECRET` is used as before. `DEV_OTP_BYPASS` must **not** be set on the server (the panel sign-in honours it exactly like the other sign-ins, for local development only).

## 2. What was verified (local, 13 Oct 2026)

Every script is in `Landing/app/api/scripts/scorecard-qa/` (see its README). They run against a local database, create their own data and remove it. The final regression was run in order against a clean local state.

| Script | Covers | Checks |
|---|---|---|
| `qa-68` | framework: dimensions, levels, competencies, publish lock, versions | 8 |
| `qa-69` | seasons, IML ID pattern, competition link | 34 |
| `qa-71` | stage report data and level engine | 25 |
| `qa-72` | wording library: kinds, approval, immutable versions, fallbacks | 64 |
| `qa-73` | report templates, PDF queue, verification | 55 |
| `qa-74` | release, withdraw, consent, audiences, student/school/parent access | 72 |
| `qa-75` | panel forms, panelists, sign-in, lifecycle, portal, aggregation, control view, selection | 148 |
| `qa-83-online` | selection of an online stage: pass mark, fastest-first ranking under a cap, once only, next-stage unlock | 9 |
| `qa-84` | roll-up rules, observer notes, written assessment, full scorecard, release, verification | 65 |
| `qa-87` | version differences, export and import, next season, audit search, module permissions | 52 |
| `qa-88` | no-code acceptance (Stage 5) | 22 |
| `qa-security` | panel sign-in and permission review | 46 |
| `qa-load` | panel concurrency and bulk PDFs | 15 |

Also: 213 unit tests pass (pure logic: scoring, levels, roll-up, lifecycle, diffs, access rules, report documents); the API and the web app build cleanly; the panel portal (sign-in, dashboard, notes, rating with autosave), the admin Panels page, the Reports page (including the full scorecard), the version-comparison dialog and the change history were driven in the browser at phone width.

**The client's sample is reproduced.** With the approved roll-up rules the sample student gets THINK Advanced, FEEL Proficient, CONNECT Proficient, LEAD Advanced and the overall "PROFICIENT – MOVING TOWARDS ADVANCED", with the Thoughtful Initiator style, five strengths and three growth areas (`qa-84`).

**Four stages end to end.** Online Stage 1 (answers by category), panel Stages 2 and 4, a hybrid Stage 3 that is a panel stage and a scored written assessment, observer notes drafted from the ratings and edited and approved by a panelist, selection and release at each stage, the full scorecard (11 pages), release, parent link, verification (`rehearsal.js`, used by `qa-84`, `qa-87`, `qa-88`).

**No-code acceptance (`qa-88`).** Starting from the running four-stage competition, using only the calls the admin screens make: add a Stage 5 to the competition; build its evaluation form with its own competencies; set up the panel, run it (rating, close, finalize, an observer note, selection, release); add a Stage 5 section to a new version of the report template and switch the season to it; the final profile now includes Stage 5 and the full scorecard shows it after Stage 4 with the new competencies. No migration ran and no code changed.
This test found one real gap, now fixed: when a stage is added to a running competition, the next-stage rows already exist as Locked and the selection did not open them. Selection now opens existing Locked rows of a **free** next stage (panel selection and online selection alike). A stage that is not marked free still waits for payment, as before.

**Load (`qa-load`, this laptop, API and database on the same machine; shows shape, not production capacity).**

| | Result |
|---|---|
| 8 panelists × 60 students rating at the same time, with the admin control view polling | 1,463 requests in 7.3 s (about 200 per second), none failed |
| Latency | open page median 22 ms (p95 32); autosave median 46 ms (p95 61); submit median 46 ms (p95 60); control view median 84 ms (p95 103) |
| Integrity | 480 of 480 ratings stored once, no duplicates from concurrent saves |
| Close and finalize 60 × 8 ratings | 126 ms; selection preview 16 ms, covers all 60 |
| 24 full-scorecard PDFs through the queue | 0.5 s each (12 s in all), memory +48 MB, 142 KB and 11 pages each, none failed |

The PDF queue is one worker at a time, started by the API's scheduler, and does not run while an exam window is open. About 2 PDFs a second means 5,000 reports take roughly 45 minutes of queue time; start the batch outside an exam window.

**Regression of what existed.** Online stage selection is guarded so the panel path is taken only for a stage that has a panel form (`isPanelStage`); `qa-83-online` runs a temporary online competition through preview and commit (two students below the pass mark, a two-seat cap won by the fastest of the four who passed, everyone else eliminated, the next stage opened for the qualified only, a second commit refused) and passes. The online exam, group and assessment checks from the earlier releases still pass, and `qa-71`, `qa-73` and `qa-74` exercise the Stage 1 report on real online data. The only change to the online selection code is the Locked-row fix above.

## 3. Behaviour to know before using it

- **Panel stages report through the full scorecard.** The single-stage report (Stage 1 layout) is for online stages. A panel stage's competencies and observer note appear in the full scorecard, so a student needs a decided stage to have something to show.
- **One stage of a competition is open at a time**, and the next opens only after the previous one is decided: for a panel stage "Selected" or "Released"; for an online stage every registration Qualified or Eliminated.
- **Lifecycle:** Draft → Ready → Open → Closed → Finalized → Selected → Released. An administrator can send Closed back to Open and Finalized back to Closed, each with a reason and each recorded. Selected and Released cannot be undone. A rating is locked on submit; only an administrator can reopen it, with a reason.
- **The form is frozen when a stage opens.** Later edits to a form never change what was rated. A new version of a form is a copy.
- **Not rated is never zero.** A student with fewer ratings than required has no score and no level and is listed for a decision; an administrator can finalize with the gap recorded.
- **Disagreement:** a gap of two or more levels between panelists is flagged; the administrator's adjudication replaces the average and is attributed.
- **Observer notes** are drafted from the ratings and the panelists' own notes, edited and approved by a panelist, and locked once the stage is released. A report only uses an approved note.
- **Pending stages** are left out of a full scorecard and the profile says it may still change; a stage that was not reached is left out.
- **Rules are versions.** A published framework and a published template are locked. Each issued report records the framework version, the roll-up rules (with a hash), the template version, the wording versions and the stages used, so any report can be explained and reproduced.
- **A new season** (Copy to next) reuses the published framework and layout and copies the wording as drafts, to be reviewed and approved.
- **Counters are in memory.** Sign-in failures (5 → locked 15 minutes) and code tries live in the API process, so they reset when it restarts. This is correct while there is one API process (pm2 with one instance); with several, each would count separately.
- **Panel sessions last 12 hours** and are not refreshed. Disabling a panelist cuts an open session off on its next request.

## 4. Security review

Tested in `qa-security` (46 checks), on top of the sign-in lockout, conflicts and roster checks in `qa-75` and the module permissions in `qa-87`.

| Area | Result |
|---|---|
| Account enumeration | Unknown user and wrong password give the same answer; "forgot password" answers the same for known and unknown users |
| Passwords | argon2 hashes; at least 8 characters; never returned by any API |
| One-time code | Bound to its sign-in; 5 wrong tries then refused even if right; single use; expires after 10 minutes; a code sent to someone else does not work |
| Sessions | A challenge is not a session; panel sessions are their own kind, refused by the admin, student and school endpoints, and theirs by the panel; forged, expired, unsigned and missing tokens refused; a disabled account is cut off on the next request |
| Isolation | A panelist sees only stages they are enrolled in, only students on the roster, never the students of a school they have a conflict with, and only their own ratings (nothing of other panelists in any response) |
| Invitation and reset links | Stored hashed, single use, expire, weak passwords refused |
| Admin permissions | Panels, Report Release, Wording Approvals and Scorecard Setup are separate and enforced by the server (`qa-87`) |
| Injection | HTML written by a panelist is escaped in the report; a search string with SQL is plain text |

Accepted, to be aware of:
- Sign-in messages differ for a locked, disabled or not-yet-activated account, which tells someone who already knows a panelist's e-mail that the account exists. Acceptable for an invite-only panel with a second factor; if it is not, make those messages generic.
- Attempt counters reset on an API restart (above).
- The public verification page shows the student's name and school to anyone who has the code (the code is random and the page only works after release). See the privacy decisions below.

## 5. Behaviour that changed in code that already existed

- Selection (`CompetitionService.commitSelection`, and the same step in panel selection) now also opens a next-stage row that already exists in the Locked state, for a free next stage. Before, only missing rows were created.
- A competition stage that has a panel form is selected through the panel's results instead of exam attempts. A stage without a panel form is untouched.
- The student assessments list and detail only return `kind = 'self'` assessments, so panel forms never reach students; the admin assessments list marks panel forms.

## 6. Human steps that remain

**Legal and privacy review (not done).** The report holds personal data of minors: name, school, grade, results, a panelist's written observations. Decide and record:
1. Lawful basis and consent: whose consent covers a student's assessment by a panel and the creation of a report (the school, the parent), and the wording of the consent text shown in the product (content library, kind "Consent text"). Verifiable parental consent for under-18s if the review concludes the DPDP Act 2023 applies as written.
2. Who may see a report: student, school, parent by link with code. Is the parent link (valid 30 days by default, 5 tries on the code) acceptable, and is the default "consent required" the right setting?
3. The public verification page: it shows the student's name and school. Keep, show initials only, or show only that the code is valid.
4. Retention: how long ratings, observer notes and reports are kept, and who can ask for correction or deletion (withdrawing a report is possible; deleting data is not offered in the product).
5. Panelists as data processors: terms, and the conflict-of-interest declaration (the product blocks a school the panelist is conflicted with).
6. Wording: every statement a report can make about a child (strengths, growth, leadership style, disclaimers, challenge) is data in the content library and is approved by a named person; have the client or counsel approve the final set. Unapproved wording is never used.
7. The decisions in #67 (sample, rules, level wording, scale).

**Client sign-off (not done).** Layout and wording of the report, the roll-up rules (as published in the framework), the panel form wording, and the release plan.

## 7. Rollout

**Before deploying**
1. Section 6 done, or an explicit decision to launch Stage 1 reports first and keep the panel for later (the panel can stay unused; nothing in the online flow depends on it).
2. Decide who gets `pn`, `rl`, `scap` and `sc`.
3. Back up the database as for any release.

**Deploy** (as before: copy the changed files into the deploy clone, commit, push to `main`; the workflow runs `prisma migrate deploy`, builds and restarts with automatic code rollback).
1. Prefer a time with no live exam. The migrations are additive and quick; the only change to a live exam path is the selection step (section 5).
2. After the workflow is green, run the four seeds (section 1).
3. Confirm `DEV_OTP_BYPASS` is not set in the server environment.

**Verify on production (read-only)**
1. Workflow green, `pm2` shows `iml-api` online, no new errors in the log for a few minutes.
2. Tables exist and are empty apart from the seeds: `SELECT count(*) FROM panelists;` (0), `scorecard_seasons` (0), `scorecard_reports` (0); `scorecard_frameworks` 1 draft, `scorecard_templates` 2 drafts, `scorecard_libraries` 1.
3. `SELECT count(*) FROM assessments WHERE kind <> 'self';` is 0, and existing assessments still list for students.
4. The admin menu shows Scorecard Setup, Panels, Report Release and Wording Approvals only for admins who hold those modules.
5. An online exam still starts and submits (a test student and the QA competition), and a selection preview of an online stage still lists the same students as before.

**Smoke test on a QA competition (not the live one)**
1. Publish the sample framework, approve the wording, publish a template, create a season and attach the QA competition.
2. Create two test panelists (use your own e-mail and phone), a panel form, set up Stage 2, open it, rate two test students from `/panel/login`, close, finalize, select, release.
3. Generate a report for a test student, preview it, release it, open it as the student and through a parent link, verify the code on the public page, withdraw it and confirm the link stops working.
4. Remove the test data (panelists can be disabled; a season without competitions can be deleted).

**Enable for the live competition**
1. Create the season, set its delivery settings (consent, notification, link validity), attach the competition.
2. Set up each panel stage in order; give each panelist their invitation; make sure each has signed in once before the stage opens.
3. Generate reports in batches outside an exam window; review a sample before releasing; release; send the parent links.

## 8. Rollback

- **Code:** revert the commit; the workflow restores the previous build. The migrations are additive and stay in place; a code rollback needs no migration revert and loses no data.
- **Before a code rollback after panel forms exist:** archive the panel forms (Assessments → the form → Archive). The previous build does not know about `kind`, and an unarchived published panel form would appear in the students' assessment list. Do not run a stage selection on the previous build for a stage that has panel ratings (it would look for exam attempts).
- **Without a deploy:** disable panelists (their sessions end on the next request); withdraw reports (the student, school and parent links stop at once and the verification page shows "withdrawn"); detach the template or library from a season; archive a framework or template.
- **Data stays.** Ratings, notes, reports and the audit log are never deleted by a rollback.
