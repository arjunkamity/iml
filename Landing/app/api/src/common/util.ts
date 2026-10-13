import type { PrismaService } from '../prisma/prisma.service';

/** Fisher-Yates — unbiased, and doesn't mutate the input array. Shared by
 * StudentService (real exam question order) and PublicService (demo exam). */
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Exam availability window = date + time (same instant the UI shows) up
 * to start + duration minutes. Shared by StudentService (gating a
 * student's own start/schedules) and CertificateQueueService (deciding
 * whether ANY exam is currently open, before draining the certificate
 * queue). */
export function examWindow(exam: {
  date: Date | null;
  time: Date | null;
  durationMin: number | null;
}): { start: Date; end: Date } | null {
  if (!exam.date) return null;
  const d = new Date(exam.date);
  if (Number.isNaN(d.getTime())) return null;
  const t = exam.time ? new Date(exam.time) : null;
  const datePart = d.toISOString().slice(0, 10);
  const timePart =
    t && !Number.isNaN(t.getTime())
      ? t.toISOString().slice(11, 16)
      : '00:00';
  const start = new Date(`${datePart}T${timePart}Z`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + (exam.durationMin ?? 15) * 60 * 1000);
  return { start, end };
}

/**
 * Backfills RegistrationStage rows for any CompetitionStage that doesn't yet
 * have one on this registration. Covers two real gaps: a student registered
 * before all the competition's stages were configured (register() only ever
 * creates rows for stages that existed at that moment), and an admin adding
 * a new stage to a competition that already has registrants. Only the very
 * first stage (by position) ever auto-unlocks, and only if it's free —
 * everything else starts Locked, matching the rule applied at registration
 * time. Safe to call on every read; it's a no-op once nothing is missing.
 */
export async function ensureRegistrationStages(
  prisma: PrismaService,
  registrationId: number,
  competitionId: number,
): Promise<void> {
  const [stages, existing] = await Promise.all([
    prisma.competitionStage.findMany({
      where: { competitionId },
      orderBy: { position: 'asc' },
    }),
    prisma.registrationStage.findMany({
      where: { registrationId },
      select: { stageId: true },
    }),
  ]);
  const have = new Set(existing.map((rs) => rs.stageId));
  const missing = stages.filter((s) => !have.has(s.id));
  if (!missing.length) return;

  const firstStageId = stages[0]?.id;
  await prisma.registrationStage.createMany({
    data: missing.map((s) => {
      const opensNow = s.id === firstStageId && s.isFree;
      return {
        registrationId,
        stageId: s.id,
        status: opensNow ? 'Unlocked' : 'Locked',
        unlockedAt: opensNow ? new Date() : null,
      };
    }),
    skipDuplicates: true,
  });
}

// Shared by exam access-gating (student.service.ts) and batch auto-assign
// eligibility (admin content.service.ts) — a stage/exam's grade band (e.g.
// "9-10", "9,10", "All") matched against one student's own grade.
export function gradeMatches(examGrade: string, studentGrade: string): boolean {
  const eg = examGrade.trim().toLowerCase();
  if (!eg || eg === 'all' || eg === 'any') return true;
  const nums = eg
    .split(/[-,&/]/)
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
  if (!nums.length) return true;
  const sg = parseInt(studentGrade, 10);
  return !Number.isNaN(sg) && nums.includes(sg);
}

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

// ---------------------------------------------------------------------------
// School duplicate-name matching
// ---------------------------------------------------------------------------
// A real production incident: schools were piling up as near-duplicates —
// "Amity International School, Saket" vs "Amity international school saket"
// vs "Amityinternationalschool vrindavan" — because the only check that
// ever existed anywhere (student self-registration's resolveOrCreateSchoolId,
// and school self-registration's own name check) was an EXACT case-
// insensitive match. Different punctuation, spacing, or a missing word was
// enough to silently mint a brand-new, unverified School row every time,
// splitting one real school's students (and their paid registrations)
// across several records. A batch of these was found and merged by hand;
// this is what stops new ones from accumulating the same way.
//
// Bigram (2-character) Dice-coefficient similarity on the normalized name
// — catches spacing/punctuation/case differences AND a missing/extra word
// (e.g. "Amityinternationalschool vrindavan" vs "Amity International
// School Vrindavan Yojana"), which plain normalized-string-equality does
// not. ~200-300 schools total, so scanning all of them per call is trivial.

function normalizeSchoolName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function bigramCounts(s: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2);
    counts.set(bg, (counts.get(bg) ?? 0) + 1);
  }
  return counts;
}

function diceSimilarity(a: string, b: string): number {
  const A = bigramCounts(a);
  const B = bigramCounts(b);
  let overlap = 0, totalA = 0, totalB = 0;
  for (const v of A.values()) totalA += v;
  for (const v of B.values()) totalB += v;
  for (const [bg, cnt] of A) if (B.has(bg)) overlap += Math.min(cnt, B.get(bg)!);
  return totalA + totalB === 0 ? 0 : (2 * overlap) / (totalA + totalB);
}

