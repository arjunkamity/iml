// An end-to-end rehearsal of all four stages, driven only through the admin / panel / student
// APIs: online Stage 1 (exam answers), panel-rated Stages 2 and 4, Stage 3 with a panel and a
// scored written assessment; then the season, wording and templates that turn it into a
// scorecard. Reused by the QA scripts for #84, #85, #86 and #88.
const { ROOT } = require('./guard.js');
const API = ROOT;
const crypto = require('crypto');
const jwt = require(API + 'node_modules/jsonwebtoken');
const argon = require(API + 'node_modules/@node-rs/argon2');
const fixture = require('./fixture-panel.js');

const B = process.env.QA_API || 'http://localhost:3000/api/v1';
const call = async (tok, m, path, body, raw) => {
  const r = await fetch(B + path, { method: m, headers: { 'Content-Type': 'application/json', Connection: 'close', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (raw) return r;
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const sign = (sub, kind) => jwt.sign({ sub, kind }, process.env.JWT_ACCESS_SECRET, { expiresIn: '3h' });

const LEVELS = { E: 0, D: 1, P: 2, A: 3 };
// competency label, dimension, level of the client's sample student (Aarav Mehta)
const STAGE2 = [['Critical Thinking', 'THINK', 'A'], ['Emotional Awareness', 'FEEL', 'P'], ['Perspective Taking', 'CONNECT', 'P'], ['Ethical Judgment', 'LEAD', 'A'], ['Communication', 'CONNECT', 'P'], ['Decision Making', 'LEAD', 'A'], ['Responsibility', 'LEAD', 'A'], ['Leadership Orientation', 'LEAD', 'P']];
const STAGE3 = [['Self-Awareness', 'FEEL', 'P'], ['Emotional Regulation', 'FEEL', 'D'], ['Empathy', 'CONNECT', 'P'], ['Listening', 'CONNECT', 'P'], ['Collaboration', 'CONNECT', 'A'], ['Problem Solving', 'THINK', 'A'], ['Ethical Decision-Making', 'LEAD', 'A'], ['Initiative', 'LEAD', 'A'], ['Adaptability', 'LEAD', 'P'], ['Accountability', 'LEAD', 'A'], ['Communication', 'CONNECT', 'P'], ['Leadership', 'LEAD', 'A']];
const STAGE4 = [['Understanding Complexity', 'THINK', 'A'], ['Critical Reasoning', 'THINK', 'A'], ['Emotional Maturity', 'FEEL', 'P'], ['Empathy', 'CONNECT', 'P'], ['Ethical Judgment', 'LEAD', 'A'], ['Communication', 'CONNECT', 'A'], ['Decision-Making', 'LEAD', 'A'], ['Confidence Under Pressure', 'FEEL', 'P'], ['Responsibility', 'LEAD', 'A'], ['Leadership Impact', 'LEAD', 'A']];
// the scored written assessment of Stage 3: percent per capacity
const WRITTEN = [['Situational Judgment', 'SIT_JUDGMENT', 80, 'THINK'], ['Ethical Reasoning', 'ETHICAL_REASON', 100, 'LEAD'], ['Applied Decision-Making', 'APPLIED_DECISION', 80, 'LEAD'], ['Reflection & Self-Awareness', 'SELF_REFLECTION', 60, 'FEEL']];

async function setup(p, AT, opts = {}) {
  const a = (m, path, b) => call(AT, m, path, b);
  const tag = opts.tag || 'RH';
  const fx = await fixture.up(p, opts.students || 8);
  const C = fixture.CODE;
  const R = fx.regs;
  const stageId = (n) => fx.stages.find((s) => s.position === n).id;
  const created = { forms: [], panelists: [], assessment: null, framework: null, library: null, season: null, templates: [] };

  // ---- panelists
  const hash = await argon.hash('Panel@12345');
  const mkP = async (name, email) => {
    const x = (await a('POST', '/panel/panelists', { name, email, phone: '9000' + Math.floor(100000 + Math.random() * 899999) })).j;
    await p.panelist.update({ where: { id: x.id }, data: { passwordHash: hash, status: 'Active', inviteTokenHash: null, inviteExpiresAt: null } });
    created.panelists.push(x.id);
    return x;
  };
  const pa = await mkP('Asha Rao', `qa.${tag}.asha@example.com`);
  const pb = await mkP('Bala Iyer', `qa.${tag}.bala@example.com`);
  const tokA = sign(pa.id, 'panel'), tokB = sign(pb.id, 'panel');

  // ---- panel forms from the client's sample
  const mkForm = async (title, rows) => {
    const f = (await a('POST', '/panel-forms', { title: `QA ${tag} ${title}`, settings: { requiredRaters: 2, noteRequired: false } })).j;
    for (const [label, dim] of rows) await a('POST', `/panel-forms/${f.code}/competencies`, { label, dimension: dim, prompt: `${label} observed`, useStandardScale: true });
    const pub = await a('POST', `/panel-forms/${f.code}/publish`);
    if (pub.s !== 201) throw new Error('form publish: ' + JSON.stringify(pub.j));
    created.forms.push(f.code);
    return f.code;
  };
  const forms = { 2: await mkForm('Live Showdown', STAGE2), 3: await mkForm('Leadership Bootcamp', STAGE3), 4: await mkForm('Grand Finale', STAGE4) };

  // ---- Stage 1: online answers of the sample student (and a weaker second student)
  const mkAttempt = async (reg, code, counts) => {
    const at = new Date(Date.now() - 3600 * 1000);
    const attempt = await p.attempt.create({ data: { code, registrationId: reg.id, stageId: stageId(1), startedAt: at, finishedAt: new Date(at.getTime() + 14 * 60000), score: 0, total: 80 } });
    const rows = [];
    for (const [cat, correct] of Object.entries(counts)) for (let i = 0; i < 20; i++) rows.push({ attemptId: attempt.id, category: cat, isCorrect: i < correct, answer: [i < correct ? 0 : 1], takenSecs: 20, answeredAt: at });
    await p.attemptAnswer.createMany({ data: rows });
    await p.attempt.update({ where: { id: attempt.id }, data: { score: Object.values(counts).reduce((s, x) => s + x, 0) } });
  };
  await mkAttempt(R[0], `T${tag}A1`, { LR: 17, DI: 14, PR: 16, GK: 13 }); // 85, 70, 80, 65 %
  await mkAttempt(R[1], `T${tag}B1`, { LR: 12, DI: 12, PR: 12, GK: 12 }); // 60 %

  // ---- the written assessment of Stage 3 (a self-taken, scored assessment)
  const asm = (await a('POST', '/assessments', { title: `QA ${tag} Written assessment`, grades: '9,10,11,12' })).j;
  created.assessment = asm.code;
  const pd = await a('PATCH', `/assessments/${asm.code}`, { dimensions: WRITTEN.map(([label, key]) => ({ key, label, intro: label, practice: 'Practise', bands: [{ label: 'All', min: 0, max: 10, summary: 'x' }] })) });
  if (pd.s !== 200) throw new Error('assessment dims: ' + JSON.stringify(pd.j));
  for (const [, key] of WRITTEN) { const qr = await a('POST', `/assessments/${asm.code}/questions`, { capacity: key, prompt: `Scenario for ${key}`, options: Array.from({ length: 6 }, (_, i) => `Choice ${i}`), points: Array.from({ length: 6 }, (_, i) => i * 2) }); if (qr.s !== 201) throw new Error('assessment question: ' + JSON.stringify(qr.j)); }
  const pubA = await a('POST', `/assessments/${asm.code}/publish`);
  if (pubA.s !== 201) throw new Error('assessment publish: ' + JSON.stringify(pubA.j));

  // ---- framework with roll-up rules (a published copy), wording, template, season
  const fwSrc = (await a('GET', '/scorecard/frameworks')).j.find((f) => /client sample/.test(f.name));
  const fw = (await a('POST', '/scorecard/frameworks', { name: `QA ${tag} framework`, cloneFrom: fwSrc.code })).j;
  const cfg = fw.config;
  cfg.rollup = {
    stageWeights: {},
    dimensionWeights: {},
    minItemsPerDimension: 1,
    minDimensionsForOverall: 1,
    competencyMap: Object.fromEntries(WRITTEN.map(([, key, , dim]) => [key, dim])),
    topStrengths: 5,
    topGrowth: 3,
    styles: [
      { key: 'THOUGHTFUL_INITIATOR', name: 'The Thoughtful Initiator', conditions: [{ dimension: 'THINK', atLeast: 'ADVANCED' }, { dimension: 'LEAD', atLeast: 'ADVANCED' }] },
      { key: 'DEVELOPING_LEADER', name: 'The Developing Leader', conditions: [{ dimension: 'LEAD', atMost: 'DEVELOPING' }] },
    ],
    fallbackStyle: 'DEVELOPING_LEADER',
    profileLines: [{ position: 1, conditions: [{ dimension: 'THINK', atLeast: 'ADVANCED' }] }],
    fallbackProfileLine: 1,
    stageSources: { 3: { type: 'assessment', code: asm.code } },
  };
  const patched = await a('PATCH', `/scorecard/frameworks/${fw.code}`, { config: cfg });
  const pubF = await a('POST', `/scorecard/frameworks/${fw.code}/publish`);
  if (pubF.s !== 201) throw new Error('framework publish: ' + JSON.stringify(pubF.j));
  created.framework = fw.code;

  const lib = (await a('POST', '/scorecard/content/libraries', { name: `QA ${tag} wording`, cloneFrom: 'CL1' })).j;
  created.library = lib.code;
  const put = (b) => a('PUT', `/scorecard/content/libraries/${lib.code}/texts`, b);
  // wording the sample did not supply, so a complete student has no gaps
  const fill = [
    { kind: 'strength', key: '*', levelKey: 'ADVANCED', title: 'Strength', text: 'is strong in this area.' },
    { kind: 'strength', key: '*', levelKey: 'PROFICIENT', title: 'Strength', text: 'is capable in this area.' },
    { kind: 'growth', key: '*', levelKey: 'DEVELOPING', title: 'Growth', text: 'build this with regular practice.' },
    { kind: 'growth', key: '*', levelKey: 'PROFICIENT', title: 'Growth', text: 'build consistency here.' },
    { kind: 'growth', key: '*', levelKey: 'ADVANCED', title: 'Growth', text: 'keep stretching here.' },
    { kind: 'dimension_note', key: 'THINK', levelKey: 'ADVANCED', text: 'You approach challenges analytically.' },
    { kind: 'observer_opening', text: '{FirstName} responded thoughtfully in this stage.' },
    { kind: 'observer_strength', key: '*', levelKey: 'ADVANCED', text: '{FirstName} showed real strength in {Competency}.' },
    { kind: 'observer_growth', key: '*', levelKey: 'DEVELOPING', text: '{Competency} is the next area to develop.' },
    { kind: 'observer_growth', key: '*', levelKey: 'PROFICIENT', text: '{Competency} can grow further.' },
    { kind: 'observer_closing', text: 'Further development will follow from continued practice.' },
    { kind: 'leadership_style', key: 'THOUGHTFUL_INITIATOR', title: 'The Thoughtful Initiator', text: 'You tend to understand a challenge and move towards action.' },
    { kind: 'snapshot_reflection', key: '*', text: 'What would help you grow in {Competency}?' },
    { kind: 'consent', text: 'I, {Name}, agree to share my report.' },
  ];
  for (const f of fill) await put(f);
  await a('POST', `/scorecard/content/libraries/${lib.code}/texts/approve-all`, { note: 'qa' });

  const tpls = (await a('GET', '/scorecard/templates')).j;
  const full = tpls.find((t) => /full scorecard/.test(t.name));
  await a('POST', `/scorecard/templates/${full.code}/publish`);
  created.templates.push(full.code);
  const season = (await a('POST', '/scorecard/seasons', { name: `QA ${tag} season`, editionLabel: 'India Mind League – 1st Edition', frameworkCode: fw.code, libraryCode: lib.code, templateCode: full.code })).j;
  created.season = season.code;
  await a('PUT', `/scorecard/seasons/${season.code}/competitions`, { competitions: [{ competitionCode: C }] });

  // ---- running a panel stage through its whole life
  const rate = (rows, who, comp) => {
    const out = {};
    comp.forEach((c, i) => (out[c.code] = { optionIndex: who(rows[i][2]), comment: 'noted' }));
    return out;
  };
  const narratives = {};
  const runStage = async (n, levelsFor, opts2 = {}) => {
    await a('PUT', `/panel/competitions/${C}/stages/${n}/setup`, { formCode: forms[n], requiredRaters: 2 });
    await a('POST', `/panel/competitions/${C}/stages/${n}/panelists`, { panelistId: pa.id });
    await a('POST', `/panel/competitions/${C}/stages/${n}/panelists`, { panelistId: pb.id });
    const op = await a('POST', `/panel/competitions/${C}/stages/${n}/open`);
    if (op.s !== 201) throw new Error(`open stage ${n}: ${JSON.stringify(op.j)}`);
    const roster = (await call(tokA, 'GET', `/panel/me/stages/${stageId(n)}/students`)).j.rows;
    for (const reg of [R[0], R[1]]) {
      if (!roster.find((x) => x.registrationId === reg.id)) continue;
      if (opts2.skip && opts2.skip.includes(reg.id)) continue;
      const page = (await call(tokA, 'GET', `/panel/me/stages/${stageId(n)}/students/${reg.id}`)).j;
      const levels = levelsFor(reg);
      for (const tok of [tokA, tokB]) {
        const body = { ratings: {}, note: reg === R[0] ? `Observed: ${tok === tokA ? 'weighed consequences before acting' : 'asked others for their view'}.` : '', submit: true };
        page.form.competencies.forEach((c, i) => (body.ratings[c.code] = { optionIndex: LEVELS[levels[i][2]], comment: 'ok' }));
        const res = await call(tok, 'PUT', `/panel/me/stages/${stageId(n)}/students/${reg.id}`, body);
        if (res.s !== 200) throw new Error(`rating ${n}: ${JSON.stringify(res.j)}`);
      }
    }
    const cl = await a('POST', `/panel/competitions/${C}/stages/${n}/close`, { confirm: true });
    if (cl.s !== 201) throw new Error(`close ${n}: ${JSON.stringify(cl.j)}`);
    const fin = await a('POST', `/panel/competitions/${C}/stages/${n}/finalize`, { force: true });
    if (fin.s !== 201) throw new Error(`finalize ${n}: ${JSON.stringify(fin.j)}`);
    // the observer / jury note: a system draft, edited and approved by a panelist
    if (n !== 3) {
      const base = `/panel/me/stages/${stageId(n)}/students/${R[0].id}/narrative`;
      const draft = (await call(tokA, 'GET', base)).j;
      const edited = draft.systemDraft + '\n\nEdited by the panelist: the student listened before acting.';
      await call(tokA, 'PUT', base, { text: edited });
      const approved = (await call(tokA, 'POST', base + '/approve')).j;
      narratives[n] = { systemDraft: draft.systemDraft, edited, approved: approved.approvedText, gaps: draft.gaps };
    }
  };
  const decideAndRelease = async (n, release) => {
    const sel = await a('POST', `/competitions/${C}/stages/${stageId(n)}/selection-commit`);
    if (sel.s !== 201) throw new Error(`selection ${n}: ${JSON.stringify(sel.j)}`);
    if (release) await a('POST', `/panel/competitions/${C}/stages/${n}/release`);
    return sel.j;
  };
  // the first stage is online: commit nothing (Stage 1 was decided by the fixture)
  const weaker = (rows) => rows.map((r) => [r[0], r[1], r[2] === 'A' ? 'P' : 'D']);
  await runStage(2, (reg) => (reg === R[0] ? STAGE2 : weaker(STAGE2)));
  const sel2 = await decideAndRelease(2, true);
  await runStage(3, (reg) => (reg === R[0] ? STAGE3 : weaker(STAGE3)));
  // the student takes the written assessment of Stage 3
  const tokS = sign(R[0].student.id, 'student');
  const subj = (await call(tokS, 'GET', `/student/assessments/${asm.slug}`)).j;
  const ans = subj.items.map((it) => {
    const key = (it.prompt.match(/for (\w+)/) || [])[1];
    const pct = WRITTEN.find((w) => w[1] === key)[2];
    return { questionId: it.id, option: it.options.find((o) => o.text === 'Choice ' + pct / 20).token };
  });
  const sub = await call(tokS, 'POST', `/student/assessments/${asm.slug}/submit`, { answers: ans });
  if (sub.s !== 201) throw new Error('assessment submit: ' + JSON.stringify(sub.j));
  const sel3 = await decideAndRelease(3, true);
  await runStage(4, (reg) => (reg === R[0] ? STAGE4 : weaker(STAGE4)));
  // stage 4 is finalized but NOT selected or released yet: pending for the scorecard until then
  const ctx = { narratives, p, a, fx, C, R, stageId, forms, pa, pb, tokA, tokB, created, season, lib, fw, full, asm, selected: { 2: sel2, 3: sel3 }, finishStage4: async () => { const s = await decideAndRelease(4, true); return s; } };
  return ctx;
}

async function teardown(ctx) {
  const { p, a, created, C } = ctx;
  const regIds = (await p.registration.findMany({ where: { competition: { code: C } }, select: { id: true } })).map((x) => x.id);
  await p.scorecardShareLink.deleteMany({ where: { registrationId: { in: regIds } } });
  await p.scorecardReport.deleteMany({ where: { registrationId: { in: regIds } } });
  await p.scorecardConsent.deleteMany({ where: { studentId: { in: ctx.R.map((r) => r.student.id) } } });
  if (created.season) {
    await a('PUT', `/scorecard/seasons/${created.season}/competitions`, { competitions: [] });
    await a('DELETE', `/scorecard/seasons/${created.season}`);
  }
  await p.assessmentSubmission.deleteMany({ where: { assessment: { code: created.assessment } } });
  await fixture.down(p);
  await p.panelEnrolment.deleteMany({ where: { panelistId: { in: created.panelists } } });
  await p.panelRating.deleteMany({ where: { panelistId: { in: created.panelists } } });
  await p.panelist.deleteMany({ where: { id: { in: created.panelists } } });
  for (const code of created.forms) {
    const f = await p.assessment.findUnique({ where: { code } });
    if (f) { await p.question.deleteMany({ where: { assessmentId: f.id } }); await p.assessment.delete({ where: { id: f.id } }); }
  }
  if (created.assessment) {
    const f = await p.assessment.findUnique({ where: { code: created.assessment } });
    if (f) { await p.question.deleteMany({ where: { assessmentId: f.id } }); await p.assessment.delete({ where: { id: f.id } }); }
  }
  if (created.library) await a('DELETE', `/scorecard/content/libraries/${created.library}`);
  if (created.framework) await p.scorecardFramework.deleteMany({ where: { code: created.framework } });
  for (const t of created.templates) await p.scorecardTemplate.updateMany({ where: { code: t }, data: { status: 'Draft', publishedAt: null } });
  await p.otp.deleteMany({ where: { purpose: 'panel-login' } });
  await p.messageLog.deleteMany({ where: { templateKey: { in: ['PANEL_INVITE', 'PANEL_LOGIN_OTP', 'PANEL_REMINDER', 'SCORECARD_REPORT_READY', 'SCORECARD_REPORT_PARENT'] } } });
}

module.exports = { setup, teardown, call, sign, STAGE2, STAGE3, STAGE4, WRITTEN };
