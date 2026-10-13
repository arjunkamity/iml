// The rules that turn stage results into a student's final profile (#84): stage and dimension
// weights, the competency-to-dimension mapping, the overall level (with the "moving towards"
// suffix), a leadership style catalogue with matching rules and a fallback, top strengths and
// growth areas, and which one-line profile template applies. Pure and DB-free. All of it is
// configuration stored on a framework, so it is versioned with it (a published framework is
// locked) and every issued report records the framework version whose rules it used.
import { FrameworkConfig, FrameworkLevel, FrameworkScale } from './scorecard-config';
import { EvidenceItem, RollupResult, StageEvidence, levelByKey, levelForAverage, overallLabel, rollUpProfile } from './level-engine';

export interface StyleCondition {
  dimension: string;
  /** The dimension's final level must be at least this (a level key). */
  atLeast?: string;
  /** ...and at most this. */
  atMost?: string;
  /** The dimension must be (one of) the student's highest or lowest by average. */
  rank?: 'highest' | 'lowest';
}

export interface LeadershipStyle {
  key: string;
  name: string;
  /** All of these must hold. The first style (in list order) that matches wins. */
  conditions: StyleCondition[];
}

export interface ProfileLineRule {
  /** The position of the profile_line template in the content library. */
  position: number;
  conditions: StyleCondition[];
}

export interface RollupRules {
  stageWeights: Record<string, number>;
  dimensionWeights: Record<string, number>;
  minItemsPerDimension: number;
  minDimensionsForOverall: number;
  /** competency key -> dimension, overriding the dimension the stage gave it. */
  competencyMap: Record<string, string>;
  topStrengths: number;
  topGrowth: number;
  /** A strength must be at least this level, a growth area at most this level (level keys); unset = no limit. */
  strengthMinLevel?: string;
  growthMaxLevel?: string;
  styles: LeadershipStyle[];
  /** Used when no style matches, or the evidence for a style's dimensions is missing. */
  fallbackStyle?: string;
  profileLines: ProfileLineRule[];
  fallbackProfileLine?: number;
  /** Where a stage's evidence comes from when it is not detected on its own (for example a scored written assessment). */
  stageSources: Record<string, { type: 'assessment'; code: string }>;
}

export const DEFAULT_ROLLUP: RollupRules = {
  stageWeights: {},
  dimensionWeights: {},
  minItemsPerDimension: 1,
  minDimensionsForOverall: 1,
  competencyMap: {},
  topStrengths: 5,
  topGrowth: 3,
  styles: [],
  profileLines: [],
  stageSources: {},
};

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const posMap = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === 'number') out[k] = x;
  return out;
};
const conds = (v: unknown): StyleCondition[] => (Array.isArray(v) ? v : []).filter((c) => c && typeof c.dimension === 'string').map((c) => ({ dimension: c.dimension, ...(c.atLeast ? { atLeast: String(c.atLeast) } : {}), ...(c.atMost ? { atMost: String(c.atMost) } : {}), ...(c.rank === 'highest' || c.rank === 'lowest' ? { rank: c.rank } : {}) }));

export function normalizeRollup(raw: unknown): RollupRules {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const map = (v: unknown) => {
    const out: Record<string, string> = {};
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === 'string' && x) out[k] = x;
    return out;
  };
  const sources: RollupRules['stageSources'] = {};
  if (c.stageSources && typeof c.stageSources === 'object') {
    for (const [k, x] of Object.entries(c.stageSources as Record<string, { type?: string; code?: string }>)) if (x?.type === 'assessment' && x.code) sources[k] = { type: 'assessment', code: String(x.code) };
  }
  return {
    stageWeights: posMap(c.stageWeights),
    dimensionWeights: posMap(c.dimensionWeights),
    minItemsPerDimension: Math.max(1, Math.round(num(c.minItemsPerDimension, 1))),
    minDimensionsForOverall: Math.max(1, Math.round(num(c.minDimensionsForOverall, 1))),
    competencyMap: map(c.competencyMap),
    topStrengths: Math.max(0, Math.round(num(c.topStrengths, 5))),
    topGrowth: Math.max(0, Math.round(num(c.topGrowth, 3))),
    ...(typeof c.strengthMinLevel === 'string' && c.strengthMinLevel ? { strengthMinLevel: c.strengthMinLevel } : {}),
    ...(typeof c.growthMaxLevel === 'string' && c.growthMaxLevel ? { growthMaxLevel: c.growthMaxLevel } : {}),
    styles: (Array.isArray(c.styles) ? c.styles : []).filter((s) => s && typeof s.key === 'string').map((s) => ({ key: String(s.key), name: String(s.name ?? s.key), conditions: conds(s.conditions) })),
    ...(typeof c.fallbackStyle === 'string' && c.fallbackStyle ? { fallbackStyle: c.fallbackStyle } : {}),
    profileLines: (Array.isArray(c.profileLines) ? c.profileLines : []).filter((p) => p && Number.isInteger(p.position)).map((p) => ({ position: p.position as number, conditions: conds(p.conditions) })),
    ...(Number.isInteger(c.fallbackProfileLine) ? { fallbackProfileLine: c.fallbackProfileLine as number } : {}),
    stageSources: sources,
  };
}

