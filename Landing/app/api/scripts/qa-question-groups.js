// QA for Question Groups: end-to-end checks of the admin API rules, serving (cap, mix,
// resume, submit/score), live-exam lock and group lifecycle, on a TEMPORARY competition
// that this script creates and removes itself.
//
// LOCAL USE ONLY — it writes to the database. Run from Landing/app/api with the API
// running locally and a local admin account:
//   QA_ADMIN_EMAIL=... QA_ADMIN_PASSWORD=... node scripts/qa-question-groups.js
// It refuses to run unless DATABASE_URL points at localhost.
require('dotenv').config();
if (!/@(localhost|127.0.0.1)[:/]/.test(process.env.DATABASE_URL || '')) {
  console.error('Refusing to run: DATABASE_URL is not a localhost database.');
  process.exit(1);
}
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const B = process.env.QA_API || 'http://localhost:3000/api/v1';
let AT = '';
let ST = '';
const call = async (tok, m, path, body) => {
  const r = await fetch(B + path, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const adm = (m, path, body) => call(AT, m, path, body);
const stu = (m, path, body) => call(ST, m, path, body);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + extra : '')); };

const EXAM = 'ZGRPE';
let compId, regId, studentId;

async function resetAttempts() {
  await p.attemptAnswer.deleteMany({ where: { attempt: { registrationId: regId } } });
  await p.attempt.deleteMany({ where: { registrationId: regId } });
  await p.registrationStage.deleteMany({ where: { registrationId: regId } });
}
const start = async () => { await resetAttempts(); return stu('POST', `/student/exams/${EXAM}/start`); };
function checkGroups(qs, groupsMeta, label, groupSizes) {
  // grouped questions must come with all siblings, contiguous, in position order; no duplicates
  const ids = qs.map((q) => q.id);
  const dup = new Set(ids).size !== ids.length;
  let intact = true;
  const byGroup = new Map();
  qs.forEach((q, i) => { if (q.groupId != null) byGroup.set(q.groupId, [...(byGroup.get(q.groupId) || []), { i, pos: q.groupPosition }]); });
  for (const [gid, arr] of byGroup) {
    if (arr.length !== groupSizes[gid]) intact = false;
    for (let k = 1; k < arr.length; k++) if (arr[k].i !== arr[k - 1].i + 1 || arr[k].pos <= arr[k - 1].pos) intact = false;
    if (!(groupsMeta || []).some((g) => g.id === gid)) intact = false;
  }
  return { dup, intact, groups: byGroup.size };
}

