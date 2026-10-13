# Question Groups: QA results and rollout runbook

Epic: arjunkamity/iml-app#56. Tasks #57–#65.

A question group is a topic (title, description, optional image and video) with 2+ existing questions as sub-questions. In an exam the group is one atomic unit that uses as many slots as it has questions, each worth one mark. The attempt still stores a flat list of question ids, so scoring, resume, results and the leaderboard are unchanged.

## 1. What was verified (local)

Run on 11 Oct 2026 against a temporary competition (created and removed by the scripts).

**Exams without groups: currently deployed build vs this branch**, same student, same data:

| Check | Result |
|---|---|
| Whole pool (60), cap 10, mix LR 6 + DI 4: status codes | identical |
| Structure (keys and types) of exam details, start, resume, progress, submit, result detail, results list | identical for all 7 responses in all 3 scenarios |
| Group fields (`groups`, `groupId`, `groupPosition`, `groupCode`, `groupTitle`) in a group-free exam | none present |
| Whole pool: question set, review and result history after sorting by id; score, percent, category totals | identical |
| Cap and mix: question count and (mix) per-category counts | identical |
| Resume: same questions in the same order | yes, both builds |
| Start latency (30 fresh starts each): old median 13.8 ms, new 14.2 ms (p95 16.3 vs 15.5) | no measurable change |

**With groups (this branch):**
- Cap 20: 40 of 40 starts served exactly 20; groups whole, contiguous and in order; no duplicates; grouped questions never served on their own.
- Mix LR 10 + DI 6: 40 of 40 exact, groups counted by size.
- Resume mid-group returns identical questions and headers. Submit scores 1 mark per sub-question (total = questions served).
- Re-attempt (max 2): the second attempt shares no question with the first in 12 of 12 runs, groups intact.
- Leaderboard and student results list work for a grouped exam.
- Admin rules: wrong category, other competition, duplicate, unknown, already-grouped, assessment/demo questions, under-filled active group, category/competition change with questions, live-exam lock (see below), auto-deactivate when a member is deleted.
- Browser: admin page (list, editor, picker, preview, live-lock note), exam screen at desktop and 375 px (image, YouTube video, description, collapse, palette marker), student, school and admin result views.

Unit tests: 64 pass (17 for the draw). Re-run the end-to-end script with:

    cd Landing/app/api
    QA_ADMIN_EMAIL=... QA_ADMIN_PASSWORD=... node scripts/qa-question-groups.js

It refuses to run unless `DATABASE_URL` is a localhost database.

## 2. Behaviour to know before using it

- **Counting:** a group of k uses k slots of the exam's question count (or of its category count in a Question mix). A group is never split or truncated. If a target cannot be met exactly it serves fewer and logs a shortfall; it never exceeds the target.
- **Share of group questions follows the pool.** If 20% of a competition's questions are in groups, about 20% of each exam's slots will be too. A guaranteed number of groups per exam would be a new rule.
- **Inactive or under-filled group:** its questions are withheld from exams entirely (not served as singles) until the group is reactivated or deleted.
- **Live-exam lock:** while a competition has a Live exam, the following are blocked for groups that have questions: creating, activating, deactivating, deleting, and changing the questions or their order. Title, description and media stay editable. Reason: they change what students who start next are served, so different students would get different pools.
- **Every sub-question keeps its own timer** and "answer before Next" rule.
- **Demo exam and Assessments** never serve grouped questions.
- Category and competition of a grouped question cannot be changed while it is in a group; deleting a question removes it from its group and deactivates the group if fewer than 2 remain.

## 3. Rollout steps

**Before deploying**
1. Client sign-off on the group header look (screenshots: desktop, phone with image, phone with video and image).
2. Confirm the working assumptions in the epic: one category per group, per-question timers, image and video both optional, serve fewer on a shortfall, fixed sub-question order.
3. Decide who manages groups; grant them the Question Bank module (`q`). Admins with `q` get both Question Bank and Question Groups.

**Deploy** (same as previous releases: copy the changed files into the deploy clone, commit, push to `main`; the workflow runs `prisma migrate deploy`, builds and restarts with automatic code rollback)
1. Do it outside any exam window if a competition is Live (the live exam path is the one this touches, although a group-free exam takes the old code path).
2. The migration `20261011100000_question_groups` is additive: one table, two nullable columns on `questions`, no backfill. A code-only rollback leaves it in place and is safe. If rolled back after groups exist, the old code would serve sub-questions as plain singles.

**Verify on production (read-only)**
1. Workflow green; `pm2` shows `iml-api` online; no new errors in the log for a few minutes.
2. `question_groups` exists and is empty; `SELECT count(*) FROM questions WHERE group_id IS NOT NULL` is 0.
3. Admin shows the new **Question Groups** page (under Content) and the Group column and filter in Question Bank.
4. An exam without groups still starts normally (an existing test student or the QA competition).

**Smoke test with a real group (non-live competition first)**
1. In a Draft or QA competition create a group of 3–4 questions with an image and a video.
2. As a test student start the exam: header shows above each sub-question with "Part n of k"; answer all; submit; check score, total and result page labels.
3. Check on a phone.
4. Delete the test group (frees its questions).

**Enable for the live competition**
1. Create and activate groups **before** the exam window opens (the live-exam lock blocks it afterwards).
2. Check the Question mix tab: "Available in pool" now counts group questions; confirm the mix is still achievable (a category target that cannot be hit exactly by group sizes serves fewer and logs it).
3. Watch the API log for "shortfall" lines after the first students start.

**Rollback**
- Code: revert the commit (the workflow restores the previous build). Data stays; no migration revert needed.
- To switch groups off without a deploy: deactivate them in admin (when no exam is Live) or delete them.
