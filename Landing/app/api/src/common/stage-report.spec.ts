import { AnsweredQuestion, buildAutoScoredStageReport } from './stage-report';
import { FrameworkConfig, standardEdpaScale, validateFrameworkConfig } from './scorecard-config';
import { SAMPLE_CONFIG } from '../scorecard/future-readiness.seed';

const EDPA = standardEdpaScale();
const config = (): FrameworkConfig => structuredClone(SAMPLE_CONFIG);

/** `correct` right answers out of `total` served in a category. */
const area = (category: string, correct: number, total: number): AnsweredQuestion[] =>
  Array.from({ length: total }, (_, i) => ({ category, isCorrect: i < correct }));

describe('buildAutoScoredStageReport: the client sample (Stage 1 THINK)', () => {
  // 20 questions per area makes the sample's 85 / 70 / 80 / 65 percentages possible.
  const answers = [...area('LR', 17, 20), ...area('DI', 14, 20), ...area('PR', 16, 20), ...area('GK', 13, 20)];

  it('gives each area its exact percentage and level', () => {
    const r = buildAutoScoredStageReport(config(), EDPA, 1, answers);
    const think = r.dimensions.find((d) => d.dimension === 'THINK')!;
    expect(think.areas.map((a) => [a.name, a.percent, a.level?.label])).toEqual([
      ['Logical Reasoning', 85, 'Advanced'],
      ['Data Interpretation', 70, 'Proficient'],
      ['Pattern Recognition', 80, 'Advanced'],
      ['India Awareness', 65, 'Proficient'],
    ]);
  });

  it('gives the overall THINK score: 75%, Proficient', () => {
    const think = buildAutoScoredStageReport(config(), EDPA, 1, answers).dimensions[0];
    expect(think.overall).toMatchObject({ correct: 60, total: 80, percent: 75 });
    expect(think.overall?.level?.label).toBe('Proficient');
  });

  it('only reports dimensions that have auto-scored areas', () => {
    const r = buildAutoScoredStageReport(config(), EDPA, 1, answers);
    expect(r.dimensions.map((d) => d.dimension)).toEqual(['THINK']);
    expect(r.totals).toEqual({ correct: 60, total: 80, percent: 75 });
    expect(r.unmapped).toEqual([]);
  });
});

