// The observer or jury note (#85): a system draft built from the ratings and the recorded notes,
// which a panelist then edits and approves. Pure and DB-free. The system never invents what a
// student did: every claim about specific behaviour comes from a note a panelist actually wrote;
// the rest is the content library's wording for a competency at a level.
import { renderTemplate } from './content-library';
import type { CompetencyResult } from './panel-scoring';

export interface NarrativeInput {
  name: string;
  gender?: string | null;
  competencies: Pick<CompetencyResult, 'code' | 'label' | 'final' | 'levelKey'>[];
  /** The observer notes panelists wrote, one per panelist who wrote one. */
  notes: string[];
  /** The library's wording: kind, competency key, level -> text (or null when none is approved). */
  text: (kind: string, key: string, level: string) => string | null;
  /** How many strengths and growth areas to mention. */
  strengths?: number;
  growth?: number;
}

export interface NarrativeDraft {
  text: string;
  /** Wording the library did not have, so the editor knows what the panelist has to supply. */
  gaps: string[];
}

/** Highest first; ties keep form order, so the same ratings always give the same draft. */
export function strongest(c: NarrativeInput['competencies'], n: number) {
  return c.map((x, i) => ({ x, i })).filter((r) => r.x.final !== null).sort((a, b) => (b.x.final as number) - (a.x.final as number) || a.i - b.i).slice(0, n).map((r) => r.x);
}

export function weakest(c: NarrativeInput['competencies'], n: number) {
  return c.map((x, i) => ({ x, i })).filter((r) => r.x.final !== null).sort((a, b) => (a.x.final as number) - (b.x.final as number) || a.i - b.i).slice(0, n).map((r) => r.x);
}

export function buildObserverDraft(input: NarrativeInput): NarrativeDraft {
  const gaps: string[] = [];
  const ctx = { name: input.name, gender: input.gender ?? null };
  const fill = (t: string, over: { competency?: string; level?: string } = {}) => renderTemplate(t, { ...ctx, competency: over.competency ?? null, level: over.level ?? null }).text;
  const parts: string[] = [];
  const opening = input.text('observer_opening', '', '');
  if (opening) parts.push(fill(opening));
  else gaps.push('Observer opening');
  const strong = strongest(input.competencies, input.strengths ?? 2);
  const strongSet = new Set(strong.map((c) => c.code));
  for (const c of strong) {
    const t = c.levelKey ? input.text('observer_strength', c.code, c.levelKey) : null;
    if (t) parts.push(fill(t, { competency: c.label, level: c.levelKey ?? undefined }));
    else gaps.push(`Observer strength for ${c.label}${c.levelKey ? ` at ${c.levelKey}` : ''}`);
  }
  for (const c of weakest(input.competencies.filter((x) => !strongSet.has(x.code)), input.growth ?? 1)) {
    const t = c.levelKey ? input.text('observer_growth', c.code, c.levelKey) : null;
    if (t) parts.push(fill(t, { competency: c.label, level: c.levelKey ?? undefined }));
    else gaps.push(`Observer growth area for ${c.label}${c.levelKey ? ` at ${c.levelKey}` : ''}`);
  }
  for (const n of input.notes.map((x) => x.trim()).filter(Boolean)) parts.push(n);
  const closing = input.text('observer_closing', '', '');
  if (closing) parts.push(fill(closing));
  return { text: parts.join('\n\n'), gaps };
}
