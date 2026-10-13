import { ApprovedText, buildIndex } from './content-library';
import { StageReportData } from './stage-report';
import { FrameworkLevel } from './scorecard-config';
import { StageReportInput, buildStageDocument, esc, renderReportHtml } from './report-document';
import { TemplateConfig, normalizeTemplateConfig, validateTemplateConfig } from './report-template';

const levels: FrameworkLevel[] = [
  { key: 'EMERGING', label: 'Emerging', points: 1, minPercent: 0, meaning: 'Beginning.' },
  { key: 'PROFICIENT', label: 'Proficient', points: 3, minPercent: 60, meaning: 'Effective across situations.' },
  { key: 'ADVANCED', label: 'Advanced', points: 4, minPercent: 80, meaning: 'Maturity & depth.' },
];
const lv = (k: string) => levels.find((l) => l.key === k) as FrameworkLevel;

const report: StageReportData = {
  dimensions: [
    {
      dimension: 'THINK',
      label: 'THINK',
      subtitle: 'Intellectual Intelligence',
      overall: { correct: 15, total: 20, percent: 75, level: lv('PROFICIENT') },
      areas: [
        { competency: 'LR', name: 'Logical Reasoning', categories: ['LR'], correct: 8, total: 10, percent: 80, level: lv('ADVANCED'), status: 'ok' },
        { competency: 'DI', name: 'Data <Interpretation>', categories: ['DI'], correct: 7, total: 10, percent: 70, level: lv('PROFICIENT'), status: 'ok' },
        { competency: 'PR', name: 'Pattern Recognition', categories: ['PR'], correct: 1, total: 2, percent: null, level: null, status: 'not_enough_questions' },
      ],
    },
  ],
  unmapped: [],
  totals: { correct: 16, total: 22, percent: 72.7 },
  minQuestionsPerArea: 5,
};

const input = (over: Partial<StageReportInput> = {}): StageReportInput => ({
  student: { code: 'S1', name: 'Aarav Mehta', grade: 'XI', school: 'Sample Public School', gender: null },
  competition: { code: 'C1', title: 'IML 2026' },
  stage: { position: 1, name: 'Online Challenge' },
  season: { code: 'SE1', name: 'IML 2026', editionLabel: '1st Edition' },
  framework: { code: 'FW1', name: 'Framework', version: 2 },
  scale: { key: 'EDPA', name: 'IML Development Scale', levels },
  report,
  ...over,
});

const template: TemplateConfig = normalizeTemplateConfig({
  branding: { primaryColor: '#1d3557', accentColor: '#9b1c31', highlightColor: '#c28a16', stageColors: { '1': '#2d6a4f' }, levelColors: { ADVANCED: '#2d6a4f' } },
  sections: [
    { key: 'cover', type: 'cover', enabled: true, labels: { title: 'INDIA MIND LEAGUE', subtitle: 'REPORT', tagline: 'T', name: 'Student', grade: 'Grade', school: 'School', id: 'ID', edition: 'Edition' } },
    { key: 'intro', type: 'intro', enabled: true, labels: { title: 'Your profile' } },
    { key: 's1', type: 'stage_results', stage: 1, enabled: true, pageBreakBefore: true, labels: { title: 'Stage 1 — {Stage}', areasHeading: 'Areas', colArea: 'Area', colScore: 'Score', colLevel: 'Level', overall: 'OVERALL {Dimension} SCORE', notEnough: 'Not enough questions' } },
    { key: 'n1', type: 'narrative', stage: 1, enabled: true, labels: { strength: 'Your {Dimension} strengths', growth: 'Development', practice: 'Build your {Dimension}' } },
    { key: 'b1', type: 'bar_profile', stage: 1, enabled: true, labels: { title: 'Profile' } },
    { key: 's2', type: 'stage_results', stage: 2, enabled: true, labels: { title: 'Stage 2', areasHeading: 'a', colArea: 'a', colScore: 'a', colLevel: 'a', overall: 'a', notEnough: 'a' } },
    { key: 'scale', type: 'level_scale', enabled: true, labels: { title: 'Scale', colLevel: 'Level', colMeaning: 'Meaning' } },
    { key: 'hidden', type: 'mantra', enabled: false, labels: { title: 'Mantra' } },
    { key: 'note', type: 'disclaimer', enabled: true, labels: { title: 'Important note' } },
  ],
});

