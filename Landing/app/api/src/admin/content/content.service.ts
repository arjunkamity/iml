import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from '../../messaging/messaging.service';
import { paginate, ListResult } from '../../common/list-result';
import { gradeMatches, nextCode, toDate, toTime } from '../../common/util';
import { parseCsv, toCsv } from '../../common/csv.util';
import { BulkUploadResult, BulkUploadRowError } from './content.dto';
import { QuestionGroupsService } from '../question-groups/question-groups.service';
import {
  AssignRegistrationDto,
  AutoAssignBatchesDto,
  CreateAnnouncementDto,
  CreateExamBatchDto,
  CreateExamDto,
  CreateGalleryDto,
  CreateNewsDto,
  CreateNotificationDto,
  CreateQuestionDto,
  PatchAnnouncementDto,
  PatchExamBatchDto,
  PatchExamDto,
  PatchGalleryDto,
  PatchGrievanceDto,
  PatchNewsDto,
  PatchQuestionDto,
  ReplyGrievanceDto,
} from './content.dto';

type ListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  comp?: string;
  category?: string;
  grade?: string;
  gtype?: string;
  demo?: string;
  group?: string;
};

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly groups: QuestionGroupsService,
  ) {}

  // ---- questions ----

  async listQuestions(
    q: ListQuery,
  ): Promise<ListResult<Record<string, unknown>>> {
    // Assessment questions are managed under Assessments, not in this bank.
    const where: Prisma.QuestionWhereInput = { assessmentId: null };
    if (q.status) where.competition = { status: q.status };
    if (q.comp) where.competition = { code: q.comp };
    if (q.category) where.category = q.category;
    if (q.grade) where.grade = q.grade;
    if (q.group === 'Grouped') where.groupId = { not: null };
    else if (q.group === 'Ungrouped') where.groupId = null;
    if (q.demo === 'Demo only') where.isDemo = true;
    else if (q.demo === 'Real only') where.isDemo = false;
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { prompt: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        include: { competition: { select: { code: true, title: true } }, group: { select: { code: true } } },
        orderBy: { code: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.question.count({ where }),
    ]);
    return paginate(
      rows.map((x) => ({
        code: x.code,
        prompt: x.prompt,
        grade: x.grade,
        category: x.category,
        qtype: x.qtype,
        mode: x.mode,
        competition: x.competition?.title ?? null,
        competitionCode: x.competition?.code ?? null,
        // Set when the question is a sub-question of a Question Group.
        groupCode: x.group?.code ?? null,
        options: x.options,
        correct: x.correct,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async getQuestion(code: string) {
    const row = await this.prisma.question.findUnique({ where: { code } });
    if (!row) throw new NotFoundException('Question not found');
    return row;
  }

  async createQuestion(dto: CreateQuestionDto) {
    const { competitionCode, options, correct, ...rest } = dto;
    const codes = (
      await this.prisma.question.findMany({ select: { code: true } })
    ).map((x) => x.code);
    const competitionId = competitionCode
      ? ((
          await this.prisma.competition.findUnique({
            where: { code: competitionCode },
          })
        )?.id ?? null)
      : null;
    return this.prisma.question.create({
      data: {
        code: nextCode(codes, 'Q'),
        competitionId,
        ...rest,
        qtype: rest.qtype ?? 'text',
        mode: rest.mode ?? 'single',
        options: (options ?? []) as Prisma.InputJsonValue,
        correct: (correct ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  /** An assessment question that already has saved results is locked: editing
   * its text/options/points or deleting it would silently change what those
   * results mean. (Full draft/publish/new-version handling arrives in Phase 2a;
   * until then locking is the safe default.) */
  private async assertAssessmentQuestionEditable(question: { assessmentId: number | null }) {
    if (question.assessmentId == null) return;
    const submissions = await this.prisma.assessmentSubmission.count({ where: { assessmentId: question.assessmentId } });
    if (submissions > 0) {
      throw new BadRequestException(
        'This question belongs to an assessment that students have already completed, so it can no longer be changed or deleted.',
      );
    }
  }

  private async groupedQuestionError(groupId: number, what: string) {
    const g = await this.prisma.questionGroup.findUnique({ where: { id: groupId }, select: { code: true } });
    return new BadRequestException(
      `This question is part of group ${g?.code ?? ''}, whose questions must share one ${what}. Remove it from the group first (Question Groups), then change it.`,
    );
  }

  async updateQuestion(code: string, dto: PatchQuestionDto) {
    const existing = await this.prisma.question.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Question not found');
    await this.assertAssessmentQuestionEditable(existing);
    const { competitionCode, options, correct, ...rest } = dto;
    // Every sub-question must share its group's competition and category, so
    // neither can be changed while the question is in a group.
    if (existing.groupId != null && rest.category !== undefined && rest.category !== existing.category) {
      throw await this.groupedQuestionError(existing.groupId, 'category');
    }
    if (existing.groupId != null && rest.isDemo === true) {
      throw new BadRequestException('This question is part of a Question Group, and a demo question can’t be grouped. Remove it from the group first.');
    }
    const data: Prisma.QuestionUpdateInput = { ...rest };
    if (competitionCode !== undefined) {
      const competitionId = competitionCode
        ? ((
            await this.prisma.competition.findUnique({
              where: { code: competitionCode },
            })
          )?.id ?? null)
        : null;
      if (existing.groupId != null && competitionId !== existing.competitionId) {
        throw await this.groupedQuestionError(existing.groupId, 'competition');
      }
      data.competition = competitionId
        ? { connect: { id: competitionId } }
        : { disconnect: true };
    }
    if (options !== undefined) data.options = options as Prisma.InputJsonValue;
    if (correct !== undefined) data.correct = correct as Prisma.InputJsonValue;
    return this.prisma.question.update({ where: { code }, data });
  }

  async deleteQuestion(code: string) {
    const existing = await this.prisma.question.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Question not found');
    await this.assertAssessmentQuestionEditable(existing);
    await this.prisma.question.delete({ where: { code } });
    // Leaving a group: close the gap in its order, and deactivate it if too few remain.
    if (existing.groupId != null) await this.groups.normalizeAfterMemberLeft(existing.groupId);
    return { ok: true };
  }

  // ---- questions: bulk upload ----

  private static readonly QUESTION_CSV_COLUMNS = [
    'grade',
    'category',
    'prompt',
    'option1',
    'option2',
    'option3',
    'option4',
    'option5',
    'option6',
    'correct',
    'mode',
    'qtype',
    'media',
    'timeLimitSecs',
    'label',
    'ref',
    'competitionCode',
  ];

  sampleQuestionsCsv(): string {
    const header = ContentService.QUESTION_CSV_COLUMNS;
    const example1 = [
      '9',
      'IQ',
      'Which number comes next: 2, 4, 8, 16, ?',
      '20',
      '24',
      '32',
      '36',
      '',
      '',
      '2',
      'single',
      'text',
      '',
      '60',
      '',
      '',
      '',
    ];
    const example2 = [
      '10',
      'EQ',
      'Which of the following are healthy ways to handle stress? (select all that apply)',
      'Talking to a friend',
      'Bottling it up',
      'Regular exercise',
      'Ignoring the problem',
      '',
      '',
      '0,2',
      'multi',
      'text',
      '',
      '90',
      '',
      '',
      '',
    ];
    return toCsv([header, example1, example2]);
  }

  async bulkUploadQuestions(buffer: Buffer): Promise<BulkUploadResult> {
    const text = buffer.toString('utf8');
    const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
    if (!rows.length) throw new BadRequestException('CSV file is empty');

    const header = rows[0].map((h) => h.trim().toLowerCase());
    for (const col of ['grade', 'category', 'prompt']) {
      if (!header.includes(col)) {
        throw new BadRequestException(`CSV is missing required column "${col}"`);
      }
    }
    const colIndex = (name: string) => header.indexOf(name.toLowerCase());
    const dataRows = rows.slice(1);

    const existingCodes = (
      await this.prisma.question.findMany({ select: { code: true } })
    ).map((x) => x.code);
    const competitionCache = new Map<string, number | null>();
    const errors: BulkUploadRowError[] = [];
    let created = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const rowNum = i + 2; // +1 for header, +1 for 1-based display
      const get = (name: string) => {
        const idx = colIndex(name);
        return idx >= 0 ? (r[idx] ?? '').trim() : '';
      };
      const fail = (message: string) => errors.push({ row: rowNum, message });

      const grade = get('grade');
      const category = get('category');
      const prompt = get('prompt');
      if (!grade) { fail('grade is required'); continue; }
      if (grade.length > 6) { fail(`grade "${grade}" exceeds 6 characters`); continue; }
      if (!category) { fail('category is required'); continue; }
      if (category.length > 20) { fail(`category "${category}" exceeds 20 characters`); continue; }
      if (!prompt) { fail('prompt is required'); continue; }

      const options: string[] = [];
      for (let n = 1; n <= 6; n++) {
        const v = get(`option${n}`);
        if (v) options.push(v);
      }
      if (options.length < 2) { fail('at least 2 options are required'); continue; }

      const correctRaw = get('correct');
      const correct = correctRaw
        .split(/[,|]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number);
      if (!correctRaw || correct.some((n) => Number.isNaN(n))) {
        fail('correct must be one or more 0-based option indices, e.g. "0" or "1,2"');
        continue;
      }
      if (correct.some((n) => n < 0 || n >= options.length)) {
        fail(`correct index out of range for ${options.length} option(s)`);
        continue;
      }

      const qtype = get('qtype') || 'text';
      if (!['text', 'video', 'image'].includes(qtype)) {
        fail(`qtype must be text, video, or image (got "${qtype}")`);
        continue;
      }
      let mode = get('mode');
      if (mode && !['single', 'multi'].includes(mode)) {
        fail(`mode must be single or multi (got "${mode}")`);
        continue;
      }
      if (!mode) mode = correct.length > 1 ? 'multi' : 'single';

      const timeLimitRaw = get('timelimitsecs');
      let timeLimitSecs: number | undefined;
      if (timeLimitRaw) {
        timeLimitSecs = Number(timeLimitRaw);
        if (!Number.isInteger(timeLimitSecs) || timeLimitSecs < 1) {
          fail(`timeLimitSecs must be a whole number of 1 or more (got "${timeLimitRaw}")`);
          continue;
        }
      }

      const label = get('label');
      if (label.length > 60) { fail('label exceeds 60 characters'); continue; }
      const ref = get('ref');
      if (ref.length > 30) { fail('ref exceeds 30 characters'); continue; }
      const media = get('media');
      const competitionCode = get('competitioncode');

      let competitionId: number | null = null;
      if (competitionCode) {
        if (!competitionCache.has(competitionCode)) {
          const c = await this.prisma.competition.findUnique({
            where: { code: competitionCode },
          });
          competitionCache.set(competitionCode, c?.id ?? null);
        }
        competitionId = competitionCache.get(competitionCode) ?? null;
        if (competitionId === null) {
          fail(`competition "${competitionCode}" not found`);
          continue;
        }
      }

      const code = nextCode(existingCodes, 'Q');
      try {
        await this.prisma.question.create({
          data: {
            code,
            competitionId,
            grade,
            category,
            qtype,
            media: media || null,
            mode,
            label: label || null,
            ref: ref || null,
            timeLimitSecs: timeLimitSecs ?? null,
            prompt,
            options: options as Prisma.InputJsonValue,
            correct: correct as Prisma.InputJsonValue,
          },
        });
        existingCodes.push(code);
        created++;
      } catch (e) {
        fail(e instanceof Error ? e.message : 'failed to save row');
      }
    }

    return { total: dataRows.length, created, failed: errors.length, errors };
  }

  // ---- exams ----

  async listExams(q: ListQuery): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.ExamWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.comp) where.competition = { code: q.comp };
    if (q.search) where.title = { contains: q.search, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.exam.findMany({
        where,
        include: { competition: { select: { code: true, title: true } } },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.exam.count({ where }),
    ]);

    // A competition with a Question mix (Competitions > Question mix) serves
    // that mix's total and ignores Exam.questionCount — so the list shows the
    // number students will actually get, not a cap that no longer applies.
    const competitionIds = [...new Set(rows.map((x) => x.competitionId).filter((id): id is number => id != null))];
    const mixTotals = new Map<number, number>();
    if (competitionIds.length) {
      const rules = await this.prisma.competitionQuestionRule.findMany({
        where: { competitionId: { in: competitionIds } },
        select: { competitionId: true, count: true },
      });
      for (const r of rules) mixTotals.set(r.competitionId, (mixTotals.get(r.competitionId) ?? 0) + r.count);
    }

    return paginate(
      rows.map((x) => {
        const mixTotal = x.competitionId != null ? mixTotals.get(x.competitionId) : undefined;
        return {
          code: x.code,
          title: x.title,
          grade: x.grade,
          date: x.date,
          time: x.time,
          durationMin: x.durationMin,
          // Raw values: the Edit form is pre-filled from this list row (it
          // doesn't re-fetch), so these were silently blank there before.
          questionCount: x.questionCount,
          maxAttempts: x.maxAttempts,
          // What students actually get: the mix total when the competition
          // has one, else the manual cap, else every tagged question.
          questionsServed: mixTotal ? `${mixTotal} (mix)` : (x.questionCount ?? 'All'),
          status: x.status,
          competition: x.competition?.title ?? null,
          competitionCode: x.competition?.code ?? null,
        };
      }),
      total,
      q.page,
      q.limit,
    );
  }

  async createExam(dto: CreateExamDto) {
    const { competitionCode, date, time, timing, ...rest } = dto;
    const codes = (
      await this.prisma.exam.findMany({ select: { code: true } })
    ).map((x) => x.code);
    const competitionId = competitionCode
      ? ((
          await this.prisma.competition.findUnique({
            where: { code: competitionCode },
          })
        )?.id ?? null)
      : null;
    return this.prisma.exam.create({
      data: {
        code: nextCode(codes, 'E'),
        competitionId,
        ...rest,
        date: toDate(date) ?? null,
        time: toTime(time) ?? null,
        timing: timing ?? {},
        status: rest.status ?? 'Scheduled',
      },
    });
  }

  async updateExam(code: string, dto: PatchExamDto) {
    const existing = await this.prisma.exam.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Exam not found');
    const { competitionCode, date, time, timing, ...rest } = dto;
    const data: Prisma.ExamUpdateInput = { ...rest };
    if (date !== undefined) data.date = toDate(date) ?? null;
    if (time !== undefined) data.time = toTime(time) ?? null;
    if (timing !== undefined) data.timing = timing as Prisma.InputJsonValue;
    if (competitionCode !== undefined) {
      const competitionId = competitionCode
        ? ((
            await this.prisma.competition.findUnique({
              where: { code: competitionCode },
            })
          )?.id ?? null)
        : null;
      data.competition = competitionId
        ? { connect: { id: competitionId } }
        : { disconnect: true };
    }
    return this.prisma.exam.update({ where: { code }, data });
  }

  async deleteExam(code: string) {
    const existing = await this.prisma.exam.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Exam not found');
    await this.prisma.exam.delete({ where: { code } });
    return { ok: true };
  }

  // ---- exam batches (batch-wise access) ----

  // The full grade-eligible registration pool for an exam's competition,
  // plus which of those are already assigned a batch. "Eligible" mirrors the
  // same grade check StudentService.resolveExam() enforces at start time, so
  // auto-assign never seats someone who couldn't actually take the exam.
  private async eligibilityForExam(examId: number) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Exam not found');
    if (!exam.competitionId) {
      return { exam, eligible: [] as { id: number; code: string }[], assignedIds: new Set<number>() };
    }
    const [registrations, assigned] = await Promise.all([
      this.prisma.registration.findMany({
        where: { competitionId: exam.competitionId },
        select: { id: true, code: true, student: { select: { grade: true } } },
      }),
      this.prisma.examBatchAssignment.findMany({
        where: { examId },
        select: { registrationId: true },
      }),
    ]);
    const assignedIds = new Set(assigned.map((a) => a.registrationId));
    const eligible = registrations.filter(
      (r) => !exam.grade || gradeMatches(exam.grade, r.student.grade),
    );
    return { exam, eligible, assignedIds };
  }

  async listExamBatches(examCode: string) {
    const exam = await this.prisma.exam.findUnique({ where: { code: examCode } });
    if (!exam) throw new NotFoundException('Exam not found');
    const { eligible, assignedIds } = await this.eligibilityForExam(exam.id);
    const batches = await this.prisma.examBatch.findMany({
      where: { examId: exam.id },
      include: { _count: { select: { assignments: true } } },
      orderBy: { startAt: 'asc' },
    });
    return {
      exam: {
        code: exam.code,
        title: exam.title,
        grade: exam.grade,
        durationMin: exam.durationMin,
      },
      batches: batches.map((b) => ({
        id: b.id,
        label: b.label,
        startAt: b.startAt,
        durationMin: b.durationMin,
        capacity: b.capacity,
        assigned: b._count.assignments,
        remaining: Math.max(0, b.capacity - b._count.assignments),
      })),
      totalEligible: eligible.length,
      totalAssigned: assignedIds.size,
      totalUnassigned: Math.max(0, eligible.length - assignedIds.size),
    };
  }

  // Full, searchable, paginated roster for one batch — backs the admin
  // "View" page (as opposed to searchExamStudents, which is a small
  // exam-wide typeahead used only to pick who to move).
  async listBatchStudents(
    batchId: number,
    q: { page: number; limit: number; search?: string },
  ): Promise<ListResult<Record<string, unknown>>> {
    const batch = await this.prisma.examBatch.findUnique({
      where: { id: batchId },
      include: { exam: { select: { code: true, title: true } } },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const where: Prisma.ExamBatchAssignmentWhereInput = { batchId };
    if (q.search?.trim()) {
      const search = q.search.trim();
      where.registration = {
        student: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.examBatchAssignment.findMany({
        where,
        include: {
          registration: {
            include: {
              student: {
                select: { name: true, email: true, phone: true, grade: true, school: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { id: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.examBatchAssignment.count({ where }),
    ]);

    const result = paginate(
      rows.map((a) => ({
        registrationCode: a.registration.code,
        name: a.registration.student.name,
        email: a.registration.student.email,
        phone: a.registration.student.phone,
        grade: a.registration.student.grade,
        school: a.registration.student.school?.name ?? null,
      })),
      total,
      q.page,
      q.limit,
    );
    return {
      ...result,
      batch: {
        id: batch.id,
        label: batch.label,
        startAt: batch.startAt,
        capacity: batch.capacity,
        examCode: batch.exam.code,
        examTitle: batch.exam.title,
      },
    } as ListResult<Record<string, unknown>> & { batch: unknown };
  }

  private formatBatchTime(d: Date): string {
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Sends the "Get Ready" (pre-window) or "Go For It" (window-open) reminder
  // to every student assigned to a batch, via the admin's chosen channel(s).
  // "Go For It" also mints a one-per-student ExamMagicLink so the message can
  // carry a link that drops the student straight onto the exam, no login
  // step needed — see AuthService.consumeExamLink.
  async sendBatchReminder(
    batchId: number,
    type: 'GET_READY' | 'GO_FOR_IT',
    channels: Array<'email' | 'sms'>,
  ) {
    if (!channels.length) {
      throw new BadRequestException('Choose at least one channel to send through.');
    }
    const batch = await this.prisma.examBatch.findUnique({
      where: { id: batchId },
      include: { exam: { select: { id: true, code: true, title: true } } },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const assignments = await this.prisma.examBatchAssignment.findMany({
      where: { batchId },
      include: {
        registration: {
          select: {
            id: true,
            student: { select: { name: true, email: true, phone: true } },
          },
        },
      },
    });
    if (!assignments.length) return { recipients: 0, queued: 0 };

    const examEnd = new Date(batch.startAt.getTime() + batch.durationMin * 60 * 1000);
    const templateKey = type === 'GET_READY' ? 'EXAM_REMINDER_GET_READY' : 'EXAM_REMINDER_GO_FOR_IT';
    const frontendBase = (process.env.FRONTEND_BASE_URL || 'https://indiamindleague.com').replace(/\/$/, '');

    const tokenByRegistration = new Map<number, string>();
    if (type === 'GO_FOR_IT') {
      const links = assignments.map((a) => ({
        token: randomBytes(9).toString('base64url'),
        registrationId: a.registration.id,
        examId: batch.exam.id,
        expiresAt: examEnd,
      }));
      await this.prisma.examMagicLink.createMany({ data: links });
      links.forEach((l) => tokenByRegistration.set(l.registrationId, l.token));
    }

    let queued = 0;
    for (const a of assignments) {
      const student = a.registration.student;
      const target = {
        email: channels.includes('email') ? student.email : null,
        phone: channels.includes('sms') ? student.phone : null,
      };
      if (!target.email && !target.phone) continue;
      const vars =
        type === 'GET_READY'
          ? { StudentName: student.name, ExamTime: this.formatBatchTime(batch.startAt) }
          : {
              StudentName: student.name,
              CloseTime: this.formatBatchTime(examEnd),
              TestLink: `${frontendBase}/t/${tokenByRegistration.get(a.registration.id)}`,
            };
      // Fire-and-forget per recipient — dispatch() never throws and logs
      // every attempt itself, so a slow/failed provider call for one student
      // never blocks or fails the batch send for the rest.
      void this.messaging.dispatch(templateKey, target, vars);
      queued++;
    }

    return { recipients: assignments.length, queued };
  }

  async createExamBatch(examCode: string, dto: CreateExamBatchDto) {
    const exam = await this.prisma.exam.findUnique({ where: { code: examCode } });
    if (!exam) throw new NotFoundException('Exam not found');
    const startAt = new Date(dto.startAt);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid start date/time');
    }
    return this.prisma.examBatch.create({
      data: {
        examId: exam.id,
        label: dto.label.trim(),
        startAt,
        durationMin: dto.durationMin,
        capacity: dto.capacity,
      },
    });
  }

  async updateExamBatch(id: number, dto: PatchExamBatchDto) {
    const existing = await this.prisma.examBatch.findUnique({
      where: { id },
      include: { _count: { select: { assignments: true } } },
    });
    if (!existing) throw new NotFoundException('Batch not found');
    if (dto.capacity !== undefined && dto.capacity < existing._count.assignments) {
      throw new BadRequestException(
        `Capacity can't be set below the ${existing._count.assignments} students already assigned to this batch.`,
      );
    }
    const data: Prisma.ExamBatchUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label.trim();
    if (dto.startAt !== undefined) {
      const startAt = new Date(dto.startAt);
      if (Number.isNaN(startAt.getTime())) throw new BadRequestException('Invalid start date/time');
      data.startAt = startAt;
    }
    if (dto.durationMin !== undefined) data.durationMin = dto.durationMin;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    return this.prisma.examBatch.update({ where: { id }, data });
  }

  async deleteExamBatch(id: number) {
    const existing = await this.prisma.examBatch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Batch not found');
    await this.prisma.examBatch.delete({ where: { id } }); // cascades assignments
    return { ok: true };
  }

  // Round-robin fills every selected batch up to its remaining capacity with
  // currently-unassigned, grade-eligible registrations. Capacity is enforced
  // at assignment time (not live at exam-start), so once this runs, "how
  // many could show up to this batch" has a hard ceiling.
  async autoAssignExamBatches(examCode: string, dto: AutoAssignBatchesDto) {
    const exam = await this.prisma.exam.findUnique({ where: { code: examCode } });
    if (!exam) throw new NotFoundException('Exam not found');

    const batches = await this.prisma.examBatch.findMany({
      where: {
        examId: exam.id,
        ...(dto.batchIds?.length ? { id: { in: dto.batchIds } } : {}),
      },
      include: { _count: { select: { assignments: true } } },
      orderBy: { startAt: 'asc' },
    });
    if (!batches.length) {
      throw new BadRequestException('No batches to assign into — create at least one batch first.');
    }

    const { eligible, assignedIds } = await this.eligibilityForExam(exam.id);
    const unassigned = eligible.filter((r) => !assignedIds.has(r.id));

    const slots = batches.map((b) => ({
      id: b.id,
      remaining: Math.max(0, b.capacity - b._count.assignments),
    }));
    const toCreate: { examId: number; batchId: number; registrationId: number }[] = [];
    let cursor = 0;
    for (const reg of unassigned) {
      let placed = false;
      for (let tries = 0; tries < slots.length; tries++) {
        const slot = slots[(cursor + tries) % slots.length];
        if (slot.remaining > 0) {
          slot.remaining--;
          toCreate.push({ examId: exam.id, batchId: slot.id, registrationId: reg.id });
          cursor = (cursor + tries + 1) % slots.length;
          placed = true;
          break;
        }
      }
      if (!placed) break; // every selected batch is full
    }

    if (toCreate.length) {
      await this.prisma.examBatchAssignment.createMany({ data: toCreate, skipDuplicates: true });
    }

    return {
      assigned: toCreate.length,
      stillUnassigned: unassigned.length - toCreate.length,
    };
  }

  async assignRegistrationToBatch(batchId: number, dto: AssignRegistrationDto) {
    const batch = await this.prisma.examBatch.findUnique({
      where: { id: batchId },
      include: { _count: { select: { assignments: true } } },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const registration = await this.prisma.registration.findUnique({
      where: { code: dto.registrationCode.trim() },
    });
    if (!registration) throw new NotFoundException('Registration not found');

    const existing = await this.prisma.examBatchAssignment.findUnique({
      where: { examId_registrationId: { examId: batch.examId, registrationId: registration.id } },
    });
    if (existing) {
      if (existing.batchId === batchId) return existing; // already here
      if (batch._count.assignments >= batch.capacity) {
        throw new BadRequestException('This batch is already at capacity.');
      }
      return this.prisma.examBatchAssignment.update({
        where: { id: existing.id },
        data: { batchId },
      });
    }
    if (batch._count.assignments >= batch.capacity) {
      throw new BadRequestException('This batch is already at capacity.');
    }
    return this.prisma.examBatchAssignment.create({
      data: { examId: batch.examId, batchId, registrationId: registration.id },
    });
  }

  // Lets the admin find a student by name/email/phone (rather than typing a
  // registration code blind) when moving them between batches.
  async searchExamStudents(examCode: string, q: string) {
    const exam = await this.prisma.exam.findUnique({ where: { code: examCode } });
    if (!exam) throw new NotFoundException('Exam not found');
    const query = (q ?? '').trim();
    if (!exam.competitionId || query.length < 2) return [];

    const registrations = await this.prisma.registration.findMany({
      where: {
        competitionId: exam.competitionId,
        student: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        },
      },
      select: {
        id: true,
        code: true,
        student: { select: { name: true, email: true, phone: true, grade: true } },
      },
      take: 20,
      orderBy: { registeredAt: 'desc' },
    });
    if (!registrations.length) return [];

    const assignments = await this.prisma.examBatchAssignment.findMany({
      where: { examId: exam.id, registrationId: { in: registrations.map((r) => r.id) } },
      include: { batch: { select: { label: true } } },
    });
    const batchByRegId = new Map(assignments.map((a) => [a.registrationId, a.batch.label]));

    return registrations.map((r) => ({
      registrationCode: r.code,
      name: r.student.name,
      email: r.student.email,
      phone: r.student.phone,
      grade: r.student.grade,
      currentBatch: batchByRegId.get(r.id) ?? null,
    }));
  }

  async unassignRegistrationFromExam(examCode: string, registrationCode: string) {
    const exam = await this.prisma.exam.findUnique({ where: { code: examCode } });
    if (!exam) throw new NotFoundException('Exam not found');
    const registration = await this.prisma.registration.findUnique({
      where: { code: registrationCode.trim() },
    });
    if (!registration) throw new NotFoundException('Registration not found');
    await this.prisma.examBatchAssignment.deleteMany({
      where: { examId: exam.id, registrationId: registration.id },
    });
    return { ok: true };
  }

  // ---- announcements ----

  async listAnnouncements(q: ListQuery) {
    const where: Prisma.AnnouncementWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) where.title = { contains: q.search, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return paginate(rows, total, q.page, q.limit);
  }

  async createAnnouncement(dto: CreateAnnouncementDto) {
    const codes = (
      await this.prisma.announcement.findMany({ select: { code: true } })
    ).map((x) => x.code);
    return this.prisma.announcement.create({
      data: {
        code: nextCode(codes, 'AN'),
        ...dto,
        publishOn: toDate(dto.publishOn) ?? null,
        status: dto.status ?? 'Draft',
      },
    });
  }

  async updateAnnouncement(code: string, dto: PatchAnnouncementDto) {
    const existing = await this.prisma.announcement.findUnique({
      where: { code },
    });
    if (!existing) throw new NotFoundException('Announcement not found');
    return this.prisma.announcement.update({
      where: { code },
      data: {
        ...dto,
        publishOn:
          dto.publishOn !== undefined
            ? (toDate(dto.publishOn) ?? null)
            : undefined,
      },
    });
  }

  async deleteAnnouncement(code: string) {
    const existing = await this.prisma.announcement.findUnique({
      where: { code },
    });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { code } });
    return { ok: true };
  }

  // ---- news ----

  async listNews(q: ListQuery) {
    const where: Prisma.NewsWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) where.title = { contains: q.search, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.news.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.news.count({ where }),
    ]);
    return paginate(rows, total, q.page, q.limit);
  }

  async createNews(dto: CreateNewsDto) {
    const codes = (
      await this.prisma.news.findMany({ select: { code: true } })
    ).map((x) => x.code);
    return this.prisma.news.create({
      data: {
        code: nextCode(codes, 'NW'),
        ...dto,
        publishOn: toDate(dto.publishOn) ?? null,
        status: dto.status ?? 'Draft',
      },
    });
  }

  async updateNews(code: string, dto: PatchNewsDto) {
    const existing = await this.prisma.news.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('News item not found');
    return this.prisma.news.update({
      where: { code },
      data: {
        ...dto,
        publishOn:
          dto.publishOn !== undefined
            ? (toDate(dto.publishOn) ?? null)
            : undefined,
      },
    });
  }

  async deleteNews(code: string) {
    const existing = await this.prisma.news.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('News item not found');
    await this.prisma.news.delete({ where: { code } });
    return { ok: true };
  }

  // ---- gallery ----

  async listGallery(q: ListQuery) {
    const where: Prisma.GalleryWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.gallery.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.gallery.count({ where }),
    ]);
    return paginate(rows, total, q.page, q.limit);
  }

  async createGallery(dto: CreateGalleryDto) {
    const codes = (
      await this.prisma.gallery.findMany({ select: { code: true } })
    ).map((x) => x.code);
    return this.prisma.gallery.create({
      data: {
        code: nextCode(codes, 'GA'),
        ...dto,
        date: toDate(dto.date) ?? null,
        photos: (dto.photos ?? []) as Prisma.InputJsonValue,
        status: dto.status ?? 'Active',
      },
    });
  }

  async updateGallery(code: string, dto: PatchGalleryDto) {
    const existing = await this.prisma.gallery.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Gallery album not found');
    const data: Prisma.GalleryUpdateInput = {
      name: dto.name,
      visibility: dto.visibility,
      cover: dto.cover,
      description: dto.description,
      status: dto.status,
    };
    if (dto.date !== undefined) data.date = toDate(dto.date) ?? null;
    if (dto.photos !== undefined)
      data.photos = dto.photos as Prisma.InputJsonValue;
    return this.prisma.gallery.update({ where: { code }, data });
  }

  async deleteGallery(code: string) {
    const existing = await this.prisma.gallery.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Gallery album not found');
    await this.prisma.gallery.delete({ where: { code } });
    return { ok: true };
  }

  // ---- grievances ----

  async listGrievances(q: ListQuery) {
    const where: Prisma.GrievanceWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.gtype) where.gtype = q.gtype;
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { subject: { contains: q.search, mode: 'insensitive' } },
        { message: { contains: q.search, mode: 'insensitive' } },
        { name: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.grievance.findMany({
        where,
        include: { student: { select: { code: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.grievance.count({ where }),
    ]);
    return paginate(
      rows.map((g) => {
        const { student, ...rest } = g;
        return { ...rest, studentCode: student?.code ?? null, studentName: student?.name ?? null };
      }),
      total,
      q.page,
      q.limit,
    );
  }

  async updateGrievance(code: string, dto: PatchGrievanceDto, adminId: number) {
    const existing = await this.prisma.grievance.findUnique({
      where: { code },
    });
    if (!existing) throw new NotFoundException('Grievance not found');
    const data: Prisma.GrievanceUpdateInput = { status: dto.status };
    if (dto.status === 'Resolved') {
      data.resolver = { connect: { id: adminId } };
      data.resolvedAt = new Date();
    } else {
      data.resolver = existing.resolvedBy ? { disconnect: true } : undefined;
      data.resolvedAt = null;
    }
    return this.prisma.grievance.update({ where: { code }, data });
  }

  /** Full thread for one ticket, including the student's contact details
   * the admin reply UI needs (email/phone) alongside the message history. */
  async grievanceDetail(code: string) {
    const grievance = await this.prisma.grievance.findUnique({
      where: { code },
      include: {
        student: { select: { code: true, name: true, email: true, phone: true } },
        resolver: { select: { name: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!grievance) throw new NotFoundException('Grievance not found');
    return grievance;
  }

  /** The admin-side counterpart to StudentService.addGrievanceReply() —
   * reply, change status, or both in one action (the common "reply and
   * close" ticketing flow). Notifies the student by email either way:
   * a reply gets GRIEVANCE_REPLIED, a status-only change gets
   * GRIEVANCE_STATUS_CHANGED — never both for the same action even when
   * both happen together, so the student gets one email, not two. */
  async replyToGrievance(code: string, dto: ReplyGrievanceDto, adminId: number) {
    if (!dto.message && !dto.status) {
      throw new BadRequestException('Provide a reply message, a status change, or both.');
    }
    const grievance = await this.prisma.grievance.findUnique({
      where: { code },
      include: { student: true },
    });
    if (!grievance) throw new NotFoundException('Grievance not found');

    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    if (dto.message) {
      ops.push(
        this.prisma.grievanceMessage.create({
          data: {
            grievanceId: grievance.id,
            authorType: 'admin',
            authorName: admin.name,
            adminId: admin.id,
            body: dto.message,
          },
        }),
      );
    }
    if (dto.status && dto.status !== grievance.status) {
      const data: Prisma.GrievanceUpdateInput = { status: dto.status };
      if (dto.status === 'Resolved') {
        data.resolver = { connect: { id: adminId } };
        data.resolvedAt = new Date();
      } else {
        data.resolver = grievance.resolvedBy ? { disconnect: true } : undefined;
        data.resolvedAt = null;
      }
      ops.push(this.prisma.grievance.update({ where: { id: grievance.id }, data }));
      ops.push(
        this.prisma.grievanceMessage.create({
          data: {
            grievanceId: grievance.id,
            authorType: 'system',
            authorName: admin.name,
            body: `Status changed from ${grievance.status} to ${dto.status}.`,
          },
        }),
      );
    }
    if (ops.length) await this.prisma.$transaction(ops);

    const target = { email: grievance.student?.email, phone: grievance.student?.phone };
    const commonVars = {
      StudentName: grievance.name ?? grievance.student?.name ?? '',
      TicketID: grievance.code,
      Subject: grievance.subject || '(no subject)',
      HelpDeskLink: 'https://indiamindleague.com/account/help-desk',
      // Available to GRIEVANCE_REPLIED too, in case a reply and a status
      // change land in the same action and the template wants to mention it.
      NewStatus: dto.status ?? grievance.status,
    };
    if (dto.message) {
      void this.messaging.dispatch('GRIEVANCE_REPLIED', target, {
        ...commonVars,
        ReplyMessage: dto.message,
      });
    } else if (dto.status) {
      void this.messaging.dispatch('GRIEVANCE_STATUS_CHANGED', target, {
        ...commonVars,
        NewStatus: dto.status,
      });
    }

    return this.grievanceDetail(code);
  }

  // ---- notifications ----

  async listNotifications(q: ListQuery) {
    const where: Prisma.NotificationWhereInput = {};
    if (q.status) where.status = q.status;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        include: {
          competition: { select: { code: true, title: true } },
          creator: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(
      rows.map((n) => {
        const { competition, creator, ...rest } = n;
        return {
          ...rest,
          competition: competition?.title ?? null,
          competitionCode: competition?.code ?? null,
          createdByName: creator?.name ?? null,
        };
      }),
      total,
      q.page,
      q.limit,
    );
  }

  async sendNotification(dto: CreateNotificationDto, adminId: number) {
    const { competitionCode, ...rest } = dto;
    const competitionId = competitionCode
      ? ((
          await this.prisma.competition.findUnique({
            where: { code: competitionCode },
          })
        )?.id ?? null)
      : null;
    return this.prisma.notification.create({
      data: {
        ...rest,
        competitionId,
        createdBy: adminId,
        status: 'Sent',
        sentAt: new Date(),
      },
      include: { competition: { select: { code: true, title: true } } },
    });
  }
}
