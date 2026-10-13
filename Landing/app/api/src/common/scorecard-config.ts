import { validateRollup } from './rollup-rules';

// Shape and rules of a Future Readiness framework configuration (the JSON stored
// on ScorecardFramework.config), plus the display-ID pattern. Pure and DB-free so
// the rules can be tested, and so the level engine and report builder can import
// the types without touching the database.
//
// A framework never contains scoring code: dimensions, level scales and
// competencies are data an admin edits. See #69.

export interface FrameworkDimension {
  key: string; // e.g. THINK
  label: string; // e.g. THINK
  subtitle?: string; // e.g. Intellectual Intelligence
  description?: string;
}

export interface FrameworkLevel {
  key: string; // e.g. ADVANCED
  label: string; // e.g. Advanced
  /** Points used when levels are averaged (Emerging 1 ... Advanced 4). Unique, ascending. */
  points: number;
  /** Lowest percentage (0-100, unrounded) that earns this level. The first level must be 0. */
  minPercent: number;
  /** Lowest 1..max average (of level points) that earns this level when levels are rolled up. Optional; all levels or none. */
  minAverage?: number;
  /** What the level means, shown to the student. */
  meaning: string;
  color?: string;
}

export interface FrameworkScale {
  key: string; // e.g. EDPA
  name: string; // e.g. IML Development Scale
  levels: FrameworkLevel[];
  /** A rolled-up average within this distance below the next level's minAverage is described as "moving towards" it. */
  movingTowardsMargin?: number;
}

export interface FrameworkCompetency {
  key: string; // e.g. ETHICAL_JUDGMENT
  name: string; // default display name
  description?: string;
  dimension: string; // a FrameworkDimension key
  /** Relative weight when competencies roll up into their dimension. */
  weight: number;
  /** Display name per stage position ("1", "2", ...) where it differs from `name`. */
  stageNames: Record<string, string>;
  /**
   * Exam question categories (as stored on questions, e.g. "LR", "GK") whose answers
   * are scored into this competency in auto-scored stages. A category feeds at most
   * one competency. Empty for competencies that are only rated by a panel.
   */
  examCategories?: string[];
}

/** Settings for the area percentages computed from auto-scored (exam) stages. */
export interface FrameworkAutoScore {
  /** An area needs at least this many served questions to get a percentage and a level. */
  minQuestionsPerArea: number;
}

export interface FrameworkConfig {
  dimensions: FrameworkDimension[];
  scales: FrameworkScale[];
  defaultScale: string;
  competencies: FrameworkCompetency[];
  autoScore?: FrameworkAutoScore;
  /** The roll-up rules for the final profile (see rollup-rules.ts). Versioned with the framework. */
  rollup?: unknown;
}

export const DEFAULT_MIN_QUESTIONS_PER_AREA = 5;

const DIMENSION_KEY = /^[A-Z][A-Z0-9_]{1,19}$/;
const SCALE_KEY = /^[A-Z][A-Z0-9_]{1,29}$/;
const LEVEL_KEY = /^[A-Z][A-Z0-9_]{1,29}$/;
const COMPETENCY_KEY = /^[A-Z][A-Z0-9_]{1,39}$/;
export const MAX_STAGE_POSITION = 12;

export function emptyFrameworkConfig(): FrameworkConfig {
  return { dimensions: [], scales: [], defaultScale: '', competencies: [] };
}

/** The IML development scale from the client's sample report, with the proposed
 * (editable) cut-offs: Advanced 80+, Proficient 60-79, Developing 40-59, Emerging below 40. */
export function standardEdpaScale(): FrameworkScale {
  return {
    key: 'EDPA',
    name: 'IML Development Scale',
    movingTowardsMargin: 0.25,
    levels: [
      { key: 'EMERGING', label: 'Emerging', points: 1, minPercent: 0, minAverage: 1, meaning: 'Beginning to demonstrate the competency.' },
      { key: 'DEVELOPING', label: 'Developing', points: 2, minPercent: 40, minAverage: 1.75, meaning: 'Demonstrates the competency in familiar situations but needs greater consistency.' },
      { key: 'PROFICIENT', label: 'Proficient', points: 3, minPercent: 60, minAverage: 2.5, meaning: 'Demonstrates the competency effectively across different situations.' },
      { key: 'ADVANCED', label: 'Advanced', points: 4, minPercent: 80, minAverage: 3.5, meaning: 'Demonstrates maturity, adaptability and depth while applying the competency.' },
    ],
  };
}