describe('buildAutoScoredStageReport: rules', () => {
  it('counts an unanswered or wrong question as wrong (it is in the denominator)', () => {
    const answers: AnsweredQuestion[] = [
      ...area('LR', 5, 10),
      ...Array.from({ length: 5 }, () => ({ category: 'LR', isCorrect: null })), // never answered
    ];
    const lr = buildAutoScoredStageReport(config(), EDPA, 1, answers).dimensions[0].areas[0];
    expect(lr).toMatchObject({ correct: 5, total: 15 });
    expect(lr.percent).toBeCloseTo(33.333, 2);
    expect(lr.level?.label).toBe('Emerging');
  });

  it('keeps the exact percentage: 79.9% stays Proficient', () => {
    const cfg = config();
    cfg.autoScore = { minQuestionsPerArea: 5 };
    const r = buildAutoScoredStageReport(cfg, EDPA, 1, area('LR', 799, 1000));
    expect(r.dimensions[0].areas[0].percent).toBeCloseTo(79.9, 5);
    expect(r.dimensions[0].areas[0].level?.label).toBe('Proficient');
  });

  it('shows "not enough questions" below the minimum instead of a misleading percentage', () => {
    const answers = [...area('LR', 3, 4), ...area('DI', 8, 10)];
    const t = buildAutoScoredStageReport(config(), EDPA, 1, answers).dimensions[0];
    const lr = t.areas.find((a) => a.competency === 'LOGICAL_REASONING')!;
    expect(lr).toMatchObject({ status: 'not_enough_questions', total: 4, percent: null, level: null });
    // the overall uses only the areas that have enough questions
    expect(t.overall).toMatchObject({ correct: 8, total: 10, percent: 80 });
    expect(t.areas.find((a) => a.competency === 'PATTERN_RECOGNITION')?.status).toBe('no_questions');
  });

  it('the minimum is configurable', () => {
    const cfg = config();
    cfg.autoScore = { minQuestionsPerArea: 3 };
    const lr = buildAutoScoredStageReport(cfg, EDPA, 1, area('LR', 3, 4)).dimensions[0].areas[0];
    expect(lr.status).toBe('ok');
    expect(lr.percent).toBe(75);
  });

  it('has no overall when no area has enough questions', () => {
    const t = buildAutoScoredStageReport(config(), EDPA, 1, area('LR', 1, 2)).dimensions[0];
    expect(t.overall).toBeNull();
  });

  it('reports categories that nothing maps to, so a gap in the mapping is visible', () => {
    const r = buildAutoScoredStageReport(config(), EDPA, 1, [...area('LR', 4, 5), ...area('IQ', 2, 6), ...area('Values', 1, 3)]);
    expect(r.unmapped).toEqual([
      { category: 'IQ', correct: 2, total: 6 },
      { category: 'Values', correct: 1, total: 3 },
    ]);
    expect(r.totals.total).toBe(14); // still counted in the stage total
  });

  it('answers without a category are ignored by the areas but kept in the totals', () => {
    const r = buildAutoScoredStageReport(config(), EDPA, 1, [...area('LR', 5, 5), { category: null, isCorrect: true }]);
    expect(r.dimensions[0].areas[0].total).toBe(5);
    expect(r.totals.total).toBe(6);
    expect(r.unmapped).toEqual([]);
  });

  it('uses the name the stage gives a competency', () => {
    const cfg = config();
    cfg.competencies.find((c) => c.key === 'INDIA_AWARENESS')!.stageNames = { '1': 'India Awareness (Stage 1)' };
    const names = buildAutoScoredStageReport(cfg, EDPA, 1, area('GK', 5, 5)).dimensions[0].areas.map((a) => a.name);
    expect(names).toContain('India Awareness (Stage 1)');
    expect(buildAutoScoredStageReport(cfg, EDPA, 2, area('GK', 5, 5)).dimensions[0].areas.map((a) => a.name)).toContain('India Awareness');
  });

  it('one competency can be fed by several categories', () => {
    const cfg = config();
    cfg.competencies.find((c) => c.key === 'LOGICAL_REASONING')!.examCategories = ['LR', 'IQ'];
    const lr = buildAutoScoredStageReport(cfg, EDPA, 1, [...area('LR', 3, 5), ...area('IQ', 5, 5)]).dimensions[0].areas[0];
    expect(lr).toMatchObject({ correct: 8, total: 10, percent: 80 });
  });

  it('works with any dimension, categories and scale', () => {
    const cfg: FrameworkConfig = {
      dimensions: [{ key: 'ALPHA', label: 'Alpha' }],
      scales: [{ key: 'S', name: 'S', levels: [{ key: 'LO', label: 'Lo', points: 1, minPercent: 0, meaning: '' }, { key: 'HI', label: 'Hi', points: 2, minPercent: 50, meaning: '' }] }],
      defaultScale: 'S',
      autoScore: { minQuestionsPerArea: 1 },
      competencies: [{ key: 'ZED', name: 'Zed', dimension: 'ALPHA', weight: 1, stageNames: {}, examCategories: ['ZZ'] }],
    };
    const r = buildAutoScoredStageReport(cfg, cfg.scales[0], 1, area('ZZ', 3, 4));
    expect(r.dimensions[0].areas[0]).toMatchObject({ percent: 75 });
    expect(r.dimensions[0].areas[0].level?.label).toBe('Hi');
  });
});

describe('framework validation of the Stage 1 settings', () => {
  it('the seeded sample has no issues', () => {
    expect(validateFrameworkConfig(SAMPLE_CONFIG)).toEqual([]);
  });

  it('a category can feed only one competency', () => {
    const cfg = config();
    cfg.competencies.find((c) => c.key === 'DATA_INTERPRETATION')!.examCategories = ['LR'];
    expect(validateFrameworkConfig(cfg).join(' ')).toMatch(/"LR" feeds both/);
  });

  it('validates category text and the minimum', () => {
    const cfg = config();
    cfg.competencies[0].examCategories = [' ', 'A'.repeat(21)];
    cfg.autoScore = { minQuestionsPerArea: 0 };
    const issues = validateFrameworkConfig(cfg).join(' ');
    expect(issues).toMatch(/1-20 characters/);
    expect(issues).toMatch(/minimum questions per area/);
  });
});
