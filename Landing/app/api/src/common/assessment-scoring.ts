// Pure scoring for Assessments (see the Assessment model). No DB, no
// framework: a student's chosen options are turned into one score and one
// band per capacity. There is deliberately NO overall score — the source
// Mind Capacity Check explicitly has none, and the result copy says so.

export interface AssessmentBand {
  label: string;
  min: number;
  max: number;
  summary: string;
}

export interface AssessmentDimension {
  key: string; // matches Question.category, e.g. THINK
  label: string;
  intro: string;
  practice: string; // 7-day practice tip, shown for the lowest-scoring capacity
  bands: AssessmentBand[];
}

export interface AssessmentConfig {
  dimensions: AssessmentDimension[];
  consent: string;
  disclaimer: string;
  howScored: string;
}

export interface ScorableQuestion {
  id: number;
  category: string; // dimension key
  options: unknown[];
  optionPoints: unknown; // parallel to options (number per option)
}

export interface DimensionScore {
  key: string;
  score: number;
  max: number;
  band: string;
}

export interface ScoredAnswer {
  questionId: number;
  optionIndex: number;
  points: number;
}

export interface ScoreResult {
  answers: ScoredAnswer[];
  scores: Record<string, DimensionScore>;
  strongest: string[]; // dimension keys tied for the highest score
  practiceFor: string[]; // dimension keys tied for the lowest score
}

export class AssessmentAnswerError extends Error {}

function pointsOf(q: ScorableQuestion): number[] {
  const pts = Array.isArray(q.optionPoints) ? q.optionPoints.map((p) => Number(p)) : [];
  return q.options.map((_, i) => (Number.isFinite(pts[i]) ? pts[i] : 0));
}

export function bandFor(dimension: AssessmentDimension, score: number): AssessmentBand | null {
  return dimension.bands.find((b) => score >= b.min && score <= b.max) ?? null;
}

/**
 * Scores one submission. Every question must be answered exactly once with a
 * valid option index — a partial or tampered submission is rejected rather
 * than scored, so a stored result is always a complete one.
 */
export function scoreAssessment(
  config: AssessmentConfig,
  questions: ScorableQuestion[],
  answers: { questionId: number; optionIndex: number }[],
): ScoreResult {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const given = new Map<number, number>();
  for (const a of answers) {
    if (!byId.has(a.questionId)) throw new AssessmentAnswerError('An answer refers to a question that is not part of this assessment.');
    if (given.has(a.questionId)) throw new AssessmentAnswerError('A question was answered more than once.');
    given.set(a.questionId, a.optionIndex);
  }
  if (given.size !== questions.length) {
    throw new AssessmentAnswerError(`Please answer every scenario (${given.size} of ${questions.length} answered).`);
  }

  const scored: ScoredAnswer[] = [];
  const totals = new Map<string, { score: number; max: number }>();
  for (const q of questions) {
    const idx = given.get(q.id)!;
    if (!Number.isInteger(idx) || idx < 0 || idx >= q.options.length) {
      throw new AssessmentAnswerError('An answer is not a valid option for its scenario.');
    }
    const pts = pointsOf(q);
    scored.push({ questionId: q.id, optionIndex: idx, points: pts[idx] });
    const t = totals.get(q.category) ?? { score: 0, max: 0 };
    t.score += pts[idx];
    t.max += Math.max(...pts, 0);
    totals.set(q.category, t);
  }

  const scores: Record<string, DimensionScore> = {};
  for (const d of config.dimensions) {
    const t = totals.get(d.key) ?? { score: 0, max: 0 };
    scores[d.key] = { key: d.key, score: t.score, max: t.max, band: bandFor(d, t.score)?.label ?? '' };
  }
  const present = config.dimensions.map((d) => scores[d.key]).filter((s) => s.max > 0);
  const hi = Math.max(...present.map((s) => s.score));
  const lo = Math.min(...present.map((s) => s.score));
  return {
    answers: scored,
    scores,
    strongest: present.filter((s) => s.score === hi).map((s) => s.key),
    practiceFor: present.filter((s) => s.score === lo).map((s) => s.key),
  };
}
