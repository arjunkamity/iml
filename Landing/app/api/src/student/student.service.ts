import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ensureRegistrationStages, examWindow, formatScore, gradeMatches, nextCode, nextRegistrationCode, shuffle } from '../common/util';
import { drawQuestions as drawByRules } from '../common/question-draw';
import { drawWithGroups } from '../common/question-draw-groups';
import { PaytmService } from '../payments/paytm.service';
import { MessagingService } from '../messaging/messaging.service';
import { StorageService } from '../storage/storage.service';
import { SettingsService } from '../settings/settings.service';
import { CertificateIssuanceService } from '../certificates/certificate-issuance.service';
import { CERTIFICATE_DOWNLOAD_BASE_URL } from '../certificates/certificate-queue.service';
import {
  AddGrievanceReplyDto,
  CreateStudentGrievanceDto,
  InitiatePaymentDto,
  SaveProgressDto,
  SetStudentPasswordDto,
  SubmitAttemptDto,
  UpdateStudentProfileDto,
} from './student.dto';

const PHOTO_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paytm: PaytmService,
    private readonly messaging: MessagingService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
    private readonly certIssuance: CertificateIssuanceService,
  ) {}

  // ---- profile ----

  async me(studentId: number) {
    // Self-heal: a registration made before all of a competition's stages
    // existed (or before an admin added a later stage) would otherwise be
    // stuck with an incomplete/empty stage list forever.
    const regs = await this.prisma.registration.findMany({
      where: { studentId },
      select: { id: true, competitionId: true },
    });
    await Promise.all(
      regs.map((r) => ensureRegistrationStages(this.prisma, r.id, r.competitionId)),
    );

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        code: true,
        name: true,
        grade: true,
        dob: true,
        gender: true,
        phone: true,
        email: true,
        parent: true,
        parentPhone: true,
        address: true,
        photoUrl: true,
        passwordHash: true,
        demoPromptSeen: true,
        school: true,
        registrations: {
          include: {
            competition: true,
            stages: {
              include: { stage: true },
              orderBy: { stage: { position: 'asc' } },
            },
            attempts: {
              include: { stage: { select: { name: true, position: true } } },
              orderBy: { finishedAt: 'desc' },
            },
            payments: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { registeredAt: 'desc' },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    const { passwordHash, ...rest } = student;
    return { ...rest, hasPassword: !!passwordHash };
  }

  /** The one-time "Congratulations — try the Demo Exam" dashboard modal
   * calls this the moment it's dismissed or acted on, so it never shows
   * again for this student. */
  async markDemoPromptSeen(studentId: number) {
    await this.prisma.student.update({
      where: { id: studentId },
      data: { demoPromptSeen: true },
    });
    return { ok: true };
  }

  async updateProfile(studentId: number, dto: UpdateStudentProfileDto) {
    const existing = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!existing) throw new NotFoundException('Student not found');

    // Email doubles as an OTP-login identifier, so guard against silently
    // colliding with a different student's address — same convention as
    // the admin-side student edit (RegistrationsService), lower-cased and
    // checked against every OTHER student, not just a straight uniqueness
    // constraint (there isn't one at the DB level; a no-op resubmission of
    // the student's own current email must stay allowed).
    let email = existing.email;
    if (dto.email !== undefined) {
      const normalized = dto.email.trim().toLowerCase();
      if (normalized !== (existing.email ?? '').toLowerCase()) {
        // An archived student's email is free to reuse (see Student.archived)
        // — only an active account's email actually blocks this.
        const clash = await this.prisma.student.findFirst({
          where: { email: normalized, id: { not: studentId }, archived: false },
        });
        if (clash) {
          throw new BadRequestException('That email is already in use by another student.');
        }
      }
      email = normalized;
    }

    let schoolId = existing.schoolId;
    if (dto.school !== undefined) {
      if (dto.school.trim()) {
        const found = await this.prisma.school.findFirst({
          where: { name: { equals: dto.school.trim(), mode: 'insensitive' } },
        });
        if (found) {
          schoolId = found.id;
        } else {
          const codes = (
            await this.prisma.school.findMany({ select: { code: true } })
          ).map((s) => s.code);
          const school = await this.prisma.school.create({
            data: { code: nextCode(codes, 'S'), name: dto.school.trim() },
          });
          schoolId = school.id;
        }
      } else {
        schoolId = null;
      }
    }

    const data: Prisma.StudentUncheckedUpdateInput = {
      name: dto.name,
      grade: dto.grade,
      phone: dto.phone,
      email,
      parent: dto.parent,
      parentPhone: dto.parentPhone,
      gender: dto.gender,
      dob: dto.dob ? new Date(`${dto.dob}T00:00:00Z`) : undefined,
      address: dto.address,
      // An empty string means "remove the photo" rather than "leave it unset".
      photoUrl: dto.photoUrl === '' ? null : dto.photoUrl,
      ...(schoolId !== existing.schoolId ? { schoolId } : {}),
    };

    await this.prisma.student.update({ where: { id: studentId }, data });
    return this.me(studentId);
  }

  async uploadPhoto(studentId: number, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('No file was uploaded');
    if (!PHOTO_ALLOWED_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    const stored = await this.storage.upload('student-photos', file.originalname, file.buffer, file.mimetype);
    await this.prisma.student.update({ where: { id: studentId }, data: { photoUrl: stored.url } });
    return this.me(studentId);
  }

  async removePhoto(studentId: number) {
    await this.prisma.student.update({ where: { id: studentId }, data: { photoUrl: null } });
    return this.me(studentId);
  }

  // ---- security ----

  async setPassword(studentId: number, dto: SetStudentPasswordDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (student.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Enter your current password to change it.',
        );
      }
      let ok = false;
      try {
        ok = await argonVerify(student.passwordHash, dto.currentPassword);
      } catch {
        ok = false;
      }
      if (!ok) throw new BadRequestException('Current password is incorrect.');
    }

    const passwordHash = await argonHash(dto.newPassword);
    await this.prisma.student.update({
      where: { id: studentId },
      data: { passwordHash },
    });
    return { ok: true };
  }

  // ---- join an additional competition (already-authenticated student) ----

  /**
   * A logged-in student registering for a SECOND competition — e.g. they
   * clicked "Register" on the public Competitions page while already
   * signed in. No new OTP/profile needed, they're already authenticated;
   * this just creates the Registration (+ stages) if one doesn't already
   * exist, and is idempotent — calling it again for a competition they're
   * already in just returns that existing registration rather than erroring.
   */
  async joinCompetition(studentId: number, competitionCode: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const competition = await this.prisma.competition.findUnique({
      where: { code: competitionCode },
    });
    if (!competition) throw new NotFoundException('Competition not found');
    if (!['Live', 'Open'].includes(competition.status)) {
      throw new BadRequestException('This competition is not open for registration.');
    }

    const existing = await this.prisma.registration.findUnique({
      where: { studentId_competitionId: { studentId, competitionId: competition.id } },
    });

    const registration =
      existing ??
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
      alreadyRegistered: !!existing,
      competition: { code: competition.code, title: competition.title },
      duePayment,
    };
  }

  // ---- schedules ----

  async schedules(studentId: number) {
    const registrations = await this.prisma.registration.findMany({
      where: { studentId },
      select: { id: true, competitionId: true },
    });
    const competitionIds = registrations.map((r) => r.competitionId);
    if (!competitionIds.length) return [];
    const registrationByCompetition = new Map(
      registrations.map((r) => [r.competitionId, r.id]),
    );

    const exams = await this.prisma.exam.findMany({
      where: {
        competitionId: { in: competitionIds },
        status: { in: ['Scheduled', 'Live'] },
      },
      include: {
        // stages[0] — same "an exam maps to its competition's first
        // stage" convention resolveExam()/startExam() already use to
        // decide whether a second attempt is blocked; needed here for
        // the exact same already-attempted lookup below.
        competition: { select: { code: true, title: true, stages: { orderBy: { position: 'asc' }, take: 1 } } },
        batches: { select: { id: true } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });

    const registrationIds = [...registrationByCompetition.values()];

    // How many attempts each registration has already used at each stage
    // these exams map to — batched the same way as finishedAttempts below,
    // so "can this student re-attempt?" is answered without a query per
    // exam. See Exam.maxAttempts / RegistrationStage.attemptsUsed.
    const regStages = registrationIds.length
      ? await this.prisma.registrationStage.findMany({
          where: { registrationId: { in: registrationIds } },
          select: { registrationId: true, stageId: true, attemptsUsed: true },
        })
      : [];
    const attemptsUsedByKey = new Map(regStages.map((r) => [`${r.registrationId}:${r.stageId}`, r.attemptsUsed]));

    const assignments = registrationIds.length
      ? await this.prisma.examBatchAssignment.findMany({
          where: { registrationId: { in: registrationIds } },
          include: { batch: true },
        })
      : [];
    const assignmentByKey = new Map(
      assignments.map((a) => [`${a.examId}:${a.registrationId}`, a]),
    );

    // Every finished attempt across the stages these exams actually map
    // to, batched once rather than per-exam — mirrors resolveExam()'s own
    // (registrationId, stageId) scoping so "already attempted" here means
    // exactly what startExam() would also block.
    const stageIds = [
      ...new Set(exams.map((e) => e.competition?.stages?.[0]?.id).filter((id): id is number => id != null)),
    ];
    const finishedAttempts = stageIds.length
      ? await this.prisma.attempt.findMany({
          where: { registrationId: { in: registrationIds }, stageId: { in: stageIds }, finishedAt: { not: null } },
          select: { code: true, registrationId: true, stageId: true },
        })
      : [];
    const attemptByKey = new Map(finishedAttempts.map((a) => [`${a.registrationId}:${a.stageId}`, a.code]));

    const now = new Date();
    return exams.map((e) => {
      const registrationId = e.competitionId
        ? registrationByCompetition.get(e.competitionId)
        : undefined;
      const hasBatches = e.batches.length > 0;
      const assignment =
        hasBatches && registrationId != null
          ? assignmentByKey.get(`${e.id}:${registrationId}`)
          : undefined;
      const batchPending = hasBatches && !assignment;

      const win = assignment
        ? {
            start: assignment.batch.startAt,
            end: new Date(assignment.batch.startAt.getTime() + assignment.batch.durationMin * 60 * 1000),
          }
        : hasBatches
          ? null // batches exist but this student isn't assigned yet — no window to compute
          : examWindow(e);

      let status = e.status;
      if (e.status === 'Scheduled' && win) {
        if (now < win.start) status = 'Scheduled';
        else if (now <= win.end) status = 'Live';
        else status = 'Closed';
      }
      const firstStageId = e.competition?.stages?.[0]?.id;
      const attemptCode =
        registrationId != null && firstStageId != null
          ? (attemptByKey.get(`${registrationId}:${firstStageId}`) ?? null)
          : null;
      const attemptsUsed =
        registrationId != null && firstStageId != null
          ? (attemptsUsedByKey.get(`${registrationId}:${firstStageId}`) ?? 0)
          : 0;
      const maxAttempts = e.maxAttempts ?? 1;
      return {
        code: e.code,
        title: e.title,
        grade: e.grade,
        date: e.date,
        time: e.time,
        durationMin: e.durationMin,
        timing: e.timing,
        status,
        competitionCode: e.competition?.code ?? null,
        competitionTitle: e.competition?.title ?? null,
        batch: assignment
          ? { label: assignment.batch.label, startAt: assignment.batch.startAt, durationMin: assignment.batch.durationMin }
          : null,
        batchPending,
        // Non-null means this student already finished this exam's stage
        // — the frontend uses this to swap "Start" for "View Result" and
        // link straight to the result instead of a dead-end
        // "Cannot start the exam" screen.
        attemptCode,
        // True when a finished attempt exists AND the student hasn't used
        // up Exam.maxAttempts yet — the frontend shows a "Re-attempt"
        // option alongside "View Result" instead of only the latter.
        canReattempt: attemptCode != null && attemptsUsed < maxAttempts,
        attemptsUsed,
        maxAttempts,
      };
    });
  }

  // ---- exam taking ----

  private async loadQuestions(competitionId: number) {
    return this.prisma.question.findMany({
      // isDemo:false is explicit and load-bearing, not just a mirror of
      // competitionId scoping — see Question.isDemo in schema.prisma. A
      // demo question must never surface in a real exam even if it were
      // ever mistakenly linked to a real competitionId.
      // assessmentId:null is just as load-bearing as isDemo:false — an
      // Assessment question (see Question.assessmentId) must never be served
      // in a real exam even if it were mistakenly given a competitionId.
      // groupId:null as well — a Question Group's sub-questions are served only
      // through their group (loadGroups), never from this single-question pool,
      // otherwise a student could get the same question twice.
      where: { competitionId, isDemo: false, assessmentId: null, groupId: null },
      orderBy: [{ category: 'asc' }, { id: 'asc' }],
    });
  }

  /** Group code/title for the grouped questions among these, keyed by group id
   * (empty when none are grouped, and then no query is made). Used to label a
   * group's questions in result views. */
  private async groupLabels(questions: { groupId?: number | null }[]) {
    const ids = [...new Set(questions.map((q) => q.groupId).filter((id): id is number => id != null))];
    if (!ids.length) return new Map<number, { code: string; title: string }>();
    const rows = await this.prisma.questionGroup.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, title: true } });
    return new Map(rows.map((g) => [g.id, { code: g.code, title: g.title }]));
  }

  /** Active Question Groups for a competition, each with its sub-questions in
   * the admin's order. A group with fewer than two usable questions is not a
   * group any more and is left out. */
  private async loadGroups(competitionId: number) {
    const groups = await this.prisma.questionGroup.findMany({
      where: { competitionId, active: true },
      orderBy: { id: 'asc' },
      include: {
        questions: {
          where: { isDemo: false, assessmentId: null },
          orderBy: [{ groupPosition: 'asc' }, { id: 'asc' }],
        },
      },
    });
    return groups.filter((g) => g.questions.length >= 2);
  }

  /**
   * The ONE place a student's question set is drawn — used by both the exam
   * preview (examDetails) and the real draw (startExam), so the count shown
   * on the pre-exam screen always matches what is served.
   *
   * - The competition has a question mix (CompetitionQuestionRule rows): draw
   *   exactly that many per category (common/question-draw.ts) and ignore
   *   Exam.questionCount — the mix total replaces it. A category with too few
   *   questions serves what exists and logs the shortfall.
   * - No mix: the original behaviour, unchanged — whole tagged pool, randomly
   *   capped to questionCount, excluding what a previous attempt served when
   *   enough unseen questions remain.
   *
   * `exclude` is the previous attempt's served ids on a re-attempt, else null.
   */
  private async drawQuestions(
    competitionId: number,
    questionCount: number | null,
    exclude: Set<number> | null,
  ) {
    const [pool, rules, groups] = await Promise.all([
      this.loadQuestions(competitionId),
      this.prisma.competitionQuestionRule.findMany({
        where: { competitionId },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: { category: true, count: true },
      }),
      this.loadGroups(competitionId),
    ]);

    // Question Groups: only when the competition actually has active groups.
    // Otherwise everything below is the original draw, untouched. A group is
    // one atomic unit worth as many slots as it has sub-questions
    // (common/question-draw-groups.ts); the attempt still freezes a flat list
    // of question ids, so scoring and resume are unchanged.
    if (groups.length) {
      const drawn = drawWithGroups(
        pool,
        groups.map((g) => ({ id: g.id, category: g.category, questions: g.questions })),
        rules,
        { questionCount, exclude },
      );
      for (const s of drawn.shortfalls) {
        this.logger.warn(
          `Question draw shortfall with groups (competition ${competitionId}): ${s.category} requested ${s.requested}, served ${s.served}`,
        );
      }
      return drawn.questions;
    }

    if (rules.length) {
      const { questions, shortfalls } = drawByRules(pool, rules, exclude);
      for (const s of shortfalls) {
        this.logger.warn(
          `Question mix shortfall (competition ${competitionId}): ${s.category} requested ${s.requested}, only ${s.served} available`,
        );
      }
      return questions;
    }

    // Re-attempt: draw from a pool that excludes whatever the previous
    // (about-to-be-superseded) attempt already served, so the student
    // doesn't just see the same questions again. If too few unseen
    // questions remain to fill a full attempt, fall back to the whole
    // pool rather than serving short — some repeats is the lesser
    // problem versus an exam with fewer questions than configured.
    let freshPool = pool;
    if (exclude && exclude.size) {
      const unseen = pool.filter((q) => !exclude.has(q.id));
      const needed = questionCount ?? pool.length;
      if (unseen.length >= needed) freshPool = unseen;
    }
    return this.selectQuestions(freshPool, questionCount);
  }

  private categoriesOf(questions: { category: string }[]): string[] {
    return [...new Set(questions.map((q) => q.category))];
  }

  /** Randomizes order and, when the exam has a questionCount set, caps the
   * pool down to that many — the "random questions, N per exam" feature.
   * A null/unset questionCount serves the whole matching pool, same as
   * before this existed, just in random order. */
  private selectQuestions<T>(pool: T[], questionCount: number | null): T[] {
    const shuffled = shuffle(pool);
    return questionCount != null && questionCount > 0 ? shuffled.slice(0, questionCount) : shuffled;
  }

  private formatWindowTime(d: Date): string {
    // Without an explicit timeZone this renders in the SERVER's own
    // timezone (UTC in production), not IST — same class of bug as
    // toTime() in util.ts. See content.service.ts's formatBatchTime() for
    // the same, already-correct pattern.
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private async resolveExam(code: string, studentId: number) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const exam = await this.prisma.exam.findUnique({
      where: { code },
      include: {
        competition: {
          select: {
            id: true,
            code: true,
            title: true,
            scoringMode: true,
            certificateMode: true,
            stages: { orderBy: { position: 'asc' }, take: 1 },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (!exam.competitionId || !exam.competition) {
      throw new BadRequestException('Exam is not linked to a competition');
    }
    if (exam.status === 'Closed') {
      throw new BadRequestException('This exam is closed');
    }
    if (exam.status !== 'Live' && exam.status !== 'Scheduled') {
      throw new BadRequestException('This exam is not open yet');
    }
    if (exam.grade && !gradeMatches(exam.grade, student.grade)) {
      throw new ForbiddenException('This exam is not open for your grade');
    }

    const registration = await this.prisma.registration.findUnique({
      where: {
        studentId_competitionId: {
          studentId,
          competitionId: exam.competitionId,
        },
      },
    });
    if (!registration) {
      throw new ForbiddenException('You are not registered for this exam');
    }

    // Batch-wise access: once an exam has been split into batches, the
    // exam's own date/time is just an outer label — a student may only
    // enter during their own assigned batch's window, and gets a clear
    // "not assigned yet" message rather than falling back to the global one.
    const batchCount = await this.prisma.examBatch.count({
      where: { examId: exam.id },
    });
    let batch: { id: number; label: string; startAt: Date; durationMin: number } | null = null;
    if (batchCount > 0) {
      const assignment = await this.prisma.examBatchAssignment.findUnique({
        where: { examId_registrationId: { examId: exam.id, registrationId: registration.id } },
        include: { batch: true },
      });
      if (!assignment) {
        throw new ForbiddenException(
          'You have not been assigned a test batch yet. Please check back closer to the exam date.',
        );
      }
      batch = assignment.batch;
    }

    if (exam.status === 'Scheduled') {
      const win = batch
        ? { start: batch.startAt, end: new Date(batch.startAt.getTime() + batch.durationMin * 60 * 1000) }
        : examWindow(exam);
      if (win) {
        const now = new Date();
        if (now < win.start) {
          throw new ForbiddenException(
            batch
              ? `Your batch (${batch.label}) opens at ${this.formatWindowTime(win.start)}. You cannot start it before your scheduled time.`
              : `This exam opens on ${this.formatWindowTime(win.start)}. You cannot start it before the scheduled time.`,
          );
        }
        if (now > win.end) {
          throw new BadRequestException(
            batch ? 'The window for your batch has closed.' : 'The window for this exam has closed.',
          );
        }
      }
    }

    return { student, exam, registration, batch };
  }

  async examDetails(code: string, studentId: number) {
    const { exam, batch } = await this.resolveExam(code, studentId);
    // A preview of the draw — startExam() makes its own fresh random draw
    // through the same drawQuestions(), so which questions are served can
    // differ, but the count and per-category mix always match.
    const preview = await this.drawQuestions(exam.competition!.id, exam.questionCount ?? null, null);
    return {
      code: exam.code,
      title: exam.title,
      grade: exam.grade,
      durationMin: exam.durationMin ?? 15,
      timing: exam.timing,
      status: exam.status,
      competitionCode: exam.competition?.code ?? null,
      competitionTitle: exam.competition?.title ?? null,
      stage: exam.competition?.stages?.[0]
        ? {
            name: exam.competition.stages[0].name,
            position: exam.competition.stages[0].position,
          }
        : null,
      questionCount: preview.length,
      categories: this.categoriesOf(preview),
      batch: batch ? { label: batch.label, startAt: batch.startAt, durationMin: batch.durationMin } : null,
    };
  }

  async startExam(code: string, studentId: number) {
    const { exam, registration, batch } = await this.resolveExam(code, studentId);
    const firstStage = exam.competition?.stages?.[0] ?? null;

    // registrationId alone already scopes to this exam's competition — a
    // Registration is unique per (student, competition). When the
    // competition has a first stage, also narrow to that stage; when it
    // doesn't (no stages configured yet), no further filter is needed —
    // there is nothing else to narrow by.
    const maxAttempts = exam.maxAttempts ?? 1;
    const regStage = firstStage
      ? await this.prisma.registrationStage.findUnique({
          where: { registrationId_stageId: { registrationId: registration.id, stageId: firstStage.id } },
        })
      : null;
    const attemptsUsed = regStage?.attemptsUsed ?? 0;

    const already = await this.prisma.attempt.findFirst({
      where: {
        registrationId: registration.id,
        ...(firstStage ? { stageId: firstStage.id } : {}),
        finishedAt: { not: null },
      },
      orderBy: { id: 'desc' },
    });
    if (already && attemptsUsed >= maxAttempts) {
      throw new BadRequestException(
        maxAttempts === 1
          ? 'You have already attempted this test. Only one attempt is allowed.'
          : `You have used all ${maxAttempts} allowed attempts for this test.`,
      );
    }

    // A refresh, a dropped connection, or a second tab must resume the
    // SAME attempt rather than mint a new one — otherwise the student
    // loses every answer already given (nothing is autosaved server-side;
    // the client restores its own answers from sessionStorage keyed by
    // this same attemptCode) and, worse, would get a freshly reshuffled
    // question set plus a fully reset timer, effectively an unlimited
    // free retake via refresh. Resume by returning the exact frozen
    // question set + the real remaining time computed from startedAt.
    const inProgress = await this.prisma.attempt.findFirst({
      where: {
        registrationId: registration.id,
        ...(firstStage ? { stageId: firstStage.id } : {}),
        finishedAt: null,
      },
      orderBy: { id: 'desc' },
    });

    let attempt: { code: string; startedAt: Date; questionIds: Prisma.JsonValue; lastQuestionId?: number | null };
    let questions: Awaited<ReturnType<typeof this.loadQuestions>>;
    // Only populated on the resume branch below — whatever's been saved
    // for this attempt so far (see saveProgress()), so the frontend can
    // offer "resume where you left off" instead of silently either
    // restarting blank or trusting a same-browser-tab sessionStorage
    // mirror that a real disconnect (closed tab, crashed browser, dead
    // battery) would have wiped along with everything else on that page.
    let savedAnswers: { questionId: number; answer: Prisma.JsonValue; takenSecs: number | null; timeUp: boolean; changeCount: number }[] = [];

    if (inProgress) {
      attempt = inProgress;
      const ids = (inProgress.questionIds as number[] | null) ?? [];
      const rows = await this.prisma.question.findMany({ where: { id: { in: ids } } });
      const byId = new Map(rows.map((r) => [r.id, r]));
      // Preserve the exact order this attempt was originally served in —
      // findMany({ id: { in } }) does not guarantee `ids` order.
      questions = ids.map((id) => byId.get(id)).filter((q): q is (typeof rows)[number] => !!q);

      const answerRows = await this.prisma.attemptAnswer.findMany({
        where: { attemptId: inProgress.id, questionId: { not: null } },
      });
      savedAnswers = answerRows.map((a) => ({
        questionId: a.questionId!,
        answer: a.answer,
        takenSecs: a.takenSecs,
        timeUp: a.timeUp,
        changeCount: a.changeCount,
      }));
    } else {
      // Re-attempt: pass what the previous (about-to-be-superseded) attempt
      // served so the draw avoids repeating it — see drawQuestions().
      const prevIds = already ? new Set(((already.questionIds as number[] | null) ?? [])) : null;
      questions = await this.drawQuestions(exam.competition!.id, exam.questionCount ?? null, prevIds);

      // Attempt codes are human-readable sequential ("T01", "T02", ...),
      // which means the next code has to be read from existing rows rather
      // than generated from a DB sequence. Under real concurrent load
      // (many students starting in the same second within a batch
      // window), two requests can compute the same "next" code — retry
      // with a fresh read rather than let that surface as a request
      // failure.
      let created: Awaited<ReturnType<typeof this.prisma.attempt.create>> | null = null;
      for (let tries = 0; tries < 5 && !created; tries++) {
        const codes = (
          await this.prisma.attempt.findMany({ select: { code: true } })
        ).map((a) => a.code);
        const attemptCode = nextCode(codes, 'T');
        try {
          created = await this.prisma.attempt.create({
            data: {
              code: attemptCode,
              registrationId: registration.id,
              stageId: firstStage?.id ?? null,
              startedAt: new Date(),
              timing: exam.timing as Prisma.InputJsonValue,
              // Freezes exactly which questions (and order) this attempt
              // was served — submitExam() scores against this list, never
              // a fresh random draw of the pool, and a resumed startExam()
              // call (above) replays this same list. See selectQuestions().
              questionIds: questions.map((q) => q.id) as Prisma.InputJsonValue,
            },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            continue; // code collision — regenerate from a fresh read and retry
          }
          throw err;
        }
      }
      if (!created) {
        throw new BadRequestException('Could not start the exam right now — please try again.');
      }
      attempt = created;

      // Count this attempt against the limit. Only reached once per real
      // new Attempt row (never on a resume, see the `if (inProgress)`
      // branch above) — an abandoned-then-resumed attempt can't be used
      // to farm extra tries.
      if (firstStage) {
        await this.prisma.registrationStage.upsert({
          where: { registrationId_stageId: { registrationId: registration.id, stageId: firstStage.id } },
          create: { registrationId: registration.id, stageId: firstStage.id, attemptsUsed: 1 },
          update: { attemptsUsed: { increment: 1 } },
        });
      }
    }

    const durationMin = exam.durationMin ?? 15;
    const elapsedSecs = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
    const remainingSecs = Math.max(0, durationMin * 60 - elapsedSecs);

    // Headers for any Question Groups among the served questions. Read from each
    // question's group on every call, so a resume shows the same headers as the
    // start did. Skipped entirely (no query) when nothing is grouped.
    const servedGroupIds = [...new Set(questions.map((q) => q.groupId).filter((id): id is number => id != null))];
    const groupRows = servedGroupIds.length
      ? await this.prisma.questionGroup.findMany({ where: { id: { in: servedGroupIds } }, orderBy: { id: 'asc' } })
      : [];

    return {
      attemptCode: attempt.code,
      startedAt: attempt.startedAt,
      durationMin,
      remainingSecs,
      timing: exam.timing,
      // True only when an already-in-progress attempt was found and
      // resumed rather than a fresh one just created — the frontend uses
      // this (plus savedAnswers being non-empty) to decide whether to
      // show a "Resume where you left off?" prompt instead of just
      // silently continuing.
      resumed: !!inProgress,
      lastQuestionId: attempt.lastQuestionId ?? null,
      savedAnswers,
      batch: batch ? { label: batch.label } : null,
      exam: {
        code: exam.code,
        title: exam.title,
        grade: exam.grade,
        competitionCode: exam.competition?.code ?? null,
        competitionTitle: exam.competition?.title ?? null,
        stage: firstStage
          ? { name: firstStage.name, position: firstStage.position }
          : null,
      },
      questionCount: questions.length,
      categories: this.categoriesOf(questions),
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
        // Only present for a Question Group's sub-questions; absent for singles, so
        // an exam without groups returns exactly what it always did.
        ...(q.groupId != null ? { groupId: q.groupId, groupPosition: q.groupPosition } : {}),
      })),
      // The headers for those groups (title, description, media), once per group.
      ...(groupRows.length
        ? {
            groups: groupRows.map((g) => ({
              id: g.id,
              code: g.code,
              title: g.title,
              description: g.description,
              imageUrl: g.imageUrl,
              videoUrl: g.videoUrl,
            })),
          }
        : {}),
    };
  }

  /** Periodic autosave while an exam is in progress (called every few
   * seconds and on every answer change from the exam page, plus a
   * best-effort final call as the tab unloads) — durable storage of
   * whatever's been answered so far, independent of the browser tab
   * that's taking the exam. Never scores anything (isCorrect stays null
   * here; grading only ever happens in submitExam()) — this exists
   * purely so a real disconnect has something server-side to resume
   * from, not just a sessionStorage mirror on one specific browser
   * instance that a closed tab / crashed browser / dead battery wipes
   * out along with everything else on that page. */
  async saveProgress(code: string, studentId: number, dto: SaveProgressDto) {
    const { registration } = await this.resolveExam(code, studentId);

    const attempt = await this.prisma.attempt.findUnique({ where: { code: dto.attemptCode } });
    if (!attempt || attempt.registrationId !== registration.id) {
      throw new NotFoundException('Attempt not found');
    }
    // A finished attempt's answers are the scored, final record — never
    // let a stray/late autosave (e.g. one queued right as Submit was
    // pressed) overwrite them after the fact.
    if (attempt.finishedAt) {
      return { ok: true };
    }

    const frozenIds = new Set(Array.isArray(attempt.questionIds) ? (attempt.questionIds as number[]) : []);
    for (const a of dto.answers ?? []) {
      if (!a || typeof a.questionId !== 'number' || !frozenIds.has(a.questionId)) continue;
      const arr = Array.isArray(a.answer) ? a.answer.map(Number) : [];
      const given = arr.length ? [...new Set(arr)].sort((x, y) => x - y) : null;
      const answer = given === null ? Prisma.JsonNull : (given as Prisma.InputJsonValue);
      await this.prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId: attempt.id, questionId: a.questionId } },
        create: {
          attemptId: attempt.id,
          questionId: a.questionId,
          answer,
          takenSecs: a.takenSecs ?? null,
          timeUp: a.timeUp ?? false,
          changeCount: a.changeCount ?? 0,
          answeredAt: given ? new Date() : null,
        },
        update: {
          answer,
          takenSecs: a.takenSecs ?? null,
          timeUp: a.timeUp ?? false,
          changeCount: a.changeCount ?? 0,
          answeredAt: given ? new Date() : null,
        },
      });
    }

    if (dto.lastQuestionId != null && frozenIds.has(dto.lastQuestionId)) {
      await this.prisma.attempt.update({
        where: { id: attempt.id },
        data: { lastQuestionId: dto.lastQuestionId },
      });
    }

    return { ok: true };
  }

  async submitExam(code: string, studentId: number, dto: SubmitAttemptDto) {
    const { exam, registration, student } = await this.resolveExam(code, studentId);
    const firstStage = exam.competition?.stages?.[0] ?? null;

    const attempt = await this.prisma.attempt.findUnique({
      where: { code: dto.attemptCode },
    });
    if (!attempt || attempt.registrationId !== registration.id) {
      throw new NotFoundException('Attempt not found');
    }
    if (attempt.finishedAt) {
      throw new BadRequestException('This attempt has already been submitted');
    }

    // Score against the EXACT set this attempt was served (frozen at
    // startExam() time) — re-querying the pool here would score against a
    // fresh, different random draw. Attempts started before this field
    // existed have questionIds: null; fall back to the full pool for
    // those so an in-progress exam at deploy time doesn't break.
    const frozenIds = Array.isArray(attempt.questionIds) ? (attempt.questionIds as number[]) : null;
    let questions: Awaited<ReturnType<typeof this.loadQuestions>>;
    if (frozenIds && frozenIds.length) {
      const rows = await this.prisma.question.findMany({ where: { id: { in: frozenIds } } });
      const byId = new Map(rows.map((r) => [r.id, r]));
      questions = frozenIds.map((id) => byId.get(id)).filter((q): q is (typeof rows)[number] => !!q);
    } else {
      questions = await this.loadQuestions(exam.competition!.id);
    }

    const groupLabel = await this.groupLabels(questions);
    const given = new Map<number, number[]>();
    const rec = new Map<number, { takenSecs?: number; timeUp?: boolean; changeCount?: number }>();
    for (const a of dto.answers ?? []) {
      if (!a || typeof a.questionId !== 'number') continue;
      const arr = Array.isArray(a.answer) ? a.answer.map(Number) : [];
      given.set(a.questionId, [...new Set(arr)].sort((x, y) => x - y));
      rec.set(a.questionId, a);
    }

    let score = 0;
    const review: Array<Record<string, unknown>> = [];
    const rows: Prisma.AttemptAnswerUncheckedCreateInput[] = [];
    for (const q of questions) {
      const correct = (Array.isArray(q.correct) ? q.correct : [])
        .map(Number)
        .sort((x, y) => x - y);
      const mine = given.get(q.id) ?? [];
      const isCorrect =
        correct.length === mine.length &&
        correct.every((c, i) => c === mine[i]);
      if (isCorrect) score += 1;

      const ansRec = rec.get(q.id);
      // "No attempt" — either never reached, or its own per-question timer
      // lapsed before an answer was chosen (mine is empty either way; the
      // timeUp flag is what tells the two apart for reporting/audit).
      rows.push({
        attemptId: attempt.id,
        questionId: q.id,
        // Snapshot of the area this answer counted towards (see AttemptAnswer.category).
        category: q.category,
        answer: q.mode === 'multi' ? mine : mine[0] ?? null,
        isCorrect,
        takenSecs: ansRec?.takenSecs ?? null,
        timeUp: ansRec?.timeUp ?? false,
        changeCount: ansRec?.changeCount ?? 0,
        answeredAt: ansRec ? new Date() : null,
      });
      review.push({
        questionId: q.id,
        code: q.code,
        category: q.category,
        mode: q.mode,
        prompt: q.prompt,
        options: q.options,
        correct,
        given: mine,
        isCorrect,
        timeUp: ansRec?.timeUp ?? false,
        // Only for a Question Group's questions; absent for singles.
        ...(q.groupId != null && groupLabel.get(q.groupId)
          ? { groupCode: groupLabel.get(q.groupId)!.code, groupTitle: groupLabel.get(q.groupId)!.title }
          : {}),
      });
    }

    const total = questions.length;
    const percent = total ? Math.round((score / total) * 100) : 0;
    const finishedAt = new Date();
    const passMark = attempt.stageId ? Number(firstStage?.passMark ?? 0) : 0;
    const qualified = percent >= passMark;
    // A stage with a qualifier cap can't decide who actually advances the
    // moment ONE student submits — it doesn't yet know how everyone else
    // will do. `qualified` above still means "cleared the pass mark" (the
    // eligibility half); status just stays 'Attempted' regardless, and
    // the next stage stays locked, until an admin runs the ranked
    // selection for this stage — see SelectionService.
    const capacityLimited = !!attempt.stageId && firstStage?.maxQualifiers != null;

    const stages = await this.prisma.competitionStage.findMany({
      where: { competitionId: exam.competitionId! },
      orderBy: { position: 'asc' },
    });
    const currentIdx = attempt.stageId
      ? stages.findIndex((s) => s.id === attempt.stageId)
      : -1;
    const next = currentIdx >= 0 && currentIdx < stages.length - 1
      ? stages[currentIdx + 1]
      : null;
    let unlockNext: Prisma.PrismaPromise<unknown> | null = null;
    if (qualified && next && next.isFree && !capacityLimited) {
      const existingNext = await this.prisma.registrationStage.findUnique({
        where: {
          registrationId_stageId: {
            registrationId: registration.id,
            stageId: next.id,
          },
        },
      });
      if (!existingNext) {
        unlockNext = this.prisma.registrationStage.create({
          data: {
            registrationId: registration.id,
            stageId: next.id,
            status: 'Unlocked',
            unlockedAt: new Date(),
          },
        });
      } else if (existingNext.status === 'Locked') {
        unlockNext = this.prisma.registrationStage.update({
          where: {
            registrationId_stageId: {
              registrationId: registration.id,
              stageId: next.id,
            },
          },
          data: { status: 'Unlocked', unlockedAt: new Date() },
        });
      }
    }

    // Re-attempt cleanup: a prior finished attempt at this same stage (the
    // one startExam() excluded questions from when this attempt began) is
    // removed now that its replacement has actually been submitted — not
    // at startExam() time, so an abandoned re-attempt never destroys a
    // real scored result. AttemptAnswer cascades automatically (see
    // schema.prisma). This keeps the "at most one finished Attempt per
    // registration+stage" invariant every other admin/results/selection
    // query already relies on, even with maxAttempts > 1.
    const staleAttemptIds = attempt.stageId
      ? (
          await this.prisma.attempt.findMany({
            where: {
              registrationId: registration.id,
              stageId: attempt.stageId,
              id: { not: attempt.id },
              finishedAt: { not: null },
            },
            select: { id: true },
          })
        ).map((a) => a.id)
      : [];

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    // Progress autosaves (saveProgress()) may already have rows for this
    // attempt — final submit is the authoritative, fully-scored record,
    // so it always fully replaces them rather than trying to reconcile
    // row-by-row (also avoids colliding with those rows' unique
    // (attemptId, questionId) constraint on the createMany below).
    ops.push(this.prisma.attemptAnswer.deleteMany({ where: { attemptId: attempt.id } }));
    if (rows.length) {
      ops.push(this.prisma.attemptAnswer.createMany({ data: rows }));
    }
    ops.push(
      this.prisma.attempt.update({
        where: { id: attempt.id },
        data: { finishedAt, score, total, clientElapsedSecs: dto.clientElapsedSecs ?? null },
      }),
    );
    if (staleAttemptIds.length) {
      ops.push(this.prisma.attempt.deleteMany({ where: { id: { in: staleAttemptIds } } }));
    }
    if (attempt.stageId) {
      ops.push(
        this.prisma.registrationStage.updateMany({
          where: {
            registrationId: registration.id,
            stageId: attempt.stageId,
          },
          data: {
            status: qualified && !capacityLimited ? 'Qualified' : 'Attempted',
            score: percent,
            qualified,
          },
        }),
      );
    }
    if (unlockNext) ops.push(unlockNext);
    ops.push(
      this.prisma.registration.update({
        where: { id: registration.id },
        data: { status: qualified && !capacityLimited ? 'Qualified' : 'Test Taken' },
      }),
    );
    await this.prisma.$transaction(ops);

    // Only Stage 1 is an auto-scored online exam in this competition's
    // design — later stages (Zoom Showdown, Bootcamp, Grand Finale) are
    // judged manually via acceptStage(), which fires its own notifications.
    if (currentIdx === 0) {
      const target = { email: student.email, phone: student.phone };
      void this.messaging.dispatch('STAGE1_SUBMITTED', target, {
        StudentName: student.name,
        RegID: registration.code,
      });
      // A capacity-limited stage's real outcome isn't decided the moment
      // ONE student submits — it depends on how the whole cohort ranks,
      // resolved later by an admin running Next Stage Selection (see
      // CompetitionService.commitSelection, which sends this same pair of
      // templates once the real decision exists). Telling a fast early
      // submitter "you qualified" here would just be wrong the moment a
      // faster/tied peer submits later.
      if (!capacityLimited) {
        void this.messaging.dispatch(
          qualified ? 'QUALIFIED_STAGE2' : 'NOT_QUALIFIED_STAGE2',
          target,
          { Name: student.name, StudentName: student.name },
        );
      }

      // Every Stage-1 participant earns a Participation Certificate,
      // regardless of qualified/not — enqueue only, never render inline:
      // CertificateQueueService drains this in the background, and only
      // once no exam is currently open anywhere on the platform. A plain
      // insert here is fast enough to never slow down the student's
      // submit response. Idempotent on registrationId (the unique
      // constraint), so a rare double-submit can't double-enqueue.
      // Skipped entirely when the competition's certificateMode is
      // 'MANUAL' — nothing is issued until an admin explicitly generates
      // it from Results (see ResultService.generateCertificate).
      if (exam.competition!.certificateMode !== 'MANUAL') {
        void this.prisma.certificateJob
          .upsert({
            where: { registrationId: registration.id },
            create: { registrationId: registration.id, eventName: exam.competition!.title },
            update: {},
          })
          .catch((err) => this.logger.error(`Could not enqueue certificate job: ${String(err)}`));
      }
    }

    const cats: Record<string, { correct: number; total: number }> = {};
    for (const r of review) {
      const slot = (cats[r.category as string] ??= { correct: 0, total: 0 });
      slot.total += 1;
      if (r.isCorrect) slot.correct += 1;
    }

    return {
      attemptCode: attempt.code,
      code: attempt.code,
      competition: exam.competition?.title ?? null,
      competitionCode: exam.competition?.code ?? null,
      stage: firstStage?.name ?? null,
      stagePosition: firstStage?.position ?? null,
      passMark: Number(firstStage?.passMark ?? 0),
      // null = this stage caps qualifiers and the real outcome is still
      // pending an admin's Next Stage Selection — the student sees
      // "submitted, check back later," never a premature verdict.
      qualified: capacityLimited ? null : qualified,
      score,
      total,
      percent,
      // How this competition is configured to present the result — the
      // frontend renders whichever of percent/score-total/grade this
      // names, instead of always showing all three.
      scoringMode: exam.competition!.scoringMode,
      scoreDisplay: formatScore(exam.competition!.scoringMode, score, total, percent),
      startedAt: attempt.startedAt,
      finishedAt,
      categories: Object.entries(cats).map(([name, v]) => ({
        name,
        correct: v.correct,
        total: v.total,
      })),
      review,
    };
  }

  // ---- results ----

  async results(studentId: number) {
    const attempts = await this.prisma.attempt.findMany({
      where: { registration: { studentId } },
      include: {
        registration: { include: { competition: true } },
        stage: { select: { name: true, position: true } },
        answers: { include: { question: { select: { category: true } } } },
      },
      orderBy: { finishedAt: 'desc' },
    });

    // Batched rather than per-attempt — a student's certificate (Stage-1
    // participation) is looked up by registrationId the same way the
    // admin queue view does it, not inferred from attempt/job status.
    const certs = attempts.length
      ? await this.prisma.certificate.findMany({
          where: { registrationId: { in: attempts.map((a) => a.registrationId) } },
          select: { registrationId: true, certificateNumber: true },
        })
      : [];
    const certByReg = new Map(certs.map((c) => [c.registrationId, c.certificateNumber]));

    return attempts.map((a) => {
      const cats: Record<string, { correct: number; total: number }> = {};
      for (const ans of a.answers) {
        const cat = ans.category ?? ans.question?.category ?? 'Other';
        const slot = (cats[cat] ??= { correct: 0, total: 0 });
        slot.total += 1;
        if (ans.isCorrect) slot.correct += 1;
      }
      const score = Number(a.score);
      const total = Number(a.total);
      return {
        code: a.code,
        competition: a.registration.competition.title,
        competitionCode: a.registration.competition.code,
        stage: a.stage?.name ?? null,
        stagePosition: a.stage?.position ?? null,
        score,
        total,
        percent: total > 0 ? Math.round((score / total) * 100) : 0,
        scoringMode: a.registration.competition.scoringMode,
        scoreDisplay: formatScore(
          a.registration.competition.scoringMode,
          score,
          total,
          total > 0 ? Math.round((score / total) * 100) : 0,
        ),
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
        certificateNumber: certByReg.get(a.registrationId) ?? null,
        categories: Object.entries(cats).map(([name, v]) => ({
          name,
          correct: v.correct,
          total: v.total,
        })),
      };
    });
  }

  async resultDetail(code: string, studentId: number) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { code, registration: { studentId } },
      include: {
        registration: { include: { competition: true } },
        stage: { select: { name: true, position: true, passMark: true, maxQualifiers: true } },
        answers: {
          include: {
            question: {
              select: {
                id: true,
                code: true,
                category: true,
                mode: true,
                prompt: true,
                options: true,
                correct: true,
                groupId: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Result not found');
    const groupLabel = await this.groupLabels(attempt.answers.map((a) => a.question ?? {}));

    const cert = await this.prisma.certificate.findFirst({
      where: { registrationId: attempt.registrationId },
      select: { certificateNumber: true },
    });

    const score = Number(attempt.score);
    const total = Number(attempt.total);
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    const passMark = Number(attempt.stage?.passMark ?? 0);

    // For a capacity-limited stage, "qualified" is never the raw
    // percent>=passMark check — it's whatever an admin's Next Stage
    // Selection actually decided (RegistrationStage.status), and stays
    // null (pending) until that's run. A stage with no cap keeps the
    // original immediate threshold behavior — its status was already set
    // synchronously at submit time (see submitExam), so this is
    // equivalent, just sourced from the persisted decision either way.
    let qualified: boolean | null = passMark > 0 ? percent >= passMark : null;
    if (attempt.stageId && attempt.stage?.maxQualifiers != null) {
      const regStage = await this.prisma.registrationStage.findUnique({
        where: { registrationId_stageId: { registrationId: attempt.registrationId, stageId: attempt.stageId } },
        select: { status: true },
      });
      qualified = regStage?.status === 'Qualified' ? true : regStage?.status === 'Eliminated' ? false : null;
    }

    const cats: Record<string, { correct: number; total: number }> = {};
    const questions = attempt.answers.map((a) => {
      const q = a.question;
      const correct = Array.isArray(q?.correct)
        ? q.correct.map(Number).sort((x, y) => x - y)
        : [];
      const givenRaw = Array.isArray(a.answer)
        ? a.answer.map(Number)
        : a.answer == null
          ? []
          : [Number(a.answer)];
      const given = [...new Set(givenRaw)].sort((x, y) => x - y);
      const cat = a.category ?? q?.category ?? 'Other';
      const slot = (cats[cat] ??= { correct: 0, total: 0 });
      slot.total += 1;
      if (a.isCorrect) slot.correct += 1;
      return {
        questionId: q?.id ?? null,
        code: q?.code ?? null,
        category: cat,
        mode: q?.mode ?? 'single',
        prompt: q?.prompt ?? '',
        options: q?.options ?? [],
        correct,
        given,
        isCorrect: !!a.isCorrect,
        takenSecs: a.takenSecs ?? null,
        timeUp: a.timeUp,
        answeredAt: a.answeredAt,
        ...(q?.groupId != null && groupLabel.get(q.groupId)
          ? { groupCode: groupLabel.get(q.groupId)!.code, groupTitle: groupLabel.get(q.groupId)!.title }
          : {}),
      };
    });

    // Admin-controlled (Site Settings > Results Page): whether a student
    // can see their own per-question breakdown at all. Enforced here, not
    // just hidden in the template — `questions` (prompts, options, the
    // correct-answer indices) is simply never sent to the browser when
    // this is off, so there's nothing for a student to recover from the
    // network tab either.
    const { showQuestionHistory } = await this.settings.get();
    const attemptedCount = questions.filter((q) => q.given.length > 0).length;

    return {
      code: attempt.code,
      competition: attempt.registration.competition.title,
      competitionCode: attempt.registration.competition.code,
      stage: attempt.stage?.name ?? null,
      stagePosition: attempt.stage?.position ?? null,
      passMark,
      qualified,
      score,
      total,
      percent,
      scoringMode: attempt.registration.competition.scoringMode,
      scoreDisplay: formatScore(attempt.registration.competition.scoringMode, score, total, percent),
      certificateMode: attempt.registration.competition.certificateMode,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      certificateNumber: cert?.certificateNumber ?? null,
      categories: Object.entries(cats).map(([name, v]) => ({
        name,
        correct: v.correct,
        total: v.total,
      })),
      attemptedCount,
      showQuestionHistory,
      questions: showQuestionHistory ? questions : [],
    };
  }

  /**
   * Student-facing "Generate Certificate" fallback — same
   * issueForRegistration() call the admin action and the automatic queue
   * both use, so it's just as idempotent (a no-op if one already exists)
   * and bypasses the queue's wait-for-no-live-exam gate the same way.
   * Exists because that gate can legitimately stay closed for a while (a
   * long exam window, a backlog after a busy batch) and a student
   * shouldn't have to wait on it once they've already finished and the
   * page shows them qualified — this lets them pull their own certificate
   * on demand instead. Scoped to the requesting student's own attempt,
   * same ownership check as resultDetail() above.
   */
  async generateCertificate(code: string, studentId: number) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { code, registration: { studentId } },
      include: { registration: { include: { student: true, competition: true } } },
    });
    if (!attempt) throw new NotFoundException('Result not found');
    // Manual-process competitions withhold ALL issuance until an admin
    // explicitly generates it from Results — this self-service pull is
    // the one path that would otherwise bypass that (submitExam's own
    // auto-queue is already skipped for these; see there for the other
    // half of this gate).
    if (attempt.registration.competition.certificateMode === 'MANUAL') {
      throw new ForbiddenException(
        'Certificates for this competition are issued by the administration team once your result has been finalized — please check back later.',
      );
    }

    const eventName = attempt.registration.competition.title;
    const cert = await this.certIssuance.issueForRegistration(attempt.registrationId, eventName);
    if (!cert) {
      throw new BadRequestException(
        'Certificate could not be generated right now — please try again shortly or contact support.',
      );
    }

    const student = attempt.registration.student;
    void this.messaging.dispatch(
      'CERTIFICATE_AVAILABLE',
      { email: student.email, phone: student.phone },
      {
        StudentName: student.name,
        CertificateType: 'Participation',
        CertificateLink: `${CERTIFICATE_DOWNLOAD_BASE_URL}/${cert.certificateNumber}/download`,
      },
    );
    return { certificateNumber: cert.certificateNumber };
  }

  // ---- payments ----

  async payments(studentId: number) {
    const payments = await this.prisma.payment.findMany({
      where: { registration: { studentId } },
      include: {
        registration: { include: { competition: true } },
        stage: { select: { name: true, position: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => ({
      code: p.code,
      amount: Number(p.amount),
      mode: p.mode,
      status: p.status,
      providerTxn: p.providerTxn,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      competition: p.registration.competition.title,
      competitionCode: p.registration.competition.code,
      stage: p.stage?.name ?? null,
    }));
  }

  /** Start a Paytm Web Checkout payment for a locked, paid stage. */
  async initiatePayment(studentId: number, dto: InitiatePaymentDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const rs = await this.prisma.registrationStage.findFirst({
      where: {
        stageId: dto.stageId,
        registration: { studentId },
      },
      include: { stage: true, registration: true },
    });
    if (!rs) throw new NotFoundException('Stage not found for your registration');
    if (rs.stage.isFree) {
      throw new BadRequestException('This stage does not require payment');
    }
    if (rs.status !== 'Locked') {
      throw new BadRequestException('This stage is not awaiting payment');
    }

    // A stage being individually "Locked" only means it hasn't been paid for
    // yet — it doesn't mean every earlier stage was actually cleared. Without
    // this, a student could pay to unlock e.g. Stage 3 while never having
    // qualified Stage 1 or 2.
    if (rs.stage.position > 1) {
      const earlier = await this.prisma.registrationStage.findMany({
        where: {
          registrationId: rs.registrationId,
          stage: { position: { lt: rs.stage.position } },
        },
        include: { stage: { select: { position: true, name: true } } },
      });
      const notCleared = earlier.find((e) => e.status !== 'Qualified');
      if (notCleared) {
        throw new BadRequestException(
          `You need to qualify ${notCleared.stage.name} before you can pay for ${rs.stage.name}.`,
        );
      }
    }

    const codes = (
      await this.prisma.payment.findMany({ select: { code: true } })
    ).map((p) => p.code);
    const code = nextCode(codes, 'PAY-');

    await this.prisma.payment.create({
      data: {
        code,
        registrationId: rs.registrationId,
        stageId: rs.stageId,
        amount: rs.stage.price,
        mode: 'Paytm',
        status: 'Pending',
      },
    });

    const callbackUrl = process.env.PAYTM_CALLBACK_URL ?? '';
    const init = await this.paytm.buildInitParams({
      MID: process.env.PAYTM_MERCHANT_ID ?? '',
      ORDER_ID: code,
      CUST_ID: String(studentId),
      INDUSTRY_TYPE_ID: process.env.PAYTM_INDUSTRY_TYPE_ID ?? '',
      CHANNEL_ID: process.env.PAYTM_CHANNEL_ID ?? 'WEB',
      TXN_AMOUNT: Number(rs.stage.price).toFixed(2),
      WEBSITE: process.env.PAYTM_WEBSITE ?? '',
      CALLBACK_URL: callbackUrl,
      EMAIL: student.email ?? undefined,
      MOBILE_NO: student.phone ?? undefined,
    });

    return {
      orderId: code,
      amount: Number(rs.stage.price),
      action: process.env.PAYTM_REQUEST_URL ?? '',
      params: init,
    };
  }

  // ---- help desk (grievances) ----

  private static readonly HELP_DESK_LINK = 'https://indiamindleague.com/account/help-desk';

  async grievances(studentId: number) {
    return this.prisma.grievance.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Full thread for one ticket — the original message plus every reply
   * and system status-change entry, oldest first. A student may only see
   * their own ticket (grievanceId is scoped by studentId, not just code). */
  async grievanceDetail(studentId: number, code: string) {
    const grievance = await this.prisma.grievance.findFirst({
      where: { code, studentId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!grievance) throw new NotFoundException('Grievance not found');
    return grievance;
  }

  async createGrievance(studentId: number, dto: CreateStudentGrievanceDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const codes = (
      await this.prisma.grievance.findMany({ select: { code: true } })
    ).map((g) => g.code);
    const code = nextCode(codes, 'GV');

    const grievance = await this.prisma.grievance.create({
      data: {
        code,
        gtype: dto.gtype,
        studentId,
        name: student.name,
        contact: student.phone ?? student.email ?? null,
        subject: dto.subject,
        message: dto.message,
        status: 'New',
      },
    });

    // Acknowledge to the student, and alert the support inbox — fire-and-
    // forget, same as every other dispatch() call in this codebase: a
    // notification outage must never block the ticket itself from being
    // created.
    void this.messaging.dispatch(
      'GRIEVANCE_RECEIVED',
      { email: student.email, phone: student.phone },
      {
        StudentName: student.name,
        TicketID: code,
        Type: dto.gtype,
        Subject: dto.subject || '(no subject)',
        HelpDeskLink: StudentService.HELP_DESK_LINK,
      },
    );
    const setting = await this.settings.get();
    if (setting.contactEmail) {
      void this.messaging.dispatch(
        'GRIEVANCE_ADMIN_ALERT',
        { email: setting.contactEmail },
        {
          StudentName: student.name,
          StudentCode: student.code,
          TicketID: code,
          Type: dto.gtype,
          Subject: dto.subject || '(no subject)',
          Message: dto.message,
        },
      );
    }

    return grievance;
  }

  /** A student following up on their own ticket. Re-opens a Resolved
   * ticket back to In Progress — a student replying clearly means the
   * matter isn't actually settled from their side — and alerts the
   * support inbox the same way the original ticket did. */
  async addGrievanceReply(studentId: number, code: string, dto: AddGrievanceReplyDto) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const grievance = await this.prisma.grievance.findFirst({ where: { code, studentId } });
    if (!grievance) throw new NotFoundException('Grievance not found');

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.grievanceMessage.create({
        data: {
          grievanceId: grievance.id,
          authorType: 'student',
          authorName: student.name,
          body: dto.message,
        },
      }),
    ];
    if (grievance.status === 'Resolved') {
      ops.push(
        this.prisma.grievance.update({
          where: { id: grievance.id },
          data: { status: 'In Progress', resolver: { disconnect: true }, resolvedAt: null },
        }),
      );
    }
    await this.prisma.$transaction(ops);

    const setting = await this.settings.get();
    if (setting.contactEmail) {
      void this.messaging.dispatch(
        'GRIEVANCE_STUDENT_REPLIED',
        { email: setting.contactEmail },
        {
          StudentName: student.name,
          StudentCode: student.code,
          TicketID: code,
          Subject: grievance.subject || '(no subject)',
          Message: dto.message,
        },
      );
    }

    return this.grievanceDetail(studentId, code);
  }
}
