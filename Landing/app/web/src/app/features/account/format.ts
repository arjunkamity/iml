// Shared formatting helpers for the student account area.

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isNaN(d.getTime()) && /T\d{2}:/.test(value)) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  const m = String(value).match(/^(\d{2}):(\d{2})/);
  if (!m) return String(value);
  let h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${suffix}`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatINR(amount: number | string | null): string {
  const n = Number(amount ?? 0);
  if (Number.isNaN(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatScore(score: string | number | null): number {
  const n = Number(score ?? 0);
  return Number.isNaN(n) ? 0 : n;
}

export function initialsOf(name?: string | null): string {
  const parts = (name ?? 'Student').trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'S';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1];
  return (first + (last ?? '')).toUpperCase();
}

export function startsInMs(date?: string | null, time?: string | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  if (time) {
    const m = String(time).match(/^(\d{2}):(\d{2})/);
    if (m) {
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    }
  }
  return d.getTime() - Date.now();
}

export function countdownParts(ms: number): {
  days: string;
  hours: string;
  mins: string;
  secs: string;
} {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    days: String(d).padStart(2, '0'),
    hours: String(h).padStart(2, '0'),
    mins: String(m).padStart(2, '0'),
    secs: String(s).padStart(2, '0'),
  };
}
