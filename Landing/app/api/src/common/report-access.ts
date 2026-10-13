// Who may see a scorecard report, and how it reaches them (#74): the audiences, a season's
// delivery settings, which sections each audience sees, consent, and the secure parent link.
// Pure rules (plus small crypto helpers) with no database, so they can be tested.
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

export const AUDIENCES = ['student', 'parent', 'school'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const isAudience = (v: unknown): v is Audience => typeof v === 'string' && (AUDIENCES as readonly string[]).includes(v);

export interface DeliverySettings {
  /** Parent and school may only get a report after the student has accepted the consent text. */
  consentRequired: boolean;
  /** Tell the student by SMS / email when a report is released. */
  notifyStudent: boolean;
  /** How long a parent link works. */
  linkValidDays: number;
}

export const DEFAULT_LINK_VALID_DAYS = 30;
export const MAX_LINK_VALID_DAYS = 180;

export function normalizeDeliverySettings(raw: unknown): DeliverySettings {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const days = typeof c.linkValidDays === 'number' && Number.isFinite(c.linkValidDays) ? Math.round(c.linkValidDays) : DEFAULT_LINK_VALID_DAYS;
  return {
    consentRequired: c.consentRequired !== false,
    notifyStudent: c.notifyStudent !== false,
    linkValidDays: Math.min(MAX_LINK_VALID_DAYS, Math.max(1, days)),
  };
}

export function validateDeliverySettings(raw: unknown): string[] {
  const issues: string[] = [];
  if (!raw || typeof raw !== 'object') return ['The delivery settings must be an object.'];
  const c = raw as Record<string, unknown>;
  for (const k of ['consentRequired', 'notifyStudent'] as const) {
    if (c[k] !== undefined && typeof c[k] !== 'boolean') issues.push(`${k} must be true or false.`);
  }
  if (c.linkValidDays !== undefined && (!Number.isInteger(c.linkValidDays) || (c.linkValidDays as number) < 1 || (c.linkValidDays as number) > MAX_LINK_VALID_DAYS)) {
    issues.push(`A link can be valid for 1 to ${MAX_LINK_VALID_DAYS} days.`);
  }
  return issues;
}

/** A section with no audiences listed is shown to everyone. */
export const sectionVisibleTo = (section: { audiences?: string[] }, audience: Audience): boolean => !section.audiences || section.audiences.includes(audience);

/**
 * The audiences that need their own copy of the PDF: those a shown section is hidden from.
 * Everyone else uses the full file.
 */
export function variantAudiences(sections: { enabled: boolean; audiences?: string[] }[]): Audience[] {
  return AUDIENCES.filter((a) => sections.some((s) => s.enabled && s.audiences && !s.audiences.includes(a)));
}

export interface ShareDecision {
  allowed: boolean;
  /** Plain words for an admin or student when it is not allowed. */
  reason?: string;
}

/** The student always sees their own report; parent and school need consent when the season asks for it. */
export function mayShare(audience: Audience, settings: DeliverySettings, hasConsent: boolean): ShareDecision {
  if (audience === 'student') return { allowed: true };
  if (!settings.consentRequired || hasConsent) return { allowed: true };
  return { allowed: false, reason: `The student has not agreed to share reports with their ${audience}.` };
}

export type ReleaseState = 'Not released' | 'Released' | 'Withdrawn';

export const releaseState = (r: { releasedAt: Date | null; withdrawnAt: Date | null }): ReleaseState => (!r.releasedAt ? 'Not released' : r.withdrawnAt ? 'Withdrawn' : 'Released');

/** The report an audience sees for one student and stage: the newest version that is released and not withdrawn. */
export function visibleReport<T extends { version: number; status: string; releasedAt: Date | null; withdrawnAt: Date | null }>(rows: T[]): T | null {
  const ok = rows.filter((r) => r.status === 'Ready' && r.releasedAt && !r.withdrawnAt);
  return ok.sort((a, b) => b.version - a.version)[0] ?? null;
}

// ------------------------------------------------------------ parent link

export const MAX_CODE_ATTEMPTS = 5;

export type LinkState = 'ok' | 'expired' | 'revoked' | 'locked';

export function linkState(link: { expiresAt: Date; revokedAt: Date | null; attempts: number }, now: Date = new Date()): LinkState {
  if (link.revokedAt) return 'revoked';
  if (link.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (link.attempts >= MAX_CODE_ATTEMPTS) return 'locked';
  return 'ok';
}

export const newToken = (): string => randomBytes(32).toString('base64url');
/** Six digits, leading zeros kept. */
export const newCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
export const hashCode = (tokenHash: string, code: string): string => createHash('sha256').update(`${tokenHash}:${code.trim()}`).digest('hex');

export function codesMatch(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}
