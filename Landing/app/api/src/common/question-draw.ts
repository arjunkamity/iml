import { shuffle } from './util';

// The per-competition question mix draw (see CompetitionQuestionRule and
// StudentService.drawQuestions). Pure and DB-free so the maths — exact
// counts per category, no duplicates, re-attempt exclusion, shortfalls —
// can be tested without a database.

export interface DrawRule {
  category: string;
  count: number;
}

export interface DrawShortfall {
  category: string;
  requested: number;
  served: number;
}

/**
 * Draws `count` questions at random from each rule's category, then shuffles
 * the combined set so students don't see the exam grouped by category.
 *
 * - `exclude` (ids a previous attempt already served): within each category,
 *   draw from the unseen questions when enough remain; otherwise fall back to
 *   that category's whole pool rather than serving short. Same rule the
 *   whole-pool draw has always applied, just per category.
 * - A category with fewer questions than requested serves what exists and is
 *   reported in `shortfalls` (the caller logs it) — never an error, never a
 *   silently different total without a trace.
 * - A question is served at most once even if two rules somehow matched it.
 */
export function drawQuestions<T extends { id: number; category: string }>(
  pool: T[],
  rules: DrawRule[],
  exclude?: Set<number> | null,
): { questions: T[]; shortfalls: DrawShortfall[] } {
  const picked: T[] = [];
  const used = new Set<number>();
  const shortfalls: DrawShortfall[] = [];

  for (const rule of rules) {
    const want = Math.max(0, Math.floor(rule.count));
    const inCategory = pool.filter((q) => q.category === rule.category && !used.has(q.id));
    let source = inCategory;
    if (exclude && exclude.size) {
      const unseen = inCategory.filter((q) => !exclude.has(q.id));
      if (unseen.length >= want) source = unseen;
    }
    const chosen = shuffle(source).slice(0, want);
    for (const q of chosen) used.add(q.id);
    picked.push(...chosen);
    if (chosen.length < want) {
      shortfalls.push({ category: rule.category, requested: want, served: chosen.length });
    }
  }

  return { questions: shuffle(picked), shortfalls };
}
