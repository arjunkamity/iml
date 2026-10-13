import type { FrameworkLevel, FrameworkScale } from './scorecard-config';

// The Future Readiness level engine (#70): turns scores and ratings into levels,
// and rolls evidence from several stages up into a level per dimension and an
// overall level. Pure and DB-free, and it knows nothing about THINK, FEEL,
// Emerging or Advanced: dimensions, levels, cut-offs and stage numbers all arrive
// as data (a FrameworkScale plus evidence), so a different scale or a fifth stage
// needs no code change.
//
// How the roll-up works (the rule proposed to the client, see the epic):
//   1. Every piece of evidence becomes level points (a rating names its level; a
//      percentage is mapped through the scale's percentage cut-offs).
//   2. Within one stage, a dimension's value is the weighted mean of its items'
//      points (competency weights).
//   3. A dimension's value overall is the weighted mean of its stage values
//      (stage weights). A stage with no evidence for that dimension adds
//      nothing; it is never counted as zero.
//   4. The overall value is the (optionally weighted) mean of the dimensions that
//      have enough evidence.
//   5. A value becomes a level through the scale's roll-up cut-offs; a value just
//      below the next level is also flagged as "moving towards" it.

/** Absorbs float noise (80.00000000000001 vs 79.99999999999999) without ever rounding a real score up. */
const EPS = 1e-9;

export interface EvidenceItem {
  dimension: string;
  /** For traceability only (the competency this came from). */
  competency?: string;
  /** A rating already expressed as one of the scale's level keys (panel-rated stages). */
  level?: string;
  /** Or an exact percentage, 0-100 (auto-scored stages). Never round it before passing it in. */
  percent?: number;
  /** The competency weight; defaults to 1. */
  weight?: number;
}

export type StageStatus = 'complete' | 'pending' | 'not_reached';

export interface StageEvidence {
  stage: number;
  /**
   * complete: counted. pending: the stage is not finished or approved yet, so it is
   * left out and the profile is marked provisional. not_reached: the student never
   * got there, so it is left out and does not make the profile provisional.
   */
  status: StageStatus;
  items: EvidenceItem[];
}

export interface RollupOptions {
  /** Relative weight of each stage; any stage not listed counts 1. */
  stageWeights?: Record<number, number>;
  /** Relative weight of each dimension in the overall value; any dimension not listed counts 1. */
  dimensionWeights?: Record<string, number>;
  /** A dimension needs at least this many evidence items (across counted stages) to get a level. Default 1. */
  minItemsPerDimension?: number;
  /** The overall level needs at least this many dimensions with a level. Default 1. */
  minDimensionsForOverall?: number;
}

export interface DimensionRollup {
  dimension: string;
  /** Mean level points, or null when there is no (or too little) evidence. */
  average: number | null;
  level: FrameworkLevel | null;
  /** The next level up, when the average sits within the scale's margin below it. */
  movingTowards: FrameworkLevel | null;
  items: number;
  stagesUsed: number[];
  status: 'ok' | 'no_evidence' | 'insufficient';
}

export interface OverallRollup {
  average: number | null;
  level: FrameworkLevel | null;
  movingTowards: FrameworkLevel | null;
  dimensionsUsed: number;
  status: 'ok' | 'no_evidence' | 'insufficient';
}

export interface RollupResult {
  dimensions: DimensionRollup[];
  overall: OverallRollup;
  stagesUsed: number[];
  stagesPending: number[];
  stagesNotReached: number[];
  /** True when a stage is still pending: what is shown may change. */
  provisional: boolean;
  /** Evidence that could not be used, in plain words. */
  issues: string[];
}

// ------------------------------------------------------------- scale lookups

const byPoints = (scale: FrameworkScale): FrameworkLevel[] => scale.levels.slice().sort((a, b) => a.points - b.points);

/** The percentage as a share of questions: null when there were no questions. */
export function percentOf(correct: number, total: number): number | null {
  // correct * 100 first: 51 / 80 * 100 is 63.74999999999999 in floating point, 5100 / 80 is exactly 63.75.
  return total > 0 ? (correct * 100) / total : null;
}

/**
 * The level a percentage earns: the highest level whose minimum it reaches.
 * Judged on the exact value, so 79.9% is never promoted to a level starting at 80%
 * just because it displays as "80%". Above 100 counts as 100; a missing or
 * negative value earns no level.
 */
export function levelForPercent(scale: FrameworkScale, percent: number | null | undefined): FrameworkLevel | null {
  if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0) return null;
  const p = Math.min(percent, 100);
  let found: FrameworkLevel | null = null;
  for (const l of byPoints(scale)) if (p + EPS >= l.minPercent) found = l;
  return found;
}

/** The level whose key this is, or null. */
export function levelByKey(scale: FrameworkScale, key: string): FrameworkLevel | null {
  return scale.levels.find((l) => l.key === key) ?? null;
}

/**
 * The level a rolled-up average of level points earns, using each level's roll-up
 * cut-off (minAverage). A scale that has none falls back to the midpoints between
 * neighbouring levels' points, so an average of 2.5 sits halfway between 2 and 3.
 */
export function levelForAverage(scale: FrameworkScale, average: number | null | undefined): FrameworkLevel | null {
  if (typeof average !== 'number' || !Number.isFinite(average)) return null;
  const levels = byPoints(scale);
  if (!levels.length) return null;
  const hasCutoffs = levels.every((l) => typeof l.minAverage === 'number' && Number.isFinite(l.minAverage));
  let found: FrameworkLevel | null = null;
  levels.forEach((l, i) => {
    const min = hasCutoffs ? (l.minAverage as number) : i === 0 ? -Infinity : (levels[i - 1].points + l.points) / 2;
    if (average + EPS >= min) found = l;
  });
  return found ?? levels[0];
}

