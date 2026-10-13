// #72: content library API (run with the API on :3000 after `npm run seed:scorecard-content`)
const { ROOT } = require('./guard.js');
const B = process.env.QA_API || 'http://localhost:3000/api/v1';
const call = async (tok, m, path, body, raw) => {
  const r = await fetch(B + path, { method: m, headers: { 'Content-Type': 'application/json', Connection: 'close', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (raw) return r;
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const msg = (r) => (Array.isArray(r.j.message) ? r.j.message.join(' ') : String(r.j.message || ''));

(async () => {
  const AT = (await call('', 'POST', '/auth/admin/login', { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD })).j.accessToken;
  const a = (m, path, b) => call(AT, m, path, b);
  const C = '/scorecard/content';

  const meta = (await a('GET', C + '/meta')).j;
  ok('meta lists the kinds and placeholders', meta.kinds.length >= 17 && meta.placeholders.some((p) => p.token === 'Name') && meta.wildcard === '*');

  const libs = (await a('GET', C + '/libraries')).j;
  const seeded = libs.find((l) => /sample wording/.test(l.name));
  ok('seeded sample library exists with drafts only', !!seeded && seeded.counts.total === 44 && seeded.counts.approved === 0 && seeded.counts.draft === 44, JSON.stringify(seeded && seeded.counts));

  // ---- library CRUD and languages
  let r = await a('POST', C + '/libraries', { name: 'QA library', languages: ['en', 'hi'], defaultLanguage: 'en' });
  ok('create a library', r.s === 201 && /^CL\d+$/.test(r.j.code) && r.j.languages.join() === 'en,hi', JSON.stringify(r.j).slice(0, 80));
  const L = r.j.code;
  r = await a('POST', C + '/libraries', { name: 'Bad lang', languages: ['en', 'English!'] });
  ok('a bad language code is refused', r.s === 400 && /language code/.test(msg(r)), msg(r));
  r = await a('POST', C + '/libraries', { name: 'Bad default', languages: ['en'], defaultLanguage: 'hi' });
  ok('default language must be in the list', r.s === 400 && /default language/i.test(msg(r)));

  // ---- saving texts and validation
  const save = (b) => a('PUT', `${C}/libraries/${L}/texts`, b);
  r = await save({ kind: 'strength', key: 'empathy', levelKey: 'advanced', title: 'Empathy', text: '{Name} shows deep care for others.' });
  ok('save a strength; key and level are upper-cased; it starts as a draft', r.s === 200 && r.j.key === 'EMPATHY' && r.j.levelKey === 'ADVANCED' && r.j.state === 'draft', JSON.stringify(r.j).slice(0, 100));
  const tid = r.j.id;
  r = await save({ kind: 'strength', key: 'EMPATHY', levelKey: 'ADVANCED', title: 'Empathy', text: 'Edited wording.' });
  ok('saving the same address updates the same item', r.s === 200 && r.j.id === tid && r.j.text === 'Edited wording.');
  r = await save({ kind: 'nonsense', text: 'x' });
  ok('unknown kind refused', r.s === 400 && /not a kind/.test(msg(r)));
  r = await save({ kind: 'mantra', key: 'THINK', text: 'x' });
  ok('a key on a kind with none is refused', r.s === 400 && /leave the key empty/.test(msg(r)), msg(r));
  r = await save({ kind: 'strength', text: 'x', levelKey: 'ADVANCED' });
  ok('a competency kind needs a key', r.s === 400 && /needs a competency/.test(msg(r)), msg(r));
  r = await save({ kind: 'mantra', levelKey: 'ADVANCED', text: 'x' });
  ok('a level on a kind that is not by level is refused', r.s === 400 && /not written by level/.test(msg(r)), msg(r));
  r = await save({ kind: 'reflection', text: 'Q?' });
  ok('a list item needs a position', r.s === 400 && /position/.test(msg(r)), msg(r));
  r = await save({ kind: 'mantra', title: 'Hello', text: 'x' });
  ok('a title on an untitled kind is refused', r.s === 400 && /no title/.test(msg(r)));
  r = await save({ kind: 'mantra', text: 'Hello {Nme}' });
  ok('a mistyped placeholder is refused with its name', r.s === 400 && /\{Nme\}/.test(msg(r)), msg(r));
  r = await save({ kind: 'mantra', text: 'Hello {Name', language: 'en' });
  ok('a stray brace is refused', r.s === 400 && /stray/.test(msg(r)), msg(r));
  r = await save({ kind: 'mantra', text: 'Namaste', language: 'fr' });
  ok('a language not in the library is refused', r.s === 400 && /not a language of this library/.test(msg(r)), msg(r));
  r = await save({ kind: 'mantra', text: '   ' });
  ok('empty text refused', r.s === 400);

  // ---- approval flow
  r = await a('POST', `${C}/libraries/${L}/texts/${tid}/approve`, { note: 'first sign-off' });
  ok('approve: version 1, state approved', r.s === 201 && r.j.state === 'approved' && r.j.approvedVersion === 1 && r.j.approvedText === 'Edited wording.' && /Arjun|admin/i.test(r.j.approvedByName || 'admin'), JSON.stringify(r.j).slice(0, 140));
  r = await a('POST', `${C}/libraries/${L}/texts/${tid}/approve`, {});
  ok('approving unchanged wording is refused', r.s === 400 && /Nothing has changed/.test(msg(r)));
  r = await save({ kind: 'strength', key: 'EMPATHY', levelKey: 'ADVANCED', title: 'Empathy', text: 'A second draft.' });
  ok('editing an approved text leaves the approved version alone ("changed")', r.j.state === 'changed' && r.j.approvedText === 'Edited wording.' && r.j.text === 'A second draft.');
  let pv = (await a('POST', `${C}/libraries/${L}/preview`, { kind: 'strength', key: 'EMPATHY', level: 'ADVANCED' })).j;
  ok('reports (approved only) still read the approved wording', pv.item && pv.item.text === 'Edited wording.' && pv.source === 'exact' && pv.approvedOnly === true, JSON.stringify(pv).slice(0, 100));
  pv = (await a('POST', `${C}/libraries/${L}/preview`, { kind: 'strength', key: 'EMPATHY', level: 'ADVANCED', draft: true })).j;
  ok('preview of drafts shows the draft', pv.item && pv.item.text === 'A second draft.');
  r = await a('POST', `${C}/libraries/${L}/texts/${tid}/approve`, { note: 'v2' });
  ok('approve again makes version 2', r.j.approvedVersion === 2 && r.j.state === 'approved');
  const vs = (await a('GET', `${C}/libraries/${L}/texts/${tid}/versions`)).j;
  ok('version history keeps both, newest first, only the latest is live', vs.length === 2 && vs[0].version === 2 && vs[0].live && !vs[1].live && vs[1].text === 'Edited wording.' && vs[1].note === 'first sign-off', JSON.stringify(vs.map((v) => [v.version, v.live])));

  r = await save({ kind: 'strength', key: 'EMPATHY', levelKey: 'ADVANCED', title: 'Empathy', text: 'Unapproved experiment.' });
  r = await a('POST', `${C}/libraries/${L}/texts/${tid}/revert`, {});
  ok('revert puts the approved wording back as the draft', r.j.text === 'A second draft.' && r.j.state === 'approved');
  r = await a('DELETE', `${C}/libraries/${L}/texts/${tid}`);
  ok('an approved-before text cannot be deleted', r.s === 400 && /kept for the record/.test(msg(r)), msg(r));
  r = await a('POST', `${C}/libraries/${L}/texts/${tid}/withdraw`, {});
  ok('withdraw: state withdrawn, reports stop using it', r.s === 201 && r.j.state === 'withdrawn' && r.j.approvedVersion === null, JSON.stringify(r.j).slice(0, 90));
  pv = (await a('POST', `${C}/libraries/${L}/preview`, { kind: 'strength', key: 'EMPATHY', level: 'ADVANCED' })).j;
  ok('after withdrawal the report sees it as missing', pv.source === 'missing' && pv.item === null && /gap/.test(pv.note));
  r = await a('POST', `${C}/libraries/${L}/texts/${tid}/approve`, { note: 'back' });
  ok('approving again after a withdrawal continues the numbering (version 3)', r.j.approvedVersion === 3, String(r.j.approvedVersion));

  // ---- never-approved text can be deleted
  r = await save({ kind: 'mantra', text: 'Scratch' });
  const del = await a('DELETE', `${C}/libraries/${L}/texts/${r.j.id}`);
  ok('a never-approved draft can be deleted', del.s === 200);

  // ---- defaults and fallbacks
  await save({ kind: 'strength', key: '*', levelKey: 'ADVANCED', text: 'Default for any competency at Advanced.' });
  await save({ kind: 'strength', key: 'LISTENING', levelKey: 'ADVANCED', language: 'en', title: 'Listening', text: 'Listens well.' });
  r = await a('POST', `${C}/libraries/${L}/texts/approve-all`, { note: 'bulk' });
  ok('approve-all approves everything changed or new', r.s === 201 && r.j.approved === 2, JSON.stringify(r.j));
  r = await a('POST', `${C}/libraries/${L}/texts/approve-all`, {});
  ok('approve-all again does nothing', r.j.approved === 0);
  pv = (await a('POST', `${C}/libraries/${L}/preview`, { kind: 'strength', key: 'COLLABORATION', level: 'ADVANCED' })).j;
  ok('a competency with no text falls back to the default and says so', pv.source === 'default' && /default wording/i.test(pv.note) && pv.item.text.startsWith('Default for any'), JSON.stringify(pv).slice(0, 120));
  pv = (await a('POST', `${C}/libraries/${L}/preview`, { kind: 'strength', key: 'LISTENING', level: 'ADVANCED', language: 'hi' })).j;
  ok('a language with no text falls back to the default language and says so', pv.source === 'language_fallback' && /Not written in hi/.test(pv.note) && pv.item.text === 'Listens well.', JSON.stringify(pv).slice(0, 140));

  // ---- placeholders and pronouns
  await save({ kind: 'dimension_note', key: 'THINK', levelKey: 'ADVANCED', text: '{FirstName} is in {Dimension} at {Level}. {Subject} {verb:demonstrate} focus and trust {reflexive}.' });
  await a('POST', `${C}/libraries/${L}/texts/approve-all`, { kind: 'dimension_note' });
  const sample = { kind: 'dimension_note', key: 'THINK', level: 'ADVANCED', name: 'Aarav Mehta', dimension: 'THINK', levelLabel: 'Advanced' };
  pv = (await a('POST', `${C}/libraries/${L}/preview`, sample)).j;
  ok('neutral pronouns by default', pv.item.text === 'Aarav is in THINK at Advanced. They demonstrate focus and trust themself.', pv.item && pv.item.text);
  pv = (await a('POST', `${C}/libraries/${L}/preview`, { ...sample, gender: 'Female' })).j;
  ok('recorded gender is used when set', pv.item.text === 'Aarav is in THINK at Advanced. She demonstrates focus and trust herself.', pv.item && pv.item.text);
  pv = (await a('POST', `${C}/libraries/${L}/preview`, { kind: 'dimension_note', key: 'THINK', level: 'ADVANCED' })).j;
  ok('a placeholder with no sample value is reported as missing', pv.item.missing.join() === 'Dimension,Level', pv.item.missing.join());
  r = await a('POST', C + '/preview-template', { text: 'Hi {Name}, {Subject} {verb:be} ready {Oops}', name: 'Sam' });
  ok('the editor can preview unsaved text and sees the problems', r.s === 201 && r.j.problems.length === 1 && /Oops/.test(r.j.problems[0]) && r.j.text.startsWith('Hi Sam, They are ready'), JSON.stringify(r.j).slice(0, 120));

  // ---- lists
  await save({ kind: 'reflection', position: 2, text: 'Second?' });
  await save({ kind: 'reflection', position: 1, text: 'First?' });
  await a('POST', `${C}/libraries/${L}/texts/approve-all`, { kind: 'reflection' });
  pv = (await a('POST', `${C}/libraries/${L}/preview`, { kind: 'reflection' })).j;
  ok('a list comes back in order', pv.items && pv.items.map((i) => i.text).join('|') === 'First?|Second?', JSON.stringify(pv.items));

  // ---- CSV export / import
  const exp = await call(AT, 'GET', `${C}/libraries/${L}/export`, null, true);
  const csv = await exp.text();
  ok('export is a CSV with headings and the wording', exp.status === 200 && /^﻿?kind,key,level,language,position,title,text/.test(csv) && /Listens well\./.test(csv), csv.slice(0, 60));
  const bad = 'kind,key,level,language,position,title,text\nmantra,,,,,,Fine\nstrength,empathy,,,,,No level is fine\nstrength,,ADVANCED,,,,Missing key\nreflection,,,,,,No position\nmantra,,,,,,Duplicate of row 2\nstrength,x y,ADVANCED,,,,bad key\n';
  r = await a('POST', `${C}/libraries/${L}/import`, { csv: bad, dryRun: true });
  ok('dry run reports each bad row and saves nothing', r.s === 201 && r.j.errors.length === 4 && r.j.errors.map((e) => e.row).join() === '4,5,6,7' && r.j.created === 2, JSON.stringify(r.j.errors));
  r = await a('POST', `${C}/libraries/${L}/import`, { csv: bad });
  ok('a real import with errors saves nothing', r.s === 400 && /Nothing was imported/.test(msg(r)));
  const before = (await a('GET', `${C}/libraries/${L}/texts?kind=mantra`)).j.total;
  ok('(nothing was saved)', before === 0, String(before));
  const good = 'kind,key,level,language,position,title,text\nmantra,,,,,,"Think wisely, feel deeply."\nstrength,LISTENING,ADVANCED,,,Listening,Listens well.\nstrength,LISTENING,PROFICIENT,en,,Listening,"Listens, mostly."\n';
  r = await a('POST', `${C}/libraries/${L}/import`, { csv: good });
  ok('import creates new drafts, leaves unchanged ones alone', r.s === 201 && r.j.created === 2 && r.j.updated === 0 && r.j.unchanged === 1, JSON.stringify(r.j));
  const m = (await a('GET', `${C}/libraries/${L}/texts?kind=mantra`)).j.items[0];
  ok('imported text is a draft, never auto-approved, commas inside quotes kept', m.state === 'draft' && m.text === 'Think wisely, feel deeply.', JSON.stringify(m).slice(0, 100));

  // ---- list filters
  const byState = (await a('GET', `${C}/libraries/${L}/texts?state=draft`)).j;
  ok('filter by state', byState.items.length > 0 && byState.items.every((i) => i.state === 'draft'));
  const found = (await a('GET', `${C}/libraries/${L}/texts?search=listens`)).j;
  ok('search finds wording', found.total >= 2);

  // ---- coverage against the sample framework
  const fw = (await a('GET', '/scorecard/frameworks')).j.find((f) => /client sample/.test(f.name));
  r = await a('GET', `${C}/libraries/${seeded.code}/coverage?framework=${fw.code}`);
  const cov = r.j;
  const strengthCov = cov.kinds.find((k) => k.kind === 'dimension_note');
  ok('coverage: 4 dimensions x 4 levels for dimension notes, 4 drafted and 12 missing', r.s === 200 && strengthCov.cells.length === 16 && strengthCov.draft === 4 && strengthCov.missing === 12 && strengthCov.approved === 0, JSON.stringify([strengthCov.cells.length, strengthCov.draft, strengthCov.missing]));
  const mantraCov = cov.kinds.find((k) => k.kind === 'mantra');
  ok('coverage: one-off kinds count once', mantraCov.cells.length === 1 && mantraCov.draft === 1);
  const consentCov = cov.kinds.find((k) => k.kind === 'consent');
  ok('coverage: consent has no wording at all (honest gap)', consentCov.missing === 1);
  const chal = cov.kinds.find((k) => k.kind === 'challenge');
  ok('coverage: challenge covers each dimension', chal.cells.length === 4 && chal.draft === 4);
  r = await a('GET', `${C}/libraries/${L}/coverage?framework=${fw.code}`);
  const sc = r.j.kinds.find((k) => k.kind === 'strength');
  ok('coverage: a wildcard default counts as "default"', sc.defaulted > 0 && sc.approved >= 1, JSON.stringify([sc.approved, sc.defaulted, sc.missing]));
  r = await a('GET', `${C}/libraries/${L}/coverage?framework=NOPE`);
  ok('coverage: unknown framework 404', r.s === 404);

  // ---- language settings
  r = await a('PATCH', `${C}/libraries/${L}`, { languages: ['en'], defaultLanguage: 'en' });
  ok('a language with no wording can be removed', r.s === 200 && r.j.languages.join() === 'en');
  r = await a('PATCH', `${C}/libraries/${L}`, { languages: ['hi'], defaultLanguage: 'hi' });
  ok('a language that has wording cannot be removed', r.s === 400 && /Delete it before/.test(msg(r)), msg(r));
  r = await a('PATCH', `${C}/libraries/${L}`, { languages: ['en', 'hi'] });
  ok('add a language', r.j.languages.join() === 'en,hi');

  // ---- season link
  const seasons = (await a('GET', '/scorecard/seasons')).j;
  let season = seasons[0];
  let qaFw = null;
  if (!season) {
    const src = (await a('GET', '/scorecard/frameworks')).j.find((x) => /client sample/.test(x.name));
    qaFw = (await a('POST', '/scorecard/frameworks', { name: 'QA temp framework', cloneFrom: src.code })).j;
    await a('POST', '/scorecard/frameworks/' + qaFw.code + '/publish');
    season = (await a('POST', '/scorecard/seasons', { name: 'QA season', editionLabel: 'QA', frameworkCode: qaFw.code })).j;
  }
  if (season && season.code) {
    r = await a('PATCH', `/scorecard/seasons/${season.code}`, { libraryCode: L });
    ok('a season can use a library', r.s === 200 && r.j.library && r.j.library.code === L, JSON.stringify(r.j.library));
    r = await a('DELETE', `${C}/libraries/${L}`);
    ok('a library a season uses cannot be deleted', r.s === 400 && /season uses/.test(msg(r)), msg(r));
    r = await a('PATCH', `/scorecard/seasons/${season.code}`, { libraryCode: 'CL999' });
    ok('an unknown library code is refused', r.s === 400 && /does not exist/.test(msg(r)));
    r = await a('PATCH', `/scorecard/seasons/${season.code}`, { libraryCode: '' });
    ok('the link can be cleared', r.s === 200 && r.j.library === null);
    if (qaFw) {
      await a('DELETE', '/scorecard/seasons/' + season.code);
      await a('POST', '/scorecard/frameworks/' + qaFw.code + '/archive');
      const { PrismaClient } = require(ROOT + 'node_modules/@prisma/client');
      const pc = new PrismaClient();
      await pc.scorecardFramework.deleteMany({ where: { code: qaFw.code } });
      await pc.$disconnect();
    }
  } else console.log('SKIP season link');

  // ---- clone
  r = await a('POST', C + '/libraries', { name: 'QA clone', cloneFrom: L });
  const cloned = r.j;
  ok('a clone copies the wording as unapproved drafts', r.s === 201 && cloned.counts.total > 5 && cloned.counts.approved === 0 && cloned.languages.join() === 'en', JSON.stringify(cloned.counts));

  // ---- audit
  const audit = (await a('GET', `/scorecard/audit?entity=library&code=${L}`)).j;
  const actions = new Set((audit.items || audit).map((x) => x.action));
  ok('the audit log records create, save, approve, withdraw, import', ['create', 'text_create', 'text_approve', 'text_withdraw', 'bulk_approve', 'import'].every((x) => actions.has(x)), [...actions].join());

  // ---- cleanup
  for (const code of [cloned.code, L]) {
    r = await a('DELETE', `${C}/libraries/${code}`);
    ok('delete QA library ' + code, r.s === 200);
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
