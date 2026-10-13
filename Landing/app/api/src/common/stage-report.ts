import { levelForPercent, percentOf } from './level-engine';
import { DEFAULT_MIN_QUESTIONS_PER_AREA, FrameworkConfig, FrameworkLevel, FrameworkScale } from './scorecard-config';

// Per-area scores for an auto-scored (exam) stage, such as Stage 1 in the client's
// sample report: each question category is scored into a competency ("area") of the
// framework, each area gets a percentage and a level, and each dimension gets an
// overall percentage and level. Pure and DB-free; areas, dimensions, categories,
// levels and the minimum number of questions all come from configuration (#69),
// the levels from the scale (#70). See #71.

/** One served question's result. Unanswered and timed-out questions arrive as not correct. */
export interface AnsweredQuestion {
  /** The category saved on the answer at submit time (see AttemptAnswer.category). */
  category: string | null;
  isCorrect: boolean | null;
}

export type AreaStatus = 'ok' | 'not_enough_questions' | 'no_questions';

export interface AreaResult {
  competency: string;
  /** The competency's name as this stage calls it. */
  name: string;
  categories: string[];
  correct: number;
  total: number;
  /** Exact, not rounded. Null unless the area has enough questions. */
  percent: number | null;
  level: FrameworkLevel | null;
  status: AreaStatus;
}

export interface DimensionResult {
  dimension: string;
  label: string;
  subtitle?: string;
  /** Pooled over the dimension's areas that have enough questions; null if none do. */
  overall: { correct: number; total: number; percent: number; level: FrameworkLevel | null } | null;
  areas: AreaResult[];
}

export interface StageReportData {
  dimensions: DimensionResult[];
  /** Categories in the answers that no competency is mapped to; a sign the mapping is incomplete. */
  unmapped: { category: string; correct: number; total: number }[];
  /** Everything the student was served in this stage, mapped or not. */
  totals: { correct: number; total: number; percent: number | null };
  minQuestionsPerArea: number;
}

const tally = (rows: AnsweredQuestion[]) => ({
  correct: rows.filter((r) => r.isCorrect === true).length,
  total: rows.length,
});

export function buildAutoScoredStageReport(
  config: FrameworkConfig,
  scale: FrameworkScale,
  stagePosition: number,
  answers: AnsweredQuestion[],
): StageReportData {
  const min = config.autoScore?.minQuestionsPerArea ?? DEFAULT_MIN_QUESTIONS_PER_AREA;
  const mappedCategories = new Set<string>();

  const dimensions: DimensionResult[] = [];
  for (const dim of config.dimensions) {
    const areas: AreaResult[] = [];
    for (const comp of config.competencies.filter((c) => c.dimension === dim.key && (c.examCategories?.length ?? 0) > 0)) {
      const categories = (comp.examCategories ?? []).map((x) => x.trim());
      categories.forEach((x) => mappedCategories.add(x));
      const { correct, total } = tally(answers.filter((a) => a.category !== null && categories.includes(a.category.trim())));
      const status: AreaStatus = total === 0 ? 'no_questions' : total < min ? 'not_enough_questions' : 'ok';
      const percent = status === 'ok' ? percentOf(correct, total) : null;
      areas.push({
        competency: comp.key,
        name: comp.stageNames?.[String(stagePosition)] || comp.name,
        categories,
        correct,
        total,
        percent,
        level: levelForPercent(scale, percent),
        status,
      });
    }
    if (!areas.length) continue;
    const usable = areas.filter((a) => a.status === 'ok');
    const correct = usable.reduce((n, a) => n + a.correct, 0);
    const total = usable.reduce((n, a) => n + a.total, 0);
    const percent = percentOf(correct, total);
    dimensions.push({
      dimension: dim.key,
      label: dim.label,
      subtitle: dim.subtitle,
      overall: percent === null ? null : { correct, total, percent, level: levelForPercent(scale, percent) },
      areas,
    });
  }

  const byCategory = new Map<string, AnsweredQuestion[]>();
  for (const a of answers) {
    const key = (a.category ?? '').trim();
    if (!key || mappedCategories.has(key)) continue;
    byCategory.set(key, [...(byCategory.get(key) ?? []), a]);
  }
  const unmapped = [...byCategory.entries()].map(([category, rows]) => ({ category, ...tally(rows) }));
  const all = tally(answers);

  return {
    dimensions,
    unmapped,
    totals: { ...all, percent: percentOf(all.correct, all.total) },
    minQuestionsPerArea: min,
  };
}
