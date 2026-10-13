import { FrameworkConfig, standardEdpaScale } from './scorecard-config';
import { StageEvidence } from './level-engine';
import { RollupRules, buildFinalProfile, normalizeRollup, validateRollup } from './rollup-rules';

const scale = standardEdpaScale();
const config: FrameworkConfig = {
  dimensions: ['THINK', 'FEEL', 'CONNECT', 'LEAD'].map((k) => ({ key: k, label: k })),
  scales: [scale],
  defaultScale: 'EDPA',
  competencies: [],
};

const L = { E: 'EMERGING', D: 'DEVELOPING', P: 'PROFICIENT', A: 'ADVANCED' } as const;
const lv = (dimension: string, competency: string, level: keyof typeof L): { dimension: string; competency: string; level: string } => ({ dimension, competency, level: L[level] });

// The client's sample student (Aarav Mehta): the levels printed on every stage page of the sample report.
const sample: StageEvidence[] = [
  { stage: 1, status: 'complete', items: [{ dimension: 'THINK', competency: 'LOGICAL_REASONING', percent: 85 }, { dimension: 'THINK', competency: 'DATA_INTERPRETATION', percent: 70 }, { dimension: 'THINK', competency: 'PATTERN_RECOGNITION', percent: 80 }, { dimension: 'THINK', competency: 'INDIA_AWARENESS', percent: 65 }] },
  { stage: 2, status: 'complete', items: [lv('THINK', 'CRITICAL_THINKING', 'A'), lv('FEEL', 'EMOTIONAL_AWARENESS', 'P'), lv('CONNECT', 'PERSPECTIVE_TAKING', 'P'), lv('LEAD', 'ETHICAL_JUDGMENT', 'A'), lv('CONNECT', 'COMMUNICATION', 'P'), lv('LEAD', 'DECISION_MAKING', 'A'), lv('LEAD', 'RESPONSIBILITY', 'A'), lv('LEAD', 'LEADERSHIP', 'P')] },
  { stage: 3, status: 'complete', items: [lv('FEEL', 'SELF_AWARENESS', 'P'), lv('FEEL', 'EMOTIONAL_REGULATION', 'D'), lv('CONNECT', 'EMPATHY', 'P'), lv('CONNECT', 'LISTENING', 'P'), lv('CONNECT', 'COLLABORATION', 'A'), lv('THINK', 'PROBLEM_SOLVING', 'A'), lv('LEAD', 'ETHICAL_JUDGMENT', 'A'), lv('LEAD', 'INITIATIVE', 'A'), lv('LEAD', 'ADAPTABILITY', 'P'), lv('LEAD', 'ACCOUNTABILITY', 'A'), lv('CONNECT', 'COMMUNICATION', 'P'), lv('LEAD', 'LEADERSHIP', 'A')] },
  { stage: 4, status: 'complete', items: [lv('THINK', 'UNDERSTANDING_COMPLEXITY', 'A'), lv('THINK', 'CRITICAL_THINKING', 'A'), lv('FEEL', 'EMOTIONAL_MATURITY', 'P'), lv('CONNECT', 'EMPATHY', 'P'), lv('LEAD', 'ETHICAL_JUDGMENT', 'A'), lv('CONNECT', 'COMMUNICATION', 'A'), lv('LEAD', 'DECISION_MAKING', 'A'), lv('FEEL', 'CONFIDENCE_UNDER_PRESSURE', 'P'), lv('LEAD', 'RESPONSIBILITY', 'A'), lv('LEAD', 'LEADERSHIP', 'A')] },
];

const rules: RollupRules = normalizeRollup({
  styles: [
    { key: 'THOUGHTFUL_INITIATOR', name: 'The Thoughtful Initiator', conditions: [{ dimension: 'THINK', atLeast: 'ADVANCED' }, { dimension: 'LEAD', atLeast: 'ADVANCED' }] },
    { key: 'CONNECTOR', name: 'The Connector', conditions: [{ dimension: 'CONNECT', rank: 'highest' }] },
  ],
  fallbackStyle: 'DEVELOPING_LEADER',
  profileLines: [{ position: 1, conditions: [{ dimension: 'THINK', atLeast: 'ADVANCED' }] }],
  fallbackProfileLine: 2,
});
rules.styles.push({ key: 'DEVELOPING_LEADER', name: 'The Developing Leader', conditions: [{ dimension: 'LEAD', atMost: 'DEVELOPING' }] });

describe('the client sample student', () => {
  const p = buildFinalProfile(config, scale, rules, sample);
  it('gets the sample\'s final level in every dimension', () => {
    expect(p.dimensions.map((d) => [d.key, d.level?.label])).toEqual([['THINK', 'Advanced'], ['FEEL', 'Proficient'], ['CONNECT', 'Proficient'], ['LEAD', 'Advanced']]);
  });
  it('and the sample\'s overall level, with the moving-towards suffix', () => {
    expect(p.overall.level?.label).toBe('Proficient');
    expect(p.overall.movingTowards?.label).toBe('Advanced');
    expect(p.overall.label).toBe('PROFICIENT – MOVING TOWARDS ADVANCED');
    expect(p.provisional).toBe(false);
  });
  it('matches the leadership style rule', () => {
    expect(p.style).toEqual({ key: 'THOUGHTFUL_INITIATOR', name: 'The Thoughtful Initiator', reason: 'matched' });
    expect(p.profileLine).toEqual({ position: 1, reason: 'matched' });
  });
  it('lists five strengths from the highest averages and three growth areas from the lowest, no overlap', () => {
    expect(p.strengths).toHaveLength(5);
    expect(p.strengths.every((s) => s.level?.label === 'Advanced')).toBe(true);
    expect(p.growth.map((g) => g.competency)).toEqual(['EMOTIONAL_REGULATION', 'ADAPTABILITY', 'CONFIDENCE_UNDER_PRESSURE']);
    expect(p.growth[0].level?.label).toBe('Developing');
    expect(new Set([...p.strengths, ...p.growth].map((c) => c.competency)).size).toBe(8);
  });
  it('is reproducible', () => {
    expect(buildFinalProfile(config, scale, rules, sample)).toEqual(p);
  });
});

