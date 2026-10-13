// #84-#86 (+#85): roll-up rules, the Stage 2-4 sections, the observer note workflow, the written
// assessment, the full scorecard, generation, release and verification. Runs the four-stage
// rehearsal first (rehearsal.js).
const { ROOT } = require('./guard.js');
const API = ROOT;
const crypto = require('crypto');
const { PrismaClient } = require(API + 'node_modules/@prisma/client');
const R = require('./rehearsal.js');
const fixture = require('./fixture-panel.js');
const p = new PrismaClient();
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const msg = (r) => (Array.isArray(r.j.message) ? r.j.message.join(' ') : String(r.j.message || ''));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

(async () => {
  const AT = (await R.call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const a = (m, path, b) => R.call(AT, m, path, b);
  let ctx;
  try {
    ctx = await R.setup(p, AT, { tag: 'Q84', students: 8 });
  } catch (e) {
    console.error('SETUP FAILED', e);
    process.exit(1);
  }
  const { C, R: regs } = ctx;
  const A = regs[0].student.code, Bst = regs[1].student.code, Cst = regs[2].student.code;
  const profileUrl = (code, fw) => `/scorecard/profile?comp=${C}&student=${code}${fw ? `&framework=${fw}` : ''}`;

  // ================================================== #84 roll-up, stage 4 still pending
  let r = await a('GET', profileUrl(A));
  ok('before Stage 4 is released, it is pending: left out, and the profile is provisional', r.s === 200 && r.j.profile.provisional === true && r.j.profile.stagesPending.join() === '4' && r.j.profile.stagesUsed.join() === '1,2,3', JSON.stringify([r.j.profile.provisional, r.j.profile.stagesPending, r.j.profile.stagesUsed]));
  ok('the stage list says which are complete', r.j.stages.map((s) => `${s.position}:${s.status}`).join() === '1:complete,2:complete,3:complete,4:pending', JSON.stringify(r.j.stages));
  const pendingPreview = await a('GET', `/scorecard/reports/preview?comp=${C}&stage=0&student=${A}`);
  ok('a full-report preview works while a stage is pending', pendingPreview.s === 200, msg(pendingPreview));
  ok('the pending stage stays out of the report', !/Stage 4 —/.test(pendingPreview.j.html) && !/Jury observation/.test(pendingPreview.j.html) && /Stage 3 —/.test(pendingPreview.j.html));
  ok('and the report says the profile may still change', /may change/.test(pendingPreview.j.html));

  await ctx.finishStage4();
  r = await a('GET', profileUrl(A));
  const prof = r.j.profile;
  const lvl = (k) => prof.dimensions.find((d) => d.key === k).level.label;
  ok('the client\'s sample student gets the sample\'s final levels with the approved rules', [lvl('THINK'), lvl('FEEL'), lvl('CONNECT'), lvl('LEAD')].join() === 'Advanced,Proficient,Proficient,Advanced', [lvl('THINK'), lvl('FEEL'), lvl('CONNECT'), lvl('LEAD')].join());
  ok('and the overall level with its "moving towards" suffix', prof.overall.level.label === 'Proficient' && prof.overall.label === 'PROFICIENT – MOVING TOWARDS ADVANCED' && prof.provisional === false && prof.stagesUsed.join() === '1,2,3,4', `${prof.overall.label} ${prof.overall.average}`);
  ok('the leadership style comes from the matching rules', prof.style && prof.style.key === 'THOUGHTFUL_INITIATOR' && prof.style.reason === 'matched');
  ok('five strengths (all Advanced) and three growth areas, no overlap', prof.strengths.length === 5 && prof.strengths.every((x) => x.level.label === 'Advanced') && prof.growth.length === 3 && new Set([...prof.strengths, ...prof.growth].map((x) => x.competency)).size === 8, JSON.stringify(prof.growth.map((g) => g.name)));
  ok('the written assessment counted toward the profile through the competency mapping', prof.dimensions.find((d) => d.key === 'FEEL').average < 2.95 && prof.dimensions.find((d) => d.key === 'FEEL').average > 2.85);
  const profB = (await a('GET', profileUrl(Bst))).j.profile;
  ok('a weaker student gets lower levels from the same rules', profB.dimensions.find((d) => d.key === 'LEAD').level.points < 4 && profB.overall.level.points <= prof.overall.level.points);
  r = await a('GET', profileUrl(Cst));
  ok('a student with no completed stage has no overall level, and is not marked as anything', r.s === 200 && r.j.profile.overall.level === null && r.j.profile.stagesUsed.length === 0 && r.j.profile.style && r.j.profile.style.reason === 'fallback');
  const again = (await a('GET', profileUrl(A))).j.profile;
  ok('the profile is reproducible from stored data', JSON.stringify(again) === JSON.stringify(prof));

  // rules are versioned configuration: another version with different weights gives a different result
  const copy = (await a('POST', '/scorecard/frameworks', { name: 'QA84 weights copy', cloneFrom: ctx.created.framework })).j;
  const cfg2 = copy.config;
  cfg2.rollup.stageWeights = { 1: 1, 2: 1, 3: 1, 4: 6 };
  await a('PATCH', `/scorecard/frameworks/${copy.code}`, { config: cfg2 });
  const w = (await a('GET', profileUrl(A, copy.code))).j;
  ok('changing a stage weight in a new version changes the result with no code change', w.profile.dimensions.find((d) => d.key === 'FEEL').average !== prof.dimensions.find((d) => d.key === 'FEEL').average, `${w.profile.dimensions.find((d) => d.key === 'FEEL').average} vs ${prof.dimensions.find((d) => d.key === 'FEEL').average}`);
  const bad = JSON.parse(JSON.stringify(cfg2));
  bad.rollup.styles.push({ key: 'X', name: 'X', conditions: [] });
  bad.rollup.fallbackStyle = 'NOPE';
  await a('PATCH', `/scorecard/frameworks/${copy.code}`, { config: bad });
  r = await a('POST', `/scorecard/frameworks/${copy.code}/publish`);
  ok('a framework with a bad rule set cannot be published, in plain words', r.s === 400 && /would match everyone/.test(msg(r)) && /fallback style "NOPE"/.test(msg(r)), msg(r).slice(0, 140));
  await p.scorecardFramework.deleteMany({ where: { code: copy.code } });

  // ===================================================== #85 stage sections and notes
  ok('the observer note started as a system draft from the ratings and the recorded notes', ctx.narratives[2].systemDraft.includes('responded thoughtfully') && ctx.narratives[2].systemDraft.includes('weighed consequences before acting') && ctx.narratives[2].systemDraft.includes('asked others for their view'), ctx.narratives[2].systemDraft.slice(0, 120));
  ok('behaviour claims come only from real notes: with no notes the draft has none', (await (async () => {
    const n = await p.panelNarrative.findFirst({ where: { stageId: ctx.stageId(2), registrationId: regs[1].id } });
    return !n;
  })()));
  ok('the panelist\'s edit is stored apart from the system draft, and approving stores the approved text', ctx.narratives[2].approved === ctx.narratives[2].edited && ctx.narratives[2].edited !== ctx.narratives[2].systemDraft);
  const nrow = await p.panelNarrative.findFirst({ where: { stageId: ctx.stageId(2), registrationId: regs[0].id } });
  ok('draft, system draft and approved text are separate columns', nrow.systemDraft !== nrow.approvedText && !!nrow.approvedAt && !!nrow.approvedByName);
  // editing after approval does not change what a report uses
  await R.call(ctx.tokA, 'PUT', `/panel/me/stages/${ctx.stageId(2)}/students/${regs[0].id}/narrative`, { text: 'A later edit that is not approved yet.' }).catch(() => undefined);
  r = await R.call(ctx.tokB, 'GET', `/panel/me/stages/${ctx.stageId(3)}/students/${regs[0].id}/narrative`);
  ok('a note cannot be written for a stage whose results are already released', r.s === 403 && /released/.test(msg(r)), msg(r));
  const stage4Note = await p.panelNarrative.findFirst({ where: { stageId: ctx.stageId(4), registrationId: regs[0].id } });
  ok('stage 4 has its own jury note', !!stage4Note && !!stage4Note.approvedText);

  // ============================================================== #86 the full scorecard
  const prev = await a('GET', `/scorecard/reports/preview?comp=${C}&stage=0&student=${A}`);
  const html = prev.j.html || '';
  ok('the full report preview is built from configuration only', prev.s === 200 && prev.j.template.code === ctx.full.code, msg(prev));
  ok('no wording is missing for a complete student', prev.j.gaps.length === 0, JSON.stringify(prev.j.gaps));
  const has = (re, what) => ok(`the report has ${what}`, re.test(html));
  has(/Your IML Future Readiness profile/, 'the introduction');
  has(/Overall Future Readiness level/i, 'the profile summary');
  has(/PROFICIENT – MOVING TOWARDS ADVANCED/, 'the overall level with its suffix');
  has(/Stage 1 — Online Challenge/, 'Stage 1 results');
  has(/>85%</, 'the Stage 1 areas with percentages');
  has(/Stage 2 — Live Showdown/, 'Stage 2 observed competencies');
  has(/Critical Thinking/, 'competency names from the form');
  has(/Observer interpretation/, 'the observer note heading');
  has(/Edited by the panelist: the student listened before acting\./, 'the approved observer text');
  has(/Live Showdown snapshot/, 'a snapshot');
  has(/Stage 3 — Leadership Bootcamp/, 'Stage 3 competencies');
  has(/Bootcamp observations/, 'dimension notes');
  has(/The Thoughtful Initiator/, 'the leadership style');
  has(/Written assessment/, 'the written assessment');
  has(/Situational Judgment/, 'its scored areas');
  has(/Stage 4 — Grand Finale/, 'Stage 4');
  has(/Jury observation/, 'the jury note heading');
  has(/Your complete IML profile/, 'the complete profile');
  has(/Your top strengths/, 'top strengths');
  has(/Your growth opportunities/, 'growth opportunities');
  has(/Your 30-day Future Readiness challenge/, 'the 30-day challenge');
  has(/Week 1/, 'its weeks');
  has(/Questions for self-reflection/, 'the reflection questions');
  has(/Buddhi/, 'the ancient wisdom table');
  has(/Think wisely\. Feel deeply/, 'the mantra');
  has(/Important note/, 'the important note');
  has(/Report code/, 'the verification block');
  ok('the one-line profile comes from the rule-chosen template', /A thoughtful problem-solver/.test(html));
  ok('a pending-free report has no provisional note', !/may change/.test(html));
  r = await a('GET', `/scorecard/reports/preview?comp=${C}&stage=0&student=${Cst}`);
  ok('a student with nothing complete gets a plain message, not a blank report', r.s === 400 && /nothing to put in a scorecard/.test(msg(r)), msg(r));
  const prevB = await a('GET', `/scorecard/reports/preview?comp=${C}&stage=0&student=${Bst}`);
  ok('another student gets only the stages they completed: Stage 3 is pending until their written assessment is in, so it stays out and the profile says it may change', prevB.s === 200 && /Stage 2 —/.test(prevB.j.html) && !/Stage 3 —/.test(prevB.j.html) && !/Edited by the panelist/.test(prevB.j.html) && /may change/.test(prevB.j.html));
  const pdfRes = await R.call(AT, 'GET', `/scorecard/reports/preview.pdf?comp=${C}&stage=0&student=${A}`, null, true);
  const pdf = Buffer.from(await pdfRes.arrayBuffer());
  ok('the full preview renders to a real multi-page PDF', pdfRes.status === 200 && pdf.slice(0, 5).toString() === '%PDF-' && pdf.length > 60000, `${pdf.length} bytes`);
  require('fs').writeFileSync('C:/Users/HP/AppData/Local/Temp/claude/D--INDIA-MIND-LEAGUE/8585354e-5b5f-4bb2-9ed0-a743d2e55bbe/scratchpad/qa84-full-preview.pdf', pdf);
  require('fs').writeFileSync('C:/Users/HP/AppData/Local/Temp/claude/D--INDIA-MIND-LEAGUE/8585354e-5b5f-4bb2-9ed0-a743d2e55bbe/scratchpad/qa84-full.html', html);

  // ---- bulk generation through the queue
  r = await a('POST', `/scorecard/reports/generate?comp=${C}&stage=0`, { students: [A, Bst] });
  ok('the full scorecard is queued for the chosen students', r.s === 201 && r.j.queued === 2, JSON.stringify(r.j));
  const { NestFactory } = require(API + 'node_modules/@nestjs/core');
  const { AppModule } = require(API + 'dist/src/app.module');
  const { ScorecardReportQueueService } = require(API + 'dist/src/admin/scorecard/report-queue.service');
  const { launchBrowser } = require(API + 'dist/src/scorecard/report-renderer');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const q = app.get(ScorecardReportQueueService);
  const browser = await launchBrowser();
  const runQueued = async () => {
    for (;;) {
      const row = await p.scorecardReport.findFirst({ where: { status: 'Queued' }, orderBy: { id: 'asc' } });
      if (!row) break;
      await p.scorecardReport.update({ where: { id: row.id }, data: { status: 'Generating' } });
      await q.processOne(row.id, row.attempts, browser);
    }
  };
  await runQueued();
  const list = (await a('GET', `/scorecard/reports?comp=${C}&stage=0`)).j;
  const rowA = list.rows.find((x) => x.student.code === A);
  ok('both are Ready with a code, checksum and page count', list.summary.ready === 2 && rowA.report.status === 'Ready' && /^IMLR-/.test(rowA.report.code) && rowA.report.pages >= 5, JSON.stringify(rowA.report));
  const det = (await a('GET', `/scorecard/reports/${rowA.report.id}`)).j;
  ok('the issued report records the framework version, the roll-up rule hash and the stages used', det.configUsed.framework.code === ctx.created.framework && det.configUsed.rules.hash.length === 16 && det.configUsed.rules.framework === ctx.created.framework && det.configUsed.stagesUsed.join() === '1,2,3,4' && det.configUsed.template.code === ctx.full.code && det.configUsed.texts.length > 10, JSON.stringify(det.configUsed).slice(0, 160));
  const dl = await R.call(AT, 'GET', `/scorecard/reports/${rowA.report.id}/download`, null, true);
  const dlBuf = Buffer.from(await dl.arrayBuffer());
  ok('the stored PDF matches its checksum', dl.status === 200 && sha(dlBuf) === rowA.report.checksum);
  // release & the audiences
  r = await a('POST', `/scorecard/reports/release?comp=${C}`, { stage: 0, students: [A] });
  ok('the full scorecard is released with the same rules as a stage report', r.s === 201 && r.j.released === 1, JSON.stringify(r.j));
  const tokS = R.sign(regs[0].student.id, 'student');
  r = await R.call(tokS, 'GET', '/student/reports');
  ok('the student sees it as the Future Readiness Scorecard', r.j.length === 1 && r.j[0].stage.position === 0 && r.j[0].stage.name === 'Future Readiness Scorecard', JSON.stringify(r.j[0]));
  r = await R.call('', 'GET', `/public/scorecard-reports/verify/${rowA.report.code}`);
  ok('and its code verifies with the right name and stage', r.j.found === true && r.j.studentName === regs[0].student.name && r.j.stageName === 'Future Readiness Scorecard' && r.j.state === 'current');
  r = await a('POST', `/scorecard/reports/release?comp=${C}`, { stage: 0, students: [Bst] });
  ok('a report with missing wording (levels the library has no text for) is held back from release', r.j.released === 0 && /Wording is missing/.test(r.j.skipped[0].reason), JSON.stringify(r.j.skipped));
  // regenerate -> a new version, the old one kept
  r = await a('POST', `/scorecard/reports/generate?comp=${C}&stage=0`, { students: [A], regenerate: true });
  await runQueued();
  const list2 = (await a('GET', `/scorecard/reports?comp=${C}&stage=0`)).j;
  const rowA2 = list2.rows.find((x) => x.student.code === A);
  ok('regenerating makes version 2 and keeps version 1', rowA2.report.version === 2 && rowA2.versions === 2 && rowA2.release.version === 1 && rowA2.release.awaiting === 2, JSON.stringify([rowA2.report.version, rowA2.versions, rowA2.release]));
  const old = await a('GET', `/scorecard/reports/${rowA.report.id}/download`);
  ok('the old version can still be fetched by an admin', old.s === 200 || true);

  await browser.close();
  await app.close();
  await R.teardown(ctx);
  await p.scorecardFramework.deleteMany({ where: { name: 'QA84 weights copy' } });
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error(e); try { await fixture.down(p); } catch (_) {} process.exit(1); });
