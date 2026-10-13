// #68: the category is saved on each answer at submit; editing/deleting the question later must not change the student's area scores.
const { ROOT } = require('./guard.js');
const { PrismaClient } = require(ROOT + 'node_modules/@prisma/client');
const p = new PrismaClient();
const B = process.env.QA_API || 'http://localhost:3000/api/v1';
const call = async (tok, m, path, body) => {
  const r = await fetch(B + path, { method: m, headers: { 'Content-Type': 'application/json', Connection: 'close', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const cats = (d) => JSON.stringify((d.categories || []).map((c) => [c.name, c.correct, c.total]).sort());

(async () => {
  // existing data was backfilled by the migration
  const missing = await p.attemptAnswer.count({ where: { category: null, questionId: { not: null }, attempt: { finishedAt: { not: null } } } });
  ok('backfill: no answer with a live question is left without a category', missing === 0, 'missing=' + missing);

  const AT = (await call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  await p.competition.deleteMany({ where: { code: 'ZSNAP' } }).catch(() => {});
  const comp = await p.competition.create({ data: { code: 'ZSNAP', title: 'Snapshot test', grades: '9-12', startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), status: 'Live' } });
  const mk = (code, category, i) => ({ code, competitionId: comp.id, grade: '9', category, prompt: `<p>${category} ${i}</p>`, options: ['A', 'B', 'C', 'D'], correct: [0] });
  await p.question.createMany({ data: [...Array.from({ length: 4 }, (_, i) => mk('ZS-IQ' + (i + 1), 'IQ', i + 1)), ...Array.from({ length: 4 }, (_, i) => mk('ZS-EQ' + (i + 1), 'EQ', i + 1))] });
  await p.exam.create({ data: { code: 'ZSNAPE', competitionId: comp.id, title: 'Snapshot exam', status: 'Live', grade: 'All', durationMin: 30 } });
  const student = await p.student.findFirst({ where: { grade: '10', archived: false } });
  const reg = await p.registration.create({ data: { code: 'RZSNAP', studentId: student.id, competitionId: comp.id, status: 'Registered' } });
  try {
    const link = (await call(AT, 'POST', '/registrations/RZSNAP/access-token', {})).j;
    const sid = new URL(link.loginUrl).searchParams.get('sid');
    const ST = (await call('', 'POST', '/auth/student/access-token/consume', { sid, token: link.token })).j.accessToken;
    const start = await call(ST, 'POST', '/student/exams/ZSNAPE/start');
    // answer everything correctly except EQ ones
    const answers = start.j.questions.map((q) => ({ questionId: q.id, answer: [q.category === 'IQ' ? 0 : 1], takenSecs: 3 }));
    const sub = await call(ST, 'POST', '/student/exams/ZSNAPE/submit', { attemptCode: start.j.attemptCode, answers });
    ok('submit ok', sub.s === 201);
    const rows = await p.attemptAnswer.findMany({ where: { attempt: { registrationId: reg.id } }, include: { question: true } });
    ok('every answer stores the question category at submit', rows.length === 8 && rows.every((r) => r.category === r.question.category), rows.map((r) => r.category).join());

    const before = (await call(ST, 'GET', `/student/results/${start.j.attemptCode}`)).j;
    console.log('before:', cats(before));
    ok('baseline per-area scores: IQ 4/4, EQ 0/4', cats(before) === JSON.stringify([['EQ', 0, 4], ['IQ', 4, 4]]));

    // now the admin re-tags one question and deletes another that students already answered
    await p.question.update({ where: { code: 'ZS-IQ1' }, data: { category: 'Values' } });
    const del = await call(AT, 'DELETE', '/questions/ZS-EQ2');
    ok('admin can still delete an answered question', del.s === 200, 'status ' + del.s);
    const after = (await call(ST, 'GET', `/student/results/${start.j.attemptCode}`)).j;
    console.log('after: ', cats(after));
    ok('student result: per-area scores unchanged after re-tag + delete', cats(after) === cats(before));
    const list = (await call(ST, 'GET', '/student/results')).j;
    const mine = (Array.isArray(list) ? list : list.data).find((x) => x.code === start.j.attemptCode);
    ok('results list: per-area scores unchanged', mine && JSON.stringify(mine.categories.map((c) => [c.name, c.correct, c.total]).sort()) === cats(before));
    const adm = await call(AT, 'GET', `/results/${start.j.attemptCode}`);
    const byCat = {};
    for (const a of adm.j.answers) byCat[a.category] = (byCat[a.category] || 0) + 1;
    ok('admin result detail carries the saved category on every answer (8 rows)', adm.j.answers.length === 8 && Object.keys(byCat).sort().join() === 'EQ,IQ' && byCat.IQ === 4 && byCat.EQ === 4, JSON.stringify(byCat));
  } finally {
    await p.attemptAnswer.deleteMany({ where: { attempt: { registrationId: reg.id } } });
    await p.attempt.deleteMany({ where: { registrationId: reg.id } });
    await p.registrationStage.deleteMany({ where: { registrationId: reg.id } });
    await p.registration.deleteMany({ where: { id: reg.id } });
    await p.exam.deleteMany({ where: { code: 'ZSNAPE' } });
    await p.question.deleteMany({ where: { competitionId: comp.id } });
    await p.competition.deleteMany({ where: { code: 'ZSNAP' } });
    console.log('cleanup:', await p.competition.count({ where: { code: 'ZSNAP' } }), 'comps left;', await p.question.count(), 'questions');
    await p.$disconnect();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
