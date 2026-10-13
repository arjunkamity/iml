# India Mind League — Admin Operations & Technical Specifications

This folder is the knowledge-transfer reference for everyone operating or maintaining the IML admin CRM (`/admin`). Each document covers one module: how it works end-to-end, the exact sequence of actions an admin takes, the data model behind it, and the key source files for engineers picking up that area.

| # | Document | Covers |
|---|---|---|
| 01 | [Users Management](01-users-management.md) | Admin accounts, roles, module-based permissions, login/session lifecycle |
| 02 | [Competitions Builder](02-competitions-builder.md) | Building a competition and its stages step by step; how it ties to exams and registrations |
| 03 | [Question Management](03-questions-management.md) | The question bank, answer-options builder, categories, the demo/real question wall |
| 04 | [Exams Management](04-exams-management.md) | Exam dates, batches, assignment, reminders, the Go-For-It magic link |
| 05 | [Payments](05-payments.md) | The Paytm checkout + reconciliation flow, manual/offline payment recording |
| 06 | [Schools](06-schools.md) | The two-email model, bulk upload, first-time login activation, duplicate merging |
| 07 | [Classes & Grades](07-classes-grades.md) | The grade/class reference list used everywhere else in the app |
| 08 | [Certificates](08-certificates.md) | The participation-certificate queue and its exam-aware pause/resume behavior |
| 09 | [Results & Selections](09-results-selections.md) | The cascading-cutoff tie-break selection algorithm — read before running a real selection |
| 10 | [User Device & Bandwidth](10-device-bandwidth.md) | Device/browser/network requirements for students, and the engineering behind them (autosave design, disconnect-resume) |

## How to read these

Each document follows the same shape:
1. **What this module is for** — the plain-language purpose.
2. **Data model** — an ER diagram of the relevant tables/fields.
3. **The actual workflow** — a flowchart or sequence diagram of what an admin does, step by step, and what happens behind the scenes.
4. **Admin actions** — a table of every button/action on the page and when to use it.
5. **Troubleshooting** — common symptoms and what they actually mean.
6. **Key files** — where an engineer should look first.

## A cross-cutting note worth knowing up front

Module-based admin permissions (which sidebar sections an Editor/Viewer can see) are currently **enforced client-side only** — the API itself does not separately verify module grants per request. See §4 of [Users Management](01-users-management.md) for the full detail. This affects how much you should trust a low-privilege admin account today, and is flagged there as a follow-up engineering item rather than something to work around ad hoc.
