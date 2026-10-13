import { SAMPLE_CONFIG } from '../scorecard/future-readiness.seed';
import {
  EvidenceItem,
  StageEvidence,
  levelForAverage,
  levelForPercent,
  movingTowards,
  overallLabel,
  percentOf,
  rollUpProfile,
} from './level-engine';
import { FrameworkScale, standardEdpaScale } from './scorecard-config';

const EDPA = standardEdpaScale();
const DIMS = ['THINK', 'FEEL', 'CONNECT', 'LEAD'];

describe('levelForPercent', () => {
  const key = (p: number | null) => levelForPercent(EDPA, p)?.key ?? null;

  it('uses the scale cut-offs, at and either side of every boundary', () => {
    expect(key(0)).toBe('EMERGING');
    expect(key(39.99)).toBe('EMERGING');
    expect(key(40)).toBe('DEVELOPING');
    expect(key(59.99)).toBe('DEVELOPING');
    expect(key(60)).toBe('PROFICIENT');
    expect(key(79.99)).toBe('PROFICIENT');
    expect(key(80)).toBe('ADVANCED');
    expect(key(100)).toBe('ADVANCED');
  });

  it('judges the exact score: 79.9% is not promoted by display rounding', () => {
    expect(Math.round(79.9)).toBe(80); // what a rounded display would show
    expect(key(79.9)).toBe('PROFICIENT');
    expect(key(79.999999)).toBe('PROFICIENT');
  });

  it('absorbs float noise on an exact boundary', () => {
    expect(key(0.8 * 100)).toBe('ADVANCED'); // 80.00000000000001
    expect(key(0.6 * 100)).toBe('PROFICIENT');
    expect(key(percentOf(8, 10))).toBe('ADVANCED');
    expect(key(percentOf(7, 10))).toBe('PROFICIENT');
  });

  it('caps above 100 and gives no level for missing or negative values', () => {
    expect(key(140)).toBe('ADVANCED');
    expect(key(-1)).toBeNull();
    expect(key(null)).toBeNull();
    expect(key(Number.NaN)).toBeNull();
  });

  it('percentOf handles no questions', () => {
    expect(percentOf(3, 0)).toBeNull();
    expect(percentOf(3, 4)).toBe(75);
    expect(percentOf(51, 80)).toBe(63.75); // not 63.74999999999999
    expect(percentOf(7, 10)).toBe(70);
  });

  it('works for any scale, not just EDPA (nothing is hard-coded)', () => {
    const three: FrameworkScale = {
      key: 'TRIPLE',
      name: 'Three levels',
      levels: [
        { key: 'LOW', label: 'Low', points: 1, minPercent: 0, meaning: '' },
        { key: 'MID', label: 'Mid', points: 2, minPercent: 33.3, meaning: '' },
        { key: 'HIGH', label: 'High', points: 3, minPercent: 66.6, meaning: '' },
      ],
    };
    expect(levelForPercent(three, 33.2)?.key).toBe('LOW');
    expect(levelForPercent(three, 33.3)?.key).toBe('MID');
    expect(levelForPercent(three, 90)?.key).toBe('HIGH');
  });
});

