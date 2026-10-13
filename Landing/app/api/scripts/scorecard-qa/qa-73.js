// #73: report templates, preview, queue and generated PDFs.
// Needs: API on :3000, sample competition SMP1 (node scripts/seed-stage1-sample.js up),
// framework FW1, library CL1 and template TP1 (the seeds). Run from anywhere.
const { ROOT } = require('./guard.js');
const crypto = require('crypto');
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
const msg = (r) => (Array.isArray(r.j.message) ? r.j.message.join(' ') : String(r.j.message || ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const AT = (await call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const a = (m, path, b) => call(AT, m, path, b);

  // ---------------------------------------------------------------- templates
  const meta = (await a('GET', '/scorecard/templates/meta')).j;
  ok('template meta lists the section types with their labels', meta.sectionTypes.length >= 10 && meta.sectionTypes.find((t) => t.type === 'stage_results').labels.length >= 6);
  const tps = (await a('GET', '/scorecard/templates')).j;
  const tp = tps.find((t) => /from client sample/.test(t.name));
  ok('the seeded template exists as a draft', !!tp && tp.status === 'Draft' && tp.sections === 8, JSON.stringify(tp));
  let r = await a('GET', `/scorecard/templates/${tp.code}`);
  ok('a complete seeded template has no publish issues', r.j.issues.length === 0, JSON.stringify(r.j.issues));

  // a copy: break it, see the issues, fix it
  r = await a('POST', '/scorecard/templates', { name: 'QA template copy', cloneFrom: tp.code });
  const cp = r.j;
  ok('copy: new draft, version 2 of the family', r.s === 201 && cp.status === 'Draft' && cp.version === 2 && cp.versions.length === 2, `${cp.code} v${cp.version}`);
  const broken = JSON.parse(JSON.stringify(cp.config));
  broken.sections[1].labels.title = '';
  broken.branding.primaryColor = 'navy';
  r = await a('PATCH', `/scorecard/templates/${cp.code}`, { config: broken });
  ok('saving a draft with problems is allowed, the issues are listed', r.s === 200 && r.j.issues.length === 2, JSON.stringify(r.j.issues));
  r = await a('POST', `/scorecard/templates/${cp.code}/publish`);
  ok('publishing with problems is refused with every issue', r.s === 400 && /Not ready to publish/.test(msg(r)) && /Heading/.test(msg(r)) && /hex colour/.test(msg(r)), msg(r).slice(0, 120));
  broken.sections[1].labels.title = 'Profile';
  broken.branding.primaryColor = '#112233';
  broken.sections.push({ key: 'x', type: 'bogus', enabled: true, labels: {} });
  r = await a('PATCH', `/scorecard/templates/${cp.code}`, { config: broken });
  ok('an unknown section type is reported', r.j.issues.some((i) => /not a kind of section/.test(i)));
  broken.sections.pop();
  await a('PATCH', `/scorecard/templates/${cp.code}`, { config: broken });
  r = await a('POST', `/scorecard/templates/${cp.code}/publish`);
  ok('publish succeeds once complete, and locks it', r.s === 201 && r.j.status === 'Published' && r.j.locked === true);
  r = await a('PATCH', `/scorecard/templates/${cp.code}`, { name: 'Changed' });
  ok('a published template cannot be edited', r.s === 400 && /published/.test(msg(r)));
  r = await a('DELETE', `/scorecard/templates/${cp.code}`);
  ok('a published template cannot be deleted', r.s === 400);
  r = await a('POST', `/scorecard/templates/${cp.code}/archive`);
  ok('archive and restore work', r.s === 201 && r.j.status === 'Archived' && (await a('POST', `/scorecard/templates/${cp.code}/unarchive`)).j.status === 'Published');

  // ------------------------------------------------------------ season setup
  const fwSrc = (await a('GET', '/scorecard/frameworks')).j.find((f) => /client sample/.test(f.name));
  const fw = (await a('POST', '/scorecard/frameworks', { name: 'QA73 framework', cloneFrom: fwSrc.code })).j;
  await a('POST', `/scorecard/frameworks/${fw.code}/publish`);
  const clone = (await a('POST', '/scorecard/content/libraries', { name: 'QA73 wording', cloneFrom: 'CL1' })).j;
  await a('POST', `/scorecard/content/libraries/${clone.code}/texts/approve-all`, { note: 'qa' });
  r = await a('POST', '/scorecard/seasons', { name: 'QA73 season', editionLabel: 'QA Edition', frameworkCode: fw.code, libraryCode: clone.code, templateCode: tp.code });
  ok('a season cannot use a draft template', r.s === 400 && /not published/.test(msg(r)), msg(r));
  await a('POST', `/scorecard/templates/${tp.code}/publish`);
  r = await a('POST', '/scorecard/seasons', { name: 'QA73 season', editionLabel: 'QA Edition', frameworkCode: fw.code, libraryCode: clone.code, templateCode: tp.code });
  ok('a season takes a published template and a library', r.s === 201 && r.j.template.code === tp.code && r.j.library.code === clone.code, JSON.stringify(r.j.template));
  const season = r.j;
  r = await a('GET', `/scorecard/reports?comp=SMP1&stage=1`);
  ok('before the competition is in the season, listing still works', r.s === 200 && r.j.rows.length > 30, `${r.j.rows && r.j.rows.length} students`);
  r = await a('POST', '/scorecard/reports/generate?comp=SMP1&stage=1', {});
  ok('generate refuses while the competition has no template and library', r.s === 400 && /No report template/.test(msg(r)), msg(r));
  r = await a('GET', '/scorecard/reports/preview?comp=SMP1&stage=1&student=NOPE');
  ok('preview without any template: a plain message', r.s === 400 && /No report template/.test(msg(r)));
  await a('PUT', `/scorecard/seasons/${season.code}/competitions`, { competitions: [{ competitionCode: 'SMP1' }] });

  // ------------------------------------------------------------------ preview
  const reg1 = await p.registration.findFirst({ where: { code: 'RSM001' }, include: { student: true } });
  const S1 = reg1.student.code; // student 1: THINK 63.75% Proficient
  r = await a('GET', `/scorecard/reports/preview?comp=SMP1&stage=1&student=${S1}`);
  ok('preview returns HTML for the student', r.s === 200 && r.j.html.includes(reg1.student.name) && r.j.html.includes('INDIA MIND LEAGUE') && r.j.html.includes('Logical Reasoning'), `${(r.j.html || '').length} chars`);
  ok('areas, percentages and levels come from the stage data (80% Advanced, 60% Proficient, 40% Developing, 75% Proficient)', ['>80%<', '>60%<', '>40%<', '>75%<'].every((x) => r.j.html.includes(x)) && r.j.html.includes('Advanced') && r.j.html.includes('Developing'));
  ok('overall THINK shows rounded 64% with the level', r.j.html.includes('OVERALL THINK SCORE') && r.j.html.includes('>64%<'));
  ok('the season edition is printed', r.j.html.includes('QA Edition'));
  ok('approved wording (the QA copy) is used: THINK strengths for Proficient', r.j.html.includes('You demonstrate a strong ability to identify relationships') && r.j.gaps.every((g) => !/THINK at Proficient/.test(g)), JSON.stringify(r.j.gaps));
  ok('with all the wording the template needs approved there are no gaps and no fallbacks', r.j.gaps.length === 0 && r.j.fallbacks.length === 0, JSON.stringify(r.j.gaps));
  ok('the disclaimer and level scale are included', r.j.html.includes('IML Development Scale'.toLowerCase()) === false ? r.j.html.toLowerCase().includes('iml development scale') : true);
  ok('a verification section shows PREVIEW, not a real code', r.j.html.includes('PREVIEW'));
  ok('no real code, no checksum in a preview', !/IMLR-/.test(r.j.html));

  // a student whose THINK level has no wording written -> gaps named, report still produced
  let reg3 = null;
  for (let i = 2; i <= 30 && !reg3; i++) {
    const cand = await p.registration.findFirst({ where: { code: 'RSM' + String(i).padStart(3, '0') }, include: { student: true } });
    const pr = await a('GET', `/scorecard/reports/preview?comp=SMP1&stage=1&student=${cand.student.code}`);
    if (pr.s === 200 && pr.j.gaps.some((g) => /Strengths paragraph for THINK at/.test(g))) { reg3 = cand; r = pr; }
  }
  ok('a student at a level with no wording: it is named as a gap, not invented', !!reg3 && r.j.gaps.length >= 2, JSON.stringify(r && r.j.gaps && r.j.gaps.slice(0, 2)));
  if (!reg3) reg3 = await p.registration.findFirst({ where: { code: 'RSM002' }, include: { student: true } });

  // draft wording preview (CL1 is all drafts)
  r = await a('GET', `/scorecard/reports/preview?comp=SMP1&stage=1&student=${S1}&library=CL1&draft=true`);
  ok('previewing with draft wording shows the drafts and says so', r.s === 200 && r.j.draftWording === true && r.j.html.includes('You demonstrate a strong ability'), '');
  r = await a('GET', `/scorecard/reports/preview?comp=SMP1&stage=1&student=${S1}&library=CL1`);
  ok('CL1 has nothing approved, so without draft the paragraphs are gaps', r.s === 200 && r.j.gaps.length >= 3 && !r.j.html.includes('You demonstrate a strong ability'));

  // stage not finished / never taken
  const unf = await p.attempt.findFirst({ where: { finishedAt: null, registration: { competition: { code: 'SMP1' } } }, include: { registration: { include: { student: true } } } });
  if (unf) {
    r = await a('GET', `/scorecard/reports/preview?comp=SMP1&stage=1&student=${unf.registration.student.code}`);
    ok('an unfinished attempt: clear message', r.s === 400 && /not finished/.test(msg(r)), msg(r));
  }

  // preview PDF
  const pdfRes = await call(AT, 'GET', `/scorecard/reports/preview.pdf?comp=SMP1&stage=1&student=${S1}`, null, true);
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  ok('preview PDF is a real PDF', pdfRes.status === 200 && pdfBuf.slice(0, 5).toString() === '%PDF-' && pdfBuf.length > 20000, `${pdfBuf.length} bytes`);
  require('fs').writeFileSync('C:/Users/HP/AppData/Local/Temp/claude/D--INDIA-MIND-LEAGUE/8585354e-5b5f-4bb2-9ed0-a743d2e55bbe/scratchpad/qa73-preview.pdf', pdfBuf);

  // --------------------------------------------------------------- generation
  r = await a('POST', '/scorecard/reports/generate?comp=SMP1&stage=1', { students: ['NOPE1'] });
  ok('naming a student with no finished attempt is refused', r.s === 400 && /No finished attempt/.test(msg(r)), msg(r));
  r = await a('POST', '/scorecard/reports/generate?comp=SMP1&stage=1', { students: [S1, reg3.student.code] });
  ok('generate queues the chosen students', r.s === 201 && r.j.queued === 2 && r.j.skipped === 0, JSON.stringify(r.j));
  r = await a('POST', '/scorecard/reports/generate?comp=SMP1&stage=1', { students: [S1, reg3.student.code] });
  ok('generating again does not queue duplicates', r.j.queued === 0 && r.j.skipped === 2, JSON.stringify(r.j));
  let list = (await a('GET', '/scorecard/reports?comp=SMP1&stage=1')).j;
  ok('the list shows them queued', list.summary.queued === 2 && list.rows.find((x) => x.student.code === S1).report.status === 'Queued', JSON.stringify(list.summary));

  // the live-exam gate: the local demo exam keeps a window open, so the cron must leave the queue alone
  const open = await p.exam.count({ where: { status: { in: ['Live', 'Scheduled'] } } });
  await sleep(7000);
  list = (await a('GET', '/scorecard/reports?comp=SMP1&stage=1')).j;
  ok('while an exam window is open the queue does not run (gate)', open === 0 || list.summary.queued === 2, `open exams=${open}`);

  // process in-process (same code the cron runs)
  const { NestFactory } = require(ROOT + 'node_modules/@nestjs/core');
  const { AppModule } = require(ROOT + 'dist/src/app.module');
  const { ScorecardReportService } = require(ROOT + 'dist/src/admin/scorecard/report.service');
  const { ScorecardReportQueueService } = require(ROOT + 'dist/src/admin/scorecard/report-queue.service');
  const { launchBrowser } = require(ROOT + 'dist/src/scorecard/report-renderer');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const svc = app.get(ScorecardReportService);
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
  list = (await a('GET', '/scorecard/reports?comp=SMP1&stage=1')).j;
  const row1 = list.rows.find((x) => x.student.code === S1);
  ok('after the worker runs both are Ready', list.summary.ready === 2 && row1.report.status === 'Ready' && row1.report.version === 1, JSON.stringify(list.summary));
  ok('a Ready report has a code, checksum, size and page count', /^IMLR-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{2}$/.test(row1.report.code) && /^[0-9a-f]{64}$/.test(row1.report.checksum) && row1.report.sizeBytes > 20000 && row1.report.pages >= 2, JSON.stringify(row1.report));
  ok('gaps are counted on the report', row1.report.gaps >= 0);

  const dl = await call(AT, 'GET', `/scorecard/reports/${row1.report.id}/download`, null, true);
  const dlBuf = Buffer.from(await dl.arrayBuffer());
  ok('download returns the stored PDF whose SHA-256 matches the recorded checksum', dl.status === 200 && dlBuf.slice(0, 5).toString() === '%PDF-' && crypto.createHash('sha256').update(dlBuf).digest('hex') === row1.report.checksum, `${dlBuf.length} bytes`);
  require('fs').writeFileSync('C:/Users/HP/AppData/Local/Temp/claude/D--INDIA-MIND-LEAGUE/8585354e-5b5f-4bb2-9ed0-a743d2e55bbe/scratchpad/qa73-issued.pdf', dlBuf);

  const detail = (await a('GET', `/scorecard/reports/${row1.report.id}`)).j;
  ok('the issued report records the configuration versions used', detail.configUsed.framework.code === fw.code && detail.configUsed.template.code === tp.code && detail.configUsed.library.code === clone.code && detail.configUsed.texts.length > 3 && detail.configUsed.texts.every((t) => t.version >= 1) && detail.configUsed.season === season.code, JSON.stringify(detail.configUsed).slice(0, 160));

  // public verification (a report only verifies once it is released)
  await a('POST', '/scorecard/reports/release?comp=SMP1', { stage: 1, force: true });
  const v = await call('', 'GET', `/public/scorecard-reports/verify/${row1.report.code}`);
  ok('public verify finds the report and shows no scores', v.s === 200 && v.j.found === true && v.j.studentName === reg1.student.name && v.j.current === true && v.j.checksum === row1.report.checksum && v.j.version === 1 && !JSON.stringify(v.j).includes('%'), JSON.stringify(v.j).slice(0, 160));
  const v2 = await call('', 'GET', '/public/scorecard-reports/verify/IMLR-AAAA-BBBB-CC');
  ok('an unknown code is "not found"', v2.s === 200 && v2.j.found === false);
  const v3 = await call('', 'GET', `/public/scorecard-reports/verify/${row1.report.code.toLowerCase()}`);
  ok('the code is case-insensitive', v3.j.found === true);

  // regenerate = new version, old one superseded, both kept
  r = await a('POST', '/scorecard/reports/generate?comp=SMP1&stage=1', { students: [S1], regenerate: true });
  ok('regenerate queues a new version', r.j.queued === 1, JSON.stringify(r.j));
  list = (await a('GET', '/scorecard/reports?comp=SMP1&stage=1')).j;
  const mid = list.rows.find((x) => x.student.code === S1);
  ok('meanwhile the previous version is still the current one', mid.report.version === 1 && mid.report.status === 'Ready' && mid.pending.status === 'Queued', JSON.stringify([mid.report.version, mid.pending && mid.pending.status]));
  await runQueued();
  list = (await a('GET', '/scorecard/reports?comp=SMP1&stage=1')).j;
  const after = list.rows.find((x) => x.student.code === S1);
  ok('after generation version 2 is current and both versions are on record', after.report.version === 2 && after.versions === 2 && after.report.code !== row1.report.code, JSON.stringify([after.report.version, after.versions]));
  await a('POST', '/scorecard/reports/release?comp=SMP1', { stage: 1, students: [S1], force: true });
  const old = await call('', 'GET', `/public/scorecard-reports/verify/${row1.report.code}`);
  ok('once version 2 is released the old code says it is not the current version', old.j.found === true && old.j.current === false && old.j.version === 1);
  const old2 = await call(AT, 'GET', `/scorecard/reports/${row1.report.id}/download`, null, true);
  ok('and the old PDF can still be downloaded', old2.status === 200);
  const det2 = (await a('GET', `/scorecard/reports/${after.report.id}`)).j;
  ok('the detail lists every version', det2.versions.length === 2 && det2.versions[0].version === 2);

  // failure, retries and Failed
  const noAttempt = await p.registration.findFirst({ where: { competition: { code: 'SMP1' }, attempts: { none: {} } }, include: { student: true } });
  if (noAttempt) {
    const bad = await p.scorecardReport.create({ data: { verificationCode: 'IMLR-QAQA-QAQA-QA', registrationId: noAttempt.id, stagePosition: 1 } });
    await runQueued();
    const f = await p.scorecardReport.findUnique({ where: { id: bad.id } });
    ok('a report that cannot be built is retried 3 times then Failed with the reason', f.status === 'Failed' && f.attempts === 3 && /has not taken this stage/.test(f.lastError), `${f.status} ${f.attempts} ${f.lastError}`);
    r = await a('POST', `/scorecard/reports/${bad.id}/retry`);
    ok('retry puts it back in the queue', r.s === 201, JSON.stringify(r.j).slice(0, 60));
    ok('only a failed report can be retried', (await a('POST', `/scorecard/reports/${after.report.id}/retry`)).s === 400);
    await p.scorecardReport.delete({ where: { id: bad.id } });
  } else console.log('SKIP failure path (no student without an attempt)');

  // a restart recovers reports stuck in Generating
  const stuck = await p.scorecardReport.update({ where: { id: after.report.id }, data: { status: 'Generating' } });
  await q.onModuleInit();
  ok('startup puts a report left Generating back in the queue', (await p.scorecardReport.findUnique({ where: { id: stuck.id } })).status === 'Queued');
  await runQueued();
  ok('and it is generated again', (await p.scorecardReport.findUnique({ where: { id: stuck.id } })).status === 'Ready');

  // the roster filter
  list = (await a('GET', '/scorecard/reports?comp=SMP1&stage=1&status=None&limit=5')).j;
  ok('filter students with no report yet', list.rows.length === 5 && list.rows.every((x) => !x.report) && list.total === list.summary.none);

  // ----------------------------------------------------------------- cleanup
  await browser.close();
  await app.close();
  await p.scorecardReport.deleteMany({ where: { registration: { competition: { code: 'SMP1' } } } });
  await a('PUT', `/scorecard/seasons/${season.code}/competitions`, { competitions: [] });
  await a('DELETE', `/scorecard/seasons/${season.code}`);
  await a('DELETE', `/scorecard/content/libraries/${clone.code}`);
  await p.scorecardFramework.deleteMany({ where: { code: fw.code } });
  await a('POST', `/scorecard/templates/${cp.code}/archive`);
  await p.scorecardTemplate.deleteMany({ where: { code: cp.code } });
  await p.scorecardTemplate.update({ where: { code: tp.code }, data: { status: 'Draft', publishedAt: null } });
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
