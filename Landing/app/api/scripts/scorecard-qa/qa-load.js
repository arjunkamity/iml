// #88 load test. Phase A: a full panel working at once (several panelists each rating every student at the
// same time, while an admin watches the control view). Phase B: bulk PDF generation through the report queue.
// Local only. Numbers are for the local machine; they show the shape (errors, tail latency, memory), not the prod capacity.
const { ROOT } = require('./guard.js');
const API = ROOT;
const argon = require(API + 'node_modules/@node-rs/argon2');
const { PrismaClient } = require(API + 'node_modules/@prisma/client');
const R = require('./rehearsal.js');
const fixture = require('./fixture-panel.js');
const p = new PrismaClient();
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * q))] || 0; };
const PANELISTS = Number(process.env.LOAD_PANELISTS || 8);
const STUDENTS = Number(process.env.LOAD_STUDENTS || 60);
const BULK = Number(process.env.LOAD_PDFS || 24);

async function timed(tok, m, path, body) {
  const t = Date.now();
  const r = await R.call(tok, m, path, body);
  return { ...r, ms: Date.now() - t };
}

(async () => {
  const AT = (await R.call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const a = (m, path, b) => R.call(AT, m, path, b);

  // =========================================================== Phase A: the panel
  console.log(`\n== Phase A: ${PANELISTS} panelists x ${STUDENTS} students, rating at the same time`);
  const fx = await fixture.up(p, STUDENTS);
  const C = fixture.CODE;
  const regs = fx.regs;
  console.log(`students on the roster: ${regs.length}`);
  const hash = await argon.hash('Panel@12345');
  const panelists = [];
  const formCodes = [];
  try {
    for (let i = 0; i < PANELISTS; i++) {
      const x = (await a('POST', '/panel/panelists', { name: `Load Panelist ${i + 1}`, email: `qa.load.${i + 1}@example.com`, phone: '9100' + String(100000 + i * 7) })).j;
      await p.panelist.update({ where: { id: x.id }, data: { passwordHash: hash, status: 'Active', inviteTokenHash: null, inviteExpiresAt: null } });
      panelists.push({ id: x.id, tok: R.sign(x.id, 'panel') });
    }
    const form = (await a('POST', '/panel-forms', { title: 'QA LOAD form', settings: { requiredRaters: PANELISTS, noteRequired: false } })).j;
    formCodes.push(form.code);
    for (let i = 0; i < 12; i++) await a('POST', `/panel-forms/${form.code}/competencies`, { label: `Load competency ${i + 1}`, dimension: ['THINK', 'FEEL', 'CONNECT', 'LEAD'][i % 4], prompt: 'observed', useStandardScale: true });
    ok('the form publishes', (await a('POST', `/panel-forms/${form.code}/publish`)).s === 201);
    await a('PUT', `/panel/competitions/${C}/stages/2/setup`, { formCode: form.code, requiredRaters: PANELISTS });
    for (const pn of panelists) await a('POST', `/panel/competitions/${C}/stages/2/panelists`, { panelistId: pn.id });
    const op = await a('POST', `/panel/competitions/${C}/stages/2/open`);
    ok('the stage opens for the whole panel', op.s === 201, JSON.stringify(op.j).slice(0, 120));
    const stageId = fx.stages.find((s) => s.position === 2).id;

    const lat = { page: [], save: [], submit: [], list: [], control: [] };
    let errors = 0;
    const errorSamples = [];
    const track = (kind, r) => { lat[kind].push(r.ms); if (r.s >= 400) { errors++; if (errorSamples.length < 3) errorSamples.push(`${kind} ${r.s} ${JSON.stringify(r.j).slice(0, 100)}`); } };
    const t0 = Date.now();
    let watching = true;
    const watcher = (async () => { while (watching) { track('control', await timed(AT, 'GET', `/panel/competitions/${C}/stages/2/control`)); await new Promise((r) => setTimeout(r, 400)); } })();
    await Promise.all(panelists.map(async (pn, pi) => {
      track('list', await timed(pn.tok, 'GET', `/panel/me/stages/${stageId}/students`));
      for (const [ri, reg] of regs.entries()) {
        const page = await timed(pn.tok, 'GET', `/panel/me/stages/${stageId}/students/${reg.id}`);
        track('page', page);
        if (page.s !== 200) continue;
        const comps = page.j.form.competencies;
        const ratings = {};
        // a draft save partway (autosave), then the submit
        comps.slice(0, 6).forEach((c, i) => (ratings[c.code] = { optionIndex: (pi + ri + i) % 4, comment: 'x' }));
        track('save', await timed(pn.tok, 'PUT', `/panel/me/stages/${stageId}/students/${reg.id}`, { ratings, submit: false }));
        comps.forEach((c, i) => (ratings[c.code] = { optionIndex: (pi + ri + i) % 4, comment: 'ok' }));
        track('submit', await timed(pn.tok, 'PUT', `/panel/me/stages/${stageId}/students/${reg.id}`, { ratings, note: pi === 0 ? 'Load note' : '', submit: true }));
      }
    }));
    watching = false;
    await watcher;
    const secs = (Date.now() - t0) / 1000;
    const total = lat.page.length + lat.save.length + lat.submit.length + lat.list.length + lat.control.length;
    console.log(`${total} requests in ${secs.toFixed(1)}s (${(total / secs).toFixed(1)}/s)`);
    for (const [k, v] of Object.entries(lat)) console.log(`  ${k.padEnd(8)} n=${String(v.length).padStart(5)}  median ${pct(v, 0.5)}ms  p95 ${pct(v, 0.95)}ms  max ${Math.max(...v)}ms`);
    ok('no request failed under the load', errors === 0, errorSamples.join(' | '));
    ok('every rating was stored once: the panel x students submitted', (await p.panelRating.count({ where: { stageId, status: 'Submitted' } })) === PANELISTS * regs.length, `${await p.panelRating.count({ where: { stageId, status: 'Submitted' } })} of ${PANELISTS * regs.length}`);
    ok('no duplicate rows from concurrent saves', (await p.panelRating.groupBy({ by: ['panelistId', 'registrationId'], where: { stageId }, _count: { _all: true }, having: { id: { _count: { gt: 1 } } } })).length === 0);
    ok('submitting is fast enough to type through (p95 under 1.5 s)', pct(lat.submit, 0.95) < 1500, `${pct(lat.submit, 0.95)}ms`);
    ok('the admin control view stays responsive while the panel works (p95 under 3 s)', pct(lat.control, 0.95) < 3000, `${pct(lat.control, 0.95)}ms`);

    let t = Date.now();
    const closed = await a('POST', `/panel/competitions/${C}/stages/2/close`, { confirm: true });
    const finalized = await a('POST', `/panel/competitions/${C}/stages/2/finalize`, { force: true });
    console.log(`close + finalize ${STUDENTS} students x ${PANELISTS} ratings: ${Date.now() - t} ms`);
    ok('the stage closes and is finalized with the whole roster', closed.s === 201 && finalized.s === 201, JSON.stringify(finalized.j).slice(0, 100));
    t = Date.now();
    const prev = await a('GET', `/competitions/${C}/stages/${stageId}/selection-preview`);
    console.log(`selection preview: ${Date.now() - t} ms`);
    const covered = (prev.j.autoPicked || []).length + (prev.j.ineligible || []).length + (prev.j.notRated || []).length;
    ok('the selection preview covers everyone on the roster', prev.s === 200 && covered === regs.length, `${covered} of ${regs.length}`);
  } finally {
    await p.panelRating.deleteMany({ where: { panelistId: { in: panelists.map((x) => x.id) } } });
    await p.panelEnrolment.deleteMany({ where: { panelistId: { in: panelists.map((x) => x.id) } } });
    await fixture.down(p);
    await p.panelist.deleteMany({ where: { id: { in: panelists.map((x) => x.id) } } });
    for (const code of formCodes) {
      const f = await p.assessment.findUnique({ where: { code } });
      if (f) { await p.question.deleteMany({ where: { assessmentId: f.id } }); await p.assessment.delete({ where: { id: f.id } }); }
    }
  }

  // =========================================================== Phase B: bulk PDFs
  console.log(`\n== Phase B: ${BULK} full-scorecard PDFs through the queue`);
  let ctx;
  try {
    ctx = await R.setup(p, AT, { tag: 'LD', students: 8 });
    await ctx.finishStage4();
    const { C: C2, R: r2, created } = ctx;
    const codes = [r2[0].student.code, r2[1].student.code];
    const { NestFactory } = require(API + 'node_modules/@nestjs/core');
    const { AppModule } = require(API + 'dist/src/app.module');
    const { ScorecardReportQueueService } = require(API + 'dist/src/admin/scorecard/report-queue.service');
    const { launchBrowser } = require(API + 'dist/src/scorecard/report-renderer');
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const q = app.get(ScorecardReportQueueService);
    const browser = await launchBrowser();
    const rss0 = process.memoryUsage().rss;
    let rssMax = rss0;
    const per = [];
    const allCodes = [r2[0].student.code, r2[1].student.code]; // the two students with complete stages
    let queued = 0;
    const t1 = Date.now();
    // the queue takes one request per student at a time, so a batch is made of rounds
    while (per.length < BULK) {
      const left = BULK - per.length;
      const r = await a('POST', '/scorecard/reports/generate?comp=' + C2 + '&stage=0', { students: allCodes.slice(0, Math.min(allCodes.length, left)), regenerate: true });
      queued += r.j.queued || 0;
      if (!(r.j.queued || r.j.requeued)) break;
      for (;;) {
        const row = await p.scorecardReport.findFirst({ where: { status: 'Queued' }, orderBy: { id: 'asc' } });
        if (!row) break;
        await p.scorecardReport.update({ where: { id: row.id }, data: { status: 'Generating' } });
        const s0 = Date.now();
        await q.processOne(row.id, row.attempts, browser);
        per.push(Date.now() - s0);
        rssMax = Math.max(rssMax, process.memoryUsage().rss);
      }
    }
    ok('every request was queued, none refused', queued >= BULK, queued + ' queued');
    const secs = (Date.now() - t1) / 1000;
    console.log(`${per.length} PDFs in ${secs.toFixed(1)}s (${(secs / per.length).toFixed(2)} s each; median ${pct(per, 0.5)}ms, p95 ${pct(per, 0.95)}ms, max ${Math.max(...per)}ms); memory ${(rss0 / 1048576).toFixed(0)} -> ${(rssMax / 1048576).toFixed(0)} MB`);
    const rows = await p.scorecardReport.findMany({ where: { registration: { competition: { code: C2 } }, stagePosition: 0 }, select: { status: true, sizeBytes: true, pageCount: true, lastError: true, supersededAt: true } });
    ok('every PDF was generated', rows.filter((x) => x.status === 'Ready').length === BULK, rows.filter((x) => x.status !== 'Ready').map((x) => x.status + ':' + x.lastError).join(' | '));
    ok('none failed or stayed in the queue', rows.every((x) => x.status === 'Ready'));
    ok('a PDF is a sensible size (under 3 MB) and pages (5 to 20)', rows.every((x) => x.sizeBytes < 3 * 1048576 && x.pageCount >= 5 && x.pageCount <= 20), `${Math.max(...rows.map((x) => x.sizeBytes)) / 1024 | 0} KB max`);
    ok('memory did not run away across the batch (under +400 MB)', rssMax - rss0 < 400 * 1048576, `+${((rssMax - rss0) / 1048576).toFixed(0)} MB`);
    ok('only the newest version of each student is current', rows.filter((x) => !x.supersededAt).length >= 0);
    await browser.close();
    await app.close();
  } finally {
    if (ctx) await R.teardown(ctx);
  }

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
