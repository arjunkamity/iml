import { createHash, createHmac, timingSafeEqual } from 'crypto';

// Admin-generated direct-login links for a School (Admin > Schools > Magic
// Link) — stateless and signed, so no School column/migration is needed.
// Unlike a student's access token (open-ended until regenerated), these
// expire on their own and also die the moment the school's password is
// set or changed: the signed payload carries a fingerprint of the current
// password hash, checked again at consume time.

export type SchoolLoginAs = 'admin' | 'coordinator';

export const SCHOOL_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error('JWT_ACCESS_SECRET is not set');
  return s;
}

export function passwordFingerprint(hash: string | null | undefined): string {
  return createHash('sha256').update(hash ?? '').digest('hex').slice(0, 12);
}

function mac(body: string): Buffer {
  return createHmac('sha256', secret()).update(`school-link:${body}`).digest();
}

export function signSchoolLink(schoolId: number, loginAs: SchoolLoginAs, passwordHash: string | null) {
  const expiresAt = Date.now() + SCHOOL_LINK_TTL_MS;
  const body = Buffer.from(
    `${schoolId}.${loginAs}.${expiresAt}.${passwordFingerprint(passwordHash)}`,
  ).toString('base64url');
  return { token: `${body}.${mac(body).toString('base64url')}`, expiresAt: new Date(expiresAt) };
}

export function verifySchoolLink(
  token: string,
): { schoolId: number; loginAs: SchoolLoginAs; fingerprint: string } | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = mac(body);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [id, loginAs, exp, fingerprint] = Buffer.from(body, 'base64url').toString().split('.');
  if (Number(exp) < Date.now()) return null;
  if (loginAs !== 'admin' && loginAs !== 'coordinator') return null;
  const schoolId = Number(id);
  if (!Number.isInteger(schoolId)) return null;
  return { schoolId, loginAs, fingerprint };
}
