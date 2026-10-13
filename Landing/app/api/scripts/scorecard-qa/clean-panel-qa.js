const { ROOT } = require('./guard.js');
const API = ROOT;
const { PrismaClient } = require(API + 'node_modules/@prisma/client');
const fixture = require('./fixture-panel.js');
const p = new PrismaClient();
(async () => {
  await fixture.down(p);
  for (const lib of await p.scorecardLibrary.findMany({ where: { name: { startsWith: 'QA ' } } })) { await p.scorecardSeason.updateMany({ where: { libraryId: lib.id }, data: { libraryId: null } }); await p.scorecardLibrary.delete({ where: { id: lib.id } }); }
  for (const se of await p.scorecardSeason.findMany({ where: { name: { startsWith: 'QA ' } } })) { await p.competition.updateMany({ where: { seasonId: se.id }, data: { seasonId: null } }); await p.scorecardSeason.delete({ where: { id: se.id } }); }
  await p.scorecardFramework.deleteMany({ where: { name: { startsWith: 'QA ' } } });
  const ids = (await p.panelist.findMany({ where: { email: { startsWith: 'qa.' } }, select: { id: true } })).map((x) => x.id);
  await p.panelEnrolment.deleteMany({ where: { panelistId: { in: ids } } });
  await p.panelRating.deleteMany({ where: { panelistId: { in: ids } } });
  await p.panelist.deleteMany({ where: { id: { in: ids } } });
  const forms = await p.assessment.findMany({ where: { kind: 'panel', title: { startsWith: 'QA ' } } });
  for (const f of forms) { await p.panelStage.updateMany({ where: { formId: f.id }, data: { formId: null } }); await p.question.deleteMany({ where: { assessmentId: f.id } }); await p.assessment.delete({ where: { id: f.id } }); }
  const written = await p.assessment.findMany({ where: { title: { startsWith: 'QA ' } } });
  for (const f of written) { await p.assessmentSubmission.deleteMany({ where: { assessmentId: f.id } }); await p.question.deleteMany({ where: { assessmentId: f.id } }); await p.assessment.delete({ where: { id: f.id } }); }
  const copies = await p.assessment.findMany({ where: { kind: 'panel', title: 'copy' } });
  for (const f of copies) { await p.question.deleteMany({ where: { assessmentId: f.id } }); await p.assessment.delete({ where: { id: f.id } }); }
  await p.otp.deleteMany({ where: { purpose: 'panel-login' } });
  console.log('cleaned', ids.length, forms.length);
  await p.$disconnect();
})();
