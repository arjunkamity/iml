import { drawQuestions } from './question-draw';
import { DrawGroupInput, drawWithGroups } from './question-draw-groups';

interface Q {
  id: number;
  category: string;
}

// Deterministic random source so every run of these tests is identical.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextId = 1;
const q = (category: string): Q => ({ id: nextId++, category });
const singles = (category: string, n: number): Q[] => Array.from({ length: n }, () => q(category));
const group = (id: number, category: string, size: number): DrawGroupInput<Q> => ({
  id,
  category,
  questions: Array.from({ length: size }, () => q(category)),
});

const countBy = (qs: Q[]) =>
  qs.reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.category]: (acc[x.category] ?? 0) + 1 }), {});

/** Every group that appears must appear whole, contiguous and in admin order. */
function expectGroupsIntact(served: Q[], groups: DrawGroupInput<Q>[]) {
  for (const g of groups) {
    const ids = g.questions.map((x) => x.id);
    const at = served.map((x) => x.id).filter((id) => ids.includes(id));
    if (!at.length) continue; // not served: fine
    expect(at).toEqual(ids); // whole, in order
    const first = served.findIndex((x) => x.id === ids[0]);
    expect(served.slice(first, first + ids.length).map((x) => x.id)).toEqual(ids); // contiguous
  }
}

describe('drawWithGroups: counting', () => {
  it('a group of 4 uses 4 slots: the total stays exactly the target', () => {
    const pool = singles('IQ', 30);
    const groups = [group(1, 'IQ', 4), group(2, 'IQ', 4), group(3, 'IQ', 4)];
    for (let seed = 1; seed <= 300; seed++) {
      const { questions, shortfalls } = drawWithGroups(pool, groups, [{ category: 'IQ', count: 10 }], { rng: seeded(seed) });
      expect(questions).toHaveLength(10);
      expect(shortfalls).toEqual([]);
      expectGroupsIntact(questions, groups);
    }
  });

  it('never repeats a question and never exceeds the target', () => {
    const pool = singles('IQ', 6);
    const groups = [group(1, 'IQ', 4), group(2, 'IQ', 3)];
    for (let seed = 1; seed <= 300; seed++) {
      const { questions } = drawWithGroups(pool, groups, [{ category: 'IQ', count: 9 }], { rng: seeded(seed) });
      const ids = questions.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeLessThanOrEqual(9);
    }
  });

  it('applies the count per category in a mix, groups counting toward their own category', () => {
    const pool = [...singles('LR', 20), ...singles('DI', 20), ...singles('GK', 20)];
    const groups = [group(1, 'LR', 4), group(2, 'LR', 4), group(3, 'DI', 3)];
    const rules = [
      { category: 'LR', count: 10 },
      { category: 'DI', count: 10 },
      { category: 'GK', count: 10 },
    ];
    for (let seed = 1; seed <= 300; seed++) {
      const { questions, shortfalls } = drawWithGroups(pool, groups, rules, { rng: seeded(seed) });
      expect(countBy(questions)).toEqual({ LR: 10, DI: 10, GK: 10 });
      expect(shortfalls).toEqual([]);
      expectGroupsIntact(questions, groups);
    }
  });

  it('with no mix, fills Exam.questionCount slots from singles and groups together', () => {
    const pool = [...singles('LR', 40), ...singles('GK', 40)];
    const groups = [group(1, 'LR', 4), group(2, 'GK', 4), group(3, 'GK', 3)];
    for (let seed = 1; seed <= 300; seed++) {
      const { questions, shortfalls } = drawWithGroups(pool, groups, [], { questionCount: 50, rng: seeded(seed) });
      expect(questions).toHaveLength(50);
      expect(shortfalls).toEqual([]);
      expectGroupsIntact(questions, groups);
    }
  });

  it('with no mix and no count, serves every question with groups intact', () => {
    const pool = singles('LR', 5);
    const groups = [group(1, 'LR', 4), group(2, 'LR', 3)];
    const { questions } = drawWithGroups(pool, groups, [], { rng: seeded(7) });
    expect(questions).toHaveLength(5 + 4 + 3);
    expectGroupsIntact(questions, groups);
  });
});

describe('drawWithGroups: groups that do not fit', () => {
  it('skips a group that would overshoot and fills the gap with singles', () => {
    const pool = singles('IQ', 2);
    const groups = [group(1, 'IQ', 4), group(2, 'IQ', 4), group(3, 'IQ', 4)];
    for (let seed = 1; seed <= 200; seed++) {
      const { questions } = drawWithGroups(pool, groups, [{ category: 'IQ', count: 10 }], { rng: seeded(seed) });
      expect(questions).toHaveLength(10); // two groups (8) + both singles
      expectGroupsIntact(questions, groups);
    }
  });

  it('serves fewer and reports it when only oversized groups remain', () => {
    const groups = [group(1, 'IQ', 4), group(2, 'IQ', 4), group(3, 'IQ', 4)];
    const { questions, shortfalls, groupIds } = drawWithGroups([], groups, [{ category: 'IQ', count: 10 }], { rng: seeded(3) });
    expect(questions).toHaveLength(8); // never 12
    expect(shortfalls).toEqual([{ category: 'IQ', requested: 10, served: 8 }]);
    expect(groupIds).toHaveLength(2);
  });

  it('finds an exact fit among mixed group sizes (4 + 6 = 10)', () => {
    const groups = [group(1, 'IQ', 3), group(2, 'IQ', 4), group(3, 'IQ', 5), group(4, 'IQ', 6)];
    for (let seed = 1; seed <= 400; seed++) {
      const { questions } = drawWithGroups([], groups, [{ category: 'IQ', count: 10 }], { rng: seeded(seed) });
      expect(questions).toHaveLength(10);
    }
  });

  it('reports a shortfall when the whole pool is smaller than the count', () => {
    const { questions, shortfalls } = drawWithGroups(singles('IQ', 3), [group(1, 'IQ', 4)], [], { questionCount: 20, rng: seeded(1) });
    expect(questions).toHaveLength(7);
    expect(shortfalls).toEqual([{ category: '*', requested: 20, served: 7 }]);
  });
});