(async () => {
  AT = (await call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;

  // ---------------------------------------------------------------- fixture
  await p.competition.deleteMany({ where: { code: 'ZGRP' } }).catch(() => {});
  const comp = await p.competition.create({ data: { code: 'ZGRP', title: 'Group test', grades: '9-12', startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), status: 'Live' } });
  compId = comp.id;
  const other = await p.competition.create({ data: { code: 'ZGRQ', title: 'Other', grades: '9-12', startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), status: 'Draft' } });
  const mk = (code, category, competitionId) => ({ code, competitionId, grade: '9', category, prompt: 'Prompt ' + code, options: ['a', 'b', 'c', 'd'], correct: [0] });
  await p.question.createMany({ data: [
    ...Array.from({ length: 30 }, (_, i) => mk('ZL' + (i + 1), 'LR', compId)),
    ...Array.from({ length: 30 }, (_, i) => mk('ZD' + (i + 1), 'DI', compId)),
    mk('ZX1', 'LR', other.id),
  ] });
  await p.exam.create({ data: { code: EXAM, competitionId: compId, title: 'Group exam', status: 'Live', grade: 'All', durationMin: 30 } });
  const student = await p.student.findFirst({ where: { grade: '10', archived: false } });
  studentId = student.id;
  const reg = await p.registration.create({ data: { code: 'RZGRP', studentId, competitionId: compId, status: 'Registered' } });
  regId = reg.id;
  const link = (await adm('POST', `/registrations/RZGRP/access-token`, {})).j;
  const sid = new URL(link.loginUrl).searchParams.get('sid');
  ST = (await call('', 'POST', '/auth/student/access-token/consume', { sid, token: link.token })).j.accessToken;
  ok('fixture + student login', !!ST);

  try {
    // ------------------------------------------------------ no groups: unchanged
    let r = await start();
    ok('no groups: 60 questions, no group fields, no groups key', r.s === 201 && r.j.questions.length === 60 && !('groups' in r.j) && r.j.questions.every((q) => !('groupId' in q) && !('groupPosition' in q)), 'status ' + r.s);
    r = await stu('GET', `/student/exams/${EXAM}`);
    ok('no groups: preview count 60', r.j.questionCount === 60);

    // ------------------------------------------------------ admin API validation
    const codes = (n, pre, from = 1) => Array.from({ length: n }, (_, i) => pre + (from + i));
    r = await adm('POST', '/question-groups', { title: 'Mixed cat', competitionCode: 'ZGRP', category: 'LR', questionCodes: ['ZL1', 'ZD1'] });
    ok('reject wrong category', r.s === 400 && /share its category|category/.test(r.j.message), r.j.message);
    r = await adm('POST', '/question-groups', { title: 'Other comp', competitionCode: 'ZGRP', category: 'LR', questionCodes: ['ZL1', 'ZX1'] });
    ok('reject other competition question', r.s === 400, r.j.message);
    r = await adm('POST', '/question-groups', { title: 'Dup', competitionCode: 'ZGRP', category: 'LR', questionCodes: ['ZL1', 'ZL1'] });
    ok('reject duplicate in list', r.s === 400, r.j.message);
    r = await adm('POST', '/question-groups', { title: 'Missing', competitionCode: 'ZGRP', category: 'LR', questionCodes: ['ZL1', 'NOPE'] });
    ok('reject unknown question', r.s === 400, r.j.message);
    r = await adm('POST', '/question-groups', { title: 'One', competitionCode: 'ZGRP', category: 'LR', questionCodes: ['ZL1'], active: true });
    ok('reject active group with 1 question', r.s === 400, r.j.message);
    r = await adm('POST', '/question-groups', { title: 'Draft only', competitionCode: 'ZGRP', category: 'LR' });
    ok('create empty draft (inactive)', r.s === 201 && r.j.active === false && r.j.questionCount === 0, r.j.code);
    const draftCode = r.j.code;
    r = await adm('DELETE', `/question-groups/${draftCode}`);
    ok('delete empty draft', r.s === 200);

    // temporarily Scheduled so membership edits are not blocked by the live-exam lock
    await p.exam.update({ where: { code: EXAM }, data: { status: 'Scheduled', date: new Date('2026-10-01'), time: new Date('1970-01-01T00:00:00Z'), durationMin: 60 * 24 * 90 } });
    r = await adm('POST', '/question-groups', { title: 'Reading passage A', description: 'About rivers', imageUrl: 'https://example.com/a.png', videoUrl: 'https://youtu.be/xyz', competitionCode: 'ZGRP', category: 'LR', questionCodes: ['ZL1', 'ZL2', 'ZL3', 'ZL4'] });
    ok('create group A (4 LR)', r.s === 201 && r.j.active === true && r.j.questionCount === 4, r.j.code + ' ' + (r.j.message || ''));
    const A = r.j.code;
    r = await adm('POST', '/question-groups', { title: 'Overlap', competitionCode: 'ZGRP', category: 'LR', questionCodes: ['ZL4', 'ZL5'] });
    ok('reject question already in another group', r.s === 400 && /already in group/.test(r.j.message), r.j.message);
    r = await adm('POST', '/question-groups', { title: 'Chart B', competitionCode: 'ZGRP', category: 'DI', questionCodes: ['ZD1', 'ZD2', 'ZD3'] });
    ok('create group B (3 DI)', r.s === 201 && r.j.questionCount === 3);
    const Bc = r.j.code;
    r = await adm('POST', '/question-groups', { title: 'Tiny', competitionCode: 'ZGRP', category: 'DI', questionCodes: ['ZD4', 'ZD5'] });
    ok('create group C (2 DI)', r.s === 201);
    const Cc = r.j.code;

    r = await adm('GET', `/question-groups?comp=ZGRP`);
    ok('list groups', r.s === 200 && r.j.total === 3 && r.j.data.every((g) => g.ready));
    r = await adm('GET', `/question-groups/${A}`);
    ok('get group A with ordered questions', r.s === 200 && r.j.questions.map((q) => q.code).join() === 'ZL1,ZL2,ZL3,ZL4' && r.j.membershipLocked === false);
    r = await adm('GET', `/question-groups/candidates?comp=ZGRP&category=LR`);
    ok('candidates exclude grouped + other competitions', r.s === 200 && r.j.length === 26 && !r.j.some((x) => ['ZL1', 'ZL2', 'ZL3', 'ZL4', 'ZX1'].includes(x.code)), 'n=' + r.j.length);
    r = await adm('GET', `/question-groups/candidates?comp=ZGRP&category=LR&group=${A}`);
    ok('candidates include the group\'s own questions when editing', r.j.length === 30 && r.j.some((x) => x.code === 'ZL1'), 'n=' + r.j.length);
    r = await adm('GET', '/questions?comp=ZGRP&limit=100');
    ok('question bank shows groupCode', r.s === 200 && r.j.data.find((q) => q.code === 'ZL1').groupCode === A && r.j.data.find((q) => q.code === 'ZL10').groupCode === null);

    r = await adm('PATCH', `/question-groups/${A}`, { questionCodes: ['ZL4', 'ZL3', 'ZL2', 'ZL1'] });
    ok('reorder members', r.s === 200 && r.j.questions.map((q) => q.code).join() === 'ZL4,ZL3,ZL2,ZL1');
    r = await adm('PATCH', `/question-groups/${A}`, { questionCodes: ['ZL1', 'ZL2', 'ZL3', 'ZL4'] });
    r = await adm('PATCH', `/question-groups/${A}`, { category: 'DI' });
    ok('cannot change category while it has questions', r.s === 400, r.j.message);
    r = await adm('PATCH', `/question-groups/${A}`, { title: 'Reading passage A (edited)' });
    ok('title edit ok', r.s === 200 && r.j.title.endsWith('(edited)'));
    r = await adm('PATCH', '/questions/ZL1', { category: 'DI' });
    ok('grouped question: category change blocked', r.s === 400 && /group/.test(r.j.message), r.j.message);
    r = await adm('PATCH', '/questions/ZL1', { isDemo: true });
    ok('grouped question: cannot become demo', r.s === 400, r.j.message);

    // ---------------------------------------------------- serving with groups
    await p.exam.update({ where: { code: EXAM }, data: { status: 'Live', questionCount: 20 } });
    const sizes = {};
    const gidOf = async (code) => (await p.questionGroup.findUnique({ where: { code } })).id;
    sizes[await gidOf(A)] = 4; sizes[await gidOf(Bc)] = 3; sizes[await gidOf(Cc)] = 2;
    let bad = 0, wrongCount = 0, withGroups = 0, singleSeenOfGrouped = 0, dupAny = 0;
    for (let i = 0; i < 40; i++) {
      r = await start();
      if (r.s !== 201) { bad++; continue; }
      if (r.j.questions.length !== 20) wrongCount++;
      const c = checkGroups(r.j.questions, r.j.groups, 'x', sizes);
      if (!c.intact) bad++;
      if (c.dup) dupAny++;
      if (c.groups) withGroups++;
      // grouped questions (ZL1-4, ZD1-5) must only be served via their group
      const groupedCodes = new Set(['ZL1', 'ZL2', 'ZL3', 'ZL4', 'ZD1', 'ZD2', 'ZD3', 'ZD4', 'ZD5']);
      for (const q of r.j.questions) if (groupedCodes.has(q.code) && q.groupId == null) singleSeenOfGrouped++;
    }
    ok('cap 20: always 20 questions', wrongCount === 0, 'wrong=' + wrongCount);
    ok('cap 20: groups intact/contiguous/in order, with header data, no duplicates', bad === 0 && dupAny === 0, `bad=${bad} dup=${dupAny}`);
    ok('cap 20: grouped questions never served as singles', singleSeenOfGrouped === 0);
    ok('cap 20: groups do appear', withGroups > 10, `${withGroups}/40 exams had a group`);
    r = await stu('GET', `/student/exams/${EXAM}`);
    ok('preview count matches cap (20)', r.j.questionCount === 20, 'preview=' + r.j.questionCount);

    // header fields present
    r = await start();
    const withG = r.j.questions.filter((q) => q.groupId != null);
    if (withG.length) {
      const g = r.j.groups.find((x) => x.id === withG[0].groupId);
      ok('group block has title/description/media', !!g && !!g.title && 'description' in g && 'imageUrl' in g && 'videoUrl' in g, JSON.stringify(g));
    } else ok('group block present in this sample', true, '(no group drawn this time)');

    // ---------------------------------------------------- question mix
    await p.competitionQuestionRule.createMany({ data: [{ competitionId: compId, category: 'LR', count: 10, position: 1 }, { competitionId: compId, category: 'DI', count: 6, position: 2 }] });
    let mixBad = 0;
    for (let i = 0; i < 40; i++) {
      r = await start();
      const lr = r.j.questions.filter((q) => q.category === 'LR').length;
      const di = r.j.questions.filter((q) => q.category === 'DI').length;
      const c = checkGroups(r.j.questions, r.j.groups, 'x', sizes);
      if (r.j.questions.length !== 16 || lr !== 10 || di !== 6 || !c.intact || c.dup) mixBad++;
    }
    ok('mix LR10 + DI6: exact counts every time, groups counted by size', mixBad === 0, 'bad=' + mixBad);
    await p.competitionQuestionRule.deleteMany({ where: { competitionId: compId } });

    // ---------------------------------------------------- resume mid-group
    await p.exam.update({ where: { code: EXAM }, data: { questionCount: 30 } });
    let first;
    for (let i = 0; i < 10; i++) { first = await start(); if (first.j.groups) break; }
    ok('resume test: sample has a group', !!first.j.groups, 'groups=' + (first.j.groups || []).length);
    const again = await stu('POST', `/student/exams/${EXAM}/start`);
    ok('resume returns the same questions, order and group headers', again.j.resumed === true && JSON.stringify(again.j.questions) === JSON.stringify(first.j.questions) && JSON.stringify(again.j.groups) === JSON.stringify(first.j.groups));

    // ---------------------------------------------------- submit: 1 mark per sub-question
    const answers = first.j.questions.map((q, i) => ({ questionId: q.id, answer: i % 2 === 0 ? [0] : [1], takenSecs: 5 }));
    const expectedScore = answers.filter((a) => a.answer[0] === 0).length;
    r = await stu('POST', `/student/exams/${EXAM}/submit`, { attemptCode: first.j.attemptCode, answers });
    const scoreStr = JSON.stringify(r.j).slice(0, 200);
    const att = await p.attempt.findFirst({ where: { registrationId: regId } });
    ok('submit: total = questions served (groups count k each), 1 mark per sub-question', r.s === 201 && Number(att.total) === first.j.questions.length && Number(att.score) === expectedScore, `score ${att.score}/${att.total}, expected ${expectedScore}/${first.j.questions.length}`);

    // ---------------------------------------------------- live lock + deletes
    r = await adm('PATCH', `/question-groups/${A}`, { questionCodes: ['ZL1', 'ZL2', 'ZL3'] });
    ok('live exam: membership change blocked', r.s === 400 && /live exam/i.test(r.j.message), r.j.message);
    r = await adm('PATCH', `/question-groups/${A}`, { title: 'Still editable', description: 'new text' });
    ok('live exam: title/description still editable', r.s === 200);
    r = await adm('GET', `/question-groups/${A}`);
    ok('group reports membershipLocked', r.j.membershipLocked === true);
    r = await adm('DELETE', `/question-groups/${A}`);
    ok('live exam: cannot delete a group that has questions', r.s === 400, r.j.message);
    r = await adm('PATCH', `/question-groups/${A}`, { active: false });
    ok('live exam: cannot deactivate a group with questions (would change the pool)', r.s === 400 && /live exam/i.test(r.j.message), r.j.message);
    r = await adm('POST', '/question-groups', { title: 'Late group', competitionCode: 'ZGRP', category: 'LR', questionCodes: ['ZL20', 'ZL21'] });
    ok('live exam: cannot create a group with questions', r.s === 400 && /live exam/i.test(r.j.message), r.j.message);
    r = await adm('POST', '/question-groups', { title: 'Empty draft during live', competitionCode: 'ZGRP', category: 'LR' });
    ok('live exam: an empty draft is still allowed (changes nothing)', r.s === 201 && r.j.active === false);
    if (r.s === 201) await adm('DELETE', `/question-groups/${r.j.code}`);

    await p.exam.update({ where: { code: EXAM }, data: { status: 'Scheduled' } });
    r = await adm('DELETE', '/questions/ZD4');
    ok('deleting a question of a 2-question group', r.s === 200);
    r = await adm('GET', `/question-groups/${Cc}`);
    ok('...group C auto-deactivated with 1 left', r.j.active === false && r.j.questionCount === 1 && r.j.ready === false, `active=${r.j.active} n=${r.j.questionCount}`);
    r = await adm('PATCH', `/question-groups/${Cc}`, { active: true });
    ok('cannot re-activate under-filled group', r.s === 400, r.j.message);
    // inactive/under-filled group is not served: ZD5 must come only as a normal... it is still grouped (groupId set) so it must NOT be served at all
    await p.exam.update({ where: { code: EXAM }, data: { status: 'Live', questionCount: null } });
    r = await start();
    const served = new Set(r.j.questions.map((q) => q.code));
    const aliveCount = 60 - 1 /* ZD4 deleted */;
    ok('inactive group: its leftover question is not served alone', !served.has('ZD5'), 'served ' + r.j.questions.length + ' of ' + aliveCount);
    r = await adm('DELETE', `/question-groups/${Cc}`);
    ok('live exam: deleting the under-filled group is blocked too', r.s === 400, r.j.message);
    await p.exam.update({ where: { code: EXAM }, data: { status: 'Scheduled' } });
    r = await adm('DELETE', `/question-groups/${Cc}`);
    await p.exam.update({ where: { code: EXAM }, data: { status: 'Live' } });
    ok('delete group frees its question', r.s === 200 && (await p.question.findUnique({ where: { code: 'ZD5' } })).groupId === null);
    r = await start();
    ok('freed question is served as a normal single again', r.j.questions.some((q) => q.code === 'ZD5' && q.groupId == null));

    // unrelated: demo pool filter
    const demoQ = await p.question.count({ where: { isDemo: true, assessmentId: null, groupId: null } });
    ok('demo pool query valid', demoQ >= 0);
  } finally {
    // ---------------------------------------------------------------- cleanup
    await resetAttempts();
    await p.competitionQuestionRule.deleteMany({ where: { competitionId: compId } });
    await p.registration.deleteMany({ where: { code: 'RZGRP' } });
    await p.question.deleteMany({ where: { code: { startsWith: 'Z' }, competitionId: { in: [compId] } } });
    await p.question.deleteMany({ where: { code: 'ZX1' } });
    await p.exam.deleteMany({ where: { code: EXAM } });
    await p.questionGroup.deleteMany({ where: { competitionId: compId } });
    await p.competition.deleteMany({ where: { code: { in: ['ZGRP', 'ZGRQ'] } } });
    const left = { comps: await p.competition.count({ where: { code: { in: ['ZGRP', 'ZGRQ'] } } }), groups: await p.questionGroup.count(), qs: await p.question.count() };
    console.log('cleanup:', JSON.stringify(left));
    await p.$disconnect();
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
