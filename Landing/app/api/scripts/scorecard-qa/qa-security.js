// #88 security review of the panel login and the permissions, as tests: no account enumeration,
// OTP limits and binding, session kinds, forged / expired tokens, disabled accounts cut off at once,
// data isolation between panelists, secrets never returned, invite/reset links, and HTML escaping
// of what panelists write. Complements qa-75 (login lockout, conflicts, roster) and qa-87 (module permissions).
const { ROOT } = require('./guard.js');
const API = ROOT;
const argon = require(API + 'node_modules/@node-rs/argon2');
const jwt = require(API + 'node_modules/jsonwebtoken');
const { PrismaClient } = require(API + 'node_modules/@prisma/client');
const R = require('./rehearsal.js');
const { hashToken } = require(API + 'dist/src/common/report-access');
const p = new PrismaClient();
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const msg = (r) => (Array.isArray(r.j.message) ? r.j.message.join(' ') : String(r.j.message || ''));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

(async () => {
  const AT = (await R.call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const a = (m, path, b) => R.call(AT, m, path, b);
  let ctx;
  try { ctx = await R.setup(p, AT, { tag: 'SEC', students: 4 }); } catch (e) { console.error('SETUP FAILED', e); process.exit(1); }
  const { C, R: regs, pa, pb, tokA, tokB, created } = ctx;
  const hash = await argon.hash('Panel@12345');
  const extraPanelists = [];
  const mkPanelist = async (name, email, withPassword = true) => {
    const x = (await a('POST', '/panel/panelists', { name, email, phone: '9200' + Math.floor(100000 + Math.random() * 899999) })).j;
    if (withPassword) await p.panelist.update({ where: { id: x.id }, data: { passwordHash: hash, status: 'Active', inviteTokenHash: null, inviteExpiresAt: null } });
    extraPanelists.push(x.id);
    return x;
  };
  const latestOtp = async (email) => (await p.otp.findFirst({ where: { email, purpose: 'panel-login' }, orderBy: { id: 'desc' } }));
  const login = (email, password = 'Panel@12345') => R.call('', 'POST', '/panel/auth/login', { userId: email, password });
  try {
    const stage4 = ctx.stageId(4);
    const A = regs[0];

    // ================================================================ sign-in
    const unknown = await login('nobody.here@example.com', 'whatever123');
    const wrong = await login(pa.email, 'Wrong@12345');
    ok('an unknown account and a wrong password get the same answer', unknown.s === 401 && wrong.s === 401 && msg(unknown) === msg(wrong), `${unknown.s}/${wrong.s} "${msg(wrong)}"`);
    const forgotKnown = await R.call('', 'POST', '/panel/auth/forgot', { userId: pa.email });
    const forgotUnknown = await R.call('', 'POST', '/panel/auth/forgot', { userId: 'nobody.here@example.com' });
    ok('"forgot password" answers the same for known and unknown accounts', forgotKnown.s === forgotUnknown.s && JSON.stringify(forgotKnown.j) === JSON.stringify(forgotUnknown.j), JSON.stringify(forgotKnown.j));
    ok('passwords are stored as argon2 hashes, never in the clear', /^\$argon2/.test((await p.panelist.findUnique({ where: { id: pa.id } })).passwordHash));

    // a normal first step gives a challenge, which is not a session
    let r = await login(pa.email);
    ok('a correct password gives a challenge, not a session', r.s === 201 && !!r.j.challenge && !r.j.accessToken, Object.keys(r.j).join());
    const challenge1 = r.j.challenge;
    const otp1 = await latestOtp(pa.email);
    r = await R.call(challenge1, 'GET', '/panel/me/stages');
    ok('the challenge cannot be used as a session', r.s === 401 || r.s === 403, String(r.s));
    const jwtClaims = jwt.decode(challenge1);
    ok('the challenge says what it is for and is short-lived', jwtClaims.purpose === 'panel-challenge' && jwtClaims.exp - jwtClaims.iat <= 600, JSON.stringify(jwtClaims));

    // the code belongs to the challenge it was sent for
    const rB = await login(pb.email);
    const otpB = await latestOtp(pb.email);
    r = await R.call('', 'POST', '/panel/auth/verify', { challenge: challenge1, code: otpB.code });
    ok('a code sent to someone else does not complete this sign-in', r.s === 400, `${r.s} ${msg(r)}`);

    // limited tries
    const challenge2 = (await login(pa.email)).j.challenge;
    const otp2 = await latestOtp(pa.email);
    const wrongCode = otp2.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await R.call('', 'POST', '/panel/auth/verify', { challenge: challenge2, code: wrongCode });
    r = await R.call('', 'POST', '/panel/auth/verify', { challenge: challenge2, code: otp2.code });
    ok('after five wrong codes even the right one is refused', r.s === 403, `${r.s} ${msg(r)}`);

    // single use and expiry
    const challenge3 = (await login(pa.email)).j.challenge;
    const otp3 = await latestOtp(pa.email);
    r = await R.call('', 'POST', '/panel/auth/verify', { challenge: challenge3, code: otp3.code });
    ok('the right code signs in', r.s === 201 && !!r.j.accessToken);
    const session = r.j.accessToken;
    r = await R.call('', 'POST', '/panel/auth/verify', { challenge: challenge3, code: otp3.code });
    ok('a code works only once', r.s === 400, `${r.s} ${msg(r)}`);
    const challenge4 = (await login(pa.email)).j.challenge;
    const otp4 = await latestOtp(pa.email);
    await p.otp.update({ where: { id: otp4.id }, data: { expiresAt: new Date(Date.now() - 60000) } });
    r = await R.call('', 'POST', '/panel/auth/verify', { challenge: challenge4, code: otp4.code });
    ok('an expired code is refused', r.s === 400 && /expired|invalid/i.test(msg(r)), `${r.s} ${msg(r)}`);
    ok('the session lasts hours, not days, and is its own kind', (() => { const c = jwt.decode(session); return c.kind === 'panel' && c.exp - c.iat <= 12 * 3600; })());
    ok('the sign-in response carries no secrets', !/password|hash|otp/i.test(JSON.stringify((await R.call('', 'POST', '/panel/auth/verify', { challenge: 'x', code: 'y' })).j)) && !/passwordHash/.test(JSON.stringify(r.j)));

    // ================================================================ tokens
    const claims = { sub: pa.id, kind: 'panel' };
    const forged = jwt.sign(claims, 'not-the-secret', { expiresIn: '1h' });
    const expired = jwt.sign(claims, process.env.JWT_ACCESS_SECRET, { expiresIn: -10 });
    const noneAlg = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
    ok('a token signed with another secret is refused', (await R.call(forged, 'GET', '/panel/me/stages')).s === 401);
    ok('an expired token is refused', (await R.call(expired, 'GET', '/panel/me/stages')).s === 401);
    ok('an unsigned ("alg none") token is refused', (await R.call(noneAlg, 'GET', '/panel/me/stages')).s === 401);
    ok('no token is refused', (await R.call('', 'GET', '/panel/me/stages')).s === 401);
    ok('a token for a panelist that does not exist is refused', [401, 403].includes((await R.call(R.sign(99999999, 'panel'), 'GET', '/panel/me/stages')).s));

    // every other kind of session is kept out of the portal, and a panel session out of theirs
    const school = await p.school.findFirst({ select: { id: true } });
    const stud = regs[0].student;
    ok('a school session cannot use the panel portal', [401, 403].includes((await R.call(R.sign(school.id, 'school'), 'GET', '/panel/me/stages')).s));
    ok('a student session cannot', [401, 403].includes((await R.call(R.sign(stud.id, 'student'), 'GET', '/panel/me/stages')).s));
    const denied = async (path, m = 'GET') => [401, 403].includes((await R.call(tokA, m, path)).s);
    ok('a panel session cannot reach the admin setup, panel admin, reports or results', (await denied('/scorecard/frameworks')) && (await denied('/panel/panelists')) && (await denied('/scorecard/reports?comp=' + C + '&stage=0')) && (await denied('/competitions')) && (await denied(`/panel/competitions/${C}/stages/4/control`)));
    ok('nor the student or school endpoints', (await denied('/student/assessments')) && (await denied('/school/students')) && (await denied('/student/reports')) && (await denied('/school/reports')));
    ok('nor can it read or change another panelist\'s ratings through the admin routes', (await denied(`/panel/competitions/${C}/stages/4/students/${A.id}`)) && (await denied('/panel/ratings/1/reopen', 'POST')));

    // ================================================================ a disabled account is cut off at once
    const pd = await mkPanelist('Dee Sec', 'qa.sec.dee@example.com');
    const tokD = R.sign(pd.id, 'panel');
    ok('a signed-in panelist can use the portal', (await R.call(tokD, 'GET', '/panel/me/stages')).s === 200);
    await a('POST', `/panel/panelists/${pd.id}/disable`);
    r = await R.call(tokD, 'GET', '/panel/me/stages');
    ok('once disabled, the session already in use stops working', r.s === 403 || r.s === 401, String(r.s));
    r = await login(pd.email);
    ok('and a new sign-in is refused', r.s === 403, `${r.s} ${msg(r)}`);

    // ================================================================ isolation between panelists
    const pe = await mkPanelist('Eve Sec', 'qa.sec.eve@example.com'); // never enrolled in any stage
    const tokE = R.sign(pe.id, 'panel');
    ok('a panelist not enrolled in a stage sees no stages', ((await R.call(tokE, 'GET', '/panel/me/stages')).j.stages || (await R.call(tokE, 'GET', '/panel/me/stages')).j || []).length === 0);
    r = await R.call(tokE, 'GET', `/panel/me/stages/${stage4}/students`);
    ok('cannot list the students of a stage they are not on', r.s === 403 || r.s === 404, String(r.s));
    r = await R.call(tokE, 'GET', `/panel/me/stages/${stage4}/students/${A.id}`);
    ok('cannot open a student of that stage', r.s === 403 || r.s === 404, String(r.s));
    r = await R.call(tokE, 'PUT', `/panel/me/stages/${stage4}/students/${A.id}`, { ratings: {}, submit: false });
    ok('cannot write a rating there', r.s === 403 || r.s === 404, String(r.s));
    const nb = `/panel/me/stages/${stage4}/students/${A.id}/narrative`;
    ok('cannot read, edit or approve an observer note there', [403, 404].includes((await R.call(tokE, 'GET', nb)).s) && [403, 404].includes((await R.call(tokE, 'PUT', nb, { text: 'x' })).s) && [403, 404].includes((await R.call(tokE, 'POST', nb + '/approve')).s));
    r = await R.call(tokE, 'GET', `/panel/me/stages/${stage4}/notes`);
    ok('nor list the notes of that stage', [403, 404].includes(r.s), String(r.s));

    // the stage is reopened for rating (an administrator override, as in real life)
    await a('POST', '/panel/competitions/' + C + '/stages/4/override', { to: 'Closed', reason: 'security test' });
    await a('POST', '/panel/competitions/' + C + '/stages/4/override', { to: 'Open', reason: 'security test' });
    // a panelist sees their own ratings only: nothing of the other panelists' ratings, names or ids
    const pageA = await R.call(tokA, 'GET', `/panel/me/stages/${stage4}/students/${A.id}`);
    const raw = JSON.stringify(pageA.j);
    ok('a panelist\'s rating page holds their own rating and nothing of the other panelists\'', pageA.s === 200 && !raw.includes(pb.name) && !raw.includes(pb.email) && !new RegExp(`"panelistId":${pb.id}\\b`).test(raw));
    const lst = JSON.stringify((await R.call(tokA, 'GET', `/panel/me/stages/${stage4}/students`)).j);
    ok('the student list shows their own status only, not others\' scores or levels', !/"percent"|"average"|"level"/.test(lst) && !lst.includes(pb.name));
    const dash = JSON.stringify((await R.call(tokA, 'GET', '/panel/me/stages')).j);
    ok('the stage list holds no results or other panelists', !/"percent"|"average"/.test(dash) && !dash.includes(pb.name));

    await a('POST', '/panel/competitions/' + C + '/stages/4/close', { confirm: true });
    await a('POST', '/panel/competitions/' + C + '/stages/4/finalize', { force: true });
    const evil = '<script>alert(1)</script> "quoted" & <img src=x onerror=alert(2)>';
    await R.call(tokA, 'PUT', nb, { text: evil });
    r = await R.call(tokA, 'POST', nb + '/approve');
    ok('an observer note with markup is accepted as plain text', r.s === 201 && r.j.approvedText === evil, `${r.s} ${msg(r)}`);
    await ctx.finishStage4(); // decided and released, so it counts in the report

    // ================================================================ secrets
    const adminViews = JSON.stringify([(await a('GET', '/panel/panelists')).j, (await a('GET', `/panel/competitions/${C}/stages/4/control`)).j, (await a('GET', `/panel/competitions/${C}/stages/4`)).j]);
    ok('no admin view returns a password hash, a link token or a sign-in code', !/passwordHash|inviteTokenHash|argon2|"code":"\d{6}"/.test(adminViews));

    // ================================================================ invitation and reset links
    const pf = await mkPanelist('Fay Sec', 'qa.sec.fay@example.com', false);
    ok('an invited panelist cannot sign in before setting a password', (await login(pf.email)).s === 400);
    const known = 'sec-known-token-' + Date.now();
    await p.panelist.update({ where: { id: pf.id }, data: { inviteTokenHash: hashToken(known), inviteExpiresAt: new Date(Date.now() + 3600 * 1000) } });
    ok('the link token is stored hashed', (await p.panelist.findUnique({ where: { id: pf.id } })).inviteTokenHash !== known);
    r = await R.call('', 'POST', '/panel/auth/set-password', { token: known, password: 'short' });
    ok('a short password is refused', r.s === 400, msg(r));
    r = await R.call('', 'POST', '/panel/auth/set-password', { token: 'wrong-' + known, password: 'Strong@12345' });
    ok('a wrong link is refused', r.s === 400);
    r = await R.call('', 'POST', '/panel/auth/set-password', { token: known, password: 'Strong@12345' });
    ok('the right link sets the password', r.s === 201);
    r = await R.call('', 'POST', '/panel/auth/set-password', { token: known, password: 'Another@12345' });
    ok('the link works only once', r.s === 400, msg(r));
    await p.panelist.update({ where: { id: pf.id }, data: { inviteTokenHash: hashToken(known + 'x'), inviteExpiresAt: new Date(Date.now() - 1000) } });
    r = await R.call('', 'POST', '/panel/auth/set-password', { token: known + 'x', password: 'Strong@12345' });
    ok('an expired link is refused', r.s === 400, msg(r));

    // ================================================================ what panelists write is escaped
    const pv = await a('GET', `/scorecard/reports/preview?comp=${C}&stage=0&student=${A.student.code}`);
    ok('the report shows it escaped, never as markup', pv.s === 200 && !pv.j.html.includes('<script>alert(1)') && !pv.j.html.includes('<img src=x') && pv.j.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), msg(pv));
    r = await a('GET', `/scorecard/reports?comp=${C}&stage=0&search=${encodeURIComponent("' OR 1=1 --")}`);
    ok('a search with SQL in it is just text', r.s === 200 && (r.j.rows || []).length === 0, String(r.s));
  } finally {
    await p.panelNarrative.deleteMany({ where: { stage: { competition: { code: C } } } }).catch(() => {});
    await p.otp.deleteMany({ where: { purpose: 'panel-login', email: { startsWith: 'qa.' } } });
    await p.panelEnrolment.deleteMany({ where: { panelistId: { in: extraPanelists } } });
    await p.panelist.deleteMany({ where: { id: { in: extraPanelists } } });
    await R.teardown(ctx);
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