/** Everything wrong with a rule set, in plain words. Empty = fine. A framework with rules cannot be published until it is. */
export function validateRollup(raw: unknown, config: FrameworkConfig): string[] {
  const issues: string[] = [];
  if (raw === undefined || raw === null) return issues; // no rules: the framework just cannot produce a final profile
  const r = normalizeRollup(raw);
  const dims = new Set(config.dimensions.map((d) => d.key));
  const scale = config.scales.find((s) => s.key === config.defaultScale) ?? config.scales[0];
  const levels = new Set((scale?.levels ?? []).map((l) => l.key));
  for (const [k, w] of Object.entries(r.stageWeights)) if (!(w > 0) || !/^\d+$/.test(k)) issues.push(`Stage weight "${k}": use a stage number and a weight above 0.`);
  for (const [k, w] of Object.entries(r.dimensionWeights)) {
    if (!dims.has(k)) issues.push(`Dimension weight: "${k}" is not a dimension of this framework.`);
    else if (!(w > 0)) issues.push(`Dimension weight for ${k} must be above 0.`);
  }
  for (const [k, d] of Object.entries(r.competencyMap)) if (!dims.has(d)) issues.push(`Competency ${k} is mapped to "${d}", which is not a dimension.`);
  for (const key of [r.strengthMinLevel, r.growthMaxLevel]) if (key && !levels.has(key)) issues.push(`"${key}" is not a level of the default scale.`);
  const styleKeys = new Set<string>();
  const checkConds = (where: string, cs: StyleCondition[]) => {
    for (const c of cs) {
      if (!dims.has(c.dimension)) issues.push(`${where}: "${c.dimension}" is not a dimension.`);
      for (const l of [c.atLeast, c.atMost]) if (l && !levels.has(l)) issues.push(`${where}: "${l}" is not a level.`);
    }
  };
  for (const s of r.styles) {
    if (styleKeys.has(s.key)) issues.push(`The style key ${s.key} is used twice.`);
    styleKeys.add(s.key);
    if (!s.conditions.length) issues.push(`Style ${s.key} has no conditions, so it would match everyone. Make it the fallback instead.`);
    checkConds(`Style ${s.key}`, s.conditions);
  }
  if (r.fallbackStyle && !styleKeys.has(r.fallbackStyle)) issues.push(`The fallback style "${r.fallbackStyle}" is not in the catalogue.`);
  if (r.styles.length && !r.fallbackStyle) issues.push('Choose a fallback style for students whose evidence matches no style.');
  r.profileLines.forEach((p, i) => checkConds(`Profile line rule ${i + 1}`, p.conditions));
  if (r.topStrengths < 0 || r.topGrowth < 0) issues.push('The number of strengths and growth areas cannot be negative.');
  return issues;
}

// ----------------------------------------------------------------- the profile

export interface ProfileDimension {
  key: string;
  label: string;
  average: number | null;
  level: FrameworkLevel | null;
  movingTowards: FrameworkLevel | null;
  status: string;
}

export interface CompetencyHighlight {
  competency: string;
  name: string;
  dimension: string;
  average: number;
  level: FrameworkLevel | null;
}

export interface FinalProfile {
  dimensions: ProfileDimension[];
  overall: { average: number | null; level: FrameworkLevel | null; movingTowards: FrameworkLevel | null; label: string };
  style: { key: string; name: string; reason: 'matched' | 'fallback' } | null;
  strengths: CompetencyHighlight[];
  growth: CompetencyHighlight[];
  profileLine: { position: number; reason: 'matched' | 'fallback' } | null;
  provisional: boolean;
  stagesUsed: number[];
  stagesPending: number[];
  stagesNotReached: number[];
  issues: string[];
}

const pointsOfLevel = (scale: FrameworkScale, key?: string) => (key ? levelByKey(scale, key)?.points : undefined);

function holds(c: StyleCondition, dims: ProfileDimension[], scale: FrameworkScale): boolean {
  const d = dims.find((x) => x.key === c.dimension);
  if (!d || !d.level || d.average === null) return false; // unclear evidence never matches
  const pts = d.level.points;
  const lo = pointsOfLevel(scale, c.atLeast);
  const hi = pointsOfLevel(scale, c.atMost);
  if (lo !== undefined && pts < lo) return false;
  if (hi !== undefined && pts > hi) return false;
  if (c.rank) {
    const withAvg = dims.filter((x) => x.average !== null) as (ProfileDimension & { average: number })[];
    const best = Math.max(...withAvg.map((x) => x.average));
    const worst = Math.min(...withAvg.map((x) => x.average));
    if (c.rank === 'highest' && (d.average as number) < best - 1e-9) return false;
    if (c.rank === 'lowest' && (d.average as number) > worst + 1e-9) return false;
  }
  return true;
}

