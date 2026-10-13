import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, ListResult } from '../common/list-result';
import { parseCsv, toCsv } from '../common/csv.util';
import { toXlsxBuffer } from '../common/xlsx.util';
import { BulkUploadResult, BulkUploadRowError } from '../admin/content/content.dto';
import { ensureRegistrationStages, nextCode, nextRegistrationCode } from '../common/util';
import {
  AddSchoolStudentDto,
  SetSchoolPasswordDto,
  UpdateSchoolProfileDto,
  UpdateSchoolStudentDto,
} from './school.dto';

const registrationInclude = {
  student: true,
  competition: true,
} as const;

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireSchool(schoolId: number) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async me(schoolId: number) {
    const school = await this.requireSchool(schoolId);
    const studentCount = await this.prisma.student.count({ where: { schoolId, archived: false } });
    return {
      id: school.id,
      code: school.code,
      name: school.name,
      city: school.city,
      contact: school.contact,
      coordinator: school.coordinator,
      email: school.email,
      phone: school.phone,
      hasPassword: !!school.passwordHash,
      studentCount,
    };
  }

  async updateProfile(schoolId: number, dto: UpdateSchoolProfileDto) {
    await this.requireSchool(schoolId);
    await this.prisma.school.update({ where: { id: schoolId }, data: dto });
    return this.me(schoolId);
  }

  /** Same shape as StudentService.setPassword — first-ever password needs
   * no current one (a school that's never set one arrives here only via
   * OTP login), changing an existing one does. */
  async setPassword(schoolId: number, dto: SetSchoolPasswordDto) {
    const school = await this.requireSchool(schoolId);
    if (school.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Enter your current password to change it.');
      }
      let ok = false;
      try {
        ok = await argonVerify(school.passwordHash, dto.currentPassword);
      } catch {
        ok = false;
      }
      if (!ok) throw new BadRequestException('Current password is incorrect.');
    }
    const passwordHash = await argonHash(dto.newPassword);
    await this.prisma.school.update({ where: { id: schoolId }, data: { passwordHash } });
    return { ok: true };
  }

  private buildStudentsWhere(
    schoolId: number,
    q: { search?: string; comp?: string; grade?: string; status?: string; paymentStatus?: string },
  ): Prisma.RegistrationWhereInput {
    const where: Prisma.RegistrationWhereInput = {};
    const studentWhere: Prisma.StudentWhereInput = { schoolId, archived: false };
    if (q.grade) studentWhere.grade = q.grade;
    where.student = studentWhere;
    if (q.comp) where.competition = { code: q.comp };
    if (q.status) where.status = q.status;
    if (q.paymentStatus === 'Unpaid') {
      where.payments = { none: { status: 'Paid' } };
    } else if (q.paymentStatus) {
      where.payments = { some: { status: q.paymentStatus } };
    }
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { student: { name: { contains: q.search, mode: 'insensitive' } } },
        { student: { email: { contains: q.search, mode: 'insensitive' } } },
        { student: { phone: { contains: q.search, mode: 'insensitive' } } },
      ];
    }
    return where;
  }

  private toStudentRow(r: {
    code: string;
    student: { name: string; grade: string; phone: string | null; email: string | null; parent: string | null };
    competition: { title: string; code: string };
    status: string;
    payments: { status: string }[];
    registeredAt: Date;
  }) {
    return {
      code: r.code,
      name: r.student.name,
      grade: r.student.grade,
      phone: r.student.phone,
      email: r.student.email,
      parent: r.student.parent,
      competition: r.competition.title,
      competitionCode: r.competition.code,
      status: r.status,
      paid: r.payments.some((p) => p.status === 'Paid') ? 'Paid' : '',
      registeredAt: r.registeredAt,
    };
  }

  /** Every non-archived student registered under this school, across all
   * of their competitions/registrations — same row shape as the admin
   * Registrations list, just pre-scoped to one school instead of taking
   * a schoolCode filter (a school has no reason to see anyone else's). */
  async listStudents(
    schoolId: number,
    q: { page: number; limit: number; search?: string; comp?: string; grade?: string; status?: string; paymentStatus?: string },
  ) {
    const where = this.buildStudentsWhere(schoolId, q);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.registration.findMany({
        where,
        include: { ...registrationInclude, payments: { select: { status: true } } },
        orderBy: { registeredAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.registration.count({ where }),
    ]);
    return {
      data: rows.map((r) => this.toStudentRow(r)),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  // Same filters as listStudents, minus pagination — see
  // RegistrationService.exportRegistrations in the admin module for the
  // same shape/rationale. School is omitted from the columns since every
  // row is already this one coordinator's own school.
  async exportStudents(
    schoolId: number,
    q: { search?: string; comp?: string; grade?: string; status?: string; paymentStatus?: string },
  ): Promise<Buffer> {
    const where = this.buildStudentsWhere(schoolId, q);
    const rows = await this.prisma.registration.findMany({
      where,
      include: { ...registrationInclude, payments: { select: { status: true } } },
      orderBy: { registeredAt: 'desc' },
    });
    const headers = [
      'Reg Code', 'Student Name', 'Grade', 'Phone', 'Email', 'Parent',
      'Competition', 'Competition Code', 'Status', 'Payment', 'Registered At',
    ];
    const body = rows.map((r) => {
      const row = this.toStudentRow(r);
      return [
        row.code, row.name, row.grade, row.phone ?? '', row.email ?? '', row.parent ?? '',
        row.competition, row.competitionCode, row.status, row.paid || 'Unpaid',
        row.registeredAt.toISOString(),
      ];
    });
    return toXlsxBuffer('Registrations', headers, body);
  }

  /** Which competitions this school can actually register a new student
   * into right now — same Open/Live set a student would see, not
   * everything (a Draft or Closed competition isn't a real option here). */
  async availableCompetitions() {
    const rows = await this.prisma.competition.findMany({
      where: { status: { in: ['Open', 'Live'] } },
      orderBy: { code: 'asc' },
      select: { code: true, title: true },
    });
    return rows;
  }

  /**
   * A school adding one of its own students — mirrors
   * RegistrationService.createRegistration() (the admin "New
   * registration" flow) closely, except schoolId always comes from the
   * authenticated school itself, never from the request body.
   */
  async addStudent(schoolId: number, dto: AddSchoolStudentDto) {
    const school = await this.requireSchool(schoolId);

    const competition = await this.prisma.competition.findUnique({
      where: { code: dto.competitionCode },
    });
    if (!competition || !['Open', 'Live'].includes(competition.status)) {
      throw new BadRequestException('That competition is not currently open for registration.');
    }

    // archived:false — see Student.archived: an archived student's email
    // is freed up, so this correctly creates a fresh student instead of
    // conflicting with one that's been archived.
    if (dto.email) {
      const existing = await this.prisma.student.findFirst({
        where: { email: dto.email.toLowerCase(), archived: false },
      });
      if (existing) {
        throw new BadRequestException('A student with that email is already registered.');
      }
    }

    const code = await nextRegistrationCode(this.prisma);
    const student = await this.prisma.student.create({
      data: {
        code,
        name: dto.name,
        grade: dto.grade,
        phone: dto.phone,
        email: dto.email?.toLowerCase(),
        parent: dto.parent,
        schoolId: school.id,
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
    await ensureRegistrationStages(this.prisma, registration.id, competition.id);

    return { code: registration.code };
  }

  /** Resolves a registration code to its student, but only if that
   * student actually belongs to this school — every write below (edit,
   * and the ownership check itself) goes through this, so a school can
   * never touch a registration code it happens to guess that belongs to
   * someone else's student. */
  private async requireOwnStudent(schoolId: number, registrationCode: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { code: registrationCode },
      include: { student: true },
    });
    if (!registration) throw new NotFoundException('Student not found');
    if (registration.student.schoolId !== schoolId) {
      throw new ForbiddenException("That student isn't registered under your school.");
    }
    return registration;
  }

  /** Editing an already-registered student's own details — never touches
   * which competition/registration they're under. */
  async updateStudent(schoolId: number, registrationCode: string, dto: UpdateSchoolStudentDto) {
    const registration = await this.requireOwnStudent(schoolId, registrationCode);

    if (dto.email) {
      const normalized = dto.email.toLowerCase();
      if (normalized !== (registration.student.email ?? '').toLowerCase()) {
        // archived:false — see Student.archived.
        const clash = await this.prisma.student.findFirst({
          where: { email: normalized, id: { not: registration.studentId }, archived: false },
        });
        if (clash) throw new BadRequestException('A student with that email is already registered.');
      }
    }

    await this.prisma.student.update({
      where: { id: registration.studentId },
      data: {
        name: dto.name,
        grade: dto.grade,
        email: dto.email ? dto.email.toLowerCase() : undefined,
        phone: dto.phone,
        parent: dto.parent,
      },
    });
    return { ok: true };
  }

  // ---- students: bulk upload (mirrors RegistrationService's admin bulk
  // upload, minus the schoolCode column — schoolId always comes from the
  // authenticated school here, never from a CSV cell) ----

  private static readonly STUDENT_CSV_COLUMNS = ['competitionCode', 'name', 'grade', 'email', 'phone', 'parent'];

  sampleStudentsCsv(): string {
    const header = SchoolService.STUDENT_CSV_COLUMNS;
    const example1 = ['C01', 'Aarav Sharma', '9', 'aarav.sharma@example.com', '9876500001', 'Rohit Sharma'];
    const example2 = ['C01', 'Diya Mehta', '10', 'diya.mehta@example.com', '9876500002', 'Sunita Mehta'];
    return toCsv([header, example1, example2]);
  }

  async bulkUploadStudents(schoolId: number, buffer: Buffer): Promise<BulkUploadResult> {
    const school = await this.requireSchool(schoolId);
    const text = buffer.toString('utf8');
    const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
    if (!rows.length) throw new BadRequestException('CSV file is empty');

    const header = rows[0].map((h) => h.trim().toLowerCase());
    for (const col of ['competitioncode', 'name', 'grade']) {
      if (!header.includes(col)) {
        throw new BadRequestException(`CSV is missing required column "${col}"`);
      }
    }
    const colIndex = (name: string) => header.indexOf(name.toLowerCase());
    const dataRows = rows.slice(1);

    const [studentRows, registrationRows] = await Promise.all([
      this.prisma.student.findMany({ select: { code: true } }),
      this.prisma.registration.findMany({ select: { code: true } }),
    ]);
    const studentCodes = [...studentRows.map((s) => s.code), ...registrationRows.map((r) => r.code)];
    const competitionCache = new Map<string, { id: number; status: string } | null>();
    const errors: BulkUploadRowError[] = [];
    let created = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const rowNum = i + 2;
      const get = (name: string) => {
        const idx = colIndex(name);
        return idx >= 0 ? (r[idx] ?? '').trim() : '';
      };
      const fail = (message: string) => errors.push({ row: rowNum, message });

      const competitionCode = get('competitioncode');
      const name = get('name');
      const grade = get('grade');
      const email = get('email').toLowerCase();
      const phone = get('phone');
      const parent = get('parent');

      if (!competitionCode) { fail('competitionCode is required'); continue; }
      if (!name) { fail('name is required'); continue; }
      if (name.length > 120) { fail('name exceeds 120 characters'); continue; }
      if (!grade) { fail('grade is required'); continue; }
      if (grade.length > 20) { fail('grade exceeds 20 characters'); continue; }
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { fail(`"${email}" is not a valid email`); continue; }

      if (!competitionCache.has(competitionCode)) {
        const c = await this.prisma.competition.findUnique({ where: { code: competitionCode } });
        competitionCache.set(competitionCode, c ? { id: c.id, status: c.status } : null);
      }
      const competition = competitionCache.get(competitionCode) ?? null;
      if (!competition) { fail(`competition "${competitionCode}" not found`); continue; }
      if (!['Open', 'Live'].includes(competition.status)) {
        fail(`competition "${competitionCode}" is not currently open for registration`);
        continue;
      }

      if (email) {
        const existing = await this.prisma.student.findFirst({ where: { email, archived: false } });
        if (existing) { fail(`a student with email "${email}" already exists`); continue; }
      }

      const code = nextCode(studentCodes, 'R');
      try {
        const student = await this.prisma.student.create({
          data: {
            code,
            name,
            grade,
            phone: phone || null,
            email: email || null,
            parent: parent || null,
            schoolId: school.id,
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
        await ensureRegistrationStages(this.prisma, registration.id, competition.id);
        studentCodes.push(code);
        created++;
      } catch (e) {
        fail(e instanceof Error ? e.message : 'failed to save row');
      }
    }

    return { total: dataRows.length, created, failed: errors.length, errors };
  }

  /** Every finished/in-progress attempt across this school's students —
   * same row shape as the admin Results list, pre-scoped to one school
   * and optionally narrowed to one competition. */
  async listResults(
    schoolId: number,
    q: { page: number; limit: number; comp?: string },
  ): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.AttemptWhereInput = { registration: { student: { schoolId, archived: false } } };
    if (q.comp) {
      where.registration = { student: { schoolId, archived: false }, competition: { code: q.comp } };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.attempt.findMany({
        where,
        include: {
          registration: {
            include: { student: { select: { code: true, name: true, grade: true } }, competition: true },
          },
          stage: { select: { name: true, position: true } },
        },
        orderBy: { finishedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.attempt.count({ where }),
    ]);
    return paginate(
      rows.map((a) => ({
        code: a.code,
        student: a.registration.student.name,
        studentCode: a.registration.student.code,
        grade: a.registration.student.grade,
        competition: a.registration.competition.title,
        competitionCode: a.registration.competition.code,
        stage: a.stage?.name ?? null,
        stagePosition: a.stage?.position ?? null,
        score: a.score,
        total: a.total,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  /** One attempt's full question-by-question detail plus its certificate
   * number if issued — same shape as StudentService.resultDetail(), just
   * scoped by school ownership instead of by the student themselves. */
  async resultDetail(schoolId: number, code: string) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { code, registration: { student: { schoolId } } },
      include: {
        registration: {
          include: { competition: true, student: { select: { code: true, name: true } } },
        },
        stage: { select: { name: true, position: true, passMark: true } },
        answers: {
          include: {
            question: {
              select: { id: true, code: true, category: true, mode: true, prompt: true, options: true, correct: true, group: { select: { code: true, title: true } } },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Result not found');

    const cert = await this.prisma.certificate.findFirst({
      where: { registrationId: attempt.registrationId },
      select: { certificateNumber: true },
    });

    const score = Number(attempt.score);
    const total = Number(attempt.total);
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    const passMark = Number(attempt.stage?.passMark ?? 0);

    const questions = attempt.answers.map((a) => {
      const q = a.question;
      const correct = Array.isArray(q?.correct) ? q.correct.map(Number).sort((x, y) => x - y) : [];
      const givenRaw = Array.isArray(a.answer) ? a.answer.map(Number) : a.answer == null ? [] : [Number(a.answer)];
      const given = [...new Set(givenRaw)].sort((x, y) => x - y);
      return {
        questionId: q?.id ?? null,
        code: q?.code ?? null,
        category: a.category ?? q?.category ?? 'Other',
        mode: q?.mode ?? 'single',
        prompt: q?.prompt ?? '',
        options: q?.options ?? [],
        correct,
        given,
        isCorrect: !!a.isCorrect,
        takenSecs: a.takenSecs ?? null,
        // Only for a Question Group's questions; absent for singles.
        ...(q?.group ? { groupCode: q.group.code, groupTitle: q.group.title } : {}),
      };
    });

    return {
      code: attempt.code,
      student: attempt.registration.student.name,
      studentCode: attempt.registration.student.code,
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
      certificateNumber: cert?.certificateNumber ?? null,
      questions,
    };
  }

  private buildPaymentsWhere(
    schoolId: number,
    q: { comp?: string; status?: string; grade?: string },
  ): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = { registration: { student: { schoolId, archived: false } } };
    if (q.status) where.status = q.status;
    if (q.comp || q.grade) {
      where.registration = {
        student: { schoolId, archived: false, ...(q.grade ? { grade: q.grade } : {}) },
        ...(q.comp ? { competition: { code: q.comp } } : {}),
      };
    }
    return where;
  }

  private readonly paymentInclude = {
    registration: {
      include: {
        student: { select: { code: true, name: true, grade: true } },
        competition: { select: { code: true, title: true } },
      },
    },
    stage: { select: { name: true, position: true } },
  } satisfies Prisma.PaymentInclude;

  private toPaymentRow(p: Prisma.PaymentGetPayload<{ include: SchoolService['paymentInclude'] }>) {
    return {
      code: p.code,
      student: p.registration.student.name,
      studentCode: p.registration.student.code,
      grade: p.registration.student.grade,
      competition: p.registration.competition.title,
      competitionCode: p.registration.competition.code,
      stage: p.stage?.name ?? null,
      stagePosition: p.stage?.position ?? null,
      amount: p.amount,
      mode: p.mode,
      status: p.status,
      providerTxn: p.providerTxn,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    };
  }

  /** Every payment tied to this school's students — same row shape as the
   * admin Payments list (FinanceService.listPayments), pre-scoped to one
   * school and optionally narrowed to one competition/status/grade. */
  async listPayments(
    schoolId: number,
    q: { page: number; limit: number; comp?: string; status?: string; grade?: string },
  ): Promise<ListResult<Record<string, unknown>>> {
    const where = this.buildPaymentsWhere(schoolId, q);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: this.paymentInclude,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(
      rows.map((p) => this.toPaymentRow(p)),
      total,
      q.page,
      q.limit,
    );
  }

  // Same filters as listPayments, minus pagination.
  async exportPayments(
    schoolId: number,
    q: { comp?: string; status?: string; grade?: string },
  ): Promise<Buffer> {
    const where = this.buildPaymentsWhere(schoolId, q);
    const rows = await this.prisma.payment.findMany({
      where,
      include: this.paymentInclude,
      orderBy: { createdAt: 'desc' },
    });
    const headers = [
      'Payment Code', 'Student', 'Student Code', 'Grade', 'Competition',
      'Stage', 'Amount', 'Mode', 'Status', 'Provider Txn', 'Paid At', 'Created At',
    ];
    const body = rows.map((p) => {
      const row = this.toPaymentRow(p);
      return [
        row.code, row.student, row.studentCode, row.grade, row.competition, row.stage ?? '',
        Number(row.amount), row.mode, row.status, row.providerTxn ?? '',
        row.paidAt ? row.paidAt.toISOString() : '', row.createdAt.toISOString(),
      ];
    });
    return toXlsxBuffer('Payments', headers, body);
  }
}
