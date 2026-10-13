// Checking a panelist's rating and combining the ratings of several panelists into a stage
// result (#80, #81). Pure and DB-free: the form (a frozen snapshot), the ratings, an admin's
// adjudications and the level scale all arrive as data, so the result can always be
// reproduced from what is stored.
import { levelForAverage } from './level-engine';
import type { FrameworkScale } from './scorecard-config';
import type { FormSnapshot } from './panel-form';

export interface RatedItem {
  optionIndex: number;
  points: number;
  comment?: string;
}

export type RatingMap = Record<string, RatedItem>;

export interface RatingInput {
  [competencyCode: string]: { optionIndex: number; comment?: string };
}

export interface ValidatedRating {
  ratings: RatingMap;
  errors: string[];
}

/**
 * Turns what a panelist sent into a stored rating. Points always come from the form, never from
 * the request. With requireAll (a submit) every competency must be rated, and have a comment when
 * the form asks for one; a draft may be partial.
 */
export function validateRating(form: FormSnapshot, input: RatingInput, opts: { requireAll: boolean }): ValidatedRating {
  const errors: string[] = [];
  const ratings: RatingMap = {};
  const byCode = new Map(form.competencies.map((c) => [c.code, c]));
  for (const [code, v] of Object.entries(input ?? {})) {
    const c = byCode.get(code);
    if (!c) {
      errors.push(`"${code}" is not a competency of this form.`);
      continue;
    }
    if (v === null || v === undefined || v.optionIndex === null || v.optionIndex === undefined) continue; // not rated yet
    if (!Number.isInteger(v.optionIndex) || v.optionIndex < 0 || v.optionIndex >= c.options.length) {
      errors.push(`${c.label}: that rating is not one of the options.`);
      continue;
    }
    const comment = typeof v.comment === 'string' ? v.comment.trim().slice(0, 1000) : '';
    ratings[code] = { optionIndex: v.optionIndex, points: c.options[v.optionIndex].points, ...(comment ? { comment } : {}) };
  }
  if (opts.requireAll) {
    for (const c of form.competencies) {
      if (!ratings[c.code]) errors.push(`${c.label}: choose a rating.`);
      else if (form.settings.requireComment && !ratings[c.code].comment) errors.push(`${c.label}: a comment is required.`);
    }
  }
  return { ratings, errors };
}

export interface SubmittedRating {
  panelistId: number;
  ratings: RatingMap;
}

export interface CompetencyResult {
  code: string;
  label: string;
  dimension: string;
  weight: number;
  /** The points each rater gave, in rater order. */
  values: number[];
  /** The combined points (mean or trimmed mean). */
  mean: number | null;
  /** What counts: the admin's decision if there is one, else the mean. */
  final: number | null;
  levelKey: string | null;
  /** The widest gap between two raters, in options (levels). */
  spread: number;
  flagged: boolean;
  adjudicated: boolean;
}

export interface StageAggregate {
  status: 'Rated' | 'NotRated';
  ratersCount: number;
  requiredRaters: number;
  /** 0-100, weighted points over the most the form can give. Null unless Rated. */
  percent: number | null;
  /** The weighted average of the final points. Null unless Rated. */
  average: number | null;
  levelKey: string | null;
  flagged: boolean;
  competencies: CompetencyResult[];
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Mean, or — when asked and there are 3 or more — the mean without the highest and the lowest. */
export function combine(values: number[], method: 'mean' | 'trimmed'): number | null {
  if (!values.length) return null;
  if (method === 'trimmed' && values.length >= 3) {
    const s = [...values].sort((a, b) => a - b);
    return mean(s.slice(1, -1));
  }
  return mean(values);
}

export function aggregateStage(
  form: FormSnapshot,
  ratings: SubmittedRating[],
  scale: FrameworkScale,
  opts: { requiredRaters?: number; overrides?: Record<string, number> } = {},
): StageAggregate {
  const requiredRaters = opts.requiredRaters ?? form.settings.requiredRaters;
  const gap = form.settings.disagreementGap;
  const overrides = opts.overrides ?? {};
  // a fixed order, so the same ratings always give exactly the same result
  ratings = [...ratings].sort((x, y) => x.panelistId - y.panelistId);
  const competencies: CompetencyResult[] = form.competencies.map((c) => {
    const given = ratings.map((r) => r.ratings[c.code]).filter((x): x is RatedItem => !!x);
    const values = given.map((g) => g.points);
    const indexes = given.map((g) => g.optionIndex);
    const m = combine(values, form.settings.method);
    const adjudicated = overrides[c.code] !== undefined;
    const final = adjudicated ? overrides[c.code] : m;
    const spread = indexes.length ? Math.max(...indexes) - Math.min(...indexes) : 0;
    return {
      code: c.code,
      label: c.label,
      dimension: c.dimension,
      weight: c.weight,
      values,
      mean: m,
      final,
      levelKey: final === null ? null : levelForAverage(scale, final)?.key ?? null,
      spread,
      flagged: gap > 0 && !adjudicated && spread >= gap,
      adjudicated,
    };
  });
  const ratersCount = ratings.length;
  const flagged = competencies.some((c) => c.flagged);
  const enough = ratersCount >= requiredRaters && competencies.every((c) => c.final !== null);
  if (!enough) {
    return { status: 'NotRated', ratersCount, requiredRaters, percent: null, average: null, levelKey: null, flagged, competencies };
  }
  const totalWeight = competencies.reduce((s, c) => s + c.weight, 0);
  const average = competencies.reduce((s, c) => s + c.weight * (c.final as number), 0) / totalWeight;
  const maxOf = (code: string) => Math.max(...(form.competencies.find((x) => x.code === code)?.options.map((o) => o.points) ?? [0]));
  const maxTotal = competencies.reduce((s, c) => s + c.weight * maxOf(c.code), 0);
  const percent = maxTotal > 0 ? (competencies.reduce((s, c) => s + c.weight * (c.final as number), 0) / maxTotal) * 100 : null;
  return { status: 'Rated', ratersCount, requiredRaters, percent, average, levelKey: levelForAverage(scale, average)?.key ?? null, flagged, competencies };
}

export interface RankRow {
  registrationId: number;
  percent: number;
  /** How many competencies are at the top level; the first tie-break. */
  topLevelCount: number;
}

/** Highest stage score first; ties by more competencies at the top level, then by registration order, so a ranking never has a tie. */
export function rankResults(rows: RankRow[]): RankRow[] {
  return [...rows].sort((a, b) => b.percent - a.percent || b.topLevelCount - a.topLevelCount || a.registrationId - b.registrationId);
}
