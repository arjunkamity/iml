import { describeChange, diffConfig } from './config-diff';

describe('diffConfig', () => {
  it('finds nothing when nothing changed', () => {
    expect(diffConfig({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toEqual([]);
  });

  it('reports changed, added and removed values with their path', () => {
    const c = diffConfig({ branding: { primaryColor: '#111111', footerText: 'x' }, n: 1 }, { branding: { primaryColor: '#222222', logoUrl: 'u' }, n: 1 });
    expect(c).toEqual([
      { path: 'branding.primaryColor', kind: 'changed', before: '#111111', after: '#222222' },
      { path: 'branding.footerText', kind: 'removed', before: 'x' },
      { path: 'branding.logoUrl', kind: 'added', after: 'u' },
    ]);
  });

  it('matches list items by key, so a reorder is not a delete and add', () => {
    const before = { competencies: [{ key: 'A', weight: 1 }, { key: 'B', weight: 1 }] };
    const after = { competencies: [{ key: 'B', weight: 2 }, { key: 'A', weight: 1 }] };
    const c = diffConfig(before, after);
    expect(c.find((x) => x.path === 'competencies[B].weight')).toEqual({ path: 'competencies[B].weight', kind: 'changed', before: 1, after: 2 });
    expect(c.some((x) => x.kind === 'added' || x.kind === 'removed')).toBe(false);
    expect(c.find((x) => x.path === 'competencies (order)')).toBeTruthy();
  });

  it('shows an added and a removed item', () => {
    const c = diffConfig({ levels: [{ key: 'A' }, { key: 'B' }] }, { levels: [{ key: 'B' }, { key: 'C' }] });
    expect(c.map((x) => [x.path, x.kind])).toEqual([['levels[A]', 'removed'], ['levels[C]', 'added']]);
  });

  it('compares plain lists by position', () => {
    expect(diffConfig({ x: [1, 2] }, { x: [1, 3, 4] }).map((c) => [c.path, c.kind])).toEqual([['x[1]', 'changed'], ['x[2]', 'added']]);
  });

  it('describes a change in one line', () => {
    expect(describeChange({ path: 'a', kind: 'changed', before: 'x', after: 'y' })).toBe('a: "x" → "y"');
    expect(describeChange({ path: 'a', kind: 'added', after: 1 })).toBe('a: added 1');
  });
});
