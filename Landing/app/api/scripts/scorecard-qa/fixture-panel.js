// Local test fixture for the panel and full-scorecard QA scripts: competition PNL1 with four
// stages (Online, Offline, Hybrid, Peer Interview), eight students and registrations. Stage 1
// is "decided" (everyone Qualified) and Stage 2 is unlocked for everyone, as if the online
// selection had been committed.
const { ROOT } = require('./guard.js');
const API = ROOT;
const CODE = 'PNL1';

async function down(p) {
  const comp = await p.competition.findUnique({ where: { code: CODE } });
  if (!comp) return;
  const regs = (await p.registration.findMany({ where: { competitionId: comp.id }, select: { id: true } })).map((r) => r.id);
  const stages = (await p.competitionStage.findMany({ where: { competitionId: comp.id }, select: { id: true } })).map((s) => s.id);
  await p.panelNarrative.deleteMany({ where: { stageId: { in: stages } } });
  await p.panelResult.deleteMany({ where: { stageId: { in: stages } } });
  await p.panelAdjudication.deleteMany({ where: { stageId: { in: stages } } });
  await p.panelRating.deleteMany({ where: { stageId: { in: stages } } });
  await p.panelStage.deleteMany({ where: { stageId: { in: stages } } });
  await p.attemptAnswer.deleteMany({ where: { attempt: { registrationId: { in: regs } } } });
  await p.attempt.deleteMany({ where: { registrationId: { in: regs } } });
  await p.scorecardShareLink.deleteMany({ where: { registrationId: { in: regs } } });
  await p.scorecardReport.deleteMany({ where: { registrationId: { in: regs } } });
  await p.registrationStage.deleteMany({ where: { registrationId: { in: regs } } });
  await p.registration.deleteMany({ where: { competitionId: comp.id } });
  await p.competition.update({ where: { id: comp.id }, data: { seasonId: null, scaleKey: null } });
  await p.competition.delete({ where: { id: comp.id } });
}

async function up(p, studentCount = 8) {
  await down(p);
  const comp = await p.competition.create({ data: { code: CODE, title: 'Panel QA Competition', grades: '9-12', startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), status: 'Open' } });
  const defs = [
    { position: 1, name: 'Online Challenge', mode: 'Online', passMark: 0 },
    { position: 2, name: 'Live Showdown', mode: 'Offline', passMark: 40, maxQualifiers: 4 },
    { position: 3, name: 'Leadership Bootcamp', mode: 'Hybrid', passMark: 0 },
    { position: 4, name: 'Grand Finale', mode: 'Peer Interview', passMark: 0 },
  ];
  const stages = [];
  for (const d of defs) stages.push(await p.competitionStage.create({ data: { competitionId: comp.id, isFree: true, ...d } }));
  // students from at least two schools
  const all = await p.student.findMany({ where: { archived: false, schoolId: { not: null }, grade: { in: ['9', '10', '11', '12'] } }, orderBy: { id: 'asc' }, take: 400, include: { school: true } });
  const bySchool = new Map();
  for (const s of all) bySchool.set(s.schoolId, [...(bySchool.get(s.schoolId) || []), s]);
  const schools = [...bySchool.values()].filter((l) => l.length >= 2).slice(0, 2);
  const chosen = [];
  for (let i = 0; chosen.length < studentCount; i++) {
    const s = schools[i % schools.length][Math.floor(i / schools.length)];
    if (!s) break;
    chosen.push(s);
  }
  const regs = [];
  for (const [i, s] of chosen.entries()) {
    const reg = await p.registration.create({ data: { code: `RPN${String(i + 1).padStart(3, '0')}`, studentId: s.id, competitionId: comp.id, status: 'Qualified' } });
    await p.registrationStage.create({ data: { registrationId: reg.id, stageId: stages[0].id, status: 'Qualified', qualified: true, score: 90 } });
    await p.registrationStage.create({ data: { registrationId: reg.id, stageId: stages[1].id, status: 'Unlocked', unlockedAt: new Date() } });
    regs.push({ id: reg.id, code: reg.code, student: s });
  }
  return { comp, stages, regs, schools: [...new Set(chosen.map((s) => s.schoolId))] };
}

module.exports = { up, down, CODE, API };
