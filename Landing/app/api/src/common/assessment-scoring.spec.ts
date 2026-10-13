import { AssessmentAnswerError, bandFor, scoreAssessment, ScorableQuestion } from './assessment-scoring';
import { MIND_CAPACITY_CHECK_CONFIG, MIND_CAPACITY_CHECK_ITEM_COUNT } from '../assessments/mind-capacity-check.seed';

const cfg = MIND_CAPACITY_CHECK_CONFIG;
const DIMS = ['THINK', 'FEEL', 'CONNECT', 'LEAD'];

// 4 questions per capacity, options worth 1-4 points, interleaved like the real one.
function makeQuestions(): ScorableQuestion[] {
  const qs: ScorableQuestion[] = [];
  let id = 1;
  for (let round = 0; round < 4; round++) {
    for (const category of DIMS) qs.push({ id: id++, category, options: ['a', 'b', 'c', 'd'], optionPoints: [1, 2, 3, 4] });
  }
  return qs;
}

// Answer every question with the option worth `pointsFor(category, nth)` (1-4).
function answersFor(qs: ScorableQuestion[], pointsFor: (category: string, nth: number) => number) {
  const seen: Record<string, number> = {};
  return qs.map((q) => {
    const nth = (seen[q.category] = (seen[q.category] ?? 0) + 1);
    return { questionId: q.id, optionIndex: pointsFor(q.category, nth) - 1 };
  });
}

describe('scoreAssessment', () => {
  const qs = makeQuestions();

  it('scores a perfect run: 16 per capacity, Advanced, all tied strongest', () => {
    const r = scoreAssessment(cfg, qs, answersFor(qs, () => 4));
    for (const d of DIMS) expect(r.scores[d]).toEqual({ key: d, score: 16, max: 16, band: 'Advanced' });
    expect(r.strongest.sort()).toEqual([...DIMS].sort());
  });

  it('scores the lowest run: 4 per capacity, Emerging', () => {
    const r = scoreAssessment(cfg, qs, answersFor(qs, () => 1));
    for (const d of DIMS) expect(r.scores[d]).toEqual({ key: d, score: 4, max: 16, band: 'Emerging' });
  });

  it.each([
    // [target score for THINK, expected band] — every boundary of 4-7 / 8-10 / 11-13 / 14-16
    [4, 'Emerging'],
    [7, 'Emerging'],
    [8, 'Developing'],
    [10, 'Developing'],
    [11, 'Proficient'],
    [13, 'Proficient'],
    [14, 'Advanced'],
    [16, 'Advanced'],
  ])('THINK total %i falls in band %s', (target, band) => {
    // distribute `target` across 4 questions, each 1..4
    const plan: Record<number, number[]> = {
      4: [1, 1, 1, 1], 7: [1, 2, 2, 2], 8: [2, 2, 2, 2], 10: [2, 2, 3, 3],
      11: [2, 3, 3, 3], 13: [3, 3, 3, 4], 14: [3, 3, 4, 4], 16: [4, 4, 4, 4],
    };
    const r = scoreAssessment(cfg, qs, answersFor(qs, (c, nth) => (c === 'THINK' ? plan[target][nth - 1] : 1)));
    expect(r.scores.THINK.score).toBe(target);
    expect(r.scores.THINK.band).toBe(band);
  });

  it('finds the strongest capacity and the capacity to practise (single and tied)', () => {
    const r = scoreAssessment(cfg, qs, answersFor(qs, (c) => ({ THINK: 4, FEEL: 2, CONNECT: 3, LEAD: 2 } as Record<string, number>)[c]));
    expect(r.strongest).toEqual(['THINK']);
    expect(r.practiceFor.sort()).toEqual(['FEEL', 'LEAD']);
  });

  it('has no overall score field', () => {
    const r = scoreAssessment(cfg, qs, answersFor(qs, () => 3));
    expect(Object.keys(r).sort()).toEqual(['answers', 'practiceFor', 'scores', 'strongest']);
  });

  it('records each answer with the points it earned', () => {
    const r = scoreAssessment(cfg, qs, answersFor(qs, () => 2));
    expect(r.answers).toHaveLength(16);
    expect(r.answers.every((a) => a.points === 2 && a.optionIndex === 1)).toBe(true);
  });

  describe('rejects bad submissions instead of scoring them', () => {
    it('a missing answer', () => {
      const a = answersFor(qs, () => 3).slice(1);
      expect(() => scoreAssessment(cfg, qs, a)).toThrow(AssessmentAnswerError);
    });
    it('a duplicated answer', () => {
      const a = answersFor(qs, () => 3);
      a[1] = { ...a[0] };
      expect(() => scoreAssessment(cfg, qs, a)).toThrow(AssessmentAnswerError);
    });
    it('a question that is not part of the assessment', () => {
      const a = answersFor(qs, () => 3);
      a[0] = { questionId: 9999, optionIndex: 0 };
      expect(() => scoreAssessment(cfg, qs, a)).toThrow(AssessmentAnswerError);
    });
    it.each([-1, 4, 99, 1.5])('an invalid option index %p', (bad) => {
      const a = answersFor(qs, () => 3);
      a[0] = { questionId: a[0].questionId, optionIndex: bad };
      expect(() => scoreAssessment(cfg, qs, a)).toThrow(AssessmentAnswerError);
    });
  });
});

describe('bandFor', () => {
  it('returns null outside every band', () => {
    expect(bandFor(cfg.dimensions[0], 99)).toBeNull();
  });
});

describe('Mind Capacity Check content', () => {
  it('has 16 scenarios and four capacities each with the four client bands', () => {
    expect(MIND_CAPACITY_CHECK_ITEM_COUNT).toBe(16);
    expect(cfg.dimensions.map((d) => d.key)).toEqual(DIMS);
    for (const d of cfg.dimensions) {
      expect(d.bands.map((b) => [b.label, b.min, b.max])).toEqual([
        ['Emerging', 4, 7],
        ['Developing', 8, 10],
        ['Proficient', 11, 13],
        ['Advanced', 14, 16],
      ]);
    }
  });
});
