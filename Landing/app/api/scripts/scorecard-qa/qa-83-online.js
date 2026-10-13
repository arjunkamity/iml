// #83 / #88 regression: selection of an ONLINE stage (no panel form) behaves as designed after the panel
// work: pass mark, ranking by the cascading criteria, stage cap, one decision only, next-stage unlock
// (including a next-stage row that already exists as Locked), and the panel code path is not taken.
// Uses a temporary competition that this script creates and removes.
const { ROOT } = require('./guard.js');
const jwt = require(ROOT + 'node_modules/jsonwebtoken');
const { PrismaClient } = require(ROOT + 'node_modules/@prisma/client');
const R = require('./rehearsal.js');
const p = new PrismaClient();
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const CODE = 'ONL83';

async function down() {
  const comp = await p.competition.findUnique({ where: { code: CODE } });
  if (!comp) return;
  const regs = (await p.registration.findMany({ where: { competitionId: comp.id }, select: { id: true } })).map((r) => r.id);
  await p.attemptAnswer.deleteMany({ where: { attempt: { registrationId: { in: regs } } } });
  await p.attempt.deleteMany({ where: { registrationId: { in: regs } } });
  await p.registrationStage.deleteMany({ where: { registrationId: { in: regs } } });
  await p.registration.deleteMany({ where: { competitionId: comp.id } });
  await p.competition.delete({ where: { id: comp.id } });
}

(async () => {
  const AT = (await R.call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const a = (m, path, b) => R.call(AT, m, path, b);
  await down();
  try {
    const comp = await p.competition.create({ data: { code: CODE, title: 'Online selection regression', grades: '9,10,11,12', startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), status: 'Open' } });
    const s1 = await p.competitionStage.create({ data: { competitionId: comp.id, position: 1, name: 'Online round', mode: 'Online', passMark: 50, maxQualifiers: 2, isFree: true } });
    const s2 = await p.competitionStage.create({ data: { competitionId: comp.id, position: 2, name: 'Online final', mode: 'Online', passMark: 0, isFree: true } });
    const students = await p.student.findMany({ where: { archived: false, grade: { in: ['9', '10', '11', '12'] } }, orderBy: { id: 'asc' }, take: 6 });
    // percent and minutes taken: four pass the mark (50), two do not; among the four, the fastest two should win the two seats
    const plan = [[90, 10], [80, 5], [70, 8], [60, 3], [40, 1], [30, 2]];
    const regs = [];
    for (const [i, s] of students.entries()) {
      const reg = await p.registration.create({ data: { code: `RON${String(i + 1).padStart(3, '0')}`, studentId: s.id, competitionId: comp.id, status: 'Registered' } });
      await p.registrationStage.create({ data: { registrationId: reg.id, stageId: s1.id, status: 'Attempted' } });
      // the next stage already has a Locked row for everyone (as when a stage is added to a running competition)
      await p.registrationStage.create({ data: { registrationId: reg.id, stageId: s2.id, status: 'Locked' } });
      const start = new Date(Date.now() - 3600 * 1000);
      await p.attempt.create({ data: { code: `AON${String(i + 1).padStart(3, '0')}`, registrationId: reg.id, stageId: s1.id, startedAt: start, finishedAt: new Date(start.getTime() + plan[i][1] * 60000), score: plan[i][0], total: 100 } });
      regs.push(reg);
    }

    let r = await a('GET', `/competitions/${CODE}/stages/${s1.id}/selection-preview`);
    ok('the preview is the online one (no panel mode)', r.s === 200 && r.j.mode !== 'panel', `status ${r.s}`);
    ok('two students are below the pass mark and listed as such', r.j.ineligible.length === 2 && r.j.ineligible.every((x) => x.percent < 50), r.j.ineligible.map((x) => x.percent).join());
    const picked = [...r.j.autoPicked, ...(r.j.stillContesting || [])].map((x) => x.registrationCode).sort();
    ok('the two fastest of the four who passed take the two seats', picked.join() === ['RON002', 'RON004'].join(), picked.join());

    r = await a('POST', `/competitions/${CODE}/stages/${s1.id}/selection-commit`);
    ok('the selection is committed', r.s === 201 && r.j.qualified === 2 && r.j.eliminated === 4, JSON.stringify(r.j));
    const st = Object.fromEntries((await p.registrationStage.findMany({ where: { stageId: s1.id } })).map((x) => [x.registrationId, x.status]));
    ok('the chosen two are Qualified and everyone else Eliminated', regs.every((g, i) => st[g.id] === ([1, 3].includes(i) ? 'Qualified' : 'Eliminated')), JSON.stringify(Object.values(st)));
    const next = Object.fromEntries((await p.registrationStage.findMany({ where: { stageId: s2.id } })).map((x) => [x.registrationId, x.status]));
    ok('the next stage is opened for the qualified, even though their rows already existed as Locked', [1, 3].every((i) => next[regs[i].id] === 'Unlocked'), JSON.stringify(next));
    ok('and stays locked for everyone who did not qualify', [0, 2, 4, 5].every((i) => next[regs[i].id] === 'Locked'));
    r = await a('POST', `/competitions/${CODE}/stages/${s1.id}/selection-commit`);
    ok('a selection can only be run once', r.s === 400 && /already been decided/.test(String(r.j.message)), String(r.j.message));
    ok('no panel stage was created by an online selection', (await p.panelStage.count({ where: { stageId: { in: [s1.id, s2.id] } } })) === 0);
  } finally {
    await down();
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
