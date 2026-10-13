// LOCAL DEVELOPMENT ONLY. Creates a sample competition with 40 students' finished Stage 1
// attempts spread over every level, so the Stage 1 report (Admin > Scorecard Setup >
// Stage reports) can be built and tried without real data. It writes to the database and
// refuses to run unless DATABASE_URL points at localhost.
//
//   node scripts/seed-stage1-sample.js up     create (replaces an earlier sample)
//   node scripts/seed-stage1-sample.js down   remove it
//
// Competition SMP1, stage 1 "Online Challenge", 25 questions in each of LR, DI, PR and GK;
// every student is served 20 per area (so percentages move in 5% steps, like the client's
// sample). A few students deliberately show the edge cases: an exact cut-off, an area with too
// few questions, a category nothing maps to, an unfinished attempt and a student who never
// attempted.
require('dotenv').config();
if (!/@(localhost|127.0.0.1)[:/]/.test(process.env.DATABASE_URL || '')) {
  console.error('Refusing to run: DATABASE_URL is not a localhost database.');
  process.exit(1);
}
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const CODE = 'SMP1';
const AREAS = ['LR', 'DI', 'PR', 'GK'];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function down() {
  const comp = await p.competition.findUnique({ where: { code: CODE } });
  if (!comp) return console.log('nothing to remove');
  const regs = await p.registration.findMany({ where: { competitionId: comp.id }, select: { id: true } });
  const ids = regs.map((r) => r.id);
  await p.attemptAnswer.deleteMany({ where: { attempt: { registrationId: { in: ids } } } });
  await p.attempt.deleteMany({ where: { registrationId: { in: ids } } });
  await p.registrationStage.deleteMany({ where: { registrationId: { in: ids } } });
  await p.registration.deleteMany({ where: { competitionId: comp.id } });
  await p.question.deleteMany({ where: { competitionId: comp.id } });
  await p.competition.update({ where: { id: comp.id }, data: { seasonId: null, scaleKey: null } });
  await p.competition.delete({ where: { id: comp.id } });
  console.log('removed', CODE);
}

async function up() {
  await down();
  const comp = await p.competition.create({
    data: { code: CODE, title: 'Stage 1 Sample (40 students)', grades: '9-12', startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), status: 'Open' },
  });
  const stage = await p.competitionStage.create({ data: { competitionId: comp.id, position: 1, name: 'Online Challenge', mode: 'Online', passMark: 40, isFree: true } });

  const questions = {};
  for (const cat of [...AREAS, 'IQ']) {
    await p.question.createMany({
      data: Array.from({ length: cat === 'IQ' ? 4 : 25 }, (_, i) => ({
        code: `SM-${cat}${i + 1}`,
        competitionId: comp.id,
        grade: '9',
        category: cat,
        prompt: `<p>${cat} sample question ${i + 1}</p>`,
        options: ['A', 'B', 'C', 'D'],
        correct: [0],
      })),
    });
    questions[cat] = await p.question.findMany({ where: { competitionId: comp.id, category: cat }, orderBy: { id: 'asc' } });
  }

  const students = await p.student.findMany({ where: { archived: false, grade: { in: ['9', '10', '11', '12'] } }, orderBy: { id: 'asc' }, take: 41, include: { school: { select: { code: true } } } });
  const r = rng(2026);
  // correct answers out of 20, drawn so that every level and every boundary shows up
  const counts = [0, 4, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const pick = () => counts[Math.floor(r() * counts.length)];

  let n = 0;
  for (const [i, s] of students.entries()) {
    const reg = await p.registration.create({ data: { code: `RSM${String(i + 1).padStart(3, '0')}`, studentId: s.id, competitionId: comp.id, status: 'Registered' } });
    if (i === students.length - 1) continue; // the last student never attempts
    const unfinished = i === students.length - 2;
    // fixed edge cases first, random after
    const target = i === 0 ? { LR: 16, DI: 12, PR: 8, GK: 15 } : i === 1 ? { LR: 20, DI: 20, PR: 20, GK: 20 } : i === 2 ? { LR: 0, DI: 0, PR: 0, GK: 0 } : Object.fromEntries(AREAS.map((a) => [a, pick()]));
    const served = [];
    for (const a of AREAS) {
      const take = i === 3 && a === 'PR' ? 4 : 20; // student 4 got only 4 PR questions: "not enough questions"
      questions[a].slice(0, take).forEach((q, k) => served.push({ q, category: a, correct: k < (i === 3 && a === 'PR' ? 3 : target[a]) }));
    }
    if (i === 4) questions.IQ.slice(0, 4).forEach((q, k) => served.push({ q, category: 'IQ', correct: k < 2 })); // a category nothing maps to
    const code = `TSM${String(i + 1).padStart(3, '0')}`;
    const at = new Date(Date.now() - (60 + i) * 60 * 1000);
    const correctCount = served.filter((x) => x.correct).length;
    const attempt = await p.attempt.create({
      data: {
        code,
        registrationId: reg.id,
        stageId: stage.id,
        startedAt: at,
        finishedAt: unfinished ? null : new Date(at.getTime() + 14 * 60 * 1000),
        score: unfinished ? 0 : correctCount,
        total: unfinished ? 0 : served.length,
        questionIds: served.map((x) => x.q.id),
      },
    });
    if (!unfinished) {
      await p.attemptAnswer.createMany({
        data: served.map((x) => ({ attemptId: attempt.id, questionId: x.q.id, category: x.category, isCorrect: x.correct, answer: [x.correct ? 0 : 1], takenSecs: 20, answeredAt: at })),
      });
    }
    n++;
  }
  console.log(`created ${CODE} with ${students.length} registrations, ${n} attempts (1 unfinished, 1 student never attempted)`);
}

(process.argv[2] === 'down' ? down() : up()).catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