const item = (over: Partial<ApprovedText>): ApprovedText => ({ kind: 'mantra', key: '', levelKey: '', language: 'en', position: 0, title: null, text: 't', version: 1, ...over });

const lib = (extra: ApprovedText[] = []) =>
  buildIndex([
    item({ kind: 'report_intro', text: 'Hello {FirstName}.\n\nSecond paragraph.', version: 3 }),
    item({ kind: 'stage_intro', key: '1', title: 'Intellectual Profile', text: 'Stage 1 looks at thinking.' }),
    item({ kind: 'dimension_strength', key: 'THINK', levelKey: 'PROFICIENT', text: '{Subject} {verb:reason} well.' }),
    item({ kind: 'dimension_growth', key: 'THINK', levelKey: 'PROFICIENT', text: 'Grow here.' }),
    item({ kind: 'dimension_practice', key: 'THINK', text: 'Practise.' }),
    item({ kind: 'disclaimer', position: 1, title: 'Note', text: 'Not a diagnosis.' }),
    item({ kind: 'disclaimer', position: 2, text: 'A snapshot.' }),
    ...extra,
  ]);

const build = (idx = lib(), inp = input()) => buildStageDocument(inp, { template, index: idx, language: 'en', defaultLanguage: 'en' });

describe('buildStageDocument', () => {
  it('follows the template order, skips hidden sections and sections about another stage', () => {
    const doc = build();
    expect(doc.sections.map((s) => s.key)).toEqual(['cover', 'intro', 's1', 'n1', 'b1', 'scale', 'note']);
  });

  it('fills the cover from the student, edition and labels', () => {
    const cover = build().sections[0];
    expect(cover).toMatchObject({ type: 'cover', title: 'INDIA MIND LEAGUE' });
    if (cover.type !== 'cover') throw new Error('x');
    expect(cover.details).toEqual([
      { label: 'Student', value: 'Aarav Mehta' },
      { label: 'Grade', value: 'XI' },
      { label: 'School', value: 'Sample Public School' },
      { label: 'ID', value: 'S1' },
      { label: 'Edition', value: '1st Edition' },
    ]);
  });

  it('renders placeholders and splits paragraphs, with neutral pronouns by default', () => {
    const doc = build();
    const intro = doc.sections[1];
    if (intro.type !== 'intro') throw new Error('x');
    expect(intro.paragraphs).toEqual(['Hello Aarav.', 'Second paragraph.']);
    const narr = doc.sections.find((s) => s.type === 'narrative');
    if (!narr || narr.type !== 'narrative') throw new Error('x');
    expect(narr.dimensions[0].strength).toEqual(['They reason well.']);
    expect(narr.dimensions[0].headings?.strength).toBe('Your THINK strengths');
    const girl = build(lib(), input({ student: { ...input().student, gender: 'Female' } }));
    const n2 = girl.sections.find((s) => s.type === 'narrative');
    if (!n2 || n2.type !== 'narrative') throw new Error('x');
    expect(n2.dimensions[0].strength).toEqual(['She reasons well.']);
  });

  it('puts the stage band colour, subtitle, intro, areas and overall line together', () => {
    const s = build().sections.find((x) => x.key === 's1');
    if (!s || s.type !== 'stage_results') throw new Error('x');
    expect(s.title).toBe('Stage 1 — Online Challenge');
    expect(s.color).toBe('#2d6a4f');
    expect(s.subtitle).toBe('Intellectual Profile');
    expect(s.intro).toEqual(['Stage 1 looks at thinking.']);
    expect(s.dimensions[0].overallLabel).toBe('OVERALL THINK SCORE');
    expect(s.dimensions[0].areas.map((a) => [a.name, a.percent, a.level?.label, a.level?.color])).toEqual([
      ['Logical Reasoning', 80, 'Advanced', '#2d6a4f'],
      ['Data <Interpretation>', 70, 'Proficient', '#9b1c31'],
      ['Pattern Recognition', null, undefined, undefined],
    ]);
  });

  it('records the approved text versions it used, once each', () => {
    const doc = build();
    expect(doc.used.find((u) => u.kind === 'report_intro')?.version).toBe(3);
    expect(doc.used.filter((u) => u.kind === 'disclaimer')).toHaveLength(2);
    expect(new Set(doc.used.map((u) => JSON.stringify(u))).size).toBe(doc.used.length);
  });

  it('reports missing wording as gaps instead of inventing it, and leaves the report buildable', () => {
    const doc = build(buildIndex([item({ kind: 'report_intro', text: 'Hi.' })]));
    expect(doc.gaps).toEqual(
      expect.arrayContaining(['Stage 1 introduction', 'Strengths paragraph for THINK at Proficient', 'Development paragraph for THINK at Proficient', 'Practice paragraph for THINK at Proficient', 'Important note']),
    );
    const narr = doc.sections.find((s) => s.type === 'narrative');
    if (!narr || narr.type !== 'narrative') throw new Error('x');
    expect(narr.dimensions[0].strength).toEqual([]);
  });

  it('flags a default used in place of specific wording', () => {
    const idx = buildIndex([
      item({ kind: 'dimension_strength', key: '*', levelKey: 'PROFICIENT', text: 'General strength.' }),
      item({ kind: 'report_intro', text: 'Hi.' }),
    ]);
    const doc = build(idx);
    expect(doc.fallbacks).toContain('Strengths paragraph for THINK at Proficient: default wording used');
    expect(doc.gaps).not.toContain('Strengths paragraph for THINK at Proficient');
  });
});