/** Reads a stored/posted config tolerantly into the full shape (missing parts become empty). */
export function normalizeConfig(raw: unknown): FrameworkConfig {
  const c = (raw ?? {}) as Partial<FrameworkConfig>;
  return {
    dimensions: Array.isArray(c.dimensions) ? c.dimensions : [],
    scales: Array.isArray(c.scales) ? c.scales : [],
    defaultScale: typeof c.defaultScale === 'string' ? c.defaultScale : '',
    competencies: Array.isArray(c.competencies) ? c.competencies : [],
    autoScore: c.autoScore && typeof c.autoScore === 'object' ? c.autoScore : { minQuestionsPerArea: DEFAULT_MIN_QUESTIONS_PER_AREA },
    ...(c.rollup !== undefined && c.rollup !== null ? { rollup: c.rollup } : {}),
  };
}

const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Everything that stops a framework from being published, in plain words.
 * Empty = ready. Editing a Draft is never blocked by these; only publishing is.
 */
export function validateFrameworkConfig(raw: unknown): string[] {
  const c = normalizeConfig(raw);
  const issues: string[] = [];

  // ---- dimensions
  if (!c.dimensions.length) issues.push('Add at least one dimension.');
  const dimKeys = new Set<string>();
  c.dimensions.forEach((d, i) => {
    const name = `Dimension ${i + 1}`;
    if (!d || typeof d.key !== 'string' || !DIMENSION_KEY.test(d.key)) {
      issues.push(`${name}: the key must be 2-20 capital letters, digits or underscores (e.g. THINK).`);
    } else if (dimKeys.has(d.key)) {
      issues.push(`${name}: the key ${d.key} is used twice.`);
    } else dimKeys.add(d.key);
    if (!d || typeof d.label !== 'string' || !d.label.trim()) issues.push(`${name}: a label is required.`);
  });

  // ---- scales
  if (!c.scales.length) issues.push('Add at least one level scale.');
  const scaleKeys = new Set<string>();
  c.scales.forEach((s, i) => {
    const name = `Scale ${i + 1}`;
    if (!s || typeof s.key !== 'string' || !SCALE_KEY.test(s.key)) {
      issues.push(`${name}: the key must be 2-30 capital letters, digits or underscores (e.g. EDPA).`);
    } else if (scaleKeys.has(s.key)) {
      issues.push(`${name}: the key ${s.key} is used twice.`);
    } else scaleKeys.add(s.key);
    if (!s || typeof s.name !== 'string' || !s.name.trim()) issues.push(`${name}: a name is required.`);
    const levels = Array.isArray(s?.levels) ? s.levels : [];
    if (levels.length < 2) {
      issues.push(`${name}: add at least two levels.`);
      return;
    }
    const levelKeys = new Set<string>();
    levels.forEach((l, j) => {
      const ln = `${name}, level ${j + 1}`;
      if (!l || typeof l.key !== 'string' || !LEVEL_KEY.test(l.key)) issues.push(`${ln}: the key must be 2-30 capital letters, digits or underscores.`);
      else if (levelKeys.has(l.key)) issues.push(`${ln}: the key ${l.key} is used twice.`);
      else levelKeys.add(l.key);
      if (!l || typeof l.label !== 'string' || !l.label.trim()) issues.push(`${ln}: a label is required.`);
      if (!l || typeof l.meaning !== 'string' || !l.meaning.trim()) issues.push(`${ln}: say what the level means.`);
      if (!l || !isFiniteNumber(l.points)) issues.push(`${ln}: points must be a number.`);
      if (!l || !isFiniteNumber(l.minPercent) || l.minPercent < 0 || l.minPercent > 100) issues.push(`${ln}: the minimum percentage must be between 0 and 100.`);
    });
    // Levels are ordered by points; cut-offs must rise with them, starting at 0.
    const ok = levels.every((l) => l && isFiniteNumber(l.points) && isFiniteNumber(l.minPercent));
    if (ok) {
      const byPoints = levels.slice().sort((a, b) => a.points - b.points);
      for (let j = 1; j < byPoints.length; j++) {
        if (byPoints[j].points === byPoints[j - 1].points) issues.push(`${name}: two levels have the same points (${byPoints[j].points}).`);
        if (byPoints[j].minPercent <= byPoints[j - 1].minPercent) {
          issues.push(`${name}: "${byPoints[j].label}" must start at a higher percentage than "${byPoints[j - 1].label}".`);
        }
      }
      if (byPoints[0].minPercent !== 0) issues.push(`${name}: the lowest level must start at 0% so every score has a level.`);
      const withAvg = levels.filter((l) => l.minAverage !== undefined && l.minAverage !== null);
      if (withAvg.length && withAvg.length !== levels.length) issues.push(`${name}: set the roll-up average for every level, or for none.`);
      if (withAvg.length === levels.length) {
        for (let j = 1; j < byPoints.length; j++) {
          const a = byPoints[j - 1].minAverage as number;
          const b = byPoints[j].minAverage as number;
          if (!isFiniteNumber(a) || !isFiniteNumber(b)) issues.push(`${name}: the roll-up averages must be numbers.`);
          else if (b <= a) issues.push(`${name}: the roll-up average for "${byPoints[j].label}" must be higher than for "${byPoints[j - 1].label}".`);
        }
      }
    }
    if (s.movingTowardsMargin !== undefined && (!isFiniteNumber(s.movingTowardsMargin) || s.movingTowardsMargin < 0)) {
      issues.push(`${name}: the "moving towards" margin must be zero or more.`);
    }
  });
  if (c.scales.length) {
    if (!c.defaultScale) issues.push('Choose the default scale.');
    else if (!scaleKeys.has(c.defaultScale)) issues.push(`The default scale "${c.defaultScale}" does not exist.`);
  }

  // ---- competencies
  const compKeys = new Set<string>();
  const namesByStage = new Map<string, string>(); // `${stage}|${lower name}` -> competency key
  const defaultNames = new Map<string, string>(); // lower name -> competency key
  c.competencies.forEach((k, i) => {
    const name = `Competency ${i + 1}${k && typeof k.name === 'string' && k.name ? ` (${k.name})` : ''}`;
    if (!k || typeof k.key !== 'string' || !COMPETENCY_KEY.test(k.key)) {
      issues.push(`${name}: the key must be 2-40 capital letters, digits or underscores.`);
    } else if (compKeys.has(k.key)) {
      issues.push(`${name}: the key ${k.key} is used twice.`);
    } else compKeys.add(k.key);
    if (!k || typeof k.name !== 'string' || !k.name.trim()) issues.push(`${name}: a name is required.`);
    if (!k || !k.dimension || !dimKeys.has(k.dimension)) issues.push(`${name}: choose which dimension it belongs to.`);
    if (!k || !isFiniteNumber(k.weight) || k.weight <= 0 || k.weight > 10) issues.push(`${name}: the weight must be more than 0 and at most 10.`);
    const stageNames = k && k.stageNames && typeof k.stageNames === 'object' ? k.stageNames : {};
    for (const [stage, label] of Object.entries(stageNames)) {
      const pos = Number(stage);
      if (!Number.isInteger(pos) || pos < 1 || pos > MAX_STAGE_POSITION) issues.push(`${name}: "${stage}" is not a valid stage number (1-${MAX_STAGE_POSITION}).`);
      else if (typeof label !== 'string' || !label.trim()) issues.push(`${name}: the stage ${pos} name is empty.`);
    }
    // The name a competency shows must identify it: default names are unique, and so are
    // the per-stage names within each stage.
    if (k && typeof k.name === 'string' && k.name.trim()) {
      const id = k.name.trim().toLowerCase();
      const other = defaultNames.get(id);
      if (other && other !== k.key) issues.push(`${name}: another competency is already called "${k.name}".`);
      defaultNames.set(id, k.key);
    }
    for (let pos = 1; pos <= MAX_STAGE_POSITION; pos++) {
      const label = stageNames[String(pos)];
      if (label && typeof label === 'string') {
        const id = `${pos}|${label.trim().toLowerCase()}`;
        const other = namesByStage.get(id);
        if (other && other !== k.key) issues.push(`${name}: "${label}" is already used in stage ${pos} by ${other}.`);
        namesByStage.set(id, k.key);
      }
    }
  });
  // Exam categories: a category feeds one competency only.
  const categoryOwner = new Map<string, string>();
  c.competencies.forEach((k) => {
    if (!k || k.examCategories === undefined) return;
    if (!Array.isArray(k.examCategories)) {
      issues.push(`${k.name || k.key}: exam categories must be a list.`);
      return;
    }
    for (const cat of k.examCategories) {
      if (typeof cat !== 'string' || !cat.trim() || cat.trim().length > 20) {
        issues.push(`${k.name || k.key}: an exam category must be 1-20 characters.`);
        continue;
      }
      const owner = categoryOwner.get(cat.trim());
      if (owner && owner !== k.key) issues.push(`The exam category "${cat.trim()}" feeds both ${owner} and ${k.key}; a category can feed only one competency.`);
      categoryOwner.set(cat.trim(), k.key);
    }
  });
  const min = c.autoScore?.minQuestionsPerArea;
  if (min !== undefined && (!Number.isInteger(min) || min < 1 || min > 200)) {
    issues.push('The minimum questions per area must be a whole number from 1 to 200.');
  }

  const usedDims = new Set(c.competencies.map((k) => k?.dimension));
  for (const d of c.dimensions) {
    if (d && dimKeys.has(d.key) && c.competencies.length && !usedDims.has(d.key)) issues.push(`Dimension ${d.key} has no competencies.`);
  }
  issues.push(...validateRollup(c.rollup, c));
  return issues;
}

