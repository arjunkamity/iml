// Shared formatting helpers for the student account area.
//
// Every real (non-bare-HH:MM) Date/timestamp below is formatted with an
// explicit `timeZone: 'Asia/Kolkata'` rather than left to
// toLocaleDateString/toLocaleTimeString's default of the VIEWER's OWN
// device timezone. This is an India-only, IST-anchored platform — a
// parent checking from abroad, or any device with a misconfigured clock,
// would otherwise silently see the wrong exam time with no indication
// anything was converted. Bare "HH:MM" wall-clock values (exam start
// time) are NOT timezone-converted here, correctly — they're already
// IST by convention, not a UTC-tagged instant.
const IST = 'Asia/Kolkata';

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isNaN(d.getTime()) && /T\d{2}:/.test(value)) {
    return d.toLocaleTimeString('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit' });
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
  return `${d.toLocaleDateString('en-IN', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit' })}`;
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

// Was `new Date(date)` (parses a bare "YYYY-MM-DD" as UTC midnight) then
// `.setHours(h, m)` (sets the hour in the BROWSER's own local timezone)
// until 2026-09-11 — mixing a UTC-anchored date with a local-timezone
// hour-set produces the wrong instant for any viewer not set to IST,
// silently showing a wrong countdown to their own exam. Built explicitly
// in IST instead, same +05:30-offset idiom as the backend's toTime().
export function startsInMs(date?: string | null, time?: string | null): number | null {
  if (!date) return null;
  const datePart = String(date).slice(0, 10);
  const timeMatch = time ? String(time).match(/^(\d{2}):(\d{2})/) : null;
  const timePart = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '00:00';
  const d = new Date(`${datePart}T${timePart}:00+05:30`);
  if (Number.isNaN(d.getTime())) return null;
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