describe('renderReportHtml', () => {
  const html = renderReportHtml(build(), template);

  it('escapes student and area text', () => {
    expect(html).toContain('Data &lt;Interpretation&gt;');
    expect(html).not.toContain('Data <Interpretation>');
    expect(esc('a&b"c')).toBe('a&amp;b&quot;c');
  });

  it('repeats table headings across pages and keeps rows together', () => {
    expect(html).toContain('table.grid thead { display: table-header-group; }');
    expect(html).toContain('table.grid tr { break-inside: avoid; }');
  });

  it('starts a section on a new page when the template says so', () => {
    expect(html).toContain('<section class="stage brk">');
    expect(html).not.toContain('<section class="cover brk">');
  });

  it('shows scores rounded to the configured decimals, and the not-enough text for a thin area', () => {
    expect(html).toContain('>80%<');
    expect(html).toContain('Not enough questions');
  });

  it('draws a bar per scored area only', () => {
    expect((html.match(/class="bar"/g) ?? []).length).toBe(2);
  });

  it('uses the template colours', () => {
    expect(html).toContain('background:#2d6a4f');
    expect(html).toContain('#1d3557');
  });
});

describe('validateTemplateConfig', () => {
  it('accepts a complete template', () => {
    expect(validateTemplateConfig(template)).toEqual([]);
  });

  it('asks for every label of a shown section, but not of a hidden one', () => {
    const t = normalizeTemplateConfig(template);
    t.sections[1].labels.title = '';
    t.sections[7].labels.title = '';
    const issues = validateTemplateConfig(t);
    expect(issues).toEqual(['Section 2 (Introduction): fill in "Heading".']);
  });

  it('checks colours, duplicate keys, stages and decimals', () => {
    const t = normalizeTemplateConfig(template);
    t.branding.primaryColor = 'navy';
    t.branding.stageColors['2'] = '#12';
    t.sections[2].key = 'cover';
    t.sections[2].stage = undefined;
    t.sections[4].percentDecimals = 5;
    const issues = validateTemplateConfig(t).join(' ');
    expect(issues).toMatch(/primary colour must be a hex/);
    expect(issues).toMatch(/stage 2 must be a hex/);
    expect(issues).toMatch(/key cover is used twice/);
    expect(issues).toMatch(/choose a stage/);
    expect(issues).toMatch(/0 to 2 decimals/);
  });

  it('needs at least one section shown, and only one cover', () => {
    expect(validateTemplateConfig({ sections: [] })).toContain('Add at least one section.');
    const t = normalizeTemplateConfig(template);
    t.sections.forEach((s) => (s.enabled = false));
    expect(validateTemplateConfig(t)).toContain('Show at least one section.');
    const two = normalizeTemplateConfig(template);
    two.sections.push({ ...two.sections[0], key: 'cover2' });
    expect(validateTemplateConfig(two)).toContain('A report has one cover.');
  });
});
