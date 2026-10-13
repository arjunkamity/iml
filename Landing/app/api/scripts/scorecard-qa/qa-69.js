// #69: scorecard configuration API (frameworks, versioning, seasons, audit, module guard)
const { ROOT } = require('./guard.js');
const { PrismaClient } = require(ROOT + 'node_modules/@prisma/client');
const p = new PrismaClient();
const B = process.env.QA_API || 'http://localhost:3000/api/v1';
const call = async (tok, m, path, body) => {
  const r = await fetch(B + path, { method: m, headers: { 'Content-Type': 'application/json', Connection: 'close', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };

const edpa = () => ({ key: 'EDPA', name: 'IML Development Scale', movingTowardsMargin: 0.25, levels: [
  { key: 'EMERGING', label: 'Emerging', points: 1, minPercent: 0, minAverage: 1, meaning: 'Beginning.' },
  { key: 'DEVELOPING', label: 'Developing', points: 2, minPercent: 40, minAverage: 1.75, meaning: 'Familiar situations.' },
  { key: 'PROFICIENT', label: 'Proficient', points: 3, minPercent: 60, minAverage: 2.5, meaning: 'Effective.' },
  { key: 'ADVANCED', label: 'Advanced', points: 4, minPercent: 80, minAverage: 3.5, meaning: 'Maturity.' },
] });
const validConfig = () => ({
  dimensions: [{ key: 'THINK', label: 'THINK', subtitle: 'Intellectual Intelligence' }, { key: 'FEEL', label: 'FEEL' }],
  scales: [edpa(), { ...edpa(), key: 'SIMPLE', name: 'Simple scale' }],
  defaultScale: 'EDPA',
  competencies: [
    { key: 'CRITICAL_THINKING', name: 'Critical Thinking', dimension: 'THINK', weight: 1, stageNames: { '4': 'Critical Reasoning' } },
    { key: 'EMPATHY', name: 'Empathy', dimension: 'FEEL', weight: 2, stageNames: {} },
  ],
});

(async () => {
  const AT = (await call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const adm = (m, path, b) => call(AT, m, path, b);
  const made = { frameworks: [], seasons: [] };

  try {
    // ---- the seeded sample framework (npm run seed:scorecard)
    let r = await adm('GET', '/scorecard/frameworks');
    ok('list frameworks', r.s === 200 && Array.isArray(r.j));
    const sample = r.j.find((f) => /client sample/.test(f.name));
    if (sample) {
      const g = await adm('GET', `/scorecard/frameworks/${sample.code}`);
      ok('seeded sample framework: 4 dimensions, EDPA scale, 24 competencies, no issues, still a Draft', g.s === 200 && g.j.config.dimensions.length === 4 && g.j.config.scales[0].key === 'EDPA' && g.j.config.competencies.length === 24 && g.j.issues.length === 0 && g.j.status === 'Draft', 'issues=' + JSON.stringify(g.j.issues));
    } else console.log('SKIP seeded sample (run npm run seed:scorecard)');

    // ---- create / edit / validate / publish
    r = await adm('POST', '/scorecard/frameworks', { name: 'QA Framework' });
    ok('create blank framework: Draft v1 with the standard EDPA scale', r.s === 201 && r.j.status === 'Draft' && r.j.version === 1 && r.j.config.scales[0].key === 'EDPA' && r.j.config.dimensions.length === 0, r.j.code);
    const fw = r.j.code; made.frameworks.push(fw);
    ok('blank framework has publish issues listed', r.j.issues.length > 0 && r.j.issues.join(' ').includes('at least one dimension'));
    r = await adm('POST', `/scorecard/frameworks/${fw}/publish`);
    ok('cannot publish while incomplete', r.s === 400 && /Not ready to publish/.test(r.j.message), r.j.message.slice(0, 80));
    r = await adm('PATCH', `/scorecard/frameworks/${fw}`, { config: { ...validConfig(), defaultScale: 'NOPE' } });
    ok('saving an incomplete draft is allowed and reports the problem', r.s === 200 && r.j.issues.join(' ').includes('default scale "NOPE"'));
    r = await adm('PATCH', `/scorecard/frameworks/${fw}`, { config: validConfig(), notes: 'QA notes' });
    ok('save a valid configuration', r.s === 200 && r.j.issues.length === 0 && r.j.config.competencies.length === 2 && r.j.notes === 'QA notes');
    r = await adm('POST', `/scorecard/frameworks/${fw}/publish`);
    ok('publish a valid framework', r.s === 201 && r.j.status === 'Published' && r.j.locked === true && !!r.j.publishedAt);
    r = await adm('PATCH', `/scorecard/frameworks/${fw}`, { name: 'Changed' });
    ok('published framework is immutable', r.s === 400 && /published/.test(r.j.message), r.j.message.slice(0, 60));
    r = await adm('DELETE', `/scorecard/frameworks/${fw}`);
    ok('published framework cannot be deleted', r.s === 400);

    // ---- versioning
    r = await adm('POST', '/scorecard/frameworks', { name: 'QA Framework v2', cloneFrom: fw });
    ok('"make a new version": Draft v2 copied from the published one', r.s === 201 && r.j.status === 'Draft' && r.j.version === 2 && r.j.config.competencies.length === 2 && r.j.versions.length === 2, `v${r.j.version} lineage=${r.j.versions.length}`);
    const fw2 = r.j.code; made.frameworks.push(fw2);
    r = await adm('PATCH', `/scorecard/frameworks/${fw2}`, { config: { ...validConfig(), competencies: [{ key: 'EMPATHY', name: 'Empathy', dimension: 'FEEL', weight: 3, stageNames: {} }, { key: 'CRITICAL_THINKING', name: 'Critical Thinking', dimension: 'THINK', weight: 1, stageNames: {} }] } });
    const orig = await adm('GET', `/scorecard/frameworks/${fw}`);
    ok('editing the copy leaves the published original untouched', r.s === 200 && orig.j.config.competencies.find((c) => c.key === 'EMPATHY').weight === 2 && r.j.config.competencies.find((c) => c.key === 'EMPATHY').weight === 3);

    // ---- seasons
    r = await adm('POST', '/scorecard/seasons', { name: 'QA Season', editionLabel: 'India Mind League – QA Edition', frameworkCode: fw2 });
    ok('a season needs a published framework', r.s === 400 && /published framework/.test(r.j.message));
    r = await adm('POST', '/scorecard/seasons', { name: 'QA Season', editionLabel: 'x', frameworkCode: fw, idPattern: 'IML-{YYYY}' });
    ok('a season ID pattern needs one running number', r.s === 400 && /running number/.test(r.j.message));
    r = await adm('POST', '/scorecard/seasons', { name: 'QA Season', editionLabel: 'x', frameworkCode: fw, scaleKey: 'NOPE' });
    ok('a season scale must exist in the framework', r.s === 400 && /does not exist/.test(r.j.message));
    r = await adm('POST', '/scorecard/seasons', { name: 'QA Season', editionLabel: 'India Mind League – QA Edition', frameworkCode: fw, year: 2026 });
    ok('create season (default ID pattern)', r.s === 201 && r.j.idPattern === 'IML-{YYYY}-{#####}' && r.j.idExample === 'IML-2026-00124' && r.j.effectiveScale === 'EDPA', r.j.code + ' ' + r.j.idExample);
    const se = r.j.code; made.seasons.push(se);
    r = await adm('PATCH', `/scorecard/seasons/${se}`, { idPattern: '{SEASON}/{YY}/{####}', scaleKey: 'SIMPLE' });
    ok('edit pattern and default scale', r.s === 200 && r.j.idExample === `${se}/26/0124` && r.j.effectiveScale === 'SIMPLE', r.j.idExample);

    const comp = await p.competition.findFirst({ where: { code: 'GTEST' } });
    const other = await p.competition.findFirst({ where: { NOT: { code: 'GTEST' } }, orderBy: { id: 'asc' } });
    r = await adm('PUT', `/scorecard/seasons/${se}/competitions`, { competitions: [{ competitionCode: comp.code, scaleKey: 'EDPA' }, { competitionCode: other.code }] });
    ok('assign competitions with an optional scale override', r.s === 200 && r.j.competitions.length === 2 && r.j.competitions.find((c) => c.code === comp.code).scaleKey === 'EDPA' && r.j.competitions.find((c) => c.code === other.code).scaleKey === null);
    r = await adm('POST', '/scorecard/seasons', { name: 'QA Season 2', editionLabel: 'Second', frameworkCode: fw });
    const se2 = r.j.code; made.seasons.push(se2);
    r = await adm('PUT', `/scorecard/seasons/${se2}/competitions`, { competitions: [{ competitionCode: comp.code }] });
    ok('a competition belongs to one season only', r.s === 409 && /already belongs to season/.test(r.j.message), r.j.message);
    r = await adm('PUT', `/scorecard/seasons/${se}/competitions`, { competitions: [{ competitionCode: comp.code, scaleKey: 'BAD' }] });
    ok('per-competition scale must exist', r.s === 400);
    r = await adm('PUT', `/scorecard/seasons/${se}/competitions`, { competitions: [{ competitionCode: comp.code }] });
    const freed = await p.competition.findUnique({ where: { id: other.id } });
    ok('removing a competition from the list frees it', r.s === 200 && r.j.competitions.length === 1 && freed.seasonId === null && freed.scaleKey === null);
    r = await adm('POST', `/scorecard/frameworks/${fw}/archive`);
    ok('cannot archive a framework an active season uses', r.s === 400 && /active season/.test(r.j.message), r.j.message.slice(0, 60));
    r = await adm('DELETE', `/scorecard/seasons/${se}`);
    ok('cannot delete a season that still has competitions', r.s === 400);
    r = await adm('PATCH', `/scorecard/seasons/${se}`, { frameworkCode: fw2 });
    ok('cannot move a season with competitions to another framework', r.s === 400);

    // ---- cleanup of seasons, then archive/unarchive/delete paths
    await adm('PUT', `/scorecard/seasons/${se}/competitions`, { competitions: [] });
    for (const s of [se, se2]) { const d = await adm('DELETE', `/scorecard/seasons/${s}`); ok('delete season ' + s, d.s === 200); }
    made.seasons.length = 0;
    r = await adm('POST', `/scorecard/frameworks/${fw}/archive`);
    ok('archive a published framework not in use', r.s === 201 && r.j.status === 'Archived');
    r = await adm('POST', '/scorecard/seasons', { name: 'QA Season 3', editionLabel: 'x', frameworkCode: fw });
    ok('an archived framework cannot get new seasons', r.s === 400);
    r = await adm('POST', `/scorecard/frameworks/${fw}/unarchive`);
    ok('unarchive', r.s === 201 && r.j.status === 'Published');
    r = await adm('DELETE', `/scorecard/frameworks/${fw2}`);
    ok('delete a draft', r.s === 200);
    made.frameworks = made.frameworks.filter((x) => x !== fw2);

    // ---- audit log
    r = await adm('GET', `/scorecard/audit?entity=framework&code=${fw}&limit=20`);
    const actions = r.j.map((x) => x.action);
    ok('audit log records create, update, publish, archive, unarchive with the admin name', ['create', 'update', 'publish', 'archive', 'unarchive'].every((a) => actions.includes(a)) && r.j.every((x) => x.adminName), actions.join());

    // ---- module guard: an editor without the module is refused
    const mk = await adm('POST', '/admins', { name: 'SC Guard', email: 'sc.guard@example.com', password: 'Guard#12345', role: 'Editor', modules: ['dash'] });
    const tok = (await call('', 'POST', '/auth/admin/login', { email: 'sc.guard@example.com', password: 'Guard#12345' })).j.accessToken;
    r = await call(tok, 'GET', '/scorecard/frameworks');
    ok('editor without the "sc" module is refused (403)', r.s === 403);
    await adm('PATCH', `/admins/${mk.j.id}`, { modules: ['dash', 'sc'] });
    r = await call(tok, 'GET', '/scorecard/frameworks');
    ok('after granting "sc" the same token works', r.s === 200);
    await adm('DELETE', `/admins/${mk.j.id}`);
    r = await call('', 'GET', '/scorecard/frameworks');
    ok('no token is refused (401)', r.s === 401);
  } finally {
    for (const s of made.seasons) { await adm('PUT', `/scorecard/seasons/${s}/competitions`, { competitions: [] }).catch(() => {}); await adm('DELETE', `/scorecard/seasons/${s}`).catch(() => {}); }
    // frameworks: direct delete (published ones included) for a clean local DB
    await p.scorecardFramework.deleteMany({ where: { name: { startsWith: 'QA Framework' } } });
    await p.configAuditLog.deleteMany({ where: { OR: [{ entityCode: { in: made.frameworks } }, { entity: 'season' }] } });
    console.log('cleanup:', await p.scorecardFramework.count({ where: { name: { startsWith: 'QA Framework' } } }), 'QA frameworks left;', await p.scorecardSeason.count(), 'seasons');
    await p.$disconnect();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
