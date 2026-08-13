import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nextCode } from '../common/util';
import {
  CreateStudentGrievanceDto,
  SetStudentPasswordDto,
  SubmitAttemptDto,
  UpdateStudentProfileDto,
} from './student.dto';

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- profile ----

  async me(studentId: number) {
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
        passwordHash: true,
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

  async updateProfile(studentId: number, dto: UpdateStudentProfileDto) {
    const existing = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!existing) throw new NotFoundException('Student not found');

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
      parent: dto.parent,
      parentPhone: dto.parentPhone,
      gender: dto.gender,
      dob: dto.dob ? new Date(`${dto.dob}T00:00:00Z`) : undefined,
      address: dto.address,
      ...(schoolId !== existing.schoolId ? { schoolId } : {}),
    };

    await this.prisma.student.update({ where: { id: studentId }, data });
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

  // ---- schedules ----

  async schedules(studentId: number) {
    const registrations = await this.prisma.registration.findMany({
      where: { studentId },
      select: { competitionId: true },
    });
    const competitionIds = registrations.map((r) => r.competitionId);
    if (!competitionIds.length) return [];

    const exams = await this.prisma.exam.findMany({
      where: {
        competitionId: { in: competitionIds },
        status: { in: ['Scheduled', 'Live'] },
      },
      include: {
        competition: { select: { code: true, title: true } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });

    const now = new Date();
    return exams.map((e) => {
      let status = e.status;
      if (e.status === 'Scheduled') {
        const win = this.examWindow(e);
        if (win) {
          if (now < win.start) status = 'Scheduled';
          else if (now <= win.end) status = 'Live';
          else status = 'Closed';
        }
      }
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
      };
    });
  }

  // ---- exam taking ----

  private async loadQuestions(competitionId: number) {
    return this.prisma.question.findMany({
      where: { competitionId },
      orderBy: [{ category: 'asc' }, { id: 'asc' }],
    });
  }

  private gradeMatches(examGrade: string, studentGrade: string): boolean {
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

  private categoriesOf(questions: { category: string }[]): string[] {
    return [...new Set(questions.map((q) => q.category))];
  }

  // Exam availability window = date + time (same instant the UI shows) up to
  // start + duration minutes. Used to gate Scheduled exams and to compute the
  // effective status shown in schedules.
  private examWindow(exam: {
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
    const end = new Date(
      start.getTime() + (exam.durationMin ?? 15) * 60 * 1000,
    );
    return { start, end };
  }

  private formatWindowTime(d: Date): string {
    return d.toLocaleString('en-IN', {
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
    if (exam.status === 'Scheduled') {
      const win = this.examWindow(exam);
      if (win) {
        const now = new Date();
        if (now < win.start) {
          throw new ForbiddenException(
            `This exam opens on ${this.formatWindowTime(win.start)}. You cannot start it before the scheduled time.`,
          );
        }
        if (now > win.end) {
          throw new BadRequestException('The window for this exam has closed.');
        }
      }
    }
    if (exam.grade && !this.gradeMatches(exam.grade, student.grade)) {
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

    return { student, exam, registration };
  }

  async examDetails(code: string, studentId: number) {
    const { exam } = await this.resolveExam(code, studentId);
    const questions = await this.loadQuestions(exam.competition!.id);
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
      questionCount: questions.length,
      categories: this.categoriesOf(questions),
    };
  }

  async startExam(code: string, studentId: number) {
    const { exam, registration } = await this.resolveExam(code, studentId);
    const questions = await this.loadQuestions(exam.competition!.id);
    const firstStage = exam.competition?.stages?.[0] ?? null;

    const already = await this.prisma.attempt.findFirst({
      where: {
        registrationId: registration.id,
        ...(firstStage
          ? { stageId: firstStage.id }
          : { competition: { id: exam.competitionId } }),
        finishedAt: { not: null },
      },
    });
    if (already) {
      throw new BadRequestException(
        'You have already attempted this test. Only one attempt is allowed.',
      );
    }

    const codes = (
      await this.prisma.attempt.findMany({ select: { code: true } })
    ).map((a) => a.code);
    const attemptCode = nextCode(codes, 'T');

    const attempt = await this.prisma.attempt.create({
      data: {
        code: attemptCode,
        registrationId: registration.id,
        stageId: firstStage?.id ?? null,
        startedAt: new Date(),
        timing: exam.timing as Prisma.InputJsonValue,
      },
    });

    return {
      attemptCode: attempt.code,
      startedAt: attempt.startedAt,
      durationMin: exam.durationMin ?? 15,
      timing: exam.timing,
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
      })),
    };
  }

  async submitExam(code: string, studentId: number, dto: SubmitAttemptDto) {
    const { exam, registration } = await this.resolveExam(code, studentId);
    const questions = await this.loadQuestions(exam.competition!.id);
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

    const given = new Map<number, number[]>();
    const rec = new Map<number, { takenSecs?: number }>();
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
      rows.push({
        attemptId: attempt.id,
        questionId: q.id,
        answer: q.mode === 'multi' ? mine : mine[0] ?? null,
        isCorrect,
        takenSecs: ansRec?.takenSecs ?? null,
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
      });
    }

    const total = questions.length;
    const percent = total ? Math.round((score / total) * 100) : 0;
    const finishedAt = new Date();
    const passMark = attempt.stageId ? Number(firstStage?.passMark ?? 0) : 0;
    const qualified = percent >= passMark;

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
    if (qualified && next && next.isFree) {
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

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    if (rows.length) {
      ops.push(this.prisma.attemptAnswer.createMany({ data: rows }));
    }
    ops.push(
      this.prisma.attempt.update({
        where: { id: attempt.id },
        data: { finishedAt, score, total },
      }),
    );
    if (attempt.stageId) {
      ops.push(
        this.prisma.registrationStage.updateMany({
          where: {
            registrationId: registration.id,
            stageId: attempt.stageId,
          },
          data: {
            status: qualified ? 'Qualified' : 'Attempted',
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
        data: { status: qualified ? 'Qualified' : 'Test Taken' },
      }),
    );
    await this.prisma.$transaction(ops);

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
      score,
      total,
      percent,
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

    return attempts.map((a) => {
      const cats: Record<string, { correct: number; total: number }> = {};
      for (const ans of a.answers) {
        const cat = ans.question?.category ?? 'Other';
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
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
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
        stage: { select: { name: true, position: true, passMark: true } },
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
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Result not found');

    const score = Number(attempt.score);
    const total = Number(attempt.total);
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    const passMark = Number(attempt.stage?.passMark ?? 0);

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
      const cat = q?.category ?? 'Other';
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
      };
    });

    return {
      code: attempt.code,
      competition: attempt.registration.competition.title,
      competitionCode: attempt.registration.competition.code,
      stage: attempt.stage?.name ?? null,
      stagePosition: attempt.stage?.position ?? null,
      passMark,
      qualified: passMark > 0 ? percent >= passMark : null,
      score,
      total,
      percent,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      categories: Object.entries(cats).map(([name, v]) => ({
        name,
        correct: v.correct,
        total: v.total,
      })),
      questions,
    };
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

  // ---- help desk (grievances) ----

  async grievances(studentId: number) {
    return this.prisma.grievance.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
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

    return this.prisma.grievance.create({
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
  }
}
