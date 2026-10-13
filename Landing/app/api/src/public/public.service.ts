import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ensureRegistrationStages, findSimilarSchool, nextCode, nextRegistrationCode, shuffle } from '../common/util';
import { PaytmService } from '../payments/paytm.service';
import { PaymentReconcileService } from '../payments/payment-reconcile.service';
import { SettingsService } from '../settings/settings.service';
import { MessagingService } from '../messaging/messaging.service';
import { AuthService } from '../auth/auth.service';
import { renderParticipationCertificate } from '../certificates/certificate-renderer';
import { siteSettingToBrandAssets } from '../certificates/brand-assets';
import { PublicRegisterDto, RequestRegisterOtpDto, SubmitDemoExamDto } from './public.dto';

const REGISTER_OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paytm: PaytmService,
    private readonly paymentReconcile: PaymentReconcileService,
    private readonly settings: SettingsService,
    private readonly messaging: MessagingService,
    private readonly auth: AuthService,
  ) {}

  /** Branding/tracking config for the public site — no auth required. */
  siteSettings() {
    return this.settings.get();
  }

  /**
   * Step 1 of registration: send a one-time code to the email the student is
   * about to register with. Does not touch the Student table — nothing is
   * created until register() below verifies this code.
   *
   * Sent regardless of whether this email already has an account: an
   * existing student registering for an ADDITIONAL competition goes
   * through this exact same OTP step (it doubles as proof-of-ownership,
   * i.e. a login) — register() is what decides whether to create a new
   * student or add a registration to an existing one. Blocking here on
   * "already registered" used to dead-end that flow entirely.
   */
  async requestRegisterOtp({ email, phone }: RequestRegisterOtpDto) {
    const normalized = email.toLowerCase().trim();

    await this.prisma.otp.updateMany({
      where: { email: normalized, purpose: 'register', used: false },
      data: { used: true },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.otp.create({
      data: {
        email: normalized,
        code,
        purpose: 'register',
        expiresAt: new Date(Date.now() + REGISTER_OTP_TTL_MS),
      },
    });

    void this.messaging.dispatch('REGISTRATION_OTP', { email: normalized, phone }, { OTP: code });

    return { expiresIn: REGISTER_OTP_TTL_MS / 1000 };
  }

  /**
   * Which competition a registration lands in when the visitor didn't
   * arrive via a specific ?comp=CODE link (the plain /register page).
   * Order of precedence:
   *   1. An explicit competitionCode on the request (a ?comp= link).
   *   2. Site Settings' admin-configured Default Competition, IF it still
   *      resolves to a real competition.
   *   3. The old implicit fallback — whichever competition has
   *      status='Live' with the lowest id — kept only as a safety net for
   *      when no default has been set (or the one that was set got
   *      deleted/renamed), not as the primary mechanism anymore.
   */
  private async resolveCompetition(competitionCode?: string) {
    if (competitionCode) {
      return this.prisma.competition.findUnique({ where: { code: competitionCode } });
    }
    const setting = await this.settings.get();
    if (setting.defaultCompetitionCode) {
      const preferred = await this.prisma.competition.findUnique({
        where: { code: setting.defaultCompetitionCode },
      });
      if (preferred) return preferred;
    }
    return this.prisma.competition.findFirst({
      where: { status: 'Live' },
      orderBy: { id: 'asc' },
    });
  }

  async register(dto: PublicRegisterDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const otp = await this.prisma.otp.findFirst({
      where: { email: normalizedEmail, purpose: 'register', used: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP. Please request a new code.');
    }
    // Local-dev convenience only — see auth.service.ts's verifyOtp for the same pattern.
    const devBypass = process.env.DEV_OTP_BYPASS === 'true' && dto.otp.trim() === '123456';
    if (!devBypass) {
      if (otp.code !== dto.otp.trim()) {
        throw new BadRequestException('Invalid or expired OTP. Please request a new code.');
      }
      if (otp.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException('This OTP has expired. Please request a new code.');
      }
    }

    const gradeName = dto.grade.trim();
    const activeGrade = await this.prisma.grade.findUnique({
      where: { name: gradeName },
    });
    if (!activeGrade || !activeGrade.active) {
      throw new BadRequestException(
        'Please choose a valid class / grade from the list.',
      );
    }

    const competition = await this.resolveCompetition(dto.competitionCode);
    if (!competition) {
      throw new BadRequestException(
        'No open competition is available for registration.',
      );
    }

    // Only consumed once we're actually committed to succeeding — this
    // used to run right after the code check above, before grade/
    // competition validation, which meant a verified-correct OTP got
    // permanently burned by an UNRELATED validation failure (e.g. a
    // stale grade selection). The student then had no way forward except
    // requesting a brand-new OTP and starting over from scratch — which
    // is exactly what happened to a real registrant, 4 times in 8
    // minutes, before giving up with no account ever created (see #22).
    await this.prisma.otp.update({ where: { id: otp.id }, data: { used: true } });

    // Already has an account (from a previous competition, most likely) —
    // the OTP they just verified for THIS email address already proves
    // ownership, so this is effectively a login, not a conflict. Rather
    // than dead-ending with "please log in" and losing the competition
    // they came here to join, sign them in and add the registration under
    // their existing student record (name/grade/school on file, not
    // whatever was retyped into this form).
    //
    // archived:false — an archived student's email/phone is deliberately
    // freed up for reuse (see Student.archived); this lookup must not
    // find them, so registering again with the same address creates a
    // genuinely new student instead of resurrecting the archived one.
    const existing = await this.prisma.student.findFirst({
      where: { email: normalizedEmail, archived: false },
    });
    if (existing) {
      // A returning student's name/grade/school on file still win over
      // whatever's retyped into this form (see the comment above) — but
      // that policy exists to stop a typo from clobbering good data, not
      // to permanently strand a student who never had a school recorded.
      // If they don't have one yet and typed one just now, capture it.
      if (!existing.schoolId && dto.school?.trim()) {
        const schoolId = await this.resolveOrCreateSchoolId(dto.school);
        if (schoolId) {
          await this.prisma.student.update({ where: { id: existing.id }, data: { schoolId } });
        }
      }
      const joined = await this.joinExistingStudentToCompetition(existing.id, competition);
      const session = await this.auth.issueStudentSession(existing.id);
      return {
        registrationCode: joined.registrationCode,
        student: {
          code: existing.code,
          name: existing.name,
          grade: existing.grade,
          email: existing.email,
        },
        competition: joined.competition,
        duePayment: joined.duePayment,
        alreadyRegistered: joined.alreadyRegistered,
        accessToken: session.accessToken,
        authStudent: session.student,
      };
    }

    const schoolId = await this.resolveOrCreateSchoolId(dto.school);

    const code = await nextRegistrationCode(this.prisma);

    const student = await this.prisma.student.create({
      data: {
        code,
        name: dto.name.trim(),
        grade: gradeName,
        email: normalizedEmail,
        phone: dto.phone?.trim() ?? null,
        parent: dto.parent?.trim() ?? null,
        schoolId,
      },
    });

    const registration = await this.prisma.registration.create({
      data: {
        code,
        studentId: student.id,
        competitionId: competition.id,
        status: 'Registered',
        registeredAt: new Date(),
      },
    });

    const stageRows = await this.prisma.competitionStage.findMany({
      where: { competitionId: competition.id },
      orderBy: { position: 'asc' },
    });
    if (stageRows.length) {
      await this.prisma.registrationStage.createMany({
        data: stageRows.map((s, i) => {
          // Stage 1 only opens immediately when it's free. A paid stage 1
          // stays Locked until the fee is accepted (acceptStage) — same rule
          // already applied to every later stage.
          const opensNow = i === 0 && s.isFree;
          return {
            registrationId: registration.id,
            stageId: s.id,
            status: opensNow ? 'Unlocked' : 'Locked',
            unlockedAt: opensNow ? new Date() : null,
          };
        }),
      });
    }

    void this.messaging.dispatch(
      'REGISTRATION_SUCCESSFUL',
      { email: student.email, phone: student.phone },
      {
        Name: student.name,
        StudentName: student.name,
        RegID: code,
        Class: student.grade,
        SchoolName: dto.school?.trim() || '',
        LoginLink: 'https://indiamindleague.com/login',
      },
    );

    // Stage 1 only unlocked above if it's free — when it's paid, tell the
    // frontend right away so it can guide the student straight to payment
    // instead of leaving them to discover it later on the dashboard.
    const firstStage = stageRows[0];
    const duePayment =
      firstStage && !firstStage.isFree
        ? { stageId: firstStage.id, stageName: firstStage.name, price: Number(firstStage.price) }
        : null;

    // Sign the student in immediately so the success screen (and a
    // straight-to-Paytm "Pay Now") don't require a separate login step.
    const session = await this.auth.issueStudentSession(student.id);

    return {
      registrationCode: code,
      student: {
        code,
        name: student.name,
        grade: student.grade,
        email: student.email,
      },
      competition: { code: competition.code, title: competition.title },
      duePayment,
      accessToken: session.accessToken,
      authStudent: session.student,
    };
  }

  /** Adds a competition Registration (+ stages) for a student who already
   * has an account — shared by register() (existing-email case) and
   * StudentService.joinCompetition() (already-logged-in case). Idempotent:
   * a student already registered for this competition just gets their
   * existing registration back instead of an error. */
  /** Resolves the free-text school name typed into the registration form's
   * school picker — case-insensitive match against an existing School, or
   * auto-creates a new one when it isn't in the list yet (the picker's own
   * "+ Use '...' as a new school" affordance). Every school created this
   * way ends up looking identical to an admin-created one (same table, no
   * distinguishing flag exists) — an admin can rename/enrich it later from
   * Schools same as any other row. */
  private async resolveOrCreateSchoolId(rawName: string | undefined): Promise<number | null> {
    const name = rawName?.trim();
    if (!name) return null;
    const existingSchool = await this.prisma.school.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existingSchool) return existingSchool.id;
    // Exact match missed — try a fuzzy match before minting a new row. A
    // real production incident: a punctuation/spacing/case difference
    // alone (no admin ever in the loop to catch it) silently created a
    // fresh unverified School every time, splitting one real school's
    // students across several records. High threshold deliberately, since
    // this path is fully unsupervised: 0.92 only auto-attaches near-
    // identical name variants (exactly the kind that caused the real
    // incident), and never a distinct school that merely shares a chain
    // name or a nearby sector number — a false positive here would
    // silently attach a student to the WRONG school, which is worse than
    // the duplicate-row problem this exists to prevent. Anything less
    // confident than that still creates a new (unverified) row exactly as
    // before, for an admin to review — see Admin > Schools.
    const similar = await findSimilarSchool(this.prisma, name, { threshold: 0.92 });
    if (similar) return similar.id;
    try {
      return await this.createSchoolWithNextCode(name);
    } catch (err) {
      // Two registrations minting a brand-new school at the same instant
      // can both compute the same next code from the same snapshot and
      // collide on School.code's unique constraint — one retry against a
      // fresh snapshot (which now sees the other one's row) resolves it;
      // anything else is a genuine failure and should still surface.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.createSchoolWithNextCode(name);
      }
      throw err;
    }
  }

  private async createSchoolWithNextCode(name: string): Promise<number> {
    const schoolCodes = (
      await this.prisma.school.findMany({ select: { code: true } })
    ).map((s) => s.code);
    const school = await this.prisma.school.create({
      // Unverified — a student typed this, an admin hasn't reviewed it yet
      // (might be a duplicate/typo of an existing school). See Admin >
      // Schools to review and mark it verified.
      data: { code: nextCode(schoolCodes, 'S'), name, verified: false },
    });
    return school.id;
  }

  private async joinExistingStudentToCompetition(
    studentId: number,
    competition: { id: number; code: string; title: string },
  ) {
    const existingReg = await this.prisma.registration.findUnique({
      where: { studentId_competitionId: { studentId, competitionId: competition.id } },
    });

    const registration =
      existingReg ??
      (await this.prisma.registration.create({
        data: {
          code: await nextRegistrationCode(this.prisma),
          studentId,
          competitionId: competition.id,
          status: 'Registered',
          registeredAt: new Date(),
        },
      }));

    await ensureRegistrationStages(this.prisma, registration.id, competition.id);

    const firstStage = await this.prisma.competitionStage.findFirst({
      where: { competitionId: competition.id },
      orderBy: { position: 'asc' },
    });
    const firstRegStage = firstStage
      ? await this.prisma.registrationStage.findUnique({
          where: { registrationId_stageId: { registrationId: registration.id, stageId: firstStage.id } },
        })
      : null;
    const duePayment =
      firstStage && !firstStage.isFree && firstRegStage?.status === 'Locked'
        ? { stageId: firstStage.id, stageName: firstStage.name, price: Number(firstStage.price) }
        : null;

    return {
      registrationCode: registration.code,
      alreadyRegistered: !!existingReg,
      competition: { code: competition.code, title: competition.title },
      duePayment,
    };
  }

  async grades() {
    const rows = await this.prisma.grade.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { name: true, position: true },
    });
    return rows.map((g) => ({ name: g.name, position: g.position }));
  }

  /** Names only, for the registration form's school autocomplete — nothing else about a school is public. */
  async schools() {
    const rows = await this.prisma.school.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    return rows.map((s) => s.name);
  }

  async competitions() {
    const rows = await this.prisma.competition.findMany({
      where: { status: { in: ['Live', 'Open'] } },
      orderBy: { id: 'asc' },
      select: {
        code: true,
        title: true,
        status: true,
        grades: true,
        startDate: true,
        endDate: true,
        description: true,
        photoUrl: true,
        stages: {
          orderBy: { position: 'asc' },
          take: 1,
          select: { isFree: true, price: true },
        },
      },
    });
    // Flatten stage 1's fee onto the row — that's the only thing a
    // prospective registrant needs to know before signing up; the full
    // stage list isn't public API surface.
    return rows.map(({ stages, ...r }) => ({
      ...r,
      isFree: stages[0]?.isFree ?? true,
      price: stages[0] ? Number(stages[0].price) : 0,
    }));
  }

  async leaderboard(comp?: string) {
    const rows = await this.prisma.attempt.findMany({
      where: {
        finishedAt: { not: null },
        ...(comp ? { registration: { competition: { code: comp } } } : {}),
      },
      include: {
        registration: { include: { student: { include: { school: true } } } },
        stage: { select: { name: true, position: true } },
      },
      orderBy: [{ score: 'desc' }, { finishedAt: 'asc' }],
      take: 100,
    });
    return rows.map((a, i) => ({
      rank: i + 1,
      attemptCode: a.code,
      student: a.registration.student.name,
      studentCode: a.registration.student.code,
      grade: a.registration.student.grade,
      school: a.registration.student.school?.name ?? null,
      score: a.score,
      total: a.total,
      stage: a.stage?.name ?? null,
      finishedAt: a.finishedAt,
    }));
  }

  async leaderboardSchools(comp?: string) {
    const rows = await this.prisma.attempt.findMany({
      where: {
        finishedAt: { not: null },
        registration: {
          student: { schoolId: { not: null } },
          ...(comp ? { competition: { code: comp } } : {}),
        },
      },
      select: {
        score: true,
        total: true,
        registration: {
          select: { studentId: true, student: { select: { schoolId: true, school: { select: { name: true } } } } },
        },
      },
    });

    const bySchool = new Map<
      number,
      { name: string; totalScore: number; totalPossible: number; attempts: number; students: Set<number> }
    >();
    for (const a of rows) {
      const schoolId = a.registration.student.schoolId;
      const schoolName = a.registration.student.school?.name;
      if (!schoolId || !schoolName) continue;
      let entry = bySchool.get(schoolId);
      if (!entry) {
        entry = { name: schoolName, totalScore: 0, totalPossible: 0, attempts: 0, students: new Set() };
        bySchool.set(schoolId, entry);
      }
      entry.totalScore += Number(a.score);
      entry.totalPossible += Number(a.total);
      entry.attempts += 1;
      entry.students.add(a.registration.studentId);
    }

    return [...bySchool.values()]
      .map((s) => ({
        school: s.name,
        totalScore: s.totalScore,
        totalPossible: s.totalPossible,
        students: s.students.size,
        avgScore: s.attempts ? Math.round((s.totalScore / s.attempts) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 50)
      .map((s, i) => ({ rank: i + 1, ...s }));
  }

  async gallery() {
    const rows = await this.prisma.gallery.findMany({
      where: { visibility: 'Public', status: 'Active' },
      orderBy: { date: 'desc' },
      select: {
        code: true,
        name: true,
        date: true,
        cover: true,
        description: true,
        photos: true,
      },
    });
    return rows;
  }

  /** Published news, newest first — feeds the homepage News slider. */
  async news() {
    return this.prisma.news.findMany({
      where: { status: 'Published' },
      orderBy: [{ publishOn: 'desc' }, { id: 'desc' }],
      take: 12,
      select: { code: true, title: true, category: true, author: true, publishOn: true, photo: true, summary: true },
    });
  }

  /** Active announcements, pinned first then newest — feeds the homepage Announcements slider. */
  async announcements() {
    return this.prisma.announcement.findMany({
      where: { status: 'Active' },
      orderBy: [{ pinned: 'desc' }, { publishOn: 'desc' }, { id: 'desc' }],
      take: 12,
      select: { code: true, title: true, category: true, audience: true, publishOn: true, pinned: true, message: true },
    });
  }

  async faqs() {
    const rows = await this.prisma.faq.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { question: true, answer: true },
    });
    return rows.map((f) => ({ q: f.question, a: f.answer }));
  }

  /** Cheap existence check — drives whether the "Leaderboard" nav link shows at all. */
  async leaderboardHasEntries(): Promise<boolean> {
    const count = await this.prisma.attempt.count({ where: { finishedAt: { not: null } } });
    return count > 0;
  }

  /**
   * Handle Paytm's callback POST. The checksum only proves the payload came
   * from Paytm at some point — it is not trusted as the final word on the
   * transaction outcome. We always re-verify against the Order Status API.
   *
   * This is the FAST path — it only fires at all if the student's browser
   * completes the round-trip back to us after paying, which isn't
   * guaranteed (see PaymentReconcileService's doc comment). Whatever this
   * misses, that service's periodic sweep catches later using the exact
   * same applyResult() this delegates to, so the two paths can never
   * disagree about what a given Paytm result means.
   */
  async paytmCallback(body: Record<string, string>) {
    const orderId = body['ORDERID'];
    if (!orderId) throw new BadRequestException('Missing ORDERID in callback');

    const validChecksum = await this.paytm.verifyCallback(body);
    if (!validChecksum) {
      this.logger.warn(`Callback checksum failed to verify for order ${orderId}`);
    }

    const payment = await this.prisma.payment.findUnique({
      where: { code: orderId },
      include: {
        registration: { include: { student: true } },
        stage: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const result = await this.paytm.fetchOrderStatus(orderId);
    await this.paymentReconcile.applyResult(payment, result);

    const status =
      result.resultStatus === 'TXN_SUCCESS' ? 'Paid' : result.resultStatus === 'TXN_FAILURE' ? 'Failed' : 'Pending';
    this.logger.log(`Payment ${orderId} -> ${status} (${result.resultCode ?? ''} ${result.resultMsg ?? ''})`);
    return { orderId, status };
  }

  // ---- Default Demo Exam ----
  // Always-available "see how the test works" sample — public (no login
  // required, matches "always available for all"), pulling ONLY from the
  // isDemo:true question pool (see Question.isDemo and
  // StudentService.loadQuestions()'s explicit isDemo:false exclusion —
  // this pool and a real exam's pool can never overlap). Entirely
  // stateless: no Attempt row, no score history, unlimited retakes.

  async getDemoExam() {
    const setting = await this.settings.get();
    if (!setting.demoExamActive) {
      return { active: false as const };
    }

    const pool = await this.prisma.question.findMany({
      // groupId:null — a Question Group's sub-questions are only ever served through
      // their group in a real exam, never as loose demo questions.
      where: { isDemo: true, assessmentId: null, groupId: null },
      orderBy: [{ category: 'asc' }, { id: 'asc' }],
    });
    const questions = shuffle(pool).slice(
      0,
      setting.demoExamQuestionCount && setting.demoExamQuestionCount > 0
        ? setting.demoExamQuestionCount
        : pool.length,
    );

    return {
      active: true as const,
      title: setting.demoExamTitle,
      durationMin: setting.demoExamDurationMin,
      questions: questions.map((q) => ({
        id: q.id,
        code: q.code,
        category: q.category,
        qtype: q.qtype,
        media: q.media,
        mode: q.mode,
        label: q.label,
        prompt: q.prompt,
        options: q.options,
        timeLimitSecs: q.timeLimitSecs,
      })),
    };
  }

  /** Scores a demo run against whatever isDemo questions the submitted ids
   * resolve to — nothing is looked up by attempt/session, so there's
   * nothing to freeze or persist. The isDemo:true filter is what keeps
   * this endpoint from ever being usable to fish for a REAL question's
   * correct answer: only demo-pool questions are ever scored/revealed
   * here, regardless of what ids a client sends. */
  async submitDemoExam(dto: SubmitDemoExamDto) {
    const given = new Map<number, number[]>();
    for (const a of dto.answers ?? []) {
      if (!a || typeof a.questionId !== 'number') continue;
      const arr = Array.isArray(a.answer) ? a.answer.map(Number) : [];
      given.set(a.questionId, [...new Set(arr)].sort((x, y) => x - y));
    }

    const questions = given.size
      ? await this.prisma.question.findMany({
          where: { id: { in: [...given.keys()] }, isDemo: true, assessmentId: null },
        })
      : [];

    let score = 0;
    const review: Array<Record<string, unknown>> = [];
    for (const q of questions) {
      const correct = (Array.isArray(q.correct) ? q.correct : [])
        .map(Number)
        .sort((x, y) => x - y);
      const mine = given.get(q.id) ?? [];
      const isCorrect =
        correct.length === mine.length && correct.every((c, i) => c === mine[i]);
      if (isCorrect) score += 1;
      review.push({
        questionId: q.id,
        code: q.code,
        prompt: q.prompt,
        options: q.options,
        correct,
        given: mine,
        isCorrect,
      });
    }

    const total = questions.length;
    return {
      score,
      total,
      percent: total ? Math.round((score / total) * 100) : 0,
      review,
    };
  }

  /** Backs the public /verify/:code page and the QR code printed on every
   * certificate. Returns `{ found: false }` rather than a 404 for an
   * unknown code — this is a lookup, not a resource fetch, and the
   * frontend renders both outcomes as normal page states. Never returns
   * anything not already visible on the certificate itself (student name,
   * school, event, issue date) — no internal ids, no contact info. */
  /**
   * Public check of a scorecard report by the code printed on it. Deliberately shows no
   * scores: only that the report exists, who and what it is for, when it was issued, whether
   * it is the current version, and its file checksum (so a holder can compare the SHA-256
   * of their PDF).
   */
  async verifyScorecardReport(code: string) {
    const r = await this.prisma.scorecardReport.findUnique({
      where: { verificationCode: code.trim().toUpperCase() },
      include: { registration: { include: { student: { include: { school: true } }, competition: { include: { season: true } } } } },
    });
    // a report only exists publicly once an admin has released it
    if (!r || r.status !== 'Ready' || !r.releasedAt) return { found: false as const };
    const state = r.withdrawnAt && !r.supersededAt ? ('withdrawn' as const) : r.supersededAt ? ('superseded' as const) : ('current' as const);
    const stage = await this.prisma.competitionStage.findUnique({
      where: { competitionId_position: { competitionId: r.registration.competitionId, position: r.stagePosition } },
      select: { name: true },
    });
    return {
      found: true as const,
      code: r.verificationCode,
      studentName: r.registration.student.name,
      schoolName: r.registration.student.school?.name ?? null,
      edition: r.registration.competition.season?.editionLabel ?? r.registration.competition.title,
      stageName: r.stagePosition === 0 ? 'Future Readiness Scorecard' : stage?.name ?? `Stage ${r.stagePosition}`,
      version: r.version,
      current: state === 'current',
      state,
      issuedAt: r.generatedAt,
      checksum: r.checksum,
    };
  }

  async verifyCertificate(certificateNumber: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificateNumber },
      include: {
        registration: {
          include: { student: { include: { school: true } } },
        },
      },
    });

    if (!cert) return { found: false as const };

    return {
      found: true as const,
      certificateNumber: cert.certificateNumber,
      certificateType: cert.certificateType,
      status: cert.status,
      studentName: cert.registration.student.name,
      schoolName: cert.registration.student.school?.name ?? null,
      eventName: cert.eventName,
      issuedAt: cert.issuedAt,
    };
  }

  /**
   * Public PDF download for a certificate a student already knows the
   * number of (from their own email/download, or the /verify page) — same
   * trust model as verifyCertificate() above: the certificate number acts
   * as the lookup key, same real name/school/event that page already shows
   * publicly. Re-renders live off current Site Settings, same as the admin
   * download, rather than serving a cached file — see
   * AdminCertificatesService.downloadPdf() for why.
   *
   * This exists so certificate delivery emails can link to a download
   * instead of attaching the PDF inline: at real batch volume (thousands
   * of participants) a multi-MB base64 attachment per email is wasteful
   * and several providers (Falconide included, 5MB per request) will
   * reject or silently corrupt an attachment that size — a link has no
   * such ceiling.
   */
  async downloadCertificatePdf(certificateNumber: string): Promise<Buffer> {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificateNumber },
      include: {
        registration: {
          include: { student: { include: { school: true } } },
        },
      },
    });
    if (!cert) throw new NotFoundException(`No certificate ${certificateNumber}`);

    const setting = await this.settings.get();
    const brand = siteSettingToBrandAssets(setting);

    const result = await renderParticipationCertificate(
      {
        studentName: cert.registration.student.name,
        eventName: cert.eventName,
        eventDate: cert.issuedAt.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
        certificateNumber: cert.certificateNumber,
        schoolName: cert.registration.student.school?.name,
      },
      brand,
    );

    if (result.status === 'REVIEW_REQUIRED') {
      throw new BadGatewayException(
        `Certificate ${certificateNumber} could not be rendered with the current template settings: ` +
          (result.reviewReasons ?? []).join('; '),
      );
    }

    return result.pdfBuffer!;
  }
}
