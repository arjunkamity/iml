// Panel-rated evaluation forms (#75): the rules for a form that panelists fill in about a
// student, kept apart from the database so they can be tested. A form is an Assessment of
// kind "panel"; each competency is a Question Bank row with options (rating levels), points,
// an optional hint per option (what that level looks like) and an optional weight.
import type { FrameworkScale } from './scorecard-config';

export interface PanelSettings {
  /** Ratings needed per student before a result counts. */
  requiredRaters: number;
  /** Ratings of one competency this many levels apart are flagged for an admin to decide. 0 turns the check off. */
  disagreementGap: number;
  /** A comment is required on every competency (otherwise optional). */
  requireComment: boolean;
  /** The observer or jury note must be filled in before submitting. */
  noteRequired: boolean;
  /** The heading above the observer note (for example "Observer note"). */
  noteLabel: string;
  /** How ratings of one competency are combined: the plain mean, or a mean that drops the highest and lowest when 3+ raters. */
  method: 'mean' | 'trimmed';
}

export const DEFAULT_PANEL_SETTINGS: PanelSettings = {
  requiredRaters: 2,
  disagreementGap: 2,
  requireComment: false,
  noteRequired: false,
  noteLabel: 'Observer note',
  method: 'mean',
};

export function normalizePanelSettings(raw: unknown): PanelSettings {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const int = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return {
    requiredRaters: int(c.requiredRaters, DEFAULT_PANEL_SETTINGS.requiredRaters, 1, 9),
    disagreementGap: int(c.disagreementGap, DEFAULT_PANEL_SETTINGS.disagreementGap, 0, 10),
    requireComment: c.requireComment === true,
    noteRequired: c.noteRequired === true,
    noteLabel: typeof c.noteLabel === 'string' && c.noteLabel.trim() ? c.noteLabel.trim().slice(0, 60) : DEFAULT_PANEL_SETTINGS.noteLabel,
    method: c.method === 'trimmed' ? 'trimmed' : 'mean',
  };
}

export function validatePanelSettings(raw: unknown): string[] {
  const issues: string[] = [];
  if (!raw || typeof raw !== 'object') return ['The panel settings must be an object.'];
  const c = raw as Record<string, unknown>;
  if (c.requiredRaters !== undefined && (!Number.isInteger(c.requiredRaters) || (c.requiredRaters as number) < 1 || (c.requiredRaters as number) > 9)) issues.push('Required raters must be a whole number from 1 to 9.');
  if (c.disagreementGap !== undefined && (!Number.isInteger(c.disagreementGap) || (c.disagreementGap as number) < 0 || (c.disagreementGap as number) > 10)) issues.push('The disagreement gap must be a whole number from 0 to 10.');
  if (c.method !== undefined && c.method !== 'mean' && c.method !== 'trimmed') issues.push('The method must be mean or trimmed.');
  return issues;
}

export interface CompetencyInput {
  label: string;
  dimension: string;
  prompt: string;
  options: string[];
  points: number[];
  hints?: string[];
  weight?: number;
}

export const MAX_RATING_POINTS = 10;

/** Problems with one competency, in plain words. Empty = fine. */
export function validateCompetency(c: CompetencyInput): string[] {
  const issues: string[] = [];
  if (!c.label?.trim()) issues.push('Give the competency a name.');
  else if (c.label.trim().length > 60) issues.push('The competency name can be at most 60 characters.');
  if (c.options.length < 2) issues.push('A competency needs at least two rating options.');
  if (c.options.some((o) => !o.trim())) issues.push('Rating options cannot be blank.');
  if (c.points.length !== c.options.length) issues.push('Give points for every option.');
  if (c.points.some((p) => !Number.isInteger(p) || p < 0 || p > MAX_RATING_POINTS)) issues.push(`Points must be whole numbers from 0 to ${MAX_RATING_POINTS}.`);
  if (c.points.length > 1 && c.points.every((p, i) => i === 0 || p > c.points[i - 1]) === false) issues.push('Points must go up from the lowest option to the highest, in the order the options are shown.');
  if (c.hints && c.hints.length > c.options.length) issues.push('There are more hints than options.');
  if (c.weight !== undefined && (!(c.weight > 0) || c.weight > 100)) issues.push('The weight must be more than 0 and at most 100.');
  return issues;
}

/** The standard rating scale: one option per level of a scale, points from the level, hint from its meaning. */
export function standardScaleOptions(scale: FrameworkScale): { options: string[]; points: number[]; hints: string[] } {
  const levels = [...scale.levels].sort((a, b) => a.points - b.points);
  return { options: levels.map((l) => l.label), points: levels.map((l) => l.points), hints: levels.map((l) => l.meaning) };
}

export interface FormQuestionRow {
  code: string;
  category: string;
  label: string | null;
  prompt: string;
  options: unknown;
  optionPoints: unknown;
  optionHints: unknown;
  weight: unknown;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? '')) : []);
const numbers = (v: unknown): number[] => (Array.isArray(v) ? v.map((x) => Number(x)) : []);

export interface FormCompetency {
  code: string;
  label: string;
  dimension: string;
  prompt: string;
  weight: number;
  options: { label: string; points: number; hint: string }[];
}

export function toCompetency(q: FormQuestionRow): FormCompetency {
  const options = strings(q.options);
  const points = numbers(q.optionPoints);
  const hints = strings(q.optionHints);
  return {
    code: q.code,
    label: q.label?.trim() || q.code,
    dimension: q.category,
    prompt: q.prompt,
    weight: Number(q.weight) > 0 ? Number(q.weight) : 1,
    options: options.map((label, i) => ({ label, points: Number.isFinite(points[i]) ? points[i] : 0, hint: hints[i] ?? '' })),
  };
}

/** Everything that stops a panel form from being published. Empty = ready. */
export function panelPublishIssues(questions: FormQuestionRow[], settings: PanelSettings): string[] {
  const issues: string[] = [];
  if (!questions.length) return ['Add at least one competency before publishing.'];
  const seen = new Set<string>();
  for (const q of questions) {
    const c = toCompetency(q);
    const problems = validateCompetency({ label: c.label, dimension: c.dimension, prompt: c.prompt, options: c.options.map((o) => o.label), points: c.options.map((o) => o.points), hints: c.options.map((o) => o.hint), weight: c.weight });
    for (const p of problems) issues.push(`${c.label}: ${p}`);
    if (seen.has(c.label.toLowerCase())) issues.push(`The competency name "${c.label}" is used twice.`);
    seen.add(c.label.toLowerCase());
  }
  const levels = new Set(questions.map((q) => numbers(q.optionPoints).join(',')));
  void levels;
  if (settings.requiredRaters < 1) issues.push('At least one rater is required.');
  return issues;
}

/** What a stage freezes when it opens: the form exactly as panelists will see it. */
export interface FormSnapshot {
  code: string;
  title: string;
  settings: PanelSettings;
  competencies: FormCompetency[];
}

export function buildSnapshot(form: { code: string; title: string }, questions: FormQuestionRow[], settings: PanelSettings): FormSnapshot {
  return { code: form.code, title: form.title, settings, competencies: questions.map(toCompetency) };
}
