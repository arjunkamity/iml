import {
  DEFAULT_ID_PATTERN,
  FrameworkConfig,
  formatImlId,
  standardEdpaScale,
  validateFrameworkConfig,
  validateIdPattern,
} from './scorecard-config';

const good = (): FrameworkConfig => ({
  dimensions: [
    { key: 'THINK', label: 'THINK', subtitle: 'Intellectual Intelligence' },
    { key: 'FEEL', label: 'FEEL' },
  ],
  scales: [standardEdpaScale()],
  defaultScale: 'EDPA',
  competencies: [
    { key: 'CRITICAL_THINKING', name: 'Critical Thinking', dimension: 'THINK', weight: 1, stageNames: { '4': 'Critical Reasoning' } },
    { key: 'EMOTIONAL_AWARENESS', name: 'Emotional Awareness', dimension: 'FEEL', weight: 1, stageNames: {} },
  ],
});

describe('validateFrameworkConfig', () => {
  it('accepts a sound framework', () => {
    expect(validateFrameworkConfig(good())).toEqual([]);
  });

  it('needs dimensions and scales', () => {
    const issues = validateFrameworkConfig({}).join(' ');
    expect(issues).toMatch(/at least one dimension/);
    expect(issues).toMatch(/at least one level scale/);
  });

  it('rejects bad or repeated keys and missing labels', () => {
    const c = good();
    c.dimensions.push({ key: 'think', label: '' });
    c.dimensions.push({ key: 'FEEL', label: 'Again' });
    const issues = validateFrameworkConfig(c).join(' ');
    expect(issues).toMatch(/2-20 capital letters/);
    expect(issues).toMatch(/a label is required/);
    expect(issues).toMatch(/FEEL is used twice/);
  });

  describe('level scale', () => {
    it('needs at least two levels and a lowest level that starts at 0%', () => {
      const c = good();
      c.scales[0].levels = [c.scales[0].levels[1]];
      expect(validateFrameworkConfig(c).join(' ')).toMatch(/at least two levels/);
      const d = good();
      d.scales[0].levels[0].minPercent = 5;
      expect(validateFrameworkConfig(d).join(' ')).toMatch(/must start at 0%/);
    });

    it('needs cut-offs that rise with the level', () => {
      const c = good();
      c.scales[0].levels[2].minPercent = 40; // Proficient = Developing
      expect(validateFrameworkConfig(c).join(' ')).toMatch(/"Proficient" must start at a higher percentage than "Developing"/);
    });

    it('rejects repeated points', () => {
      const c = good();
      c.scales[0].levels[3].points = 3;
      expect(validateFrameworkConfig(c).join(' ')).toMatch(/same points/);
    });

    it('needs the roll-up average on every level or none, rising with the level', () => {
      const some = good();
      delete some.scales[0].levels[1].minAverage;
      expect(validateFrameworkConfig(some).join(' ')).toMatch(/for every level, or for none/);
      const none = good();
      none.scales[0].levels.forEach((l) => delete l.minAverage);
      expect(validateFrameworkConfig(none)).toEqual([]);
      const flat = good();
      flat.scales[0].levels[3].minAverage = 2.5;
      expect(validateFrameworkConfig(flat).join(' ')).toMatch(/roll-up average for "Advanced" must be higher/);
    });

    it('needs a default scale that exists', () => {
      const c = good();
      c.defaultScale = 'NOPE';
      expect(validateFrameworkConfig(c).join(' ')).toMatch(/default scale "NOPE" does not exist/);
      c.defaultScale = '';
      expect(validateFrameworkConfig(c).join(' ')).toMatch(/Choose the default scale/);
    });
  });

  describe('competencies', () => {
    it('must belong to a real dimension and have a sensible weight', () => {
      const c = good();
      c.competencies[0].dimension = 'LEAD';
      c.competencies[1].weight = 0;
      const issues = validateFrameworkConfig(c).join(' ');
      expect(issues).toMatch(/choose which dimension/);
      expect(issues).toMatch(/weight must be more than 0/);
    });

    it('keeps names unambiguous: default names and per-stage names', () => {
      const c = good();
      c.competencies.push({ key: 'DUP', name: 'critical thinking', dimension: 'THINK', weight: 1, stageNames: {} });
      expect(validateFrameworkConfig(c).join(' ')).toMatch(/already called/);
      const d = good();
      d.competencies.push({ key: 'OTHER', name: 'Other', dimension: 'FEEL', weight: 1, stageNames: { '4': 'critical reasoning' } });
      expect(validateFrameworkConfig(d).join(' ')).toMatch(/already used in stage 4/);
    });

    it('validates stage numbers and empty stage names', () => {
      const c = good();
      c.competencies[0].stageNames = { '0': 'x', abc: 'y', '2': ' ' };
      const issues = validateFrameworkConfig(c).join(' ');
      expect(issues).toMatch(/"0" is not a valid stage number/);
      expect(issues).toMatch(/"abc" is not a valid stage number/);
      expect(issues).toMatch(/stage 2 name is empty/);
    });

    it('flags a dimension nothing is mapped to', () => {
      const c = good();
      c.dimensions.push({ key: 'LEAD', label: 'LEAD' });
      expect(validateFrameworkConfig(c).join(' ')).toMatch(/Dimension LEAD has no competencies/);
    });
  });
});

describe('IML display ID pattern', () => {
  it('formats the sample ID', () => {
    expect(formatImlId(DEFAULT_ID_PATTERN, { year: 2026, seq: 124 })).toBe('IML-2026-00124');
  });

  it('supports short year, season and any number width', () => {
    expect(formatImlId('{SEASON}/{YY}/{###}', { year: 2027, seq: 7, season: 'S2' })).toBe('S2/27/007');
    expect(formatImlId('IML{######}', { year: 2026, seq: 1234567 })).toBe('IML1234567');
  });

  it('accepts good patterns and rejects bad ones', () => {
    expect(validateIdPattern(DEFAULT_ID_PATTERN)).toEqual([]);
    expect(validateIdPattern('')).toHaveLength(1);
    expect(validateIdPattern('IML-{YYYY}').join(' ')).toMatch(/exactly one running number/);
    expect(validateIdPattern('IML-{#####}-{####}').join(' ')).toMatch(/exactly one running number/);
    expect(validateIdPattern('IML-{FOO}-{#####}').join(' ')).toMatch(/Only \{YYYY\}/);
    expect(validateIdPattern('IML*{#####}').join(' ')).toMatch(/letters, digits/);
  });
});
