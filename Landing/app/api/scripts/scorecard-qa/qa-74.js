// #74: release, audiences, consent and parent links.
// Needs: API on :3000, the local demo season (node setup-73-demo.js), sample competition SMP1.
const { ROOT } = require('./guard.js');
const API = ROOT;
const crypto = require('crypto');
const jwt = require(API + 'node_modules/jsonwebtoken');
const { PrismaClient } = require(API + 'node_modules/@prisma/client');
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
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const bytes = async (r) => Buffer.from(await r.arrayBuffer());

(async () => {
  const AT = (await call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const a = (m, path, b) => call(AT, m, path, b);
  const sign = (sub, kind) => jwt.sign({ sub, kind }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

  const season = (await a('GET', '/scorecard/seasons')).j.find((s) => s.name === 'Local demo season');
  if (!season) throw new Error('run setup-73-demo.js first');
  const origTemplate = season.template.code;
  const origSettings = season.deliverySettings;

  // ---- a template that hides the narrative from parent and school
  const tpl = (await a('POST', '/scorecard/templates', { name: 'QA74 audience template', cloneFrom: 'TP1' })).j;
  const cfg = tpl.config;
  cfg.sections.find((s) => s.type === 'narrative').audiences = ['student'];
  await a('PATCH', `/scorecard/templates/${tpl.code}`, { config: cfg });
  await a('POST', `/scorecard/templates/${tpl.code}/publish`);
  let r = await a('PATCH', `/scorecard/seasons/${season.code}`, { templateCode: tpl.code });
  ok('season switches to the audience template', r.s === 200 && r.j.template.code === tpl.code);
  r = await a('PATCH', `/scorecard/seasons/${season.code}`, { deliverySettings: { consentRequired: 'maybe' } });
  ok('bad delivery settings are refused', r.s === 400 && /true or false/.test(msg(r)), msg(r));
  r = await a('PATCH', `/scorecard/seasons/${season.code}`, { deliverySettings: { linkValidDays: 999 } });
  ok('a link cannot be valid for years', r.s === 400 && /1 to 180/.test(msg(r)));
  r = await a('PATCH', `/scorecard/seasons/${season.code}`, { deliverySettings: { consentRequired: true, notifyStudent: true, linkValidDays: 14 } });
  ok('delivery settings are saved and read back', r.s === 200 && r.j.deliverySettings.linkValidDays === 14 && r.j.deliverySettings.consentRequired === true);

  // ---- students: S1 and S2 in the same school, S3 in another one
  const regOf = (code) => p.registration.findFirst({ where: { code }, include: { student: { include: { school: true } } } });
  const reg1 = await regOf('RSM001');
  const school1 = reg1.student.schoolId;
  const others = await p.registration.findMany({ where: { competition: { code: 'SMP1' }, code: { startsWith: 'RSM' }, student: { schoolId: school1 }, id: { not: reg1.id }, attempts: { some: { finishedAt: { not: null } } } }, include: { student: true }, take: 30 });
  // S2 must have no missing wording, so look for a Proficient-THINK student by trying the preview
  let reg2 = null;
  for (const o of others) {
    const pr = await a('GET', `/scorecard/reports/preview?comp=SMP1&stage=1&student=${o.student.code}`);
    if (pr.s === 200 && pr.j.gaps.length === 0) { reg2 = o; break; }
  }
  const foreign = await p.registration.findFirst({ where: { competition: { code: 'SMP1' }, student: { schoolId: { not: school1 } }, attempts: { some: { finishedAt: { not: null } } } }, include: { student: true } });
  if (!reg2 || !foreign) throw new Error('need two students in one school and one in another');
  const S1 = reg1.student, S2 = reg2.student, S3 = foreign.student;
  // restore these afterwards
  const saved = [];
  for (const [s, phone] of [[S1, '9876500001'], [S2, null], [S3, '9876500003']]) {
    saved.push({ id: s.id, parentPhone: s.parentPhone, parent: s.parent });
    await p.student.update({ where: { id: s.id }, data: { parentPhone: phone, parent: 'Parent of ' + s.name.split(' ')[0] } });
  }
  const tokS1 = sign(S1.id, 'student'), tokS2 = sign(S2.id, 'student'), tokS3 = sign(S3.id, 'student');
  const tokSchool1 = sign(school1, 'school'), tokSchool3 = sign(S3.schoolId, 'school');

  // ---- generate (in-process, like the cron would)
  r = await a('POST', '/scorecard/reports/generate?comp=SMP1&stage=1', { students: [S1.code, S2.code, S3.code] });
  ok('three reports queued', r.s === 201 && r.j.queued === 3, JSON.stringify(r.j));
  const { NestFactory } = require(API + 'node_modules/@nestjs/core');
  const { AppModule } = require(API + 'dist/src/app.module');
  const { ScorecardReportQueueService } = require(API + 'dist/src/admin/scorecard/report-queue.service');
  const { ReportReleaseService } = require(API + 'dist/src/admin/scorecard/report-release.service');
  const { MessagingService } = require(API + 'node_modules/../dist/src/messaging/messaging.service');
  const { launchBrowser } = require(API + 'dist/src/scorecard/report-renderer');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const q = app.get(ScorecardReportQueueService);
  const release = app.get(ReportReleaseService);
  const messaging = app.get(MessagingService);
  const sent = [];
  const realDispatch = messaging.dispatch.bind(messaging);
  messaging.dispatch = async (key, target, vars) => { sent.push({ key, target, vars }); return realDispatch(key, target, vars); };
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
  const rep = async (s) => p.scorecardReport.findFirst({ where: { registration: { studentId: s.id, competition: { code: 'SMP1' } }, stagePosition: 1 }, orderBy: { version: 'desc' }, include: { variants: true, file: true } });
  let r1 = await rep(S1);
  ok('reports are Ready', r1.status === 'Ready');
  ok('the template hides the narrative from parent and school, so those two audiences get their own copy', r1.variants.map((v) => v.audience).sort().join() === 'parent,school' && (r1.configUsed.variants || []).join() === 'parent,school', r1.variants.map((v) => v.audience).join());
  ok('the variant files are different from the full one, and smaller', r1.variants.every((v) => v.checksum !== r1.checksum && v.sizeBytes < r1.sizeBytes), `${r1.sizeBytes} vs ${r1.variants.map((v) => v.sizeBytes)}`);

  // ---- nothing is visible before release
  r = await call(tokS1, 'GET', '/student/reports');
  ok('before release the student sees nothing', r.s === 200 && r.j.length === 0);
  const pre = await call(tokS1, 'GET', `/student/reports/${r1.id}/download`, null, true);
  ok('and cannot download it by id', pre.status === 404);
  r = await call(tokSchool1, 'GET', '/school/reports');
  ok('the school sees nothing either', r.s === 200 && r.j.reports.length === 0 && r.j.awaitingConsent === 0);
  r = await call('', 'GET', `/public/scorecard-reports/verify/${r1.verificationCode}`);
  ok('an unreleased report does not verify publicly', r.j.found === false);
  r = await a('POST', '/scorecard/reports/send-parents?comp=SMP1', { stage: 1, students: [S1.code] });
  ok('sending to a parent needs the report released', r.j.sent === 0 && /not released/.test(r.j.skipped[0].reason), JSON.stringify(r.j.skipped));
  r = await call(tokS1, 'GET', '/scorecard/reports?comp=SMP1&stage=1');
  ok('a student token cannot reach the admin API', r.s === 403);
  r = await call('', 'GET', '/student/reports');
  ok('and no token means no student reports', r.s === 401);

  // ---- release
  r = await a('POST', '/scorecard/reports/release?comp=SMP1', { stage: 1, students: [S1.code, S2.code] });
  ok('release two reports', r.s === 201 && r.j.released === 2 && r.j.skippedCount === 0, JSON.stringify(r.j));
  await new Promise((res) => setTimeout(res, 2000));
  const logs = await p.messageLog.count({ where: { templateKey: 'SCORECARD_REPORT_READY' } });
  ok('students are told by message through the existing templates (one log row per channel and student)', logs >= 2, String(logs));
  r = await a('POST', '/scorecard/reports/release?comp=SMP1', { stage: 1, students: [S1.code, S2.code] });
  ok('releasing again changes nothing', r.j.released === 0);
  r = await a('POST', '/scorecard/reports/release?comp=SMP1', { stage: 1, students: ['NOPE'] });
  ok('an unknown student is just nothing to release', r.s === 201 && r.j.released === 0);

  // ---- student view
  r = await call(tokS1, 'GET', '/student/reports');
  ok('the student now sees their report with stage and edition', r.j.length === 1 && r.j[0].stage.position === 1 && r.j[0].version === 1 && /Edition/.test(r.j[0].edition), JSON.stringify(r.j[0]).slice(0, 140));
  let dl = await call(tokS1, 'GET', `/student/reports/${r.j[0].id}/download`, null, true);
  let buf = await bytes(dl);
  ok('and downloads the full PDF (the student sees every section)', dl.status === 200 && buf.slice(0, 5).toString() === '%PDF-' && sha(buf) === r1.checksum);
  dl = await call(tokS2, 'GET', `/student/reports/${r1.id}/download`, null, true);
  ok("another student cannot download it (looks like it does not exist)", dl.status === 404);
  const r3 = await rep(S3);
  dl = await call(tokS1, 'GET', `/student/reports/${r3.id}/download`, null, true);
  ok('nor a report that is not released at all', dl.status === 404);

  // ---- gaps block a release unless forced
  r = await a('POST', '/scorecard/reports/release?comp=SMP1', { stage: 1, students: [S3.code] });
  const gaps = ((r3.warnings || {}).gaps || []).length;
  if (gaps) {
    ok('a report with missing wording is not released by default', r.j.released === 0 && /Wording is missing/.test(r.j.skipped[0].reason), JSON.stringify(r.j.skipped));
    r = await a('POST', '/scorecard/reports/release?comp=SMP1', { stage: 1, students: [S3.code], force: true });
    ok('unless the admin says so', r.j.released === 1);
  } else {
    ok('(S3 has no gaps; released normally)', r.j.released === 1);
  }

  // ---- school: consent
  r = await call(tokSchool1, 'GET', '/school/reports');
  ok('the school sees none while consent is missing, and how many wait for it', r.j.reports.length === 0 && r.j.awaitingConsent === 2, JSON.stringify([r.j.reports.length, r.j.awaitingConsent]));
  dl = await call(tokSchool1, 'GET', `/school/reports/${r1.id}/download`, null, true);
  ok('and cannot download', dl.status === 403);
  r = await call(tokS1, 'GET', '/student/reports/consent');
  ok('the student sees a consent card, with the wording not written yet', r.j.length === 1 && r.j[0].required === true && r.j[0].text === null && r.j[0].textMissing === true && r.j[0].accepted.school === false, JSON.stringify(r.j));
  r = await call(tokS1, 'POST', '/student/reports/consent', { audience: 'school', season: season.code, accept: true });
  ok('consent cannot be given before the wording is approved', r.s === 400 && /not been approved/.test(msg(r)), msg(r));

  // write and approve the consent wording in the season's library
  const libCode = (await a('GET', `/scorecard/seasons/${season.code}`)).j.library.code;
  r = await a('PUT', `/scorecard/content/libraries/${libCode}/texts`, { kind: 'consent', text: 'I, {Name}, agree that my {Edition} report may be shared with my parent and my school.' });
  await a('POST', `/scorecard/content/libraries/${libCode}/texts/${r.j.id}/approve`, { note: 'qa' });
  r = await call(tokS1, 'GET', '/student/reports/consent');
  ok('the consent wording is shown, filled in for the student', r.j[0].text && r.j[0].text.startsWith('I, ' + S1.name) && !r.j[0].textMissing, (r.j[0].text || '').slice(0, 70));
  r = await call(tokS1, 'POST', '/student/reports/consent', { audience: 'student', season: season.code, accept: true });
  ok('only parent or school consent can be given', r.s === 400);
  r = await call(tokS1, 'POST', '/student/reports/consent', { audience: 'school', season: 'SE99', accept: true });
  ok('an unknown season is refused', r.s === 404);
  r = await call(tokS1, 'POST', '/student/reports/consent', { audience: 'school', season: season.code, accept: true });
  ok('the student agrees to share with the school', r.s === 201 && r.j[0].accepted.school === true && r.j[0].accepted.parent === false);
  const cRow = await p.scorecardConsent.findFirst({ where: { studentId: S1.id, audience: 'school', withdrawnAt: null } });
  ok('the exact wording and its version are recorded', !!cRow && cRow.consentText.startsWith('I, ') && cRow.textVersion === 1 && cRow.libraryCode === libCode && cRow.acceptedBy === 'student');
  r = await call(tokS1, 'POST', '/student/reports/consent', { audience: 'school', season: season.code, accept: true });
  ok('agreeing twice records it once', (await p.scorecardConsent.count({ where: { studentId: S1.id, audience: 'school', withdrawnAt: null } })) === 1);

  // ---- school view
  r = await call(tokSchool1, 'GET', '/school/reports');
  ok('the school now sees that student only (the other still waits)', r.j.reports.length === 1 && r.j.reports[0].student.code === S1.code && r.j.awaitingConsent === 1, JSON.stringify([r.j.reports.length, r.j.awaitingConsent]));
  dl = await call(tokSchool1, 'GET', `/school/reports/${r1.id}/download`, null, true);
  buf = await bytes(dl);
  const schoolVariant = r1.variants.find((v) => v.audience === 'school');
  ok("and gets the school's copy, not the full file", dl.status === 200 && sha(buf) === schoolVariant.checksum && sha(buf) !== r1.checksum);
  dl = await call(tokSchool3, 'GET', `/school/reports/${r1.id}/download`, null, true);
  ok("another school cannot download that school's student", dl.status === 404);
  dl = await call(tokSchool1, 'GET', `/school/reports/${r3.id}/download`, null, true);
  ok("a school cannot download another school's student either", dl.status === 404);

  // ---- parents
  r = await a('POST', '/scorecard/reports/send-parents?comp=SMP1', { stage: 1, students: [S1.code, S2.code] });
  ok('parents: no consent for the parent audience yet, and one has no phone', r.s === 201 && r.j.sent === 0 && r.j.skippedCount === 2, JSON.stringify(r.j.skipped));
  await call(tokS1, 'POST', '/student/reports/consent', { audience: 'parent', season: season.code, accept: true });
  sent.length = 0;
  const parentCall = () => release.sendToParents('SMP1', { stage: 1, students: [S1.code] }, null);
  let sp = await parentCall();
  ok('with consent and a phone number the link is sent', sp.sent === 1 && sent.length === 1 && sent[0].key === 'SCORECARD_REPORT_PARENT' && sent[0].target.phone === '9876500001', JSON.stringify(sp));
  const v1 = sent[0].vars;
  ok('the message carries a link, a 6-digit code and the number of days', /\/report\/[A-Za-z0-9_-]{43}$/.test(v1.ReportLink) && /^\d{6}$/.test(v1.Code) && v1.Days === 14 && v1.ParentName === 'Parent of ' + S1.name.split(' ')[0], JSON.stringify(v1).slice(0, 150));
  const token1 = v1.ReportLink.split('/report/')[1];
  const linkRow = await p.scorecardShareLink.findFirst({ where: { registrationId: reg1.id }, orderBy: { id: 'desc' } });
  ok('only hashes are stored, never the token or the code', linkRow.tokenHash !== token1 && linkRow.codeHash !== v1.Code && !JSON.stringify(linkRow).includes(token1) && !JSON.stringify(linkRow).includes(v1.Code) && /^[0-9a-f]{64}$/.test(linkRow.tokenHash));
  r = await call('', 'GET', `/public/scorecard-links/${token1}`);
  ok('the link page shows a first name and the stage before any code', r.j.state === 'ok' && r.j.studentFirstName === S1.name.split(' ')[0] && !!r.j.stage && r.j.triesLeft === 5 && !('studentName' in r.j), JSON.stringify(r.j));
  r = await call('', 'GET', '/public/scorecard-links/not-a-real-token');
  ok('an unknown link is a 404', r.s === 404);
  r = await call('', 'POST', `/public/scorecard-links/${token1}/open`, { code: '000000' === v1.Code ? '111111' : '000000' });
  ok('a wrong code is refused and counted', r.s === 403 && /4 tries left/.test(msg(r)), msg(r));
  r = await call('', 'POST', `/public/scorecard-links/${token1}/open`, { code: 'abc' });
  ok('a malformed code is also a miss', r.s === 403);
  let open = await call('', 'POST', `/public/scorecard-links/${token1}/open`, { code: v1.Code }, true);
  buf = await bytes(open);
  const parentVariant = r1.variants.find((v) => v.audience === 'parent');
  ok("the right code opens the parent's copy of the report", open.status === 201 && buf.slice(0, 5).toString() === '%PDF-' && sha(buf) === parentVariant.checksum);
  ok('opening is counted', (await p.scorecardShareLink.findUnique({ where: { id: linkRow.id } })).openCount === 1);

  // a second link revokes the first; five wrong codes lock a link
  sent.length = 0;
  sp = await parentCall();
  const v2 = sent[0].vars;
  const token2 = v2.ReportLink.split('/report/')[1];
  open = await call('', 'POST', `/public/scorecard-links/${token1}/open`, { code: v1.Code }, true);
  ok('sending again revokes the earlier link', open.status === 403 && (await open.json()).message.includes('no longer active'));
  for (let i = 0; i < 5; i++) await call('', 'POST', `/public/scorecard-links/${token2}/open`, { code: v2.Code === '123456' ? '654321' : '123456' });
  open = await call('', 'POST', `/public/scorecard-links/${token2}/open`, { code: v2.Code }, true);
  ok('five wrong codes lock the link, even for the right code', open.status === 403 && (await open.json()).message.includes('Too many wrong codes'));
  r = await call('', 'GET', `/public/scorecard-links/${token2}`);
  ok('the page says it is locked', r.j.state === 'locked' && r.j.triesLeft === 0);

  sent.length = 0;
  await parentCall();
  const v3 = sent[0].vars;
  const token3 = v3.ReportLink.split('/report/')[1];
  await p.scorecardShareLink.updateMany({ where: { tokenHash: crypto.createHash('sha256').update(token3).digest('hex') }, data: { expiresAt: new Date(Date.now() - 1000) } });
  open = await call('', 'POST', `/public/scorecard-links/${token3}/open`, { code: v3.Code }, true);
  ok('an expired link does not open', open.status === 403 && (await open.json()).message.includes('expired'));

  sent.length = 0;
  await parentCall();
  const v4 = sent[0].vars;
  const token4 = v4.ReportLink.split('/report/')[1];

  // ---- admin list shows it all
  r = await a('GET', '/scorecard/reports?comp=SMP1&stage=1&limit=100');
  const row1 = r.j.rows.find((x) => x.student.code === S1.code);
  ok('the admin list shows release, consent and the parent link', row1.release.state === 'Released' && row1.release.version === 1 && row1.consent.parent && row1.consent.school && row1.parentLink.state === 'ok' && row1.student.hasParentPhone, JSON.stringify([row1.release, row1.consent, row1.parentLink && row1.parentLink.state]));
  ok('summary counts released reports', r.j.summary.released === 3 && r.j.summary.toRelease === 0, JSON.stringify(r.j.summary));

  // ---- regenerate: the old version stays visible until the new one is released
  await a('POST', '/scorecard/reports/generate?comp=SMP1&stage=1', { students: [S1.code], regenerate: true });
  await runQueued();
  r = await call(tokS1, 'GET', '/student/reports');
  ok('a new version waiting for release changes nothing for the student', r.j.length === 1 && r.j[0].version === 1);
  r = await a('GET', '/scorecard/reports?comp=SMP1&stage=1&limit=100');
  const row1b = r.j.rows.find((x) => x.student.code === S1.code);
  ok('the admin sees that version 2 awaits release', row1b.release.version === 1 && row1b.release.awaiting === 2 && r.j.summary.toRelease === 1, JSON.stringify(row1b.release));
  r = await call('', 'GET', `/public/scorecard-reports/verify/${r1.verificationCode}`);
  ok('version 1 still verifies as current while version 2 is unreleased', r.j.found === true && r.j.state === 'current' && r.j.version === 1);
  await a('POST', '/scorecard/reports/release?comp=SMP1', { stage: 1, students: [S1.code] });
  r = await call(tokS1, 'GET', '/student/reports');
  ok('after releasing version 2 the student sees version 2', r.j.length === 1 && r.j[0].version === 2);
  r = await call('', 'GET', `/public/scorecard-reports/verify/${r1.verificationCode}`);
  ok('version 1 now verifies as superseded', r.j.found === true && r.j.state === 'superseded' && r.j.current === false);
  r1 = await rep(S1);
  open = await call('', 'POST', `/public/scorecard-links/${token4}/open`, { code: v4.Code }, true);
  buf = await bytes(open);
  ok("the parent link follows to the newest released version (its parent copy)", open.status === 201 && sha(buf) === r1.variants.find((v) => v.audience === 'parent').checksum && r1.version === 2);

  // ---- withdrawing consent and withdrawing the release
  await call(tokS1, 'POST', '/student/reports/consent', { audience: 'parent', season: season.code, accept: false });
  open = await call('', 'POST', `/public/scorecard-links/${token4}/open`, { code: v4.Code }, true);
  ok('taking parent consent back kills the parent links at once', open.status === 403 && (await open.json()).message.includes('no longer active'));
  await call(tokS1, 'POST', '/student/reports/consent', { audience: 'school', season: season.code, accept: false });
  r = await call(tokSchool1, 'GET', '/school/reports');
  ok('taking school consent back hides the report from the school', r.j.reports.length === 0 && r.j.awaitingConsent === 2);
  await a('PATCH', `/scorecard/seasons/${season.code}`, { deliverySettings: { consentRequired: false } });
  r = await call(tokSchool1, 'GET', '/school/reports');
  ok('a season that does not require consent shows the school its students', r.j.reports.length === 2, String(r.j.reports.length));
  await a('PATCH', `/scorecard/seasons/${season.code}`, { deliverySettings: { consentRequired: true, linkValidDays: 14 } });

  r = await a('POST', '/scorecard/reports/withdraw?comp=SMP1', { stage: 1, students: [S1.code], reason: 'wrong marks' });
  ok('withdraw takes it away from everyone', r.s === 201 && r.j.withdrawn === 1, JSON.stringify(r.j));
  r = await call(tokS1, 'GET', '/student/reports');
  ok('the student no longer sees it', r.j.length === 0);
  dl = await call(tokS1, 'GET', `/student/reports/${r1.id}/download`, null, true);
  ok('or downloads it', dl.status === 404);
  r = await call('', 'GET', `/public/scorecard-reports/verify/${r1.verificationCode}`);
  ok('its code says it was withdrawn', r.j.found === true && r.j.state === 'withdrawn' && r.j.current === false);
  const wd = await p.scorecardReport.findUnique({ where: { id: r1.id } });
  ok('the reason is recorded', wd.withdrawnReason === 'wrong marks' && !!wd.withdrawnAt);
  r = await a('POST', '/scorecard/reports/release?comp=SMP1', { stage: 1, students: [S1.code] });
  ok('a withdrawn report can be released again', r.j.released === 1);
  r = await call(tokS1, 'GET', '/student/reports');
  ok('and the student sees it again', r.j.length === 1 && r.j[0].version === 2);

  // ---- audit
  const audit = (await a('GET', '/scorecard/audit?entity=report&code=SMP1&limit=50')).j;
  const actions = new Set((audit.items || audit).map((x) => x.action));
  ok('release, withdraw and send-to-parents are in the audit log', ['release', 'withdraw', 'send_parents'].every((x) => actions.has(x)), [...actions].join());

  // ---- cleanup
  await browser.close();
  await app.close();
  const regIds = (await p.registration.findMany({ where: { competition: { code: 'SMP1' } }, select: { id: true } })).map((x) => x.id);
  await p.scorecardShareLink.deleteMany({ where: { registrationId: { in: regIds } } });
  await p.scorecardReport.deleteMany({ where: { registrationId: { in: regIds } } });
  await p.scorecardConsent.deleteMany({ where: { studentId: { in: [S1.id, S2.id, S3.id] } } });
  await p.scorecardText.deleteMany({ where: { library: { code: libCode }, kind: 'consent' } });
  for (const s of saved) await p.student.update({ where: { id: s.id }, data: { parentPhone: s.parentPhone, parent: s.parent } });
  await a('PATCH', `/scorecard/seasons/${season.code}`, { templateCode: origTemplate, deliverySettings: origSettings });
  await a('POST', `/scorecard/templates/${tpl.code}/archive`);
  await p.scorecardTemplate.deleteMany({ where: { code: tpl.code } });
  await p.messageLog.deleteMany({ where: { templateKey: { in: ['SCORECARD_REPORT_READY', 'SCORECARD_REPORT_PARENT'] } } });
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