describe('levelForAverage and movingTowards', () => {
  const key = (a: number) => levelForAverage(EDPA, a)?.key ?? null;

  it('uses the roll-up cut-offs', () => {
    expect(key(1)).toBe('EMERGING');
    expect(key(1.74)).toBe('EMERGING');
    expect(key(1.75)).toBe('DEVELOPING');
    expect(key(2.49)).toBe('DEVELOPING');
    expect(key(2.5)).toBe('PROFICIENT');
    expect(key(3.49)).toBe('PROFICIENT');
    expect(key(3.5)).toBe('ADVANCED');
    expect(key(4)).toBe('ADVANCED');
  });

  it('falls back to the midpoints between levels when the scale has no roll-up cut-offs', () => {
    const plain = standardEdpaScale();
    plain.levels.forEach((l) => delete l.minAverage);
    expect(levelForAverage(plain, 1.4)?.key).toBe('EMERGING');
    expect(levelForAverage(plain, 1.5)?.key).toBe('DEVELOPING');
    expect(levelForAverage(plain, 3.5)?.key).toBe('ADVANCED');
  });

  it('flags an average just below the next level (margin 0.25)', () => {
    const towards = (a: number) => movingTowards(EDPA, a)?.key ?? null;
    expect(towards(3.45)).toBe('ADVANCED');
    expect(towards(3.25)).toBe('ADVANCED'); // exactly the margin
    expect(towards(3.24)).toBeNull();
    expect(towards(3.5)).toBeNull(); // already Advanced
    expect(towards(4)).toBeNull(); // the top level moves towards nothing
    expect(towards(2.3)).toBe('PROFICIENT'); // Developing, within 0.25 of 2.5
  });

  it('is off when the scale has no margin', () => {
    const none = standardEdpaScale();
    delete none.movingTowardsMargin;
    expect(movingTowards(none, 3.45)).toBeNull();
    none.movingTowardsMargin = 0;
    expect(movingTowards(none, 3.45)).toBeNull();
  });

  it('words the overall level like the sample', () => {
    expect(overallLabel(levelForAverage(EDPA, 3.45), movingTowards(EDPA, 3.45))).toBe('Proficient – moving towards Advanced');
    expect(overallLabel(levelForAverage(EDPA, 3.8), movingTowards(EDPA, 3.8))).toBe('Advanced');
    expect(overallLabel(null, null)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// The client's sample report (Aarav Mehta). Competencies are mapped to dimensions
// by the proposed library in future-readiness.seed.ts; stage 1 is the overall THINK
// percentage (75%).
// ---------------------------------------------------------------------------
const dimensionOf = new Map(SAMPLE_CONFIG.competencies.map((c) => [c.key, c.dimension]));
const rated = (rows: [string, string][]): EvidenceItem[] =>
  rows.map(([competency, level]) => ({ competency, level, dimension: dimensionOf.get(competency) as string }));

const sampleStages = (): StageEvidence[] => [
  { stage: 1, status: 'complete', items: [{ dimension: 'THINK', competency: 'THINK overall', percent: 75 }] },
  {
    stage: 2,
    status: 'complete',
    items: rated([
      ['CRITICAL_THINKING', 'ADVANCED'], ['EMOTIONAL_AWARENESS', 'PROFICIENT'], ['PERSPECTIVE_TAKING', 'PROFICIENT'], ['ETHICAL_JUDGMENT', 'ADVANCED'],
      ['COMMUNICATION', 'PROFICIENT'], ['DECISION_MAKING', 'ADVANCED'], ['RESPONSIBILITY', 'ADVANCED'], ['LEADERSHIP', 'PROFICIENT'],
    ]),
  },
  {
    stage: 3,
    status: 'complete',
    items: rated([
      ['SELF_AWARENESS', 'PROFICIENT'], ['EMOTIONAL_REGULATION', 'DEVELOPING'], ['EMPATHY', 'PROFICIENT'], ['LISTENING', 'PROFICIENT'],
      ['COLLABORATION', 'ADVANCED'], ['PROBLEM_SOLVING', 'ADVANCED'], ['ETHICAL_JUDGMENT', 'ADVANCED'], ['INITIATIVE', 'ADVANCED'],
      ['ADAPTABILITY', 'PROFICIENT'], ['ACCOUNTABILITY', 'ADVANCED'], ['COMMUNICATION', 'PROFICIENT'], ['LEADERSHIP', 'ADVANCED'],
    ]),
  },
  {
    stage: 4,
    status: 'complete',
    items: rated([
      ['UNDERSTANDING_COMPLEXITY', 'ADVANCED'], ['CRITICAL_THINKING', 'ADVANCED'], ['EMOTIONAL_MATURITY', 'PROFICIENT'], ['EMPATHY', 'PROFICIENT'],
      ['ETHICAL_JUDGMENT', 'ADVANCED'], ['COMMUNICATION', 'ADVANCED'], ['DECISION_MAKING', 'ADVANCED'], ['CONFIDENCE_UNDER_PRESSURE', 'PROFICIENT'],
      ['RESPONSIBILITY', 'ADVANCED'], ['LEADERSHIP', 'ADVANCED'],
    ]),
  },
];

const levelsOf = (r: ReturnType<typeof rollUpProfile>) => Object.fromEntries(r.dimensions.map((d) => [d.dimension, d.level?.label]));

describe('rollUpProfile: the client sample report', () => {
  it('reproduces the final level of every dimension and the overall wording', () => {
    const r = rollUpProfile(EDPA, DIMS, sampleStages());
    // THINK Advanced, FEEL Proficient, CONNECT Proficient, LEAD Advanced (sample page 1 and 6)
    expect(levelsOf(r)).toEqual({ THINK: 'Advanced', FEEL: 'Proficient', CONNECT: 'Proficient', LEAD: 'Advanced' });
    expect(r.overall.status).toBe('ok');
    expect(overallLabel(r.overall.level, r.overall.movingTowards)).toBe('Proficient – moving towards Advanced');
    expect(r.provisional).toBe(false);
    expect(r.issues).toEqual([]);
    expect(r.stagesUsed).toEqual([1, 2, 3, 4]);
  });

  it('gives the averages behind those levels', () => {
    const r = rollUpProfile(EDPA, DIMS, sampleStages());
    const avg = Object.fromEntries(r.dimensions.map((d) => [d.dimension, Number((d.average as number).toFixed(3))]));
    expect(avg).toEqual({ THINK: 3.75, FEEL: 2.833, CONNECT: 3.25, LEAD: 3.85 });
    expect(Number((r.overall.average as number).toFixed(2))).toBe(3.42);
  });

  it('also holds when stage 1 is given as its four areas instead of the overall percent', () => {
    const stages = sampleStages();
    stages[0].items = [85, 70, 80, 65].map((percent) => ({ dimension: 'THINK', percent })); // LR, DI, PR, India Awareness
    const r = rollUpProfile(EDPA, DIMS, stages);
    expect(levelsOf(r)).toEqual({ THINK: 'Advanced', FEEL: 'Proficient', CONNECT: 'Proficient', LEAD: 'Advanced' });
  });

  it('changing the stage weights changes the result (stage 1 counts ten times as much)', () => {
    const r = rollUpProfile(EDPA, DIMS, sampleStages(), { stageWeights: { 1: 10 } });
    expect(r.dimensions.find((d) => d.dimension === 'THINK')?.level?.label).toBe('Proficient');
  });

  it('changing the dimension weights changes the overall value', () => {
    const base = rollUpProfile(EDPA, DIMS, sampleStages()).overall.average as number;
    const leadHeavy = rollUpProfile(EDPA, DIMS, sampleStages(), { dimensionWeights: { LEAD: 5 } }).overall.average as number;
    expect(leadHeavy).toBeGreaterThan(base);
    expect(rollUpProfile(EDPA, DIMS, sampleStages(), { dimensionWeights: { LEAD: 5 } }).overall.level?.label).toBe('Advanced');
  });

  it('competency weights count within a stage', () => {
    const stages: StageEvidence[] = [
      { stage: 1, status: 'complete', items: [{ dimension: 'THINK', level: 'EMERGING', weight: 1 }, { dimension: 'THINK', level: 'ADVANCED', weight: 3 }] },
    ];
    const r = rollUpProfile(EDPA, ['THINK'], stages);
    expect(r.dimensions[0].average).toBe(3.25); // (1*1 + 4*3) / 4
  });
});

describe('rollUpProfile: partial evidence', () => {
  it('leaves a pending stage out, marks the profile provisional, and never counts it as zero', () => {
    const stages = sampleStages();
    stages[3].status = 'pending';
    const r = rollUpProfile(EDPA, DIMS, stages);
    expect(r.provisional).toBe(true);
    expect(r.stagesPending).toEqual([4]);
    expect(r.stagesUsed).toEqual([1, 2, 3]);
    // With stage 4 left out, THINK is the mean of 3, 4, 4 (not dragged down by an empty stage)
    expect(r.dimensions.find((d) => d.dimension === 'THINK')?.average).toBeCloseTo(3.6667, 3);
  });

  it('a stage the student never reached is simply absent: not provisional, not zero', () => {
    const stages = sampleStages();
    stages[2].status = 'not_reached';
    stages[2].items = [];
    stages[3].status = 'not_reached';
    stages[3].items = [];
    const r = rollUpProfile(EDPA, DIMS, stages);
    expect(r.provisional).toBe(false);
    expect(r.stagesNotReached).toEqual([3, 4]);
    expect(r.dimensions.find((d) => d.dimension === 'THINK')?.average).toBeCloseTo(3.5, 5); // stages 1 and 2 only
  });

  it('a dimension with no evidence gets no level, and the overall uses the rest', () => {
    const stages: StageEvidence[] = [{ stage: 1, status: 'complete', items: [{ dimension: 'THINK', percent: 90 }] }];
    const r = rollUpProfile(EDPA, DIMS, stages);
    expect(r.dimensions.map((d) => d.status)).toEqual(['ok', 'no_evidence', 'no_evidence', 'no_evidence']);
    expect(r.overall.level?.label).toBe('Advanced');
    expect(r.overall.dimensionsUsed).toBe(1);
  });

  it('enforces the minimum evidence rules', () => {
    const stages: StageEvidence[] = [{ stage: 1, status: 'complete', items: [{ dimension: 'THINK', percent: 90 }, { dimension: 'FEEL', level: 'PROFICIENT' }, { dimension: 'FEEL', level: 'ADVANCED' }] }];
    const perDim = rollUpProfile(EDPA, DIMS, stages, { minItemsPerDimension: 2 });
    expect(perDim.dimensions.map((d) => d.status)).toEqual(['insufficient', 'ok', 'no_evidence', 'no_evidence']);
    expect(perDim.dimensions[0].level).toBeNull();
    const overall = rollUpProfile(EDPA, DIMS, stages, { minDimensionsForOverall: 3 }); // only THINK and FEEL have evidence
    expect(overall.overall.status).toBe('insufficient');
    expect(overall.overall.level).toBeNull();
  });

  it('no evidence at all gives no overall level', () => {
    const r = rollUpProfile(EDPA, DIMS, []);
    expect(r.overall.status).toBe('no_evidence');
    expect(r.overall.level).toBeNull();
    expect(r.provisional).toBe(false);
  });

  it('reports unusable evidence in plain words and carries on with the rest', () => {
    const stages: StageEvidence[] = [
      {
        stage: 2,
        status: 'complete',
        items: [
          { dimension: 'THINK', competency: 'Critical Thinking', level: 'WRONG' },
          { dimension: 'THINK', competency: 'Problem Solving', percent: -5 },
          { dimension: 'THINK', competency: 'Reasoning' },
          { dimension: 'THINK', competency: 'Pattern', level: 'PROFICIENT' },
        ],
      },
    ];
    const r = rollUpProfile(EDPA, ['THINK'], stages);
    expect(r.issues).toHaveLength(3);
    expect(r.issues.join(' ')).toMatch(/"WRONG" is not a level/);
    expect(r.issues.join(' ')).toMatch(/not a valid percentage/);
    expect(r.issues.join(' ')).toMatch(/no level or percentage/);
    expect(r.dimensions[0].level?.label).toBe('Proficient');
    expect(r.dimensions[0].items).toBe(1);
  });
});

describe('rollUpProfile: nothing is hard-coded', () => {
  it('works with other dimensions, another scale and a fifth stage', () => {
    const scale: FrameworkScale = {
      key: 'TRIPLE',
      name: 'Three levels',
      movingTowardsMargin: 0.2,
      levels: [
        { key: 'LOW', label: 'Low', points: 1, minPercent: 0, minAverage: 1, meaning: '' },
        { key: 'MID', label: 'Mid', points: 2, minPercent: 33, minAverage: 1.6, meaning: '' },
        { key: 'HIGH', label: 'High', points: 3, minPercent: 66, minAverage: 2.4, meaning: '' },
      ],
    };
    const stages: StageEvidence[] = [
      { stage: 1, status: 'complete', items: [{ dimension: 'ALPHA', percent: 70 }, { dimension: 'BETA', percent: 10 }] },
      { stage: 5, status: 'complete', items: [{ dimension: 'ALPHA', level: 'MID' }, { dimension: 'BETA', level: 'MID' }] },
    ];
    const r = rollUpProfile(scale, ['ALPHA', 'BETA'], stages);
    expect(r.dimensions.map((d) => [d.dimension, d.level?.label, d.average])).toEqual([
      ['ALPHA', 'High', 2.5],
      ['BETA', 'Low', 1.5],
    ]);
    expect(r.stagesUsed).toEqual([1, 5]);
    expect(r.overall.average).toBe(2); // (2.5 + 1.5) / 2
    expect(r.overall.level?.label).toBe('Mid');
    expect(r.overall.movingTowards).toBeNull(); // High starts at 2.4; 2.4 - 2.0 = 0.4 is beyond the 0.2 margin
  });
});
