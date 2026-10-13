// #71: Stage 1 report data API against the local sample (node scripts/seed-stage1-sample.js up)
const { ROOT } = require('./guard.js');
const { PrismaClient } = require(ROOT + 'node_modules/@prisma/client');
const p = new PrismaClient();
const B = process.env.QA_API || 'http://localhost:3000/api/v1';
const call = async (tok, m, path, body, raw) => {
  const r = await fetch(B + path, { method: m, headers: { 'Content-Type': 'application/json', Connection: 'close', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (raw) return r;
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const LEVEL = (pct) => (pct >= 80 ? 'Advanced' : pct >= 60 ? 'Proficient' : pct >= 40 ? 'Developing' : 'Emerging');
const MAP = { LR: 'LOGICAL_REASONING', DI: 'DATA_INTERPRETATION', PR: 'PATTERN_RECOGNITION', GK: 'INDIA_AWARENESS' };

(async () => {
  const AT = (await call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const adm = (m, path, b) => call(AT, m, path, b);

  // make sure the local sample framework has the Stage 1 mapping (the seed adds it for new installs)
  const list = (await adm('GET', '/scorecard/frameworks')).j;
  const sample = list.find((f) => /client sample/.test(f.name));
  let fw = (await adm('GET', `/scorecard/frameworks/${sample.code}`)).j;
  if (!fw.config.competencies.some((c) => (c.examCategories || []).length)) {
    const cfg = fw.config;
    cfg.autoScore = { minQuestionsPerArea: 5 };
    for (const [cat, key] of Object.entries(MAP)) cfg.competencies.find((c) => c.key === key).examCategories = [cat];
    fw = (await adm('PATCH', `/scorecard/frameworks/${sample.code}`, { config: cfg })).j;
  }
  ok('sample framework has the exam category mapping and no publish issues', fw.issues.length === 0, JSON.stringify(fw.issues));
  const F = sample.code;

  // ---- errors
  let r = await adm('GET', `/scorecard/stage-report?comp=SMP1&stage=1&student=R1`);
  ok('no season and no framework chosen: a clear message', r.s === 400 && /not in a scorecard season/.test(r.j.message), r.j.message.slice(0, 70));
  r = await adm('GET', `/scorecard/stage-report?comp=SMP1&stage=9&student=R1&framework=${F}`);
  ok('unknown stage: 404', r.s === 404);
  r = await adm('GET', `/scorecard/stage-report?comp=SMP1&stage=1&student=NOPE&framework=${F}`);
  ok('student not in the competition: 404', r.s === 404);

  // ---- designed edge-case students
  const regCode = (i) => `RSM${String(i).padStart(3, '0')}`;
  const studentOf = async (i) => (await p.registration.findFirst({ where: { code: regCode(i) }, include: { student: true } })).student.code;
  const rep = async (i) => (await adm('GET', `/scorecard/stage-report?comp=SMP1&stage=1&student=${await studentOf(i)}&framework=${F}`)).j;

  let s = await rep(1);
  const think = s.report.dimensions[0];
  ok('student 1: LR 80% Advanced, DI 60% Proficient, PR 40% Developing, GK 75% Proficient', JSON.stringify(think.areas.map((a) => [a.name, a.percent, a.level.label])) === JSON.stringify([['Logical Reasoning', 80, 'Advanced'], ['Data Interpretation', 60, 'Proficient'], ['Pattern Recognition', 40, 'Developing'], ['India Awareness', 75, 'Proficient']]), JSON.stringify(think.areas.map((a) => a.percent)));
  ok('student 1: overall THINK 63.75% Proficient (51 of 80)', think.overall.correct === 51 && think.overall.total === 80 && think.overall.percent === 63.75 && think.overall.level.label === 'Proficient');
  ok('student 1: header and attempt details', s.status === 'ready' && s.attempt.code === 'TSM001' && s.stage.name === 'Online Challenge' && s.framework.code === F && s.scale.key === 'EDPA' && !!s.student.name);
  s = await rep(2);
  ok('student 2: all correct = 100% Advanced everywhere', s.report.dimensions[0].areas.every((a) => a.percent === 100 && a.level.label === 'Advanced') && s.report.dimensions[0].overall.percent === 100);
  s = await rep(3);
  ok('student 3: none correct = 0% Emerging', s.report.dimensions[0].areas.every((a) => a.percent === 0 && a.level.label === 'Emerging'));
  s = await rep(4);
  const pr = s.report.dimensions[0].areas.find((a) => a.competency === 'PATTERN_RECOGNITION');
  ok('student 4: PR has 4 questions, below the minimum: "not enough questions", no percentage', pr.status === 'not_enough_questions' && pr.percent === null && pr.level === null && pr.total === 4);
  ok('student 4: overall THINK uses only the areas that qualify', s.report.dimensions[0].overall.total === 60);
  s = await rep(5);
  ok('student 5: a category nothing maps to is reported, not hidden', s.report.unmapped.length === 1 && s.report.unmapped[0].category === 'IQ' && s.report.unmapped[0].total === 4 && s.report.unmapped[0].correct === 2);
  const regs = await p.registration.findMany({ where: { code: { startsWith: 'RSM' } }, orderBy: { code: 'asc' }, include: { student: true } });
  s = (await adm('GET', `/scorecard/stage-report?comp=SMP1&stage=1&student=${regs[regs.length - 2].student.code}&framework=${F}`)).j;
  ok('unfinished attempt: status in_progress, no report', s.status === 'in_progress' && s.report === null);
  s = (await adm('GET', `/scorecard/stage-report?comp=SMP1&stage=1&student=${regs[regs.length - 1].student.code}&framework=${F}`)).j;
  ok('never attempted: status not_attempted, no report', s.status === 'not_attempted' && s.report === null);

  // ---- roster agrees with an independent computation from the database, for every student
  const roster = (await adm('GET', `/scorecard/stage-report/roster?comp=SMP1&stage=1&framework=${F}&limit=100`)).j;
  ok('roster: 39 finished attempts (the unfinished one and the non-attempt are excluded)', roster.total === 39 && roster.rows.length === 39, `total=${roster.total}`);
  ok('roster: columns list the four areas and the THINK dimension', roster.columns.areas.length === 4 && roster.columns.dimensions.length === 1 && roster.minQuestionsPerArea === 5);
  const attempts = await p.attempt.findMany({ where: { stage: { competition: { code: 'SMP1' } }, finishedAt: { not: null } }, include: { answers: true, registration: { include: { student: true } } } });
  let mismatches = 0;
  for (const row of roster.rows) {
    const a = attempts.find((x) => x.code === row.attemptCode);
    for (const [cat, key] of Object.entries(MAP)) {
      const ans = a.answers.filter((x) => x.category === cat);
      const exp = ans.length >= 5 ? (ans.filter((x) => x.isCorrect).length / ans.length) * 100 : null;
      const got = row.areas[key];
      if ((exp === null) !== (got.percent === null) || (exp !== null && (Math.abs(exp - got.percent) > 1e-9 || got.level !== LEVEL(exp)))) mismatches++;
    }
  }
  ok('roster: every area percentage and level matches the answers in the database (39 students x 4 areas)', mismatches === 0, 'mismatches=' + mismatches);
  const levels = new Set(roster.rows.flatMap((r) => Object.values(r.areas).map((x) => x.level)).filter(Boolean));
  ok('the sample spans every level', ['Emerging', 'Developing', 'Proficient', 'Advanced'].every((l) => levels.has(l)), [...levels].join());

  // ---- filters and paging
  const one = roster.rows[5].student;
  r = await adm('GET', `/scorecard/stage-report/roster?comp=SMP1&stage=1&framework=${F}&search=${one.code}`);
  ok('roster: search by student code', r.j.total === 1 && r.j.rows[0].student.code === one.code);
  r = await adm('GET', `/scorecard/stage-report/roster?comp=SMP1&stage=1&framework=${F}&grade=10&limit=100`);
  ok('roster: grade filter', r.j.total > 0 && r.j.rows.every((x) => x.student.grade === '10'), 'n=' + r.j.total);
  r = await adm('GET', `/scorecard/stage-report/roster?comp=SMP1&stage=1&framework=${F}&page=2&limit=15`);
  ok('roster: paging (page 2 of 15)', r.j.page === 2 && r.j.rows.length === 15 && r.j.total === 39);

  // ---- export
  const ex = await call(AT, 'GET', `/scorecard/stage-report/roster/export?comp=SMP1&stage=1&framework=${F}`, null, true);
  const buf = Buffer.from(await ex.arrayBuffer());
  ok('Excel export: a real .xlsx', ex.status === 200 && buf.slice(0, 2).toString() === 'PK' && /sheet/.test(ex.headers.get('content-type')), buf.length + ' bytes');

  // ---- saved category: re-tagging a question later changes nothing in the report
  const q = await p.question.findFirst({ where: { code: 'SM-LR1' } });
  await p.question.update({ where: { id: q.id }, data: { category: 'ZZ' } });
  const after = await rep(1);
  await p.question.update({ where: { id: q.id }, data: { category: 'LR' } });
  ok('re-tagging a served question later does not change the student\'s area scores', after.report.dimensions[0].areas[0].correct === 16 && after.report.dimensions[0].areas[0].total === 20);

  // ---- framework without a mapping
  const blank = (await adm('POST', '/scorecard/frameworks', { name: 'QA no mapping' })).j;
  r = await adm('GET', `/scorecard/stage-report?comp=SMP1&stage=1&student=${await studentOf(1)}&framework=${blank.code}`);
  ok('a framework without exam categories is explained', r.s === 400 && /does not map any exam categories/.test(r.j.message));
  await p.scorecardFramework.deleteMany({ where: { code: blank.code } });

  // ---- access
  const mk = await adm('POST', '/admins', { name: 'SC Guard 71', email: 'sc.guard71@example.com', password: 'Guard#12345', role: 'Editor', modules: ['dash'] });
  const tok = (await call('', 'POST', '/auth/admin/login', { email: 'sc.guard71@example.com', password: 'Guard#12345' })).j.accessToken;
  r = await call(tok, 'GET', `/scorecard/stage-report/roster?comp=SMP1&stage=1&framework=${F}`);
  ok('an admin without the "sc" module is refused (403)', r.s === 403);
  await adm('DELETE', `/admins/${mk.j.id}`);
  await p.configAuditLog.deleteMany({ where: { entityCode: blank.code } });

  await p.$disconnect();
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
