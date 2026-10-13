import { drawQuestions } from './question-draw';

// C1's real pool shape: DI 80, GK 100, LR 80, PR 80.
function makePool(sizes: Record<string, number>) {
  const pool: { id: number; category: string }[] = [];
  let id = 1;
  for (const [category, n] of Object.entries(sizes)) {
    for (let i = 0; i < n; i++) pool.push({ id: id++, category });
  }
  return pool;
}

const countBy = (qs: { category: string }[]) =>
  qs.reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.category]: (acc[q.category] ?? 0) + 1 }), {});

describe('drawQuestions', () => {
  const pool = makePool({ DI: 80, GK: 100, LR: 80, PR: 80 });
  const rules = [
    { category: 'LR', count: 10 },
    { category: 'DI', count: 10 },
    { category: 'PR', count: 10 },
    { category: 'GK', count: 10 },
  ];

  it('serves exactly the requested number per category, every time', () => {
    for (let run = 0; run < 500; run++) {
      const { questions, shortfalls } = drawQuestions(pool, rules);
      expect(questions).toHaveLength(40);
      expect(countBy(questions)).toEqual({ LR: 10, DI: 10, PR: 10, GK: 10 });
      expect(shortfalls).toEqual([]);
    }
  });

  it('never repeats a question within one draw', () => {
    for (let run = 0; run < 200; run++) {
      const ids = drawQuestions(pool, rules).questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('only serves categories that have a rule', () => {
    const { questions } = drawQuestions(pool, [{ category: 'GK', count: 5 }]);
    expect(Object.keys(countBy(questions))).toEqual(['GK']);
    expect(questions).toHaveLength(5);
  });

  it('does not serve in category blocks (combined set is shuffled)', () => {
    let blocked = 0;
    for (let run = 0; run < 200; run++) {
      const cats = drawQuestions(pool, rules).questions.map((q) => q.category);
      const grouped = [...cats].sort().join() === cats.join();
      if (grouped) blocked++;
    }
    expect(blocked).toBe(0);
  });

  it('draws different questions across runs (random, not fixed)', () => {
    const seenGk = new Set<number>();
    for (let run = 0; run < 100; run++) {
      for (const q of drawQuestions(pool, rules).questions) if (q.category === 'GK') seenGk.add(q.id);
    }
    expect(seenGk.size).toBeGreaterThan(80);
  });

  it('reports a shortfall and serves what exists when a category is too small', () => {
    const small = makePool({ LR: 3, GK: 20 });
    const { questions, shortfalls } = drawQuestions(small, [
      { category: 'LR', count: 10 },
      { category: 'GK', count: 10 },
    ]);
    expect(countBy(questions)).toEqual({ LR: 3, GK: 10 });
    expect(shortfalls).toEqual([{ category: 'LR', requested: 10, served: 3 }]);
  });

  it('treats a category with no questions as a full shortfall, not an error', () => {
    const { questions, shortfalls } = drawQuestions(pool, [{ category: 'Nope', count: 4 }]);
    expect(questions).toEqual([]);
    expect(shortfalls).toEqual([{ category: 'Nope', requested: 4, served: 0 }]);
  });

  describe('re-attempt exclusion (per category)', () => {
    it('avoids previously served questions when enough unseen remain', () => {
      const first = drawQuestions(pool, rules).questions;
      const exclude = new Set(first.map((q) => q.id));
      for (let run = 0; run < 100; run++) {
        const again = drawQuestions(pool, rules, exclude).questions;
        expect(again.some((q) => exclude.has(q.id))).toBe(false);
        expect(countBy(again)).toEqual({ LR: 10, DI: 10, PR: 10, GK: 10 });
      }
    });

    it('falls back to the whole category when too few unseen remain, keeping the count', () => {
      const tight = makePool({ LR: 12 });
      const exclude = new Set(tight.slice(0, 6).map((q) => q.id)); // only 6 unseen, 10 wanted
      const { questions, shortfalls } = drawQuestions(tight, [{ category: 'LR', count: 10 }], exclude);
      expect(questions).toHaveLength(10);
      expect(shortfalls).toEqual([]);
    });

    it('applies the fallback independently per category', () => {
      const p = makePool({ LR: 10, GK: 50 });
      const exclude = new Set(p.filter((q) => q.category === 'LR').map((q) => q.id)); // LR fully seen
      const exclude2 = new Set([...exclude, ...p.filter((q) => q.category === 'GK').slice(0, 5).map((q) => q.id)]);
      const { questions } = drawQuestions(p, [{ category: 'LR', count: 5 }, { category: 'GK', count: 10 }], exclude2);
      expect(countBy(questions)).toEqual({ LR: 5, GK: 10 });
      // LR had no unseen so repeats are allowed; GK had plenty so it must avoid the 5 seen ones.
      const seenGk = new Set(p.filter((q) => q.category === 'GK').slice(0, 5).map((q) => q.id));
      expect(questions.filter((q) => q.category === 'GK').some((q) => seenGk.has(q.id))).toBe(false);
    });
  });

  it('ignores non-positive counts safely', () => {
    expect(drawQuestions(pool, [{ category: 'GK', count: 0 }]).questions).toEqual([]);
    expect(drawQuestions(pool, [{ category: 'GK', count: -3 }]).questions).toEqual([]);
  });
});