describe('weights and mappings are configuration', () => {
  it('stage weights change the result without code', () => {
    const heavy = normalizeRollup({ stageWeights: { '1': 1, '2': 1, '3': 1, '4': 10 } });
    const p = buildFinalProfile(config, scale, heavy, sample);
    expect(p.dimensions.find((d) => d.key === 'FEEL')?.average).toBeCloseTo((3 + 2.5 + 3 * 10) / 12, 5);
  });
  it('a competency can be mapped to another dimension', () => {
    const map = normalizeRollup({ competencyMap: { COMMUNICATION: 'LEAD' } });
    const p = buildFinalProfile(config, scale, map, sample);
    // Communication now counts for LEAD, so CONNECT is Perspective Taking; Empathy, Listening, Collaboration; Empathy
    expect(p.dimensions.find((d) => d.key === 'CONNECT')?.average).toBeCloseTo((3 + 10 / 3 + 3) / 3, 5);
  });
  it('a dimension weight changes the overall level', () => {
    const w = normalizeRollup({ dimensionWeights: { FEEL: 6 } });
    const p = buildFinalProfile(config, scale, w, sample);
    expect(p.overall.level?.label).toBe('Proficient');
    expect(p.overall.movingTowards).toBeNull();
  });
});

describe('partial and unclear evidence', () => {
  it('a pending stage stays out and makes the profile provisional; a stage never reached just does not count', () => {
    const partial: StageEvidence[] = [sample[0], { stage: 2, status: 'pending', items: sample[1].items }, { stage: 3, status: 'not_reached', items: [] }];
    const p = buildFinalProfile(config, scale, rules, partial);
    expect(p.provisional).toBe(true);
    expect(p.stagesPending).toEqual([2]);
    expect(p.stagesNotReached).toEqual([3]);
    expect(p.dimensions.find((d) => d.key === 'THINK')?.level?.label).toBe('Advanced');
    expect(p.dimensions.find((d) => d.key === 'FEEL')?.level).toBeNull();
  });
  it('fewer strengths and growth areas are listed when there is not enough evidence, never padded', () => {
    const tiny: StageEvidence[] = [{ stage: 1, status: 'complete', items: [lv('THINK', 'A1', 'A'), lv('THINK', 'A2', 'D')] }];
    const p = buildFinalProfile(config, scale, rules, tiny);
    expect(p.strengths.map((s) => s.competency)).toEqual(['A1', 'A2']);
    expect(p.growth).toEqual([]);
  });
  it('unclear evidence uses the fallback style, never a guess', () => {
    const none: StageEvidence[] = [{ stage: 1, status: 'complete', items: [lv('FEEL', 'X', 'P')] }];
    const p = buildFinalProfile(config, scale, rules, none);
    expect(p.style).toEqual({ key: 'DEVELOPING_LEADER', name: 'The Developing Leader', reason: 'fallback' });
    expect(p.profileLine).toEqual({ position: 2, reason: 'fallback' });
  });
  it('strength and growth limits by level', () => {
    const limited = normalizeRollup({ strengthMinLevel: 'ADVANCED', growthMaxLevel: 'DEVELOPING' });
    const p = buildFinalProfile(config, scale, limited, sample);
    expect(p.strengths.every((s) => s.level?.key === 'ADVANCED')).toBe(true);
    expect(p.growth.every((g) => (g.level?.points ?? 9) <= 2)).toBe(true);
    expect(p.growth.map((g) => g.competency)).toEqual(['EMOTIONAL_REGULATION']);
  });
  it('no stage evidence at all gives no overall level', () => {
    const p = buildFinalProfile(config, scale, rules, []);
    expect(p.overall.level).toBeNull();
    expect(p.overall.label).toBe('');
  });
});

describe('validateRollup', () => {
  it('accepts a good rule set and no rule set', () => {
    expect(validateRollup(undefined, config)).toEqual([]);
    expect(validateRollup(rules, config)).toEqual([]);
  });
  it('finds mistakes in plain words', () => {
    const bad = {
      stageWeights: { x: 1, '2': 0 },
      dimensionWeights: { NOPE: 2 },
      competencyMap: { A: 'NOPE' },
      strengthMinLevel: 'GREAT',
      styles: [{ key: 'S', name: 'S', conditions: [] }, { key: 'S', name: 'S2', conditions: [{ dimension: 'NOPE', atLeast: 'WRONG' }] }],
      fallbackStyle: 'MISSING',
    };
    const issues = validateRollup(bad, config).join(' | ');
    expect(issues).toMatch(/Stage weight "x"/);
    expect(issues).toMatch(/Stage weight "2"/);
    expect(issues).toMatch(/NOPE" is not a dimension of this framework/);
    expect(issues).toMatch(/mapped to "NOPE"/);
    expect(issues).toMatch(/"GREAT" is not a level/);
    expect(issues).toMatch(/used twice/);
    expect(issues).toMatch(/would match everyone/);
    expect(issues).toMatch(/fallback style "MISSING"/);
  });
  it('asks for a fallback when styles exist', () => {
    expect(validateRollup({ styles: [{ key: 'S', name: 'S', conditions: [{ dimension: 'THINK', atLeast: 'ADVANCED' }] }] }, config)).toContain('Choose a fallback style for students whose evidence matches no style.');
  });
});
