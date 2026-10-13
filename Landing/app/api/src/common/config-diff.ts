// A readable difference between two versions of a configuration (a framework or a report
// template, #87). Pure and DB-free. Arrays of objects that have a "key" or "code" are matched
// by it, so moving a competency does not look like deleting and adding it.

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface Change {
  /** Where, in words a person can follow: dimensions[THINK].label */
  path: string;
  kind: ChangeKind;
  before?: unknown;
  after?: unknown;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const idOf = (v: unknown): string | null => (isObj(v) ? (typeof v.key === 'string' ? v.key : typeof v.code === 'string' ? v.code : null) : null);

export function diffConfig(before: unknown, after: unknown, path = ''): Change[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const here = path || '(whole configuration)';
  if (before === undefined) return [{ path: here, kind: 'added', after }];
  if (after === undefined) return [{ path: here, kind: 'removed', before }];

  if (Array.isArray(before) && Array.isArray(after)) {
    const keyed = [...before, ...after].every((x) => idOf(x) !== null);
    if (keyed && before.length + after.length > 0) {
      const b = new Map(before.map((x) => [idOf(x) as string, x]));
      const a = new Map(after.map((x) => [idOf(x) as string, x]));
      const out: Change[] = [];
      for (const [k, v] of b) out.push(...(a.has(k) ? diffConfig(v, a.get(k), `${path}[${k}]`) : [{ path: `${path}[${k}]`, kind: 'removed' as const, before: v }]));
      for (const [k, v] of a) if (!b.has(k)) out.push({ path: `${path}[${k}]`, kind: 'added', after: v });
      // the same items in a different order is a change worth showing
      const orderB = before.map(idOf).filter((k) => a.has(k as string)).join('|');
      const orderA = after.map(idOf).filter((k) => b.has(k as string)).join('|');
      if (orderA !== orderB) out.push({ path: `${here} (order)`, kind: 'changed', before: orderB.split('|'), after: orderA.split('|') });
      return out;
    }
    const out: Change[] = [];
    for (let i = 0; i < Math.max(before.length, after.length); i++) out.push(...diffConfig(before[i], after[i], `${path}[${i}]`));
    return out;
  }

  if (isObj(before) && isObj(after)) {
    const out: Change[] = [];
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) out.push(...diffConfig(before[k], after[k], path ? `${path}.${k}` : k));
    return out;
  }
  return [{ path: here, kind: 'changed', before, after }];
}

/** One line per change, for a quick read or the audit log. */
export function describeChange(c: Change): string {
  const show = (v: unknown) => (typeof v === 'string' ? `"${v}"` : JSON.stringify(v));
  if (c.kind === 'added') return `${c.path}: added ${show(c.after)}`;
  if (c.kind === 'removed') return `${c.path}: removed ${show(c.before)}`;
  return `${c.path}: ${show(c.before)} → ${show(c.after)}`;
}