export interface SimilarSchoolMatch {
  id: number;
  code: string;
  name: string;
  verified: boolean;
  similarity: number;
}

/** Finds the closest existing School to `name` by fuzzy name similarity,
 * excluding `excludeId` (so an update on a school doesn't match itself).
 * Returns null if nothing clears `threshold` (default 0.82 — tuned against
 * the real duplicate batch found in production: every genuine duplicate in
 * that batch scored 0.93+, while every genuinely-different school sharing
 * only a generic word or trust name scored 0.82 or below). */
export async function findSimilarSchool(
  prisma: PrismaService,
  name: string,
  opts?: { excludeId?: number; threshold?: number },
): Promise<SimilarSchoolMatch | null> {
  const target = normalizeSchoolName(name);
  if (!target) return null;
  const threshold = opts?.threshold ?? 0.82;
  const schools = await prisma.school.findMany({
    select: { id: true, code: true, name: true, verified: true },
  });
  let best: SimilarSchoolMatch | null = null;
  for (const s of schools) {
    if (s.id === opts?.excludeId) continue;
    const similarity = diceSimilarity(target, normalizeSchoolName(s.name));
    if (similarity >= threshold && (!best || similarity > best.similarity)) {
      best = { id: s.id, code: s.code, name: s.name, verified: s.verified, similarity };
    }
  }
  return best;
}

/** A brand-new student's FIRST registration reuses the SAME code for both
 * Student.code and Registration.code (see PublicService.register()) — so
 * the two are really one shared numbering space, not two independent
 * ones. Every OTHER place that mints a Registration.code (an existing
 * student joining an ADDITIONAL competition — see
 * PublicService.joinExistingStudentToCompetition and
 * StudentService.joinCompetition) must draw from the union of both
 * tables' codes, or the two pools drift apart and a later insert into
 * either one can collide with a number the other pool already used.
 * (A real P2002 unique-constraint failure surfaced this during testing
 * before this helper existed — the fix is this single shared source of
 * truth, not a patch on any one call site.) */
export async function nextRegistrationCode(prisma: PrismaService): Promise<string> {
  const [students, registrations] = await Promise.all([
    prisma.student.findMany({ select: { code: true } }),
    prisma.registration.findMany({ select: { code: true } }),
  ]);
  return nextCode([...students.map((s) => s.code), ...registrations.map((r) => r.code)], 'R');
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
  // Admin-entered clock time is always IST (this is an India-only
  // platform) — attach an explicit +05:30 offset so the stored UTC instant
  // is correct no matter what timezone the server process itself runs in
  // (production runs in UTC). A date-TIME string with NO offset parses as
  // the RUNNING PROCESS's local time per the ECMAScript spec, not a fixed
  // zone, which silently shifted every exam time by 5.5 hours before this.
  const hms = value.length <= 5 ? `${value}:00` : value; // "HH:MM" -> "HH:MM:SS"
  return new Date(`2000-01-01T${hms}+05:30`);
}

/** Formats a Date as a human-readable IST calendar date (e.g. "11 Sep
 * 2026") for message templates. Never use bare `Date.toDateString()` for
 * this — it always renders in the SERVER's own timezone (UTC in
 * production), not IST, same class of bug as toTime() above (and one
 * that reached a real student-facing payment email before being caught
 * — see PaymentReconcileService). */
export function formatIstDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
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

// Simple A-F letter-grade scale used when a Competition's scoringMode is
// 'GRADE' — shared by the student result endpoints and certificate
// rendering so the letter grade shown never drifts between the two.
const GRADE_BANDS: Array<{ min: number; label: string }> = [
  { min: 90, label: 'A+' },
  { min: 80, label: 'A' },
  { min: 70, label: 'B+' },
  { min: 60, label: 'B' },
  { min: 50, label: 'C' },
  { min: 40, label: 'D' },
  { min: 0, label: 'F' },
];
export function gradeForPercent(percent: number): string {
  const p = Number.isFinite(percent) ? percent : 0;
  return (GRADE_BANDS.find((b) => p >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1]).label;
}

// Renders a result according to the competition's configured scoring mode —
// shared by the student result endpoints and certificate rendering so the
// number/label printed on the certificate always matches what the student
// sees on their dashboard.
export function formatScore(
  mode: string | null | undefined,
  score: number,
  total: number,
  percent: number,
): string {
  switch (mode) {
    case 'GRADE':
      return gradeForPercent(percent);
    case 'FRACTION':
      return `${score}/${total}`;
    case 'PERCENT':
    default:
      return `${percent}%`;
  }
}