/**
 * The next level up when an average is below it by no more than the scale's margin
 * (default none). It is how "Proficient - moving towards Advanced" is decided; the
 * top level never moves towards anything.
 */
export function movingTowards(scale: FrameworkScale, average: number | null | undefined): FrameworkLevel | null {
  const margin = scale.movingTowardsMargin;
  if (typeof average !== 'number' || !Number.isFinite(average) || typeof margin !== 'number' || !(margin > 0)) return null;
  const current = levelForAverage(scale, average);
  const levels = byPoints(scale);
  const next = current ? levels[levels.findIndex((l) => l.key === current.key) + 1] : undefined;
  if (!next || typeof next.minAverage !== 'number') return null;
  const gap = next.minAverage - average;
  return gap > EPS && gap <= margin + EPS ? next : null;
}

/** The wording used in the sample report; the text itself is overridable (content library, #72). */
export function overallLabel(level: FrameworkLevel | null, towards: FrameworkLevel | null, joiner = 'moving towards'): string {
  if (!level) return '';
  return towards ? `${level.label} – ${joiner} ${towards.label}` : level.label;
}

// ------------------------------------------------------------------ roll-up

function pointsOf(scale: FrameworkScale, item: EvidenceItem): { points: number } | { problem: string } {
  const label = item.competency ?? item.dimension;
  if (item.level !== undefined && item.level !== null) {
    const l = levelByKey(scale, item.level);
    return l ? { points: l.points } : { problem: `${label}: "${item.level}" is not a level of this scale.` };
  }
  if (item.percent !== undefined && item.percent !== null) {
    const l = levelForPercent(scale, item.percent);
    return l ? { points: l.points } : { problem: `${label}: ${item.percent} is not a valid percentage.` };
  }
  return { problem: `${label}: no level or percentage was given.` };
}

function weightedMean(pairs: { value: number; weight: number }[]): number | null {
  const total = pairs.reduce((s, p) => s + p.weight, 0);
  if (!(total > 0)) return null;
  return pairs.reduce((s, p) => s + p.value * p.weight, 0) / total;
}

/**
 * Rolls evidence from any number of stages up into a level per dimension and an
 * overall level. See the header of this file for the rule. The dimensions listed
 * are the ones reported; evidence for any other dimension is ignored.
 */
export function rollUpProfile(
  scale: FrameworkScale,
  dimensions: string[],
  stages: StageEvidence[],
  options: RollupOptions = {},
): RollupResult {
  const issues: string[] = [];
  const minItems = Math.max(1, options.minItemsPerDimension ?? 1);
  const minDims = Math.max(1, options.minDimensionsForOverall ?? 1);
  const stageWeight = (n: number) => {
    const w = options.stageWeights?.[n];
    return typeof w === 'number' && w > 0 ? w : 1;
  };

  const counted = stages.filter((s) => s.status === 'complete');
  const stagesPending = stages.filter((s) => s.status === 'pending').map((s) => s.stage);
  const stagesNotReached = stages.filter((s) => s.status === 'not_reached').map((s) => s.stage);

  const rollups: DimensionRollup[] = dimensions.map((dimension) => {
    const perStage: { stage: number; value: number; weight: number }[] = [];
    let items = 0;
    for (const s of counted) {
      const pairs: { value: number; weight: number }[] = [];
      for (const item of s.items.filter((i) => i.dimension === dimension)) {
        const p = pointsOf(scale, item);
        if ('problem' in p) {
          issues.push(`Stage ${s.stage}, ${p.problem}`);
          continue;
        }
        const w = typeof item.weight === 'number' && item.weight > 0 ? item.weight : 1;
        pairs.push({ value: p.points, weight: w });
      }
      const mean = weightedMean(pairs);
      if (mean !== null) {
        perStage.push({ stage: s.stage, value: mean, weight: stageWeight(s.stage) });
        items += pairs.length;
      }
    }
    if (!items) return { dimension, average: null, level: null, movingTowards: null, items: 0, stagesUsed: [], status: 'no_evidence' as const };
    const average = weightedMean(perStage.map((p) => ({ value: p.value, weight: p.weight })));
    if (items < minItems) return { dimension, average, level: null, movingTowards: null, items, stagesUsed: perStage.map((p) => p.stage), status: 'insufficient' as const };
    return {
      dimension,
      average,
      level: levelForAverage(scale, average),
      movingTowards: movingTowards(scale, average),
      items,
      stagesUsed: perStage.map((p) => p.stage),
      status: 'ok' as const,
    };
  });

  const usable = rollups.filter((r) => r.status === 'ok' && r.average !== null);
  let overall: OverallRollup;
  if (!usable.length) {
    overall = { average: null, level: null, movingTowards: null, dimensionsUsed: 0, status: rollups.some((r) => r.status === 'insufficient') ? 'insufficient' : 'no_evidence' };
  } else if (usable.length < minDims) {
    overall = { average: null, level: null, movingTowards: null, dimensionsUsed: usable.length, status: 'insufficient' };
  } else {
    const average = weightedMean(
      usable.map((r) => {
        const w = options.dimensionWeights?.[r.dimension];
        return { value: r.average as number, weight: typeof w === 'number' && w > 0 ? w : 1 };
      }),
    );
    overall = {
      average,
      level: levelForAverage(scale, average),
      movingTowards: movingTowards(scale, average),
      dimensionsUsed: usable.length,
      status: 'ok',
    };
  }

  return {
    dimensions: rollups,
    overall,
    stagesUsed: counted.filter((s) => rollups.some((r) => r.stagesUsed.includes(s.stage))).map((s) => s.stage),
    stagesPending,
    stagesNotReached,
    provisional: stagesPending.length > 0,
    issues,
  };
}
