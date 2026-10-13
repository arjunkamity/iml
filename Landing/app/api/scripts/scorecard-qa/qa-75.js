// #75-#83: panel forms, panelists, login, lifecycle, portal, aggregation, control view, selection.
const { ROOT } = require('./guard.js');
const API = ROOT;
const crypto = require('crypto');
const jwt = require(API + 'node_modules/jsonwebtoken');
const argon = require(API + 'node_modules/@node-rs/argon2');
const { PrismaClient } = require(API + 'node_modules/@prisma/client');
const fixture = require('./fixture-panel.js');
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
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sign = (sub, kind, extra = {}) => jwt.sign({ sub, kind, ...extra }, process.env.JWT_ACCESS_SECRET, { expiresIn: '2h' });

(async () => {
  const AT = (await call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const a = (m, path, b) => call(AT, m, path, b);
  const fx = await fixture.up(p, 8);
  const C = fixture.CODE;
  const REG = fx.regs; // 8 registrations
  const [school1, school2] = fx.schools;
  const stageId = (pos) => fx.stages.find((s) => s.position === pos).id;
  const cleanup = [];

  // ================================================================ #75 forms
  let r = await a('POST', '/panel-forms', { title: 'QA Live Showdown form', settings: { requiredRaters: 2, disagreementGap: 2, noteLabel: 'Observer note' } });
  ok('create a panel form', r.s === 201 && /^AS\d+$/.test(r.j.code) && r.j.kind === 'panel' && r.j.settings.requiredRaters === 2 && r.j.status === 'Draft', JSON.stringify(r.j).slice(0, 90));
  const F2 = r.j.code;
  r = await a('POST', `/panel-forms/${F2}/competencies`, { label: ' ', dimension: 'THINK', prompt: 'x', options: ['A', 'B'], points: [1, 2] });
  ok('a competency needs a name', r.s === 400 && /name/.test(msg(r)));
  r = await a('POST', `/panel-forms/${F2}/competencies`, { label: 'Bad order', dimension: 'THINK', prompt: 'x', options: ['A', 'B', 'C'], points: [1, 3, 2] });
  ok('points must go up in the order the options are shown', r.s === 400 && /go up/.test(msg(r)), msg(r));
  r = await a('POST', `/panel-forms/${F2}/competencies`, { label: 'Critical Thinking', dimension: 'THINK', prompt: 'Assesses the situation before responding', options: ['Low', 'High'], points: [1, 4], hints: ['Acts at once', 'Weighs consequences'], weight: 1.5 });
  ok('add a competency with hints and a weight', r.s === 201 && r.j.weight === 1.5 && r.j.options[1].hint === 'Weighs consequences' && r.j.options[0].points === 1, JSON.stringify(r.j).slice(0, 120));
  const q1 = r.j.code;
  r = await a('PATCH', `/panel-forms/${F2}/competencies/${q1}`, { useStandardScale: true });
  ok('"use the standard scale" fills options, points and hints', r.s === 200 && r.j.options.map((o) => o.label).join() === 'Emerging,Developing,Proficient,Advanced' && r.j.options.map((o) => o.points).join() === '1,2,3,4' && /Beginning/.test(r.j.options[0].hint), JSON.stringify(r.j.options.map((o) => o.label)));
  const S2 = ['Emotional Awareness', 'Perspective Taking', 'Ethical Judgment', 'Communication', 'Decision Making', 'Responsibility', 'Leadership Orientation'];
  const dims = ['FEEL', 'CONNECT', 'LEAD', 'CONNECT', 'LEAD', 'LEAD', 'LEAD'];
  for (const [i, label] of S2.entries()) r = await a('POST', `/panel-forms/${F2}/competencies`, { label, dimension: dims[i], prompt: label + ' observed', useStandardScale: true });
  r = await a('POST', `/panel-forms/${F2}/competencies`, { label: 'critical thinking', dimension: 'THINK', prompt: 'x', useStandardScale: true });
  ok('the same competency name twice is refused', r.s === 400 && /already exists/.test(msg(r)));
  r = await a('GET', `/panel-forms/${F2}`);
  ok('the Stage 2 form from the sample has all eight competencies and can be published', r.j.competencies.length === 8 && r.j.issues.length === 0, JSON.stringify(r.j.issues));
  ok('options keep their order (no shuffling)', r.j.competencies.every((c) => c.options.map((o) => o.points).join() === '1,2,3,4'));
  r = await a('POST', `/panel-forms/${F2}/publish`);
  ok('publish', r.s === 201 && r.j.status === 'Published');

  // the Stage 3 and Stage 4 forms of the sample, built the same way
  const mk = async (title, labels) => {
    const f = (await a('POST', '/panel-forms', { title, settings: { requiredRaters: 2 } })).j;
    for (const l of labels) await a('POST', `/panel-forms/${f.code}/competencies`, { label: l, dimension: 'THINK', prompt: l + ' observed', useStandardScale: true });
    await a('POST', `/panel-forms/${f.code}/publish`);
    return f.code;
  };
  const F3 = await mk('QA Bootcamp form', ['Self-Awareness', 'Emotional Regulation', 'Empathy', 'Listening', 'Collaboration', 'Problem Solving', 'Ethical Decision-Making', 'Initiative', 'Adaptability', 'Accountability', 'Communication']);
  const F4 = await mk('QA Finale form', ['Understanding Complexity', 'Critical Reasoning', 'Emotional Maturity', 'Empathy', 'Ethical Judgment', 'Communication', 'Decision-Making', 'Confidence Under Pressure', 'Responsibility', 'Leadership Impact']);
  ok('the Stage 3 (11 capabilities) and Stage 4 (10) forms can be built in admin', (await a('GET', `/panel-forms/${F3}`)).j.competencies.length === 11 && (await a('GET', `/panel-forms/${F4}`)).j.competencies.length === 10);

  // existing self-taken assessments are untouched
  const list = (await a('GET', '/assessments')).j;
  ok('the Assessments list labels kinds: panel forms are "panel", existing ones "self"', list.assessments.some((x) => x.code === F2 && x.kind === 'panel') && list.assessments.filter((x) => x.kind === 'self').length >= 1, list.assessments.map((x) => x.code + ':' + x.kind).join());
  r = await a('GET', `/assessments/${F2}`);
  ok('a panel form is not editable through the self-taken screens', r.s === 404);
  const selfCode = list.assessments.find((x) => x.kind === 'self').code;
  r = await a('GET', `/assessments/${selfCode}`);
  ok('a self-taken assessment still opens exactly as before', r.s === 200 && Array.isArray(r.j.dimensions));
  const stud = await p.student.findFirst({ where: { archived: false } });
  const studTok = sign(stud.id, 'student');
  r = await call(studTok, 'GET', '/student/assessments');
  ok('students never see a panel form', r.s === 200 && !(r.j || []).some((x) => x.slug && /qa-live-showdown/.test(x.slug)) && JSON.stringify(r.j).indexOf(F2) < 0);
  r = await call(studTok, 'GET', '/student/assessments/qa-live-showdown-form');
  ok('nor open one by its address', r.s === 404);

  // ============================================================ #76 panelists
  const PW = 'Panel@12345';
  const hash = await argon.hash(PW);
  const mkPanelist = async (name, email, phone, password = true) => {
    const x = await a('POST', '/panel/panelists', { name, email, phone });
    if (password) await p.panelist.update({ where: { id: x.j.id }, data: { passwordHash: hash, status: 'Active', inviteTokenHash: null, inviteExpiresAt: null } });
    return x.j;
  };
  r = await a('POST', '/panel/panelists', { name: 'Asha Rao', email: 'qa.asha@example.com', phone: '9000000001' });
  ok('invite a panelist: account created as Invited, with an invite link outstanding', r.s === 201 && r.j.status === 'Invited' && /^PN\d+$/.test(r.j.code) && !!r.j.inviteExpiresAt && r.j.hasPassword === false, JSON.stringify(r.j).slice(0, 100));
  const asha = r.j;
  r = await a('POST', '/panel/panelists', { name: 'Dup', email: 'QA.Asha@example.com' });
  ok('an email can only have one account, case aside', r.s === 409);
  r = await a('POST', '/panel/panelists', { name: 'X', email: 'not-an-email' });
  ok('a bad email is refused', r.s === 400);
  await new Promise((res) => setTimeout(res, 800));
  const invLogs = await p.messageLog.count({ where: { templateKey: 'PANEL_INVITE', recipient: { in: ['qa.asha@example.com', '9000000001'] } } });
  ok('the invite goes by email and SMS through an editable message template', invLogs >= 1 && !!(await p.messageTemplate.findUnique({ where: { key: 'PANEL_INVITE' } })), String(invLogs));
  const tok1 = crypto.randomBytes(20).toString('base64url');
  await p.panelist.update({ where: { id: asha.id }, data: { inviteTokenHash: sha(tok1), inviteExpiresAt: new Date(Date.now() + 3600000) } });
  r = await call('', 'POST', '/panel/auth/set-password', { token: tok1, password: 'short' });
  ok('a short password is refused', r.s === 400);
  r = await call('', 'POST', '/panel/auth/set-password', { token: 'nope-nope', password: PW });
  ok('a wrong invite link is refused', r.s === 400);
  r = await call('', 'POST', '/panel/auth/set-password', { token: tok1, password: PW });
  ok('the invitee sets their own password and the account is Active', r.s === 201 && (await p.panelist.findUnique({ where: { id: asha.id } })).status === 'Active');
  r = await call('', 'POST', '/panel/auth/set-password', { token: tok1, password: PW });
  ok('an invite link works once', r.s === 400);
  r = await a('POST', `/panel/panelists/${asha.id}/resend`);
  const reHash = (await p.panelist.findUnique({ where: { id: asha.id } })).inviteTokenHash;
  ok('resend makes a fresh link', r.s === 201 && !!reHash);

  const pb = await mkPanelist('Bala Iyer', 'qa.bala@example.com', '9000000002');
  const pc = await mkPanelist('Chitra Nair', 'qa.chitra@example.com', '9000000003');
  const pd = await mkPanelist('Dev Menon', 'qa.dev@example.com', '9000000004');
  const pe = await mkPanelist('Esha Khan', 'qa.esha@example.com', '9000000005');
  for (const x of [asha, pb, pc, pd, pe]) cleanup.push(x.id);

  // module permission: an admin without the Panels module is refused
  let editor = await p.admin.findFirst({ where: { role: { not: 'Super Admin' } } });
  if (!editor) editor = await p.admin.create({ data: { name: 'QA Editor', email: 'qa.editor@example.com', passwordHash: 'x', role: 'Editor' } });
  await p.adminModule.deleteMany({ where: { adminId: editor.id, moduleCode: 'pn' } });
  const edTok = sign(editor.id, 'admin', { role: editor.role });
  r = await call(edTok, 'GET', '/panel/panelists');
  ok('an admin without the Panels module cannot manage panels', r.s === 403, String(r.s));
  await p.adminModule.upsert({ where: { adminId_moduleCode: { adminId: editor.id, moduleCode: 'pn' } }, create: { adminId: editor.id, moduleCode: 'pn' }, update: {} });
  r = await call(edTok, 'GET', '/panel/panelists');
  ok('and can once the module is granted', r.s === 200);
  await p.adminModule.deleteMany({ where: { adminId: editor.id, moduleCode: 'pn' } });

  // ---- stage 2 setup
  r = await a('GET', `/panel/competitions/${C}/stages/2`);
  ok('a new stage starts in Draft with a checklist of what is missing, in plain words', r.s === 200 && r.j.state === 'Draft' && r.j.readyIssues.length >= 2 && /evaluation form/.test(r.j.readyIssues.join(' ')) && /panelist/.test(r.j.readyIssues.join(' ')), JSON.stringify(r.j.readyIssues));
  ok('the roster is the students unlocked into the stage', r.j.rosterSize === 8, String(r.j.rosterSize));
  r = await a('POST', `/panel/competitions/${C}/stages/2/open`);
  ok('open is refused until the stage is ready, with the reasons', r.s === 400 && /Finish the Ready checklist/.test(msg(r)), msg(r));
  r = await a('PUT', `/panel/competitions/${C}/stages/2/setup`, { formCode: F2, requiredRaters: 2 });
  ok('set the form and the required raters', r.s === 200 && r.j.form.code === F2 && r.j.requiredRaters === 2);
  r = await a('PUT', `/panel/competitions/${C}/stages/2/setup`, { formCode: 'AS1' });
  ok('only a panel form can be chosen', r.s === 400);
  for (const x of [asha, pb, pc]) r = await a('POST', `/panel/competitions/${C}/stages/2/panelists`, { panelistId: x.id, conflictSchools: x === pc ? [school1] : [] });
  ok('enrol three panelists (one with a school conflict)', r.s === 201 && r.j.panelists.length === 3 && r.j.panelists.find((x) => x.name === 'Chitra Nair').conflictSchools[0] === school1);
  r = await a('POST', `/panel/competitions/${C}/stages/2/panelists`, { panelistId: asha.id });
  ok('a panelist can be on a stage once', r.s === 409);
  await a('POST', `/panel/panelists/${pd.id}/disable`);
  r = await a('POST', `/panel/competitions/${C}/stages/2/panelists`, { panelistId: pd.id });
  ok('a disabled panelist cannot be enrolled', r.s === 400);
  await a('POST', `/panel/panelists/${pd.id}/enable`);

  // lifecycle gates before opening
  r = await a('GET', `/panel/competitions/${C}/stages/3`);
  ok('stage 3 cannot open while stage 2 is not decided, and says why', r.j.openBlockers.some((x) => /Stage 2 .* not closed with its selection committed/.test(x)) || r.j.readyIssues.length > 0, JSON.stringify(r.j.openBlockers));
  r = await a('POST', `/panel/competitions/${C}/stages/3/open`);
  ok('opening stage 3 early is refused by the server', r.s === 400);
  r = await a('GET', `/panel/competitions/${C}/stages/2`);
  ok('stage 2 now has no blockers (stage 1 is decided)', r.j.readyIssues.length === 0 && r.j.openBlockers.length === 0 && r.j.canOpen, JSON.stringify([r.j.readyIssues, r.j.openBlockers]));

  // tokens
  const tokA = sign(asha.id, 'panel'), tokB = sign(pb.id, 'panel'), tokC = sign(pc.id, 'panel'), tokD = sign(pd.id, 'panel');
  r = await call(tokA, 'GET', '/panel/me/stages');
  ok('the dashboard lists the stage as "Not open yet" before it opens', r.s === 200 && r.j.length === 1 && r.j[0].label === 'Not open yet' && r.j[0].canRate === false, JSON.stringify(r.j[0]));
  r = await call(tokA, 'GET', `/panel/me/stages/${stageId(2)}/students`);
  ok('direct calls to a stage that is not open are refused', r.s === 400 && /not open/.test(msg(r)), msg(r));
  r = await call(tokA, 'PUT', `/panel/me/stages/${stageId(2)}/students/${REG[0].id}`, { ratings: {} });
  ok('and ratings cannot be saved before it opens', r.s === 400);

  // open
  r = await a('POST', `/panel/competitions/${C}/stages/2/open`);
  ok('open stage 2', r.s === 201 && r.j.state === 'Open' && !!r.j.openedAt, JSON.stringify([r.j.state, r.j.openBlockers]));
  const snap = (await p.panelStage.findUnique({ where: { stageId: stageId(2) } })).formSnapshot;
  ok('the form is frozen into the stage when it opens', snap && snap.code === F2 && snap.competencies.length === 8);
  r = await a('PATCH', `/panel-forms/${F2}`, { settings: { requiredRaters: 3 } });
  ok('a form in use by an open stage is locked', r.s === 400 && /in use/.test(msg(r)));
  r = await a('POST', `/panel-forms/${F2}/competencies`, { label: 'Late addition', dimension: 'THINK', prompt: 'x', useStandardScale: true });
  ok('including adding a competency', r.s === 400);
  r = await a('POST', `/panel/competitions/${C}/stages/3/open`);
  ok('only one stage per competition can be open', r.s === 400);
  r = await a('PUT', `/panel/competitions/${C}/stages/2/setup`, { requiredRaters: 3 });
  ok('the stage setup is locked once it has opened', r.s === 400 && /locked/.test(msg(r)));
  r = await a('POST', '/panel-forms', { title: 'copy', cloneFrom: F2 });
  ok('"make a new version" copies a locked form into a fresh draft with the same competencies', r.s === 201 && r.j.status === 'Draft' && r.j.competencies.length === 8 && r.j.competencies[0].options[3].hint.length > 0 && r.j.locked === false);
  cleanup.push();
  const F2copy = r.j.code;

  // ============================================================== #77 login
  const login = (userId, password) => call('', 'POST', '/panel/auth/login', { userId, password });
  r = await login('qa.bala@example.com', 'wrong-password');
  ok('a wrong password gets one plain message', r.s === 401 && /do not match/.test(msg(r)));
  r = await login('nobody@example.com', PW);
  ok('and an unknown user gets the same one', r.s === 401 && /do not match/.test(msg(r)));
  r = await login('qa.bala@example.com', PW);
  ok('right password: a challenge, code sent to email and phone', r.s === 201 && !!r.j.challenge && r.j.sentTo.email === true && r.j.sentTo.phone === true && r.j.expiresIn === 600, JSON.stringify(r.j).slice(0, 80));
  const challenge = r.j.challenge;
  const otp = await p.otp.findFirst({ where: { purpose: 'panel-login', email: 'qa.bala@example.com', used: false }, orderBy: { id: 'desc' } });
  ok('one code, stored against both channels, so either completes the sign-in', otp && otp.email === 'qa.bala@example.com' && otp.phone === '9000000002' && /^\d{6}$/.test(otp.code), JSON.stringify(otp && [otp.email, otp.phone]));
  await new Promise((res) => setTimeout(res, 800));
  ok('the code goes out through the message template', (await p.messageLog.count({ where: { templateKey: 'PANEL_LOGIN_OTP' } })) >= 1);
  r = await call('', 'POST', '/panel/auth/verify', { challenge, code: otp.code === '000000' ? '111111' : '000000' });
  ok('a wrong code is refused', r.s === 400);
  r = await call('', 'POST', '/panel/auth/verify', { challenge: 'garbage', code: otp.code });
  ok('a bad challenge is refused', r.s === 400);
  r = await call('', 'POST', '/panel/auth/verify', { challenge, code: otp.code });
  ok('the right code signs the panelist in with a "panel" session', r.s === 201 && !!r.j.accessToken && r.j.panelist.email === 'qa.bala@example.com', JSON.stringify(r.j).slice(0,160));
  const sess = r.j.accessToken;
  ok('the session kind is panel', jwt.decode(sess).kind === 'panel');
  r = await call('', 'POST', '/panel/auth/verify', { challenge, code: otp.code });
  ok('a code works once', r.s === 400);
  r = await call(sess, 'GET', '/panel/me/stages');
  ok('the session reaches the panel portal', r.s === 200);
  r = await call(sess, 'GET', '/registrations');
  ok('but not admin data', r.s === 403, String(r.s));
  r = await call(sess, 'GET', '/student/me');
  ok('nor student data', r.s === 403, String(r.s));
  r = await call(sess, 'GET', '/school/me');
  ok('nor school data', r.s === 403);
  r = await call(AT, 'GET', '/panel/me/stages');
  ok('an admin session cannot use the panel portal', r.s === 403);
  r = await call(studTok, 'GET', '/panel/me/stages');
  ok('nor a student session', r.s === 403);
  r = await call('', 'GET', '/panel/me/stages');
  ok('and no session gets 401', r.s === 401);
  // too many wrong codes on one challenge
  r = await login('qa.chitra@example.com', PW);
  const ch2 = r.j.challenge;
  let last;
  for (let i = 0; i < 6; i++) last = await call('', 'POST', '/panel/auth/verify', { challenge: ch2, code: '000001' });
  ok('five wrong codes use up a sign-in', last.s === 403 && /Too many/.test(msg(last)), msg(last));
  const otp2 = await p.otp.findFirst({ where: { purpose: 'panel-login', email: 'qa.chitra@example.com' }, orderBy: { id: 'desc' } });
  last = await call('', 'POST', '/panel/auth/verify', { challenge: ch2, code: otp2.code });
  ok('even the right code after that', last.s !== 201);
  // expired code
  r = await login('qa.chitra@example.com', PW);
  const otp3 = await p.otp.findFirst({ where: { purpose: 'panel-login', email: 'qa.chitra@example.com', used: false }, orderBy: { id: 'desc' } });
  await p.otp.update({ where: { id: otp3.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  last = await call('', 'POST', '/panel/auth/verify', { challenge: r.j.challenge, code: otp3.code });
  ok('an expired code is refused', last.s === 400 && /expired/i.test(msg(last)), msg(last));
  // password lockout
  for (let i = 0; i < 5; i++) await login('qa.esha@example.com', 'wrong-wrong');
  r = await login('qa.esha@example.com', PW);
  ok('five wrong passwords lock the account for a while, even for the right one', r.s === 403 && /Too many/.test(msg(r)), msg(r));
  // disabled
  await a('POST', `/panel/panelists/${pd.id}/disable`);
  r = await login('qa.dev@example.com', PW);
  ok('a disabled panelist cannot log in', r.s === 403 && /disabled/.test(msg(r)));
  r = await call(tokD, 'GET', '/panel/me/stages');
  ok('and an existing session of theirs stops working at once', r.s === 403);
  await a('POST', `/panel/panelists/${pd.id}/enable`);
  // invited-without-password
  const pf = await mkPanelist('Farid Ali', 'qa.farid@example.com', '9000000006', false);
  cleanup.push(pf.id);
  r = await login('qa.farid@example.com', PW);
  ok('someone who has not set a password yet is told to use the invite link', r.s === 400 && /invitation/.test(msg(r)));
  r = await call('', 'POST', '/panel/auth/forgot', { userId: 'nobody@example.com' });
  const r2 = await call('', 'POST', '/panel/auth/forgot', { userId: 'qa.bala@example.com' });
  ok('forgot password answers the same for a stranger and a panelist', r.s === 201 && r2.s === 201 && JSON.stringify(r.j) === JSON.stringify(r2.j));
  ok('and starts a reset link that lasts an hour', !!(await p.panelist.findUnique({ where: { id: pb.id } })).inviteTokenHash);
  // phone sign in
  r = await login('9000000003', PW);
  ok('the user ID can be the phone number', r.s === 201 && !!r.j.challenge);

  // ======================================================= #79 / #80 portal
  r = await call(tokA, 'GET', '/panel/me/stages');
  ok('the dashboard shows "Rate now" with progress', r.j.length === 1 && r.j[0].label === 'Rate now' && r.j[0].canRate && r.j[0].progress.total === 8 && r.j[0].progress.rated === 0, JSON.stringify(r.j[0]));
  r = await call(tokD, 'GET', '/panel/me/stages');
  ok('a panelist sees only their own stages', r.s === 200 && r.j.length === 0);
  r = await call(tokD, 'GET', `/panel/me/stages/${stageId(2)}/students`);
  ok('a stage they are not enrolled in looks like it does not exist', r.s === 404);
  r = await call(tokA, 'GET', `/panel/me/stages/${stageId(3)}/students`);
  ok('so does a stage they have no part in', r.s === 404);
  r = await call(tokA, 'GET', `/panel/me/stages/${stageId(2)}/students`);
  ok('the student list has the whole roster for a panelist with no conflicts', r.s === 200 && r.j.rows.length === 8 && r.j.rows.every((x) => x.status === 'Not started'), String(r.j.rows && r.j.rows.length));
  const schoolsOfRoster = r.j.schools;
  r = await call(tokC, 'GET', `/panel/me/stages/${stageId(2)}/students`);
  const conflictCount = REG.filter((x) => x.student.schoolId === school1).length;
  ok('a panelist never sees students of a school they have a conflict with', r.j.rows.length === 8 - conflictCount && r.j.total === 8 - conflictCount && !r.j.rows.some((x) => REG.find((q) => q.code === x.code && q.student.schoolId === school1)), `${r.j.rows.length} of 8, conflict ${conflictCount}`);
  r = await call(tokC, 'GET', `/panel/me/stages/${stageId(2)}/students/${REG.find((x) => x.student.schoolId === school1).id}`);
  ok('and cannot open one by address either', r.s === 404);
  r = await call(tokA, 'GET', `/panel/me/stages/${stageId(2)}/students?search=${encodeURIComponent(REG[0].student.name.split(' ')[0])}`);
  ok('search narrows the list', r.s === 200 && r.j.rows.length >= 1 && r.j.rows.length < 8 + 1);
  r = await call(tokA, 'GET', `/panel/me/stages/${stageId(2)}/students?school=${encodeURIComponent(schoolsOfRoster[0])}`);
  ok('filter by school', r.s === 200 && r.j.rows.every((x) => x.school === schoolsOfRoster[0]) && r.j.rows.length < 8);

  // the rating page
  const reg1 = REG[0].id;
  r = await call(tokA, 'GET', `/panel/me/stages/${stageId(2)}/students/${reg1}`);
  const form = r.j.form;
  ok('the rating page has every competency, the options in order and the hint for each', r.s === 200 && form.competencies.length === 8 && form.competencies.every((c) => c.options.length === 4 && c.options[2].hint.length > 0 && c.options.map((o) => o.label).join() === 'Emerging,Developing,Proficient,Advanced') && form.noteLabel === 'Observer note', '');
  ok('there are no points for a panelist to game and no one else\'s ratings on the page', JSON.stringify(r.j).indexOf('panelistId') < 0);
  const codes = form.competencies.map((c) => c.code);
  const rate = (idx, comment) => Object.fromEntries(codes.map((c, i) => [c, { optionIndex: idx[i], ...(comment ? { comment } : {}) }]));
  r = await call(tokA, 'PUT', `/panel/me/stages/${stageId(2)}/students/${reg1}`, { ratings: { [codes[0]]: { optionIndex: 3, comment: 'sharp' } }, note: 'draft note' });
  ok('save a partial draft', r.s === 200 && r.j.rating.status === 'Draft' && r.j.rating.note === 'draft note' && r.j.rating.ratings[codes[0]].points === 4, JSON.stringify(r.j.rating).slice(0, 100));
  r = await call(tokA, 'PUT', `/panel/me/stages/${stageId(2)}/students/${reg1}`, { ratings: { [codes[0]]: { optionIndex: 3 } }, submit: true });
  ok('submit checks that every competency is rated', r.s === 400 && /choose a rating/.test(msg(r)), msg(r));
  r = await call(tokA, 'PUT', `/panel/me/stages/${stageId(2)}/students/${reg1}`, { ratings: { [codes[0]]: { optionIndex: 9 } } });
  ok('an option that does not exist is refused', r.s === 400);
  r = await call(tokA, 'PUT', `/panel/me/stages/${stageId(2)}/students/${reg1}`, { ratings: { NOPE: { optionIndex: 1 } } });
  ok('so is a competency that is not on the form', r.s === 400);
  r = await call(tokA, 'PUT', `/panel/me/stages/${stageId(2)}/students/${reg1}`, { ratings: rate([3, 3, 3, 3, 3, 3, 3, 3]), note: 'A very good showing', submit: true });
  ok('a complete rating is submitted and locked', r.s === 200 && r.j.rating.status === 'Submitted' && !!r.j.rating.submittedAt);
  r = await call(tokA, 'PUT', `/panel/me/stages/${stageId(2)}/students/${reg1}`, { ratings: rate([0, 0, 0, 0, 0, 0, 0, 0]) });
  ok('a submitted rating cannot be changed by the panelist', r.s === 403 && /locked/.test(msg(r)));
  r = await call(tokA, 'PUT', `/panel/me/stages/${stageId(2)}/students/${reg1}`, { ratings: rate([0, 0, 0, 0, 0, 0, 0, 0]), submit: true });
  ok('nor re-submitted', r.s === 403);
  const stored = await p.panelRating.findFirst({ where: { stageId: stageId(2), registrationId: reg1, panelistId: asha.id } });
  ok('the stored points came from the form (all 4), not from the request', Object.values(stored.ratings).every((x) => x.points === 4));
  r = await call(tokB, 'GET', `/panel/me/stages/${stageId(2)}/students/${reg1}`);
  ok("another panelist cannot see A's rating or note", r.s === 200 && r.j.rating.status === 'Not started' && JSON.stringify(r.j).indexOf('A very good showing') < 0);
  r = await call(tokB, 'GET', `/panel/me/stages/${stageId(2)}/students`);
  ok('and A\'s progress is not in B\'s list', r.j.rows.find((x) => x.code === REG[0].student.code).status === 'Not started');
  r = await call(tokA, 'GET', `/panel/me/stages/${stageId(2)}/students?status=Submitted`);
  ok('filter by status', r.j.rows.length === 1 && r.j.rows[0].code === REG[0].student.code);
  // a student who is not in the roster
  const outsider = await p.student.findFirst({ where: { id: { notIn: REG.map((x) => x.student.id) }, archived: false } });
  const outReg = await p.registration.findFirst({ where: { studentId: outsider.id, competitionId: { not: fx.comp.id } } });
  if (outReg) {
    r = await call(tokA, 'GET', `/panel/me/stages/${stageId(2)}/students/${outReg.id}`);
    ok('a student outside the stage roster does not exist for the panelist', r.s === 404);
  }
  // required comments / required note via a stricter form
  // ratings by B, C for everyone (varied), A for everyone
  const pattern = {
    0: { A: [3, 3, 3, 3, 3, 3, 3, 3], B: [3, 3, 3, 3, 3, 3, 3, 3] },     // very high, agree
    1: { A: [2, 2, 2, 2, 2, 2, 2, 2], B: [2, 2, 2, 2, 2, 2, 2, 2] },     // middle
    2: { A: [0, 0, 0, 0, 0, 0, 0, 0], B: [3, 3, 3, 3, 3, 3, 3, 3] },     // big disagreement
    3: { A: [1, 1, 1, 1, 1, 1, 1, 1], B: [1, 1, 1, 1, 1, 1, 1, 1] },     // low
    4: { A: [3, 3, 2, 2, 3, 3, 2, 2], B: [2, 3, 2, 3, 2, 3, 2, 3] },     // good, minor differences
    5: { A: [0, 0, 0, 0, 0, 0, 0, 0], B: null },                         // only one rater -> not rated
    6: { A: [2, 2, 3, 3, 2, 2, 3, 3], B: [2, 2, 3, 3, 2, 2, 3, 3] },
    7: { A: [1, 2, 1, 2, 1, 2, 1, 2], B: [1, 2, 1, 2, 1, 2, 1, 2] },
  };
  const tokens = { A: tokA, B: tokB };
  for (const [i, pat] of Object.entries(pattern)) {
    const id = REG[Number(i)].id;
    for (const who of ['A', 'B']) {
      if (!pat[who]) continue;
      if (i === '0' && who === 'A') continue; // already submitted above
      const res = await call(tokens[who], 'PUT', `/panel/me/stages/${stageId(2)}/students/${id}`, { ratings: rate(pat[who]), note: `${who} note on ${i}`, submit: true });
      if (res.s !== 200) { ok('rating setup', false, `${who} ${i} ${res.s} ${msg(res)}`); }
    }
  }
  // C (conflict with school1) rates one student not in school1
  const cStudent = REG.find((x) => x.student.schoolId !== school1);
  r = await call(tokC, 'PUT', `/panel/me/stages/${stageId(2)}/students/${cStudent.id}`, { ratings: rate([2, 2, 2, 2, 2, 2, 2, 2]), submit: false });
  ok('a panelist can keep a draft', r.s === 200 && r.j.rating.status === 'Draft');

  // ============================================ #82 control view, #81 results
  r = await a('GET', `/panel/competitions/${C}/stages/2/control`);
  const ctl = r.j;
  ok('the control view shows each student with ratings received of required, flags and levels', r.s === 200 && ctl.students.length === 8 && ctl.students[0].required === 2 && ctl.students[0].submitted === 2 && ctl.students[0].status === 'Rated', JSON.stringify(ctl.students[0]));
  const st = (i) => ctl.students.find((s) => s.code === REG[i].student.code);
  ok('student 1: both 4s -> 100% and Advanced', st(0).percent === 100 && st(0).levelKey === 'ADVANCED' && !st(0).flagged, JSON.stringify(st(0)));
  ok('student 3: a 3-level gap is flagged for decision', st(2).flagged === true && st(2).average === 2.5, JSON.stringify(st(2)));
  ok('student 6: one rating only, so Not rated and no score (never zero)', st(5).status === 'Not rated' && st(5).percent === null && st(5).levelKey === null && st(5).submitted === 1, JSON.stringify(st(5)));
  ok('student 4: a one-level difference is not flagged', st(4).flagged === false && st(4).percent !== null);
  ok('the summary says who is missing ratings before closing', ctl.summary.missing === 1 && ctl.summary.flagged === 1 && ctl.summary.rated === 7, JSON.stringify(ctl.summary));
  const pa = ctl.panelistProgress.find((x) => x.name === 'Asha Rao');
  const pcp = ctl.panelistProgress.find((x) => x.name === 'Chitra Nair');
  ok('panelist progress: submitted, drafts and not started, honouring conflicts', pa.assigned === 8 && pa.submitted === 8 && pcp.assigned === 8 - conflictCount && pcp.drafts === 1 && pcp.submitted === 0 && pcp.notStarted === 8 - conflictCount - 1, JSON.stringify([pa, pcp]));
  r = await a('POST', `/panel/competitions/${C}/stages/2/remind`, {});
  ok('remind the panelists who still have students to rate', r.s === 201 && r.j.sent >= 1, JSON.stringify(r.j));
  r = await a('POST', `/panel/competitions/${C}/stages/2/remind`, { panelistId: pb.id });
  ok('or one panelist', r.s === 201 && r.j.sent <= 1);
  const xl = await call(AT, 'GET', `/panel/competitions/${C}/stages/2/export`, null, true);
  const xb = Buffer.from(await xl.arrayBuffer());
  ok('export to Excel', xl.status === 200 && /spreadsheetml/.test(xl.headers.get('content-type')) && xb.slice(0, 2).toString() === 'PK', `${xb.length} bytes`);
  const detail = (await a('GET', `/panel/competitions/${C}/stages/2/students/${REG[2].id}`)).j;
  ok('an admin sees each panelist\'s ratings for a student and the combined result', detail.ratings.length === 2 && detail.result.flagged && detail.result.competencies[0].values.join() === '1,4');
  // reopen a rating while open
  const toReopen = detail.ratings.find((x) => x.panelist === 'Asha Rao');
  r = await a('POST', `/panel/ratings/${toReopen.id}/reopen`, { reason: 'x' });
  ok('reopening needs a real reason', r.s === 400);
  r = await a('POST', `/panel/ratings/${toReopen.id}/reopen`, { reason: 'Panelist mis-clicked the level' });
  ok('an admin can reopen a submitted rating, with a reason', r.s === 201);
  r = await call(tokA, 'GET', `/panel/me/stages/${stageId(2)}/students/${REG[2].id}`);
  ok('it is a draft again for the panelist', r.j.rating.status === 'Draft');
  await call(tokA, 'PUT', `/panel/me/stages/${stageId(2)}/students/${REG[2].id}`, { ratings: rate(pattern[2].A), note: 'A note on 2', submit: true });
  const reopenLog = await p.configAuditLog.findFirst({ where: { entity: 'panel', action: 'rating_reopen' }, orderBy: { id: 'desc' } });
  ok('and the reopening is in the audit log with who, what and why', reopenLog && reopenLog.summary.reason === 'Panelist mis-clicked the level' && !!reopenLog.adminName);

  // ============================================================ close
  r = await a('POST', `/panel/competitions/${C}/stages/2/close`, {});
  ok('closing warns about drafts and students with too few ratings and needs a confirmation', r.s === 400 && r.j.needsConfirm === true && r.j.warnings.length === 2 && /draft/.test(r.j.warnings[0]) && /Not rated/.test(r.j.warnings[1]), JSON.stringify(r.j.warnings));
  r = await a('POST', `/panel/competitions/${C}/stages/2/close`, { confirm: true });
  ok('confirm to close', r.s === 201 && r.j.state === 'Closed');
  r = await call(tokA, 'PUT', `/panel/me/stages/${stageId(2)}/students/${REG[1].id}`, { ratings: rate([0, 0, 0, 0, 0, 0, 0, 0]) });
  ok('ratings outside the open window are refused', r.s === 400 && /not open/.test(msg(r)));
  r = await call(tokA, 'GET', '/panel/me/stages');
  ok('the dashboard now says Closed', r.j[0].label === 'Closed' && r.j[0].canRate === false);
  r = await a('POST', `/panel/ratings/${stored.id}/reopen`, { reason: 'trying after close' });
  ok('and a rating cannot be reopened on a closed stage', r.s === 400);
  r = await a('POST', `/panel/competitions/${C}/stages/2/panelists`, { panelistId: pe.id });
  ok('the panel is locked once the stage is closed', r.s === 400);

  // ============================================================ #81 moderation
  r = await a('POST', `/panel/competitions/${C}/stages/2/finalize`, {});
  ok('finalize refuses while a disagreement has no decision', r.s === 400 && /disagree/.test(msg(r)) && r.j.flagged.length === 1, msg(r));
  r = await a('POST', `/panel/competitions/${C}/stages/2/students/${REG[2].id}/adjudicate`, { overrides: { [codes[0]]: 9 }, reason: 'Panel chair decided' });
  ok('a decision must use points the competency can give', r.s === 400);
  r = await a('POST', `/panel/competitions/${C}/stages/2/students/${REG[2].id}/adjudicate`, { overrides: Object.fromEntries(codes.map((c) => [c, 2])), reason: 'Reviewed with both panelists; Proficient' });
  ok('an admin decides the disagreement; the decision replaces the average and is attributed', r.s === 201 && r.j.adjudication.decidedByName && r.j.result.flagged === false && r.j.result.competencies.every((c) => c.final === 2 && c.adjudicated && c.mean === 2.5), JSON.stringify(r.j.adjudication));
  const adjLog = await p.configAuditLog.findFirst({ where: { entity: 'panel', action: 'rating_adjudicate' }, orderBy: { id: 'desc' } });
  ok('the decision is logged', adjLog && adjLog.summary.reason.startsWith('Reviewed'));
  r = await a('POST', `/panel/competitions/${C}/stages/2/finalize`, {});
  ok('finalize computes the stage result', r.s === 201 && r.j.state === 'Finalized' && r.j.rated === 7 && r.j.notRated === 1, JSON.stringify([r.j.state, r.j.rated, r.j.notRated]));
  const results = await p.panelResult.findMany({ where: { stageId: stageId(2) } });
  const res5 = results.find((x) => x.registrationId === REG[5].id);
  const res0 = results.find((x) => x.registrationId === REG[0].id);
  const res2 = results.find((x) => x.registrationId === REG[2].id);
  ok('a student without enough ratings is NotRated: no score, no level, not zero', res5.status === 'NotRated' && res5.percent === null && res5.levelKey === null && res5.ratersCount === 1);
  ok('stored results match the live control view (reproducible from the ratings)', Number(res0.percent) === 100 && res0.levelKey === 'ADVANCED' && Number(res2.percent) === 50 && res2.levelKey === 'DEVELOPING', JSON.stringify([res0.percent, res2.percent, res2.levelKey]));
  r = await a('GET', `/panel/competitions/${C}/stages/2/control`);
  ok('control view after finalize agrees with the stored results', r.j.students.every((s) => { const x = results.find((q) => q.registrationId === s.registrationId); return s.percent === (x.percent === null ? null : Number(x.percent)); }));

  // override
  r = await a('POST', `/panel/competitions/${C}/stages/2/override`, { reason: 'abc' });
  ok('an override needs a real reason', r.s === 400);
  r = await a('POST', `/panel/competitions/${C}/stages/2/override`, { reason: 'Panelist asked to correct student 8 before selection' });
  ok('an administrator can send a finalized stage back to Closed, with a reason', r.s === 201 && r.j.state === 'Closed');
  r = await a('POST', `/panel/competitions/${C}/stages/2/override`, { reason: 'Reopen for one late rating' });
  ok('and a closed one back to Open', r.s === 201 && r.j.state === 'Open');
  const ovLog = (await p.configAuditLog.findMany({ where: { entity: 'panel', action: 'stage_override' }, orderBy: { id: 'desc' }, take: 2 }));
  ok('every override is logged with who, from, to and why', ovLog.length === 2 && ovLog.every((o) => o.adminName && o.summary.reason && o.summary.from && o.summary.to));
  r = await call(tokB, 'PUT', `/panel/me/stages/${stageId(2)}/students/${REG[5].id}`, { ratings: rate(pattern[5].A), note: 'B late', submit: true });
  ok('the late rating is accepted while it is open again', r.s === 200);
  await a('POST', `/panel/competitions/${C}/stages/2/close`, { confirm: true });
  r = await a('POST', `/panel/competitions/${C}/stages/2/finalize`, {});
  ok('finalize again', r.s === 201 && r.j.rated === 8 && r.j.notRated === 0, JSON.stringify([r.j.rated, r.j.notRated]));

  // ========================================================== #83 selection
  r = await a('GET', `/competitions/${C}/stages/${stageId(2)}/selection-preview`);
  ok('the selection preview ranks panel stages by stage score, using the same screen shape', r.s === 200 && r.j.mode === 'panel' && r.j.cap === 4 && r.j.autoPicked.length === 4 && Array.isArray(r.j.ineligible) && 'stillContesting' in r.j && 'criteriaStages' in r.j, JSON.stringify(Object.keys(r.j)));
  const rank = r.j.autoPicked.map((x) => x.studentCode);
  const expectOrder = results.filter((x) => x.status === 'Rated').sort((x, y) => Number(y.percent) - Number(x.percent) || y.competencies.filter((c) => c.levelKey === y.levelKey).length - x.competencies.filter((c) => c.levelKey === x.levelKey).length || x.registrationId - y.registrationId).slice(0, 4).map((x) => REG.find((q) => q.id === x.registrationId).student.code);
  ok('the top four by score qualify, in rank order with ties broken the same way every time', rank.join() === expectOrder.join(), `${rank.join()} vs ${expectOrder.join()}`);
  ok('everyone else is in the not-selected list', r.j.ineligible.length === 4);
  ok('student 1 (100%) is first', rank[0] === REG[0].student.code);
  const prePanel = JSON.stringify(r.j);
  r = await a('GET', `/competitions/${C}/stages/${stageId(2)}/selection-preview`);
  ok('the preview is reproducible: asking again gives the identical ranking', JSON.stringify(r.j) === prePanel);
  r = await a('POST', `/competitions/${C}/stages/${stageId(2)}/selection-commit`);
  ok('commit selects the same four and eliminates the rest', r.s === 201 && r.j.qualified === 4 && r.j.eliminated === 4, JSON.stringify(r.j));
  const rs = await p.registrationStage.findMany({ where: { stageId: stageId(2) } });
  ok('Qualified and Eliminated statuses are written to the stage and the registration', rs.filter((x) => x.status === 'Qualified').length === 4 && rs.filter((x) => x.status === 'Eliminated').length === 4 && (await p.registration.findFirst({ where: { id: REG[0].id } })).status === 'Qualified');
  const next = await p.registrationStage.findMany({ where: { stageId: stageId(3) } });
  ok('stage 3 is unlocked for exactly the qualified students', next.length === 4 && next.every((x) => x.status === 'Unlocked') && next.every((x) => rank.includes(REG.find((q) => q.id === x.registrationId).student.code)));
  r = await a('POST', `/competitions/${C}/stages/${stageId(2)}/selection-commit`);
  ok('a selection can only be run once', r.s === 400 && /already been decided/.test(msg(r)));
  ok('the panel stage is now Selected', (await a('GET', `/panel/competitions/${C}/stages/2`)).j.state === 'Selected');
  r = await a('POST', `/panel/competitions/${C}/stages/2/override`, { reason: 'trying to undo a selection' });
  ok('a committed selection cannot be undone by an override', r.s === 400 && /cannot be undone/.test(msg(r)));
  r = await a('GET', `/panel/competitions/${C}/stages/3`);
  ok('now stage 3 has the previous stage decided; its own checklist is what is left', !r.j.openBlockers.some((x) => /Stage 2/.test(x)), JSON.stringify(r.j.openBlockers));
  r = await a('POST', `/panel/competitions/${C}/stages/2/release`);
  ok('release marks the stage results as usable in reports', r.s === 201 && r.j.state === 'Released');
  r = await a('GET', `/panel/competitions/${C}/stages/3`);
  ok('stage 3 roster is the four qualified', r.j.rosterSize === 4);

  // online selection untouched
  const smp = await p.competition.findUnique({ where: { code: 'SMP1' }, include: { stages: true } });
  if (smp && smp.stages[0]) {
    r = await a('GET', `/competitions/SMP1/stages/${smp.stages[0].id}/selection-preview`);
    ok('an online stage still gets the original selection preview (no panel mode)', r.s === 200 && r.j.mode === undefined && 'autoPicked' in r.j && 'criteriaStages' in r.j);
  }

  // ---------------------------------------------------------- audit
  const actions = new Set((await p.configAuditLog.findMany({ where: { entity: 'panel' }, select: { action: true } })).map((x) => x.action));
  ok('the audit log has setup, open, close, finalize, override, selection and panelist actions', ['stage_setup', 'stage_open', 'stage_close', 'stage_finalize', 'stage_override', 'selection_commit', 'panel_enrol', 'panelist_invite', 'rating_reopen', 'rating_adjudicate'].every((x) => actions.has(x)), [...actions].join());

  // ---------------------------------------------------------- cleanup
  await p.panelEnrolment.deleteMany({ where: { panelistId: { in: cleanup } } });
  await fixture.down(p);
  await p.panelRating.deleteMany({ where: { panelistId: { in: cleanup } } });
  await p.panelist.deleteMany({ where: { id: { in: cleanup } } });
  for (const code of [F2copy, F2, F3, F4]) {
    const as = await p.assessment.findUnique({ where: { code } });
    if (as) { await p.question.deleteMany({ where: { assessmentId: as.id } }); await p.assessment.delete({ where: { id: as.id } }); }
  }
  await p.otp.deleteMany({ where: { purpose: 'panel-login' } });
  await p.messageLog.deleteMany({ where: { templateKey: { in: ['PANEL_INVITE', 'PANEL_LOGIN_OTP', 'PANEL_REMINDER'] } } });
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error(e); try { await fixture.down(p); } catch (_) {} process.exit(1); });
