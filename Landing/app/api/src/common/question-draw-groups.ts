import type { DrawRule, DrawShortfall } from './question-draw';

// The draw for pools that contain Question Groups (see QuestionGroup in
// schema.prisma). Pure and DB-free, like question-draw.ts, so the maths can be
// tested without a database.
//
// Counting rule (decided with the client): a group of k sub-questions uses k
// slots of the exam's question count, and each sub-question is worth one
// mark. A 50-question exam therefore stays 50 questions whether it is served
// as 50 singles or as groups plus singles.
//
// This lives beside question-draw.ts rather than inside it on purpose: when a
// pool contains no groups the caller keeps using the original drawQuestions()
// / whole-pool path untouched, so an exam without groups cannot change
// behaviour.

export interface DrawGroupInput<T> {
  id: number;
  category: string;
  /** Sub-questions in the order the admin set; served back to back in this order. */
  questions: T[];
}

export interface GroupDrawOptions {
  /** Whole-pool cap (Exam.questionCount), used only when there are no mix rules. Null/0 = serve everything. */
  questionCount?: number | null;
  /** Ids a previous attempt served; a re-attempt prefers units it has not seen. */
  exclude?: Set<number> | null;
  /** Random source, injectable so tests are deterministic. Defaults to Math.random. */
  rng?: () => number;
}

export interface GroupDrawResult<T> {
  questions: T[];
  shortfalls: DrawShortfall[];
  /** Ids of the groups that were served, in serving order. */
  groupIds: number[];
}

interface Unit<T> {
  groupId: number | null;
  size: number;
  questions: T[];
}

/** How many random orderings to try when a plain pass cannot fill the target
 * exactly (groups of 3 and 4 and a target of 10, say). Cheap; and a plain pass
 * that hits the target stops immediately. */
const MAX_FILL_ATTEMPTS = 40;

function shuffleWith<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sizeOf = <T,>(units: Unit<T>[]) => units.reduce((n, u) => n + u.size, 0);

/**
 * Picks whole units, in random order, while they fit the slots still needed. A
 * unit that does not fit is skipped (a group is never truncated or split) and
 * later, smaller units can still fill the gap. If a pass leaves slots unfilled
 * although more were available, other random orderings are tried and the
 * fullest result wins — so a reachable target (e.g. 4 + 6 = 10) is reached
 * almost always, and an unreachable one gives the closest result below it.
 */
function fillBucket<T>(units: Unit<T>[], want: number, rng: () => number): Unit<T>[] {
  if (!Number.isFinite(want)) return units;
  if (want <= 0) return [];
  if (sizeOf(units) <= want) return units; // everything fits: nothing to choose

  let best: Unit<T>[] = [];
  let bestSize = -1;
  for (let attempt = 0; attempt < MAX_FILL_ATTEMPTS; attempt++) {
    let left = want;
    const picked: Unit<T>[] = [];
    for (const u of shuffleWith(units, rng)) {
      if (left === 0) break;
      if (u.size <= left) {
        picked.push(u);
        left -= u.size;
      }
    }
    if (want - left > bestSize) {
      best = picked;
      bestSize = want - left;
    }
    if (left === 0) break;
  }
  return best;
}

/**
 * Draws the exam's questions from a pool of single questions plus groups.
 *
 * - Units: a single question (1 slot) or a whole group (k slots).
 * - With mix `rules`: per category, fill that category's count from its units
 *   (a group counts toward the category it is filed under). `questionCount`
 *   is ignored, same as the plain mix draw.
 * - Without rules: fill `questionCount` slots from every unit, or serve every
 *   unit when it is unset.
 * - Units are chosen at random, so a category's share of group slots follows
 *   the pool's own composition (a pool that is 20% grouped serves about 20%
 *   grouped slots).
 * - A target that cannot be met exactly (not enough units, or only groups that
 *   overshoot) serves fewer and reports it in `shortfalls`; it never exceeds
 *   the target and never errors.
 * - Re-attempts: per bucket, prefer units the previous attempt did not serve
 *   when enough unseen slots remain, otherwise use the whole bucket (the same
 *   rule the plain draw applies). A group counts as seen if any of its
 *   questions was served.
 * - The chosen units are then shuffled together so the exam is not grouped by
 *   category, and flattened: a group's sub-questions stay contiguous and in
 *   admin order.
 */
export function drawWithGroups<T extends { id: number; category: string }>(
  pool: T[],
  groups: DrawGroupInput<T>[],
  rules: DrawRule[],
  options: GroupDrawOptions = {},
): GroupDrawResult<T> {
  const rng = options.rng ?? Math.random;
  const exclude = options.exclude && options.exclude.size ? options.exclude : null;
  const used = new Set<number>();
  const shortfalls: DrawShortfall[] = [];
  const chosen: Unit<T>[] = [];

  const singleUnits: (Unit<T> & { category: string })[] = pool.map((q) => ({
    groupId: null,
    size: 1,
    questions: [q],
    category: q.category,
  }));
  const groupUnits: (Unit<T> & { category: string })[] = groups
    .filter((g) => g.questions.length > 0)
    .map((g) => ({ groupId: g.id, size: g.questions.length, questions: g.questions, category: g.category }));

  const take = (candidates: (Unit<T> & { category: string })[], want: number): Unit<T>[] => {
    // A question already served by an earlier bucket is never served twice.
    const free = candidates.filter((u) => u.questions.every((q) => !used.has(q.id)));
    let source = free;
    if (exclude) {
      const unseen = free.filter((u) => u.questions.every((q) => !exclude.has(q.id)));
      if (sizeOf(unseen) >= want) source = unseen;
    }
    const picked = fillBucket(source, want, rng);
    for (const u of picked) for (const q of u.questions) used.add(q.id);
    chosen.push(...picked);
    return picked;
  };

  if (rules.length) {
    for (const rule of rules) {
      const want = Math.max(0, Math.floor(rule.count));
      const picked = take(
        [...singleUnits, ...groupUnits].filter((u) => u.category === rule.category),
        want,
      );
      const served = sizeOf(picked);
      if (served < want) shortfalls.push({ category: rule.category, requested: want, served });
    }
  } else {
    const cap = options.questionCount != null && options.questionCount > 0 ? Math.floor(options.questionCount) : Infinity;
    const picked = take([...singleUnits, ...groupUnits], cap);
    const served = sizeOf(picked);
    if (Number.isFinite(cap) && served < cap) shortfalls.push({ category: '*', requested: cap, served });
  }

  const ordered = shuffleWith(chosen, rng);
  return {
    questions: ordered.flatMap((u) => u.questions),
    shortfalls,
    groupIds: ordered.filter((u) => u.groupId !== null).map((u) => u.groupId as number),
  };
}