// ---------------------------------------------------------------- display ID

export const DEFAULT_ID_PATTERN = 'IML-{YYYY}-{#####}';

/** Problems with a display-ID pattern. Tokens: {YYYY}, {YY}, {SEASON}, and exactly one {#...} for the running number. */
export function validateIdPattern(pattern: string): string[] {
  const issues: string[] = [];
  if (typeof pattern !== 'string' || !pattern.trim()) return ['Enter an ID pattern.'];
  if (pattern.length > 60) issues.push('The ID pattern is too long (60 characters at most).');
  const stripped = pattern.replace(/\{(YYYY|YY|SEASON|#{1,10})\}/g, '');
  if (/[{}]/.test(stripped)) issues.push('Only {YYYY}, {YY}, {SEASON} and {#####} can go inside braces.');
  if (/[^A-Za-z0-9\-_/ ]/.test(stripped.replace(/[{}]/g, ''))) issues.push('Use letters, digits, - _ / and spaces around the tokens.');
  const numbers = pattern.match(/\{#{1,10}\}/g) ?? [];
  if (numbers.length !== 1) issues.push('The pattern needs exactly one running number, such as {#####}.');
  return issues;
}

/** Formats a display ID, e.g. formatImlId('IML-{YYYY}-{#####}', { year: 2026, seq: 124 }) = 'IML-2026-00124'. */
export function formatImlId(pattern: string, parts: { year: number; seq: number; season?: string }): string {
  return pattern
    .replace(/\{YYYY\}/g, String(parts.year))
    .replace(/\{YY\}/g, String(parts.year % 100).padStart(2, '0'))
    .replace(/\{SEASON\}/g, parts.season ?? '')
    .replace(/\{(#{1,10})\}/g, (_, hashes: string) => String(parts.seq).padStart(hashes.length, '0'));
}
