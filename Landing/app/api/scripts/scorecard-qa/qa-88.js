// #88 no-code acceptance test: add a Stage 5 to a running competition with its own panel form and its
// own report section, using only the admin API calls the admin screens make — no code change, no
// migration — then generate the Stage 5 report and the full scorecard that includes it.
const { ROOT } = require('./guard.js');
const API = ROOT;
const { PrismaClient } = require(API + 'node_modules/@prisma/client');
const R = require('./rehearsal.js');
const p = new PrismaClient();
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const msg = (r) => (Array.isArray(r.j.message) ? r.j.message.join(' ') : String(r.j.message || ''));
const LEVELS = { E: 0, D: 1, P: 2, A: 3 };
const STAGE5 = [['Resilience', 'LEAD', 'A'], ['Curiosity', 'THINK', 'P'], ['Teamwork', 'CONNECT', 'A']];

(async () => {
  const AT = (await R.call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const a = (m, path, b) => R.call(AT, m, path, b);
  let ctx;
  try { ctx = await R.setup(p, AT, { tag: 'Q88', students: 6 }); } catch (e) { console.error('SETUP FAILED', e); process.exit(1); }
  const { C, R: regs, tokA, tokB, created } = ctx;
  const extraTemplates = [];
  const migrationsBefore = await p.$queryRawUnsafe('SELECT count(*)::int AS n FROM _prisma_migrations');
  try {
    const A = regs[0], B = regs[1];

    // ---------------------------------------------------------- 1. the stage and its form
    let r = await a('POST', `/competitions/${C}/stages`, { position: 5, name: 'Mentor Round', mode: 'Peer Interview', passMark: 0, isFree: true });
    ok('a fifth stage is added to the competition', r.s === 201, msg(r));
    const stage5 = (await p.competitionStage.findFirst({ where: { competition: { code: C }, position: 5 } }));
    const form = (await a('POST', '/panel-forms', { title: 'QA Q88 Mentor Round', settings: { requiredRaters: 2, noteRequired: false } })).j;
    created.forms.push(form.code);
    for (const [label, dim] of STAGE5) await a('POST', `/panel-forms/${form.code}/competencies`, { label, dimension: dim, prompt: `${label} observed`, useStandardScale: true });
    r = await a('POST', `/panel-forms/${form.code}/publish`);
    ok('it gets its own evaluation form, with its own competencies', r.s === 201, msg(r));

    // ---------------------------------------------------------- 2. run it with the panel
    const sel4 = await ctx.finishStage4(); // Stage 4's selection now also unlocks the new Stage 5
    console.log('SEL4', JSON.stringify(sel4).slice(0, 300), JSON.stringify(await p.competitionStage.findMany({ where: { competition: { code: C } }, select: { position: true, isFree: true, id: true } })), JSON.stringify(await p.registrationStage.groupBy({ by: ['status'], where: { stageId: stage5.id }, _count: { _all: true } })));
    ok('the previous stage was selected, so Stage 5 can be set up', (await a('PUT', `/panel/competitions/${C}/stages/5/setup`, { formCode: form.code, requiredRaters: 2 })).s === 200);
    await a('POST', `/panel/competitions/${C}/stages/5/panelists`, { panelistId: ctx.pa.id });
    await a('POST', `/panel/competitions/${C}/stages/5/panelists`, { panelistId: ctx.pb.id });
    r = await a('POST', `/panel/competitions/${C}/stages/5/open`);
    if (r.s !== 201) { const st = (await a('GET', '/panel/competitions/' + C + '/stages/5')).j; console.log('STATUS', JSON.stringify({ state: st.state, ready: st.readyIssues, blockers: st.openBlockers, roster: st.rosterSize })); }
    ok('Stage 5 opens for rating', r.s === 201, msg(r));
    const roster = (await R.call(tokA, 'GET', `/panel/me/stages/${stage5.id}/students`)).j.rows;
    ok('everyone who reached it is on the roster', roster.length >= 2 && roster.some((x) => x.registrationId === A.id), `${roster.length} students`);
    for (const reg of [A, B]) {
      const page = (await R.call(tokA, 'GET', `/panel/me/stages/${stage5.id}/students/${reg.id}`)).j;
      ok('the panelist sees the new form, not another stage\'s', page.form.competencies.map((c) => c.label).join() === 'Resilience,Curiosity,Teamwork', page.form.competencies.map((c) => c.label).join());
      for (const tok of [tokA, tokB]) {
        const body = { ratings: {}, note: `Observed in Mentor Round: ${tok === tokA ? 'stayed steady under pressure' : 'built on others\' ideas'}.`, submit: true };
        page.form.competencies.forEach((c, i) => (body.ratings[c.code] = { optionIndex: LEVELS[reg === A ? STAGE5[i][2] : 'D'], comment: 'ok' }));
        const res = await R.call(tok, 'PUT', `/panel/me/stages/${stage5.id}/students/${reg.id}`, body);
        if (res.s !== 200) ok('rating saved', false, JSON.stringify(res.j));
      }
    }
    ok('Stage 5 closes and is finalized', (await a('POST', `/panel/competitions/${C}/stages/5/close`, { confirm: true })).s === 201 && (await a('POST', `/panel/competitions/${C}/stages/5/finalize`, { force: true })).s === 201);
    const base = `/panel/me/stages/${stage5.id}/students/${A.id}/narrative`;
    const draft = (await R.call(tokA, 'GET', base)).j;
    await R.call(tokA, 'PUT', base, { text: draft.systemDraft + '\n\nQA Q88 mentor observation.' });
    const ap = await R.call(tokA, 'POST', base + '/approve');
    ok('the mentor note is drafted from the ratings, edited and approved', ap.s === 201 && /QA Q88 mentor observation/.test(ap.j.approvedText));
    r = await a('POST', `/competitions/${C}/stages/${stage5.id}/selection-commit`);
    ok('selection is committed for Stage 5 through the same flow', r.s === 201, msg(r));
    ok('and its result is released', (await a('POST', `/panel/competitions/${C}/stages/5/release`)).s === 201);

    // ---------------------------------------------------------- 3. its report section: a new template version
    const full = (await a('GET', `/scorecard/templates/${ctx.full.code}`)).j;
    const copy = (await a('POST', '/scorecard/templates', { name: 'QA Q88 template with Stage 5', cloneFrom: full.code })).j;
    extraTemplates.push(copy.code);
    const cfg = copy.config;
    const i4 = cfg.sections.findIndex((s) => s.key === 'stage4_competencies');
    const note4 = cfg.sections.find((s) => s.key === 'stage4_observer' || (s.type === 'observer_note' && s.stage === 4));
    const comp5 = { ...JSON.parse(JSON.stringify(cfg.sections[i4])), key: 'stage5_competencies', stage: 5, labels: { ...cfg.sections[i4].labels, title: 'Stage 5 — {Stage}' } };
    const note5 = { ...JSON.parse(JSON.stringify(note4)), key: 'stage5_note', stage: 5, labels: { ...note4.labels, title: 'Mentor observation' } };
    const at = cfg.sections.indexOf(note4) + 1;
    cfg.sections.splice(at, 0, comp5, note5);
    r = await a('PATCH', `/scorecard/templates/${copy.code}`, { config: cfg });
    ok('a report section for Stage 5 is added in the template editor', r.s === 200 && r.j.config.sections.some((s) => s.key === 'stage5_competencies'), msg(r));
    r = await a('POST', `/scorecard/templates/${copy.code}/publish`);
    ok('the new template version publishes', r.s === 201, msg(r));
    r = await a('PATCH', `/scorecard/seasons/${created.season}`, { templateCode: copy.code });
    ok('the season is switched to it', r.s === 200, msg(r));

    // ---------------------------------------------------------- 4. reports (panel stages report through the full scorecard)
    const prof = (await a('GET', `/scorecard/profile?comp=${C}&student=${A.student.code}`)).j;
    ok('the final profile now includes Stage 5', prof.profile.stagesUsed.join() === '1,2,3,4,5', prof.profile.stagesUsed.join());
    const fp = await a('GET', `/scorecard/reports/preview?comp=${C}&stage=0&student=${A.student.code}`);
    ok('the full scorecard previews with Stage 5, after Stage 4, with its own competencies', fp.s === 200 && /Resilience/.test(fp.j.html) && /Curiosity/.test(fp.j.html) && /Teamwork/.test(fp.j.html) && fp.j.html.indexOf('Resilience') > fp.j.html.indexOf('Jury observation'), msg(fp));
    ok('and the approved mentor note under the new section', /Mentor observation/.test(fp.j.html) && /QA Q88 mentor observation/.test(fp.j.html));
    ok('the earlier stages are still there', /Understanding Complexity/.test(fp.j.html) && /Critical Thinking/.test(fp.j.html));
    r = await a('POST', `/scorecard/reports/generate?comp=${C}&stage=0`, { students: [A.student.code] });
    ok('the full scorecard is queued', r.s === 201 && r.j.queued === 1, JSON.stringify(r.j));
    const { NestFactory } = require(API + 'node_modules/@nestjs/core');
    const { AppModule } = require(API + 'dist/src/app.module');
    const { ScorecardReportQueueService } = require(API + 'dist/src/admin/scorecard/report-queue.service');
    const { launchBrowser } = require(API + 'dist/src/scorecard/report-renderer');
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const q = app.get(ScorecardReportQueueService);
    const browser = await launchBrowser();
    for (;;) {
      const row = await p.scorecardReport.findFirst({ where: { status: 'Queued' }, orderBy: { id: 'asc' } });
      if (!row) break;
      await p.scorecardReport.update({ where: { id: row.id }, data: { status: 'Generating' } });
      await q.processOne(row.id, row.attempts, browser);
    }
    await browser.close();
    await app.close();
    const stored = await p.scorecardReport.findFirst({ where: { registrationId: A.id, stagePosition: 0 }, orderBy: { id: 'desc' } });
    ok('the full scorecard is generated as a PDF', stored && stored.status === 'Ready' && stored.pageCount >= 5, stored && stored.status + ' ' + stored.pageCount + ' pages ' + (stored.lastError || ''));
    ok('the report records the framework, rules and template it was made with', stored && stored.configUsed && !!stored.configUsed.rules && !!stored.configUsed.framework && !!stored.configUsed.template && !!stored.configUsed.library && stored.configUsed.stagesUsed.join() === '1,2,3,4,5', stored && JSON.stringify(stored.configUsed.framework) + ' ' + JSON.stringify(stored.configUsed.template));

    // ---------------------------------------------------------- 5. nothing outside the admin panel changed
    const migrationsAfter = await p.$queryRawUnsafe('SELECT count(*)::int AS n FROM _prisma_migrations');
    ok('no migration was needed', migrationsAfter[0].n === migrationsBefore[0].n);
  } finally {
    await p.panelNarrative.deleteMany({ where: { stage: { competition: { code: C } } } }).catch(() => {});
    for (const t of extraTemplates) {
      await a('PATCH', `/scorecard/seasons/${created.season}`, { templateCode: created.templates[0] });
      await p.scorecardReport.deleteMany({ where: { registration: { competition: { code: C } } } });
      await p.scorecardTemplate.deleteMany({ where: { code: t } });
    }
    await R.teardown(ctx);
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