/** Per competency across the counted stages: the weighted mean of its level points. */
function competencyAverages(scale: FrameworkScale, stages: StageEvidence[], rules: RollupRules, compName: (key: string) => string) {
  const acc = new Map<string, { dimension: string; sum: number; weight: number }>();
  for (const s of stages.filter((x) => x.status === 'complete')) {
    const sw = (rules.stageWeights[String(s.stage)] ?? 1) > 0 ? rules.stageWeights[String(s.stage)] ?? 1 : 1;
    for (const it of s.items) {
      if (!it.competency) continue;
      let pts: number | undefined;
      if (it.level) pts = levelByKey(scale, it.level)?.points;
      else if (typeof it.percent === 'number') {
        const lv = [...scale.levels].sort((a, b) => b.minPercent - a.minPercent).find((l) => it.percent! + 1e-9 >= l.minPercent);
        pts = lv?.points;
      }
      if (pts === undefined) continue;
      const w = sw * (it.weight && it.weight > 0 ? it.weight : 1);
      const a = acc.get(it.competency) ?? { dimension: it.dimension, sum: 0, weight: 0 };
      a.sum += pts * w;
      a.weight += w;
      acc.set(it.competency, a);
    }
  }
  return [...acc.entries()].map(([competency, a]) => {
    const average = a.sum / a.weight;
    return { competency, name: compName(competency), dimension: a.dimension, average, level: levelForAverage(scale, average) };
  });
}

export function buildFinalProfile(
  config: FrameworkConfig,
  scale: FrameworkScale,
  rules: RollupRules,
  stages: StageEvidence[],
  compName: (key: string) => string = (k) => k,
): FinalProfile {
  // the configured competency-to-dimension mapping overrides what a stage said
  const mapped: StageEvidence[] = stages.map((s) => ({ ...s, items: s.items.map((i): EvidenceItem => ({ ...i, dimension: (i.competency && rules.competencyMap[i.competency]) || i.dimension })) }));
  const roll: RollupResult = rollUpProfile(
    scale,
    config.dimensions.map((d) => d.key),
    mapped,
    {
      stageWeights: Object.fromEntries(Object.entries(rules.stageWeights).map(([k, v]) => [Number(k), v])),
      dimensionWeights: rules.dimensionWeights,
      minItemsPerDimension: rules.minItemsPerDimension,
      minDimensionsForOverall: rules.minDimensionsForOverall,
    },
  );
  const dims: ProfileDimension[] = roll.dimensions.map((d) => ({ key: d.dimension, label: config.dimensions.find((x) => x.key === d.dimension)?.label ?? d.dimension, average: d.average, level: d.level, movingTowards: d.movingTowards, status: d.status }));

  const style = (() => {
    for (const s of rules.styles) if (s.conditions.length && s.conditions.every((c) => holds(c, dims, scale))) return { key: s.key, name: s.name, reason: 'matched' as const };
    const fb = rules.styles.find((s) => s.key === rules.fallbackStyle);
    return fb ? { key: fb.key, name: fb.name, reason: 'fallback' as const } : null;
  })();
  const line = (() => {
    for (const p of rules.profileLines) if (p.conditions.every((c) => holds(c, dims, scale))) return { position: p.position, reason: 'matched' as const };
    return rules.fallbackProfileLine ? { position: rules.fallbackProfileLine, reason: 'fallback' as const } : null;
  })();

  const comps = competencyAverages(scale, mapped, rules, compName);
  const minS = pointsOfLevel(scale, rules.strengthMinLevel);
  const maxG = pointsOfLevel(scale, rules.growthMaxLevel);
  const order = (a: { average: number; name: string }, b: { average: number; name: string }, dir: 1 | -1) => dir * (b.average - a.average) || a.name.localeCompare(b.name);
  const strengthPool = comps.filter((c) => minS === undefined || (c.level?.points ?? 0) >= minS).sort((a, b) => order(a, b, 1));
  const strengths = strengthPool.slice(0, rules.topStrengths);
  const taken = new Set(strengths.map((c) => c.competency));
  const growthPool = comps.filter((c) => !taken.has(c.competency) && (maxG === undefined || (c.level?.points ?? 99) <= maxG)).sort((a, b) => order(a, b, -1));
  const growth = growthPool.slice(0, rules.topGrowth);

  return {
    dimensions: dims,
    overall: { average: roll.overall.average, level: roll.overall.level, movingTowards: roll.overall.movingTowards, label: overallLabel(roll.overall.level, roll.overall.movingTowards).toUpperCase() },
    style,
    strengths,
    growth,
    profileLine: line,
    provisional: roll.provisional,
    stagesUsed: roll.stagesUsed,
    stagesPending: roll.stagesPending,
    stagesNotReached: roll.stagesNotReached,
    issues: roll.issues,
  };
}
