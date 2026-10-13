# Scorecard and panel QA scripts

End-to-end checks for the Future Readiness scorecard epic (arjunkamity/iml-app#66, tasks #68–#88). They call the real API as the admin screens, the panel portal and the student/school/parent pages do, and read the database to confirm what was stored.

**Local use only.** They create and remove their own temporary data (competition `PNL1`, panelists, forms, seasons, frameworks, libraries, templates), but they write to the database. Each script starts with `guard.js`, which refuses to run unless `DATABASE_URL` points at localhost.

## Run

With the API running locally (`npm run start:dev`, and a built `dist/` for the scripts that generate PDFs) and a local super admin:

    cd Landing/app/api
    set QA_ADMIN_EMAIL=...  &&  set QA_ADMIN_PASSWORD=...      (PowerShell: $env:QA_ADMIN_EMAIL = '...')
    node scripts/scorecard-qa/qa-87.js

Optional: `QA_API` (default `http://localhost:3000/api/v1`), and for the load test `LOAD_PANELISTS`, `LOAD_STUDENTS`, `LOAD_PDFS`.

| Script | Covers |
|---|---|
| `qa-68.js` | #68 framework: dimensions, levels, competencies, publishing, versions |
| `qa-69.js` | #69 seasons and the IML ID |
| `qa-71.js` | #71 stage report data |
| `qa-72.js` | #72 content library: wording, approval, versions |
| `qa-73.js` | #73 report templates, PDF generation queue, verification. **Run with no demo season attached to SMP1** |
| `qa-74.js` | #74 release, consent, student/school/parent access. Needs the local demo season (`SE1` on `SMP1`) |
| `qa-75.js` | #75–#83 panel forms, panelists, sign-in, stage lifecycle, portal, aggregation, control view, selection |
| `qa-83-online.js` | #83 regression: selection of an online stage (pass mark, ranking, cap, once only, next-stage unlock) behaves as designed |
| `qa-84.js` | #84–#86 roll-up rules, observer notes, the full scorecard, release and verification |
| `qa-87.js` | #87 version differences, export / import, next season, audit search, module permissions |
| `qa-88.js` | #88 no-code acceptance: a Stage 5 added with admin calls only, then the full scorecard with it |
| `qa-load.js` | #88 load: 8 panelists × 60 students at once; 24 PDFs through the report queue |
| `qa-security.js` | #88 security review of the panel sign-in and permissions |

`rehearsal.js` and `fixture-panel.js` build the four-stage competition (online, offline, hybrid, peer interview) with sample students at different levels, a written assessment, panel forms, a framework with the roll-up rules, wording, a template and a season; most scripts above use them. `clean-panel-qa.js` removes anything a crashed run left behind.

Scripts that generate PDFs run the report queue themselves (they need `npm run build` first), so they do not depend on the API's cron.
