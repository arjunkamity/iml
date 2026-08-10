export function nextCode(codes: string[], prefix: string): string {
  let max = 0;
  let width = 1;
  for (const c of codes) {
    const m = c.match(/(\d+)$/);
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
      width = Math.max(width, m[1].length);
    }
  }
  return `${prefix}${String(max + 1).padStart(width, '0')}`;
}

export function toDate(
  value: string | Date | undefined | null,
): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return value instanceof Date ? value : new Date(`${value}`);
}

export function toTime(
  value: string | Date | undefined | null,
): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) return value;
  return new Date(`2000-01-01T${value}`);
}

export function toDecimal(value: number | string | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0;
  return typeof value === 'number' ? value : parseFloat(value);
}

export function parseIntOr(
  value: string | undefined,
  fallback: number,
): number {
  const n = parseInt(value ?? '', 10);
  return Number.isNaN(n) ? fallback : n;
}