describe('drawWithGroups: re-attempts', () => {
  it('prefers units the previous attempt did not serve when enough remain', () => {
    const pool = singles('IQ', 20);
    const groups = [group(1, 'IQ', 4), group(2, 'IQ', 4), group(3, 'IQ', 4)];
    const first = drawWithGroups(pool, groups, [{ category: 'IQ', count: 8 }], { rng: seeded(11) }).questions;
    const seen = new Set(first.map((x) => x.id));
    for (let seed = 1; seed <= 100; seed++) {
      const again = drawWithGroups(pool, groups, [{ category: 'IQ', count: 8 }], { exclude: seen, rng: seeded(seed) }).questions;
      expect(again).toHaveLength(8);
      expect(again.some((x) => seen.has(x.id))).toBe(false);
    }
  });

  it('treats a group as seen if any one of its questions was served', () => {
    const groups = [group(1, 'IQ', 4), group(2, 'IQ', 4)];
    const seen = new Set([groups[0].questions[2].id]);
    for (let seed = 1; seed <= 50; seed++) {
      const { groupIds } = drawWithGroups([], groups, [{ category: 'IQ', count: 4 }], { exclude: seen, rng: seeded(seed) });
      expect(groupIds).toEqual([2]);
    }
  });

  it('falls back to the whole bucket when too few unseen slots remain', () => {
    const pool = singles('IQ', 4);
    const groups = [group(1, 'IQ', 4)];
    const everything = new Set([...pool.map((x) => x.id), ...groups[0].questions.map((x) => x.id)]);
    const { questions } = drawWithGroups(pool, groups, [{ category: 'IQ', count: 6 }], { exclude: everything, rng: seeded(5) });
    expect(questions).toHaveLength(6); // served short of unseen, not short of the count
  });
});

describe('drawWithGroups: distribution and equivalence', () => {
  it('group slots follow the pool composition (about 20% grouped in, about 20% out)', () => {
    const pool = singles('IQ', 80);
    const groups = Array.from({ length: 5 }, (_, i) => group(i + 1, 'IQ', 4)); // 20 of 100 questions
    let groupSlots = 0;
    const runs = 2000;
    for (let seed = 1; seed <= runs; seed++) {
      const r = drawWithGroups(pool, groups, [{ category: 'IQ', count: 20 }], { rng: seeded(seed) });
      groupSlots += r.groupIds.length * 4;
    }
    const share = groupSlots / (runs * 20);
    expect(share).toBeGreaterThan(0.12);
    expect(share).toBeLessThan(0.28);
  });

  it('with no groups, matches the plain mix draw: same counts per category, no repeats', () => {
    const pool = [...singles('LR', 30), ...singles('DI', 30)];
    const rules = [
      { category: 'LR', count: 10 },
      { category: 'DI', count: 7 },
    ];
    for (let seed = 1; seed <= 200; seed++) {
      const grouped = drawWithGroups(pool, [], rules, { rng: seeded(seed) });
      const plain = drawQuestions(pool, rules);
      expect(countBy(grouped.questions)).toEqual(countBy(plain.questions));
      expect(grouped.shortfalls).toEqual(plain.shortfalls);
      expect(new Set(grouped.questions.map((x) => x.id)).size).toBe(17);
    }
  });

  it('shuffles units together so the exam is not grouped by category', () => {
    const pool = [...singles('LR', 10), ...singles('DI', 10)];
    let interleaved = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const { questions } = drawWithGroups(pool, [], [{ category: 'LR', count: 5 }, { category: 'DI', count: 5 }], { rng: seeded(seed) });
      if (questions.slice(0, 5).some((x) => x.category === 'DI')) interleaved++;
    }
    expect(interleaved).toBeGreaterThan(80);
  });

  it('ignores a rule count of zero and empty groups', () => {
    const { questions } = drawWithGroups(singles('LR', 5), [{ id: 9, category: 'LR', questions: [] }], [{ category: 'LR', count: 0 }], { rng: seeded(2) });
    expect(questions).toEqual([]);
  });

  it('never serves a group whose category the mix does not ask for', () => {
    const { groupIds } = drawWithGroups(singles('LR', 10), [group(1, 'GK', 4)], [{ category: 'LR', count: 5 }], { rng: seeded(2) });
    expect(groupIds).toEqual([]);
  });
});
