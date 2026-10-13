// #87 governance: version differences, export / import (dry run first), copy to next season,
// audit search, and the module permissions of the scorecard admin screens.
const { ROOT } = require('./guard.js');
const API = ROOT;
const { PrismaClient } = require(API + 'node_modules/@prisma/client');
const R = require('./rehearsal.js');
const p = new PrismaClient();
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const msg = (r) => (Array.isArray(r.j.message) ? r.j.message.join(' ') : String(r.j.message || ''));

(async () => {
  const AT = (await R.call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const a = (m, path, b) => R.call(AT, m, path, b);
  let ctx;
  try { ctx = await R.setup(p, AT, { tag: 'Q87', students: 4 }); } catch (e) { console.error('SETUP FAILED', e); process.exit(1); }
  const extra = { frameworks: [], templates: [], libraries: [], seasons: [] };
  try {
    const FW = ctx.created.framework, SE = ctx.created.season, LIB = ctx.created.library;

    // ===================================================== diff between versions
    const root = await p.scorecardFramework.findFirst({ where: { parentId: null }, orderBy: { id: 'asc' } });
    let r = await a('GET', `/scorecard/frameworks/${root.code}/diff`);
    ok('the first version has nothing to compare with, and says so', r.s === 400 && /first version/.test(msg(r)), msg(r));
    r = await a('GET', `/scorecard/frameworks/${FW}/diff`);
    ok('a version made from another compares with it by default', r.s === 200 && r.j.from.version < r.j.to.version);
    const copy = (await a('POST', '/scorecard/frameworks', { name: 'QA87 v2', cloneFrom: FW })).j;
    extra.frameworks.push(copy.code);
    ok('a copy is a new version of the same framework', copy.version > 1, `v${copy.version}`);
    const cfg = copy.config;
    cfg.rollup.stageWeights = { 1: 1, 2: 2, 3: 1, 4: 3 };
    cfg.rollup.topStrengths = 4;
    cfg.dimensions[0].label = cfg.dimensions[0].label + ' (renamed)';
    r = await a('PATCH', `/scorecard/frameworks/${copy.code}`, { config: cfg });
    ok('the copy can be edited while a draft', r.s === 200, msg(r));
    r = await a('GET', `/scorecard/frameworks/${copy.code}/diff`);
    const paths = (r.j.changes || []).map((c) => c.path);
    ok('the difference lists exactly what changed, in readable paths', r.s === 200 && paths.includes('rollup.topStrengths') && paths.some((x) => x.startsWith('rollup.stageWeights')) && paths.some((x) => /dimensions\[.+\]\.label/.test(x)), paths.join(' | '));
    ok('and nothing that did not change', !paths.some((x) => x.startsWith('rollup.topGrowth')) && !paths.some((x) => x.startsWith('rollup.styles')));
    ok('it says which versions were compared', r.j.from.code === FW && r.j.to.code === copy.code);
    const topS = r.j.changes.find((c) => c.path === 'rollup.topStrengths');
    ok('a changed value carries its old and new value', topS && topS.before === 5 && topS.after === 4 && topS.kind === 'changed');
    r = await a('GET', `/scorecard/frameworks/${FW}/diff?against=${copy.code}`);
    ok('a version can be compared with any other one', r.s === 200 && r.j.from.code === copy.code && r.j.changes.length > 0);
    r = await a('GET', `/scorecard/frameworks/${copy.code}/diff?against=NOPE9`);
    ok('an unknown version to compare with is a clear 404', r.s === 404);

    const tpCopy = (await a('POST', '/scorecard/templates', { name: 'QA87 template v2', cloneFrom: ctx.created.templates[0] })).j;
    extra.templates.push(tpCopy.code);
    const tcfg = tpCopy.config;
    tcfg.branding = { ...(tcfg.branding || {}), footerText: 'QA87 footer' };
    await a('PATCH', `/scorecard/templates/${tpCopy.code}`, { config: tcfg });
    r = await a('GET', `/scorecard/templates/${tpCopy.code}/diff`);
    ok('a template version can be compared with the one before it too', r.s === 200 && r.j.changes.some((c) => /footerText/.test(c.path)), (r.j.changes || []).map((c) => c.path).join(' | '));

    // ===================================================== export
    r = await a('GET', `/scorecard/export?season=${SE}`);
    const bundle = r.j;
    ok('a season exports as one file with format and version', r.s === 200 && bundle.format === 'iml-scorecard-config' && bundle.version === 1);
    ok('it carries the framework (with its roll-up rules), the template and the wording', !!bundle.framework.config.rollup && !!bundle.template && bundle.library.texts.length > 20, `${bundle.library && bundle.library.texts.length} texts`);
    ok('the wording that was approved is marked as approved in the file', bundle.library.texts.some((t) => t.approved === true));
    ok('the file holds no student data, tokens or IDs', !/"studentId"|"passwordHash"|"token"/.test(JSON.stringify(bundle)));
    r = await a('GET', `/scorecard/export?season=NOPE9`);
    ok('exporting an unknown season is a 404', r.s === 404);

    // ===================================================== import
    const fwBefore = await p.scorecardFramework.count();
    const tpBefore = await p.scorecardTemplate.count();
    const clBefore = await p.scorecardLibrary.count();
    r = await a('POST', '/scorecard/import', { bundle });
    ok('import is a dry run unless told otherwise', r.s === 201 && r.j.dryRun === true && r.j.problems.length === 0 && r.j.libraryTexts === bundle.library.texts.length, JSON.stringify(r.j).slice(0, 200));
    ok('a dry run creates nothing', (await p.scorecardFramework.count()) === fwBefore && (await p.scorecardTemplate.count()) === tpBefore && (await p.scorecardLibrary.count()) === clBefore);
    r = await a('POST', '/scorecard/import', { bundle: { format: 'something-else', version: 1 }, dryRun: true });
    ok('a file from somewhere else is refused', r.s === 400 && /not a scorecard/i.test(msg(r)), msg(r));
    const broken = JSON.parse(JSON.stringify(bundle));
    broken.framework.config.dimensions = [];
    r = await a('POST', '/scorecard/import', { bundle: broken, dryRun: true });
    ok('a file whose rules would not pass is reported with the problems, before anything is created', r.s === 201 && r.j.problems.length > 0, r.j.problems && r.j.problems[0]);
    r = await a('POST', '/scorecard/import', { bundle, dryRun: false });
    ok('a real import creates a framework, a template and a library', r.s === 201 && r.j.dryRun === false && r.j.created.framework && r.j.created.template && r.j.created.library, JSON.stringify(r.j.created));
    if (r.j.created) { extra.frameworks.push(r.j.created.framework); extra.templates.push(r.j.created.template); extra.libraries.push(r.j.created.library); }
    const imp = r.j.created;
    const impFw = await p.scorecardFramework.findUnique({ where: { code: imp.framework } });
    ok('the imported framework is a draft that must be reviewed and published', impFw.status === 'Draft' && /imported/.test(impFw.name));
    ok('its rules are the exported rules', JSON.stringify(impFw.config.rollup) === JSON.stringify(bundle.framework.config.rollup));
    const impTp = await p.scorecardTemplate.findUnique({ where: { code: imp.template } });
    ok('the imported template is a draft', impTp.status === 'Draft');
    const impLib = await p.scorecardLibrary.findUnique({ where: { code: imp.library }, include: { texts: true } });
    ok('the imported wording is all drafts: nothing is approved by importing', impLib.texts.length === bundle.library.texts.length && impLib.texts.every((t) => t.approvedVersionId === null));

    // ===================================================== next season
    const orig = await p.scorecardSeason.findUnique({ where: { code: SE }, include: { library: { include: { texts: true } } } });
    await a('PATCH', `/scorecard/seasons/${SE}`, { deliverySettings: { consentRequired: true, notifyStudent: false, linkValidDays: 45 } });
    r = await a('POST', `/scorecard/seasons/${SE}/copy`, { name: 'QA87 next season', editionLabel: 'India Mind League – 2nd Edition' });
    ok('a season copies to a new one', r.s === 201 && r.j.season && r.j.library, JSON.stringify(r.j));
    if (r.j.season) { extra.seasons.push(r.j.season); extra.libraries.push(r.j.library); }
    const next = await p.scorecardSeason.findUnique({ where: { code: r.j.season }, include: { library: { include: { texts: true } } } });
    ok('the new season reuses the same published framework and template (same rules, same layout)', next.frameworkId === orig.frameworkId && next.templateId === orig.templateId);
    ok('it keeps the delivery settings', JSON.stringify(next.deliverySettings) === JSON.stringify((await p.scorecardSeason.findUnique({ where: { code: SE } })).deliverySettings) && next.deliverySettings.linkValidDays === 45);
    ok('it has its own wording, a copy, as drafts to be reviewed', next.libraryId !== orig.libraryId && next.library.texts.length === orig.library.texts.length && next.library.texts.every((t) => t.approvedVersionId === null));
    ok('the original wording is untouched, still approved', (await p.scorecardText.count({ where: { libraryId: orig.libraryId, approvedVersionId: { not: null } } })) > 20);
    ok('the new season has no competitions until some are added', (await p.competition.count({ where: { seasonId: next.id } })) === 0);
    r = await a('POST', `/scorecard/seasons/NOPE9/copy`, { name: 'QA87 x', editionLabel: 'Edition' });
    ok('copying an unknown season is a 404', r.s === 404);
    r = await a('POST', `/scorecard/seasons/${SE}/copy`, { name: 'x' });
    ok('a copy needs a name and an edition label', r.s === 400);

    // ===================================================== audit
    r = await a('GET', '/scorecard/audit?limit=5');
    ok('the existing audit list still returns a plain list', r.s === 200 && Array.isArray(r.j));
    r = await a('GET', '/scorecard/audit/search?action=export');
    ok('the audit can be filtered by action', r.s === 200 && r.j.total >= 1 && r.j.items.every((x) => x.action === 'export'));
    r = await a('GET', `/scorecard/audit/search?entity=season&code=${SE}`);
    ok('and by what it is about', r.s === 200 && r.j.items.length > 0 && r.j.items.every((x) => x.entity === 'season' && x.entityCode === SE));
    r = await a('GET', `/scorecard/audit/search?action=import`);
    ok('importing and copying are recorded', r.j.total >= 1 && (await a('GET', '/scorecard/audit/search?action=copy')).j.items.some((x) => x.summary.from === SE));
    r = await a('GET', '/scorecard/audit/search?admin=arjun');
    ok('it records who did it', r.j.items.length > 0 && r.j.items.every((x) => /arjun/i.test(x.adminName || '')), (r.j.items[0] || {}).adminName);
    r = await a('GET', '/scorecard/audit/search?limit=2&offset=0');
    const page2 = await a('GET', '/scorecard/audit/search?limit=2&offset=2');
    ok('it pages with a total', r.j.items.length === 2 && r.j.total > 2 && page2.j.items[0].id < r.j.items[1].id, `total ${r.j.total}`);
    ok('it lists the kinds and actions available to filter on', r.j.entities.includes('season') && r.j.actions.includes('copy'));
    r = await a('GET', `/scorecard/audit/search?from=${new Date(Date.now() + 86400000).toISOString()}`);
    ok('a date filter excludes what is outside it', r.j.total === 0);

    // ===================================================== module permissions
    let ed = await p.admin.findFirst({ where: { email: 'qa.editor87@example.com' } });
    if (!ed) ed = await p.admin.create({ data: { name: 'QA Editor87', email: 'qa.editor87@example.com', passwordHash: 'x', role: 'Editor' } });
    const edTok = R.sign(ed.id, 'admin');
    // sign() has no role; add it the way qa-75 does
    const jwt = require(API + 'node_modules/jsonwebtoken');
    const tok = jwt.sign({ sub: ed.id, kind: 'admin', role: ed.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
    const e = (m, path, b) => R.call(tok, m, path, b);
    const grant = async (...codes) => {
      await p.adminModule.deleteMany({ where: { adminId: ed.id } });
      for (const c of codes) await p.adminModule.create({ data: { adminId: ed.id, moduleCode: c } });
    };
    const denied = (x) => x.s === 403;
    await grant();
    ok('with no module, every scorecard screen is closed', denied(await e('GET', '/scorecard/frameworks')) && denied(await e('GET', '/scorecard/reports?comp=PNL1')) && denied(await e('GET', '/scorecard/content/libraries')) && denied(await e('GET', '/panel/panelists')));

    await grant('rl');
    ok('Report Release can read the reports', !denied(await e('GET', `/scorecard/reports?comp=${ctx.C}&stage=0`)));
    ok('it can release, withdraw and send to parents (the call is let through)', !denied(await e('POST', '/scorecard/reports/release', {})) && !denied(await e('POST', '/scorecard/reports/withdraw', {})) && !denied(await e('POST', '/scorecard/reports/send-parents', {})));
    ok('but cannot generate reports or change a template', denied(await e('POST', '/scorecard/reports/generate', {})) && denied(await e('POST', '/scorecard/templates', { name: 'x' })));
    ok('and has none of the setup, governance or panel screens', denied(await e('GET', '/scorecard/frameworks')) && denied(await e('GET', `/scorecard/export?season=${SE}`)) && denied(await e('POST', '/scorecard/import', { bundle })) && denied(await e('GET', '/scorecard/audit/search')) && denied(await e('GET', '/panel/panelists')));

    await grant('scap');
    ok('Wording Approvals can read the library', !denied(await e('GET', '/scorecard/content/libraries')));
    ok('it can approve wording (the call is let through)', !denied(await e('POST', `/scorecard/content/libraries/${LIB}/texts/approve-all`, {})));
    ok('but cannot edit or delete wording, or release reports', denied(await e('PUT', `/scorecard/content/libraries/${LIB}/texts`, {})) && denied(await e('DELETE', `/scorecard/content/libraries/${LIB}`)) && denied(await e('POST', '/scorecard/reports/release', {})));

    await grant('sc');
    ok('Scorecard Setup can read, edit and generate', !denied(await e('GET', '/scorecard/frameworks')) && !denied(await e('GET', `/scorecard/export?season=${SE}`)) && !denied(await e('POST', '/scorecard/reports/generate', {})) && !denied(await e('PUT', `/scorecard/content/libraries/${LIB}/texts`, {})));
    ok('but cannot release reports or approve wording', denied(await e('POST', '/scorecard/reports/release', {})) && denied(await e('POST', `/scorecard/content/libraries/${LIB}/texts/approve-all`, {})));

    await grant('pn');
    ok('Panels reaches the panel screens and not the scorecard ones', !denied(await e('GET', '/panel/panelists')) && denied(await e('GET', '/scorecard/frameworks')) && denied(await e('GET', '/scorecard/reports?comp=x')));
    await p.adminModule.deleteMany({ where: { adminId: ed.id } });
  } finally {
    // clean up what this script made
    for (const s of extra.seasons) { await a('PUT', `/scorecard/seasons/${s}/competitions`, { competitions: [] }); await a('DELETE', `/scorecard/seasons/${s}`); }
    for (const l of extra.libraries) await a('DELETE', `/scorecard/content/libraries/${l}`);
    await p.scorecardFramework.deleteMany({ where: { code: { in: extra.frameworks } } });
    await p.scorecardTemplate.deleteMany({ where: { code: { in: extra.templates } } });
    const ed = await p.admin.findFirst({ where: { email: 'qa.editor87@example.com' } });
    if (ed) { await p.adminModule.deleteMany({ where: { adminId: ed.id } }); await p.admin.delete({ where: { id: ed.id } }).catch(() => {}); }
    await R.teardown(ctx);
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
