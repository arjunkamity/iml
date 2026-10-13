import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { hash as argonHash } from '@node-rs/argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { findSimilarSchool, nextCode, nextRegistrationCode } from '../../common/util';
import { parseCsv, toCsv } from '../../common/csv.util';
import { toXlsxBuffer } from '../../common/xlsx.util';
import { SchoolLoginAs, signSchoolLink } from '../../common/school-link.util';
import { MessagingService } from '../../messaging/messaging.service';
import {
  AcceptStageDto,
  BulkUploadResult,
  BulkUploadRowError,
  CreateRegistrationDto,
  CreateSchoolDto,
  CreateStudentDto,
  PatchRegistrationDto,
  PatchSchoolDto,
  PatchStudentDto,
} from './registrations.dto';

const registrationInclude = {
  student: { include: { school: true } },
  competition: true,
} satisfies Prisma.RegistrationInclude;

// Fixed for this competition's known design (see PAYTM_FEE_STAGE1_REGISTRATION /
// PAYTM_FEE_STAGE3_BOOTCAMP in the legacy backend's .env): position 1 = Stage 1
// online exam (its own qualify notification fires from submitExam), 2 = Zoom
// Showdown, 3 = Leadership Bootcamp, 4 = Grand Finale. A competition with a
// different stage layout just won't get a "qualified" notification for
// positions outside this map — it degrades silently, not incorrectly.
const STAGE_QUALIFIED_TEMPLATE: Record<number, string> = {
  3: 'QUALIFIED_BOOTCAMP',
  4: 'GRAND_FINALE_QUALIFIED',
};

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  // ---- registrations ----

  private buildRegistrationWhere(q: {
    search?: string;
    status?: string;
    comp?: string;
    school?: string;
    grade?: string;
    paymentStatus?: string;
  }): Prisma.RegistrationWhereInput {
    const where: Prisma.RegistrationWhereInput = {};
    // "Archived" is a synthetic status value, not a real Registration.status
    // — selecting it shows exactly the archived students (see
    // Student.archived) instead of filtering by the registration's own
    // status. Every other view (including no filter at all) excludes them,
    // matching "removed but not deleted": gone from the default list,
    // still fully intact underneath.
    if (q.status === 'Archived') {
      where.student = { archived: true };
    } else {
      where.student = { archived: false };
      if (q.status) where.status = q.status;
    }
    if (q.comp) where.competition = { code: q.comp };
    if (q.school) where.student = { ...where.student, school: { code: q.school } };
    if (q.grade) where.student = { ...where.student, grade: q.grade };
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

  private toRegistrationRow(r: {
    code: string;
    student: { name: string; grade: string; phone: string | null; email: string | null; parent: string | null; archived: boolean; school: { name: string } | null };
    competition: { title: string; code: string };
    status: string;
    payments: { status: string }[];
    registeredAt: Date;
  }) {
    return {
      code: r.code,
      name: r.student.name,
      grade: r.student.grade,
      school: r.student.school?.name ?? null,
      phone: r.student.phone,
      email: r.student.email,
      parent: r.student.parent,
      competition: r.competition.title,
      competitionCode: r.competition.code,
      status: r.status,
      // At least one Paid payment on this registration — shown as a
      // "Paid" badge alongside the registration status in the admin
      // table, since a stage fee can be paid well before/after the
      // status field itself changes. Empty string (not false) so the
      // generic 'badge' column type just renders nothing for an unpaid
      // row instead of a literal "false".
      paid: r.payments.some((p) => p.status === 'Paid') ? 'Paid' : '',
      registeredAt: r.registeredAt,
      archived: r.student.archived,
    };
  }

  async listRegistrations(q: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    comp?: string;
    school?: string;
    grade?: string;
    paymentStatus?: string;
  }): Promise<ListResult<Record<string, unknown>>> {
    const where = this.buildRegistrationWhere(q);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.registration.findMany({
        where,
        include: { ...registrationInclude, payments: { select: { status: true } } },
        // `id` as a tie-breaker matters a lot here: every registration
        // made before the 2026-09-11 registeredAt fix (see schema.prisma)
        // shares the exact same midnight timestamp with everything else
        // registered that same day — 26-33-row tie groups are common in
        // existing data. Sorting on registeredAt alone left those ties in
        // whatever order Postgres happened to resolve them in, which
        // isn't guaranteed stable between two paginated queries — the
        // same row could land on two different pages, or get skipped
        // entirely (see #22 — "Ridhvi jain" R1074 showing twice).
        orderBy: [{ registeredAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.registration.count({ where }),
    ]);
    return paginate(
      rows.map((r) => this.toRegistrationRow(r)),
      total,
      q.page,
      q.limit,
    );
  }

  // Same filters as listRegistrations, minus pagination — every matching
  // row goes into one workbook. Admin-only, and the realistic ceiling here
  // (a few thousand registrations) is nowhere near where an in-memory
  // XLSX build would become a problem.
  async exportRegistrations(q: {
    search?: string;
    status?: string;
    comp?: string;
    school?: string;
    grade?: string;
    paymentStatus?: string;
  }): Promise<Buffer> {
    const where = this.buildRegistrationWhere(q);
    const rows = await this.prisma.registration.findMany({
      where,
      include: { ...registrationInclude, payments: { select: { status: true } } },
      orderBy: [{ registeredAt: 'desc' }, { id: 'desc' }],
    });
    const headers = [
      'Reg Code', 'Student Name', 'Grade', 'School', 'Phone', 'Email', 'Parent',
      'Competition', 'Competition Code', 'Status', 'Payment', 'Registered At',
    ];
    const body = rows.map((r) => {
      const row = this.toRegistrationRow(r);
      return [
        row.code, row.name, row.grade, row.school ?? '', row.phone ?? '', row.email ?? '',
        row.parent ?? '', row.competition, row.competitionCode, row.status, row.paid || 'Unpaid',
        row.registeredAt.toISOString(),
      ];
    });
    return toXlsxBuffer('Registrations', headers, body);
  }

  async getRegistration(code: string) {
    const reg = await this.prisma.registration.findUnique({
      where: { code },
      include: {
        ...registrationInclude,
        stages: {
          include: {
            stage: { include: { rules: { orderBy: { position: 'asc' } } } },
          },
          orderBy: { stage: { position: 'asc' } },
        },
        payments: { orderBy: { createdAt: 'desc' } },
        attempts: { include: { answers: true } },
      },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    return reg;
  }

  /** One-off "you registered but haven't paid yet" nudge for a single
   * registration — the per-row kebab-menu action. "Hasn't paid" uses the
   * exact same definition as the admin Registrations table's own Paid
   * badge (listRegistrations() below): no Payment row with status
   * 'Paid' exists for this registration at all, regardless of stage. */
  async sendPaymentReminder(code: string) {
    const reg = await this.prisma.registration.findUnique({
      where: { code },
      include: {
        student: { select: { name: true, email: true, phone: true, archived: true, school: { select: { name: true } } } },
        competition: { include: { stages: { orderBy: { position: 'asc' }, take: 1 } } },
        payments: { select: { status: true } },
      },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.student.archived) {
      throw new BadRequestException('This student is archived — cannot send them a reminder.');
    }
    if (reg.payments.some((p) => p.status === 'Paid')) {
      throw new BadRequestException('This registration is already paid — nothing to remind them about.');
    }
    const firstStage = reg.competition.stages[0];
    if (!firstStage || firstStage.isFree) {
      throw new BadRequestException('This registration has no payment due.');
    }
    await this.messaging.dispatch(
      'PAYMENT_REMINDER',
      { email: reg.student.email, phone: reg.student.phone },
      {
        StudentName: reg.student.name,
        RegID: reg.code,
        SchoolName: reg.student.school?.name ?? '',
        Amount: firstStage.price.toString(),
        CompetitionName: reg.competition.title,
        PaymentLink: 'https://indiamindleague.com/account/payments',
      },
    );
    return { ok: true };
  }

  /**
   * (Re)generates the student's direct-login token and returns a ready-to-
   * paste URL — see AuthService.consumeStudentAccessToken. Overwrites any
   * previous token outright, so regenerating is also the revoke path: the
   * old link stops working the moment a new one is issued. Meant for when
   * a student's own inbox is unreachable (testing against a disposable
   * address, a bounced/undeliverable school email, etc.) — not something
   * to hand out routinely, since it's a standing way into that account.
   */
  async generateStudentAccessToken(code: string) {
    const reg = await this.prisma.registration.findUnique({
      where: { code },
      include: { student: { select: { id: true, code: true, archived: true } } },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.student.archived) {
      throw new BadRequestException('This student is archived — cannot generate a login link.');
    }
    const token = randomBytes(24).toString('base64url');
    await this.prisma.student.update({
      where: { id: reg.student.id },
      data: { accessToken: token },
    });
    const base = process.env.FRONTEND_BASE_URL ?? 'https://indiamindleague.com';
    const loginUrl = `${base}/?sid=${reg.student.code}&token=${token}`;
    return { token, loginUrl };
  }

  /** Admin-authored password override for a student, resolved via their
   * registration code (same lookup pattern as generateStudentAccessToken).
   * No currentPassword check — this is an admin setting a password on
   * someone else's behalf, not the student authenticating themselves. The
   * student can sign in with this password immediately afterward. */
  async setStudentPasswordByAdmin(code: string, newPassword: string) {
    const reg = await this.prisma.registration.findUnique({
      where: { code },
      include: { student: { select: { id: true, archived: true } } },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.student.archived) {
      throw new BadRequestException('This student is archived — cannot set a password.');
    }
    const passwordHash = await argonHash(newPassword);
    await this.prisma.student.update({
      where: { id: reg.student.id },
      data: { passwordHash },
    });
    return { ok: true };
  }

  async createRegistration(dto: CreateRegistrationDto) {
    const competition = await this.prisma.competition.findUnique({
      where: { code: dto.competitionCode },
    });
    if (!competition) throw new NotFoundException('Competition not found');

    const code = await nextRegistrationCode(this.prisma);

    const schoolId = dto.student.schoolCode
      ? ((
          await this.prisma.school.findUnique({
            where: { code: dto.student.schoolCode },
          })
        )?.id ?? null)
      : null;

    // archived:false — see Student.archived: an archived student's email
    // is freed up, so this correctly creates a fresh student instead of
    // conflicting with one that's been archived.
    const existing = await this.prisma.student.findFirst({
      where: { email: dto.student.email?.toLowerCase(), archived: false },
    });
    if (existing) {
      throw new ConflictException(
        'A student with that email is already registered',
      );
    }

    const student = await this.prisma.student.create({
      data: {
        code,
        name: dto.student.name,
        grade: dto.student.grade,
        phone: dto.student.phone,
        email: dto.student.email?.toLowerCase(),
        parent: dto.student.parent,
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
      include: registrationInclude,
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
    return this.getRegistration(code);
  }

  // ---- registrations: bulk upload ----

  private static readonly REGISTRATION_CSV_COLUMNS = [
    'competitionCode',
    'name',
    'grade',
    'email',
    'phone',
    'schoolCode',
    'parent',
  ];

  sampleRegistrationsCsv(): string {
    const header = RegistrationService.REGISTRATION_CSV_COLUMNS;
    const example1 = ['C01', 'Aarav Sharma', '9', 'aarav.sharma@example.com', '9876500001', 'S01', 'Rohit Sharma'];
    const example2 = ['C01', 'Diya Mehta', '10', 'diya.mehta@example.com', '9876500002', '', 'Sunita Mehta'];
    return toCsv([header, example1, example2]);
  }

  async bulkUploadRegistrations(buffer: Buffer): Promise<BulkUploadResult> {
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

    // Seeded from BOTH tables, same reasoning as nextRegistrationCode() —
    // a bare student-codes pool can drift behind registration codes minted
    // elsewhere (e.g. an existing student joining an additional
    // competition) and collide. Kept as a local array (not
    // nextRegistrationCode() per row) so this loop doesn't re-query both
    // tables on every single CSV row — same performance shape as before.
    const [studentRows, registrationRows] = await Promise.all([
      this.prisma.student.findMany({ select: { code: true } }),
      this.prisma.registration.findMany({ select: { code: true } }),
    ]);
    const studentCodes = [...studentRows.map((s) => s.code), ...registrationRows.map((r) => r.code)];
    const competitionCache = new Map<string, { id: number } | null>();
    const schoolCache = new Map<string, number | null>();
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
      const schoolCode = get('schoolcode');
      const parent = get('parent');

      if (!competitionCode) { fail('competitionCode is required'); continue; }
      if (!name) { fail('name is required'); continue; }
      if (name.length > 120) { fail('name exceeds 120 characters'); continue; }
      if (!grade) { fail('grade is required'); continue; }
      if (grade.length > 20) { fail('grade exceeds 20 characters'); continue; }
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { fail(`"${email}" is not a valid email`); continue; }

      if (!competitionCache.has(competitionCode)) {
        const c = await this.prisma.competition.findUnique({ where: { code: competitionCode } });
        competitionCache.set(competitionCode, c ? { id: c.id } : null);
      }
      const competition = competitionCache.get(competitionCode) ?? null;
      if (!competition) { fail(`competition "${competitionCode}" not found`); continue; }

      let schoolId: number | null = null;
      if (schoolCode) {
        if (!schoolCache.has(schoolCode)) {
          const s = await this.prisma.school.findUnique({ where: { code: schoolCode } });
          schoolCache.set(schoolCode, s?.id ?? null);
        }
        schoolId = schoolCache.get(schoolCode) ?? null;
        if (schoolId === null) { fail(`school "${schoolCode}" not found`); continue; }
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
            data: stageRows.map((s, idx) => {
              const opensNow = idx === 0 && s.isFree;
              return {
                registrationId: registration.id,
                stageId: s.id,
                status: opensNow ? 'Unlocked' : 'Locked',
                unlockedAt: opensNow ? new Date() : null,
              };
            }),
          });
        }
        studentCodes.push(code);
        created++;
      } catch (e) {
        fail(e instanceof Error ? e.message : 'failed to save row');
      }
    }

    return { total: dataRows.length, created, failed: errors.length, errors };
  }

  async updateRegistration(code: string, dto: PatchRegistrationDto) {
    const existing = await this.prisma.registration.findUnique({
      where: { code },
    });
    if (!existing) throw new NotFoundException('Registration not found');
    await this.prisma.registration.update({ where: { code }, data: dto });
    return this.getRegistration(code);
  }

  async deleteRegistration(code: string) {
    const reg = await this.prisma.registration.findUnique({ where: { code } });
    if (!reg) throw new NotFoundException('Registration not found');
    await this.prisma.$transaction([
      this.prisma.payment.deleteMany({ where: { registrationId: reg.id } }),
      this.prisma.attemptAnswer.deleteMany({
        where: { attempt: { registrationId: reg.id } },
      }),
      this.prisma.attempt.deleteMany({ where: { registrationId: reg.id } }),
      this.prisma.registrationStage.deleteMany({
        where: { registrationId: reg.id },
      }),
      this.prisma.registration.delete({ where: { id: reg.id } }),
    ]);
    return { ok: true };
  }

  /**
   * Soft-removes the student behind this registration — see
   * Student.archived. One-way: there is deliberately no unarchive action.
   * Every registration/attempt/payment/certificate this student has stays
   * exactly as it was; they just stop appearing in the default admin
   * view, stop matching "does this email/phone already have an account"
   * lookups (freeing their contact info up for a fresh registration), and
   * stop receiving any further SMS/email (see MessagingService.dispatch).
   */
  async archiveStudent(code: string) {
    const reg = await this.prisma.registration.findUnique({
      where: { code },
      select: { studentId: true },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    const student = await this.prisma.student.findUnique({
      where: { id: reg.studentId },
      select: { email: true, phone: true },
    });
    await this.prisma.student.update({
      where: { id: reg.studentId },
      data: {
        archived: true,
        // Prefixed, not cleared — the original value is still fully
        // legible on this row (strip the prefix to read it back), so
        // nothing is actually lost. But as a stored value it can never
        // again exact-match a real lookup: a fresh registration using
        // the same real address creates a genuinely separate student
        // (see the archived:false lookups elsewhere in this file and in
        // PublicService.register()), and — just as importantly —
        // MessagingService.dispatch()'s own archived-recipient check
        // reads this SAME (now-prefixed) value whenever it fetches this
        // student fresh, so it still correctly matches and blocks any
        // notification aimed at them, while never accidentally matching
        // a different, un-archived student who happens to share the
        // original address.
        email: student?.email ? `archived:${student.email}` : student?.email,
        phone: student?.phone ? `archived:${student.phone}` : student?.phone,
      },
    });
    return { ok: true };
  }

  async acceptStage(code: string, dto: AcceptStageDto) {
    const reg = await this.prisma.registration.findUnique({
      where: { code },
      include: { competition: true, student: true },
    });
    if (!reg) throw new NotFoundException('Registration not found');

    const stage = await this.prisma.competitionStage.findUnique({
      where: {
        competitionId_position: {
          competitionId: reg.competitionId,
          position: dto.position,
        },
      },
    });
    if (!stage)
      throw new BadRequestException(
        `Stage ${dto.position} does not exist for this competition`,
      );

    const existingBefore = await this.prisma.registrationStage.findUnique({
      where: {
        registrationId_stageId: { registrationId: reg.id, stageId: stage.id },
      },
    });
    const isNewlyUnlocked = !existingBefore || existingBefore.status === 'Locked';

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.registrationStage.findUnique({
        where: {
          registrationId_stageId: { registrationId: reg.id, stageId: stage.id },
        },
      });
      if (!existing) {
        await tx.registrationStage.create({
          data: {
            registrationId: reg.id,
            stageId: stage.id,
            status: stage.isFree ? 'Unlocked' : 'Paid',
          },
        });
      } else if (existing.status === 'Locked') {
        await tx.registrationStage.update({
          where: {
            registrationId_stageId: {
              registrationId: reg.id,
              stageId: stage.id,
            },
          },
          data: {
            status: stage.isFree ? 'Unlocked' : 'Paid',
            unlockedAt: new Date(),
            paidAt: stage.isFree ? undefined : new Date(),
          },
        });
      }

      const codes = (await tx.payment.findMany({ select: { code: true } })).map(
        (p) => p.code,
      );
      const payment = await tx.payment.create({
        data: {
          code: nextCode(codes, 'PAY-'),
          registrationId: reg.id,
          stageId: stage.id,
          amount: stage.price,
          mode: dto.payment?.mode ?? 'Offline',
          providerTxn: dto.payment?.providerTxn ?? null,
          status: 'Paid',
          paidAt: new Date(),
        },
      });

      if (reg.status === 'Registered') {
        await tx.registration.update({
          where: { id: reg.id },
          data: { status: 'Test Taken' },
        });
      }

      return {
        registrationId: code,
        acceptedStage: {
          name: stage.name,
          position: stage.position,
          isFree: stage.isFree,
          price: stage.price,
        },
        payment,
      };
    });

    const templateKey = STAGE_QUALIFIED_TEMPLATE[dto.position];
    if (isNewlyUnlocked && templateKey) {
      void this.messaging.dispatch(
        templateKey,
        { email: reg.student.email, phone: reg.student.phone },
        {
          Name: reg.student.name,
          StudentName: reg.student.name,
          RegID: reg.code,
          Amount: stage.price.toString(),
        },
      );
    }

    return result;
  }

  // ---- students ----

  async getStudent(code: string) {
    const student = await this.prisma.student.findUnique({
      where: { code },
      include: {
        school: true,
        registrations: {
          include: { competition: true, stages: true, payments: true },
        },
        grievances: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async updateStudent(code: string, dto: PatchStudentDto) {
    const existing = await this.prisma.student.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Student not found');
    const schoolId = dto.schoolCode
      ? ((
          await this.prisma.school.findUnique({
            where: { code: dto.schoolCode },
          })
        )?.id ?? undefined)
      : undefined;
    const data: Prisma.StudentUncheckedUpdateInput = {
      name: dto.name,
      grade: dto.grade,
      phone: dto.phone,
      email: dto.email?.toLowerCase(),
      parent: dto.parent,
      ...(schoolId !== undefined ? { schoolId } : {}),
    };
    await this.prisma.student.update({
      where: { code },
      data,
    });
    return this.getStudent(code);
  }

  async createStudent(dto: CreateStudentDto) {
    // No registration created here, but Student.code and Registration.code
    // share one numbering space (see nextRegistrationCode's doc comment) —
    // a student-only pool could still mint a code a registration already
    // claimed elsewhere.
    const code = await nextRegistrationCode(this.prisma);
    const schoolId = dto.schoolCode
      ? ((
          await this.prisma.school.findUnique({
            where: { code: dto.schoolCode },
          })
        )?.id ?? null)
      : null;
    return this.prisma.student.create({
      data: {
        code,
        name: dto.name,
        grade: dto.grade,
        phone: dto.phone,
        email: dto.email?.toLowerCase(),
        parent: dto.parent,
        schoolId,
      },
      include: { school: true },
    });
  }

  // ---- students: merge duplicates ----

  /** Resolves a student by either their own Student.code or a
   * Registration.code belonging to them — the admin UI only ever has a
   * registration row in front of it, and a student's primary registration
   * conventionally shares its code (see nextRegistrationCode), but that's
   * never guaranteed (bulk upload, older data), so this looks both ways
   * instead of assuming. */
  private async resolveStudentByCode(code: string) {
    const direct = await this.prisma.student.findFirst({ where: { code: { equals: code.trim(), mode: 'insensitive' } } });
    if (direct) return direct;
    const viaRegistration = await this.prisma.registration.findFirst({
      where: { code: { equals: code.trim(), mode: 'insensitive' } },
      include: { student: true },
    });
    if (viaRegistration) return viaRegistration.student;
    throw new NotFoundException(`No student or registration found for code "${code}"`);
  }

  /** Everything a merge needs to show/decide before touching data: both
   * students' own registrations (each tagged with the competition they're
   * under), and which of the duplicate's registrations collide with one
   * the keeper already has in the same competition — those are the ones
   * mergeStudents() will refuse to move automatically. */
  async previewStudentMerge(keepCode: string, mergeCode: string) {
    const keep = await this.resolveStudentByCode(keepCode);
    const merge = await this.resolveStudentByCode(mergeCode);
    if (keep.id === merge.id) {
      throw new BadRequestException('Pick two different students to merge.');
    }
    const regInclude = {
      competition: { select: { code: true, title: true } },
      payments: { select: { status: true, amount: true } },
      attempts: { select: { id: true, finishedAt: true } },
    } satisfies Prisma.RegistrationInclude;
    const [keepRegs, mergeRegs] = await Promise.all([
      this.prisma.registration.findMany({ where: { studentId: keep.id }, include: regInclude }),
      this.prisma.registration.findMany({ where: { studentId: merge.id }, include: regInclude }),
    ]);
    const keepCompetitionIds = new Set(keepRegs.map((r) => r.competitionId));
    const shape = (r: (typeof keepRegs)[number]) => ({
      code: r.code,
      competitionCode: r.competition.code,
      competitionTitle: r.competition.title,
      status: r.status,
      paid: r.payments.some((p) => p.status === 'Paid'),
      attempts: r.attempts.length,
    });
    return {
      keep: { code: keep.code, name: keep.name, grade: keep.grade, registrations: keepRegs.map(shape) },
      merge: { code: merge.code, name: merge.name, grade: merge.grade, registrations: mergeRegs.map(shape) },
      conflicts: mergeRegs.filter((r) => keepCompetitionIds.has(r.competitionId)).map(shape),
      movable: mergeRegs.filter((r) => !keepCompetitionIds.has(r.competitionId)).length,
    };
  }

  /** Moves every one of the duplicate's registrations into the keeper
   * EXCEPT ones that collide with a competition the keeper is already
   * registered under (Registration has a @@unique([studentId,
   * competitionId]) — moving one of those would either throw or silently
   * overwrite, neither of which is acceptable for something that can
   * carry a real payment). A colliding pair is left exactly as-is and
   * reported back; nothing about it is touched, deleted, or guessed at —
   * resolving it (e.g. deleting whichever side is the real duplicate) is
   * an explicit separate action the admin takes from the normal
   * Registrations list. The duplicate Student row itself is only deleted
   * once it has zero registrations left — if any conflicts remain
   * unresolved, it stays around (holding just those) rather than vanish
   * while still referenced by real data. */
  async mergeStudents(keepCode: string, mergeCode: string) {
    const keep = await this.resolveStudentByCode(keepCode);
    const merge = await this.resolveStudentByCode(mergeCode);
    if (keep.id === merge.id) {
      throw new BadRequestException('Pick two different students to merge.');
    }
    const keepCompetitionIds = new Set(
      (await this.prisma.registration.findMany({ where: { studentId: keep.id }, select: { competitionId: true } })).map(
        (r) => r.competitionId,
      ),
    );
    const mergeRegs = await this.prisma.registration.findMany({
      where: { studentId: merge.id },
      include: { competition: { select: { code: true, title: true } } },
    });
    const movable = mergeRegs.filter((r) => !keepCompetitionIds.has(r.competitionId));
    const conflicts = mergeRegs.filter((r) => keepCompetitionIds.has(r.competitionId));

    // An assessment is once per student: if both students completed the same
    // one, the surviving student's result is kept and the duplicate's dropped
    // (moving it would break the unique student+assessment key).
    const keepAssessmentIds = (
      await this.prisma.assessmentSubmission.findMany({ where: { studentId: keep.id }, select: { assessmentId: true } })
    ).map((s) => s.assessmentId);

    await this.prisma.$transaction([
      ...movable.map((r) => this.prisma.registration.update({ where: { id: r.id }, data: { studentId: keep.id } })),
      this.prisma.grievance.updateMany({ where: { studentId: merge.id }, data: { studentId: keep.id } }),
      this.prisma.broadcastRecipient.updateMany({ where: { studentId: merge.id }, data: { studentId: keep.id } }),
      // Assessment results follow the surviving student (the FK would otherwise
      // block deleting the duplicate).
      this.prisma.assessmentSubmission.deleteMany({
        where: { studentId: merge.id, assessmentId: { in: keepAssessmentIds } },
      }),
      this.prisma.assessmentSubmission.updateMany({ where: { studentId: merge.id }, data: { studentId: keep.id } }),
    ]);

    let deleted = false;
    if (conflicts.length === 0) {
      await this.prisma.student.delete({ where: { id: merge.id } });
      deleted = true;
    }

    return {
      keptCode: keep.code,
      mergedCode: merge.code,
      registrationsMoved: movable.length,
      conflicts: conflicts.map((r) => ({ code: r.code, competitionCode: r.competition.code, competitionTitle: r.competition.title })),
      duplicateDeleted: deleted,
    };
  }

  // ---- schools ----

  async listSchools(q: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.SchoolWhereInput = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
        { city: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    // Reuses the shared "status" query param as the Verified/Unverified
    // filter — same convention as every other CRUD list's status filter.
    if (q.status === 'Verified') where.verified = true;
    else if (q.status === 'Unverified') where.verified = false;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.school.findMany({
        where,
        include: { _count: { select: { students: true } } },
        orderBy: { code: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.school.count({ where }),
    ]);
    return paginate(
      rows.map((s) => ({
        code: s.code,
        name: s.name,
        city: s.city,
        contact: s.contact,
        contactSecondary: s.contactSecondary,
        coordinator: s.coordinator,
        // The school's own institutional address — see School.schoolEmail.
        // Distinct from `email` below (the coordinator's personal login
        // identity); this is what the "All Schools" broadcast audience
        // sends to.
        schoolEmail: s.schoolEmail,
        // Never included here before — the "Coordinator login" column and
        // the Edit form's Coordinator email/phone fields always read from
        // this list response (Edit reuses the already-loaded row, it
        // doesn't re-fetch), so both silently showed blank regardless of
        // what was actually saved.
        email: s.email,
        phone: s.phone,
        // Raw boolean (`verified`) for the edit form's checkbox to read
        // correctly, plus a separate display string (`verifiedLabel`) for
        // the table's badge column — the same key can't serve both, a
        // checkbox needs the real boolean and a badge needs "Verified"/
        // "Unverified" text to match its badgeMap.
        verified: s.verified,
        verifiedLabel: s.verified ? 'Verified' : 'Unverified',
        students: s._count.students,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async getSchool(code: string) {
    const school = await this.prisma.school.findUnique({
      where: { code },
      include: {
        students: {
          include: { registrations: { include: { competition: true } } },
        },
      },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  /** A newly-onboarded school's sign-in password until it sets its own:
   * its own registered phone number, so an admin never has to invent or
   * relay a credential. mustChangePassword forces the OTP-verify-then-set
   * flow (AuthService.completeSchoolFirstLogin) the first time it's used —
   * it's a bootstrap value, immediately replaced, never the standing one. */
  private async schoolDefaultPasswordFields(phone?: string | null) {
    if (!phone) return {};
    return { passwordHash: await argonHash(phone), mustChangePassword: true };
  }

  async createSchool({ confirmNew, ...dto }: CreateSchoolDto) {
    // A human is driving this one (unlike public self-registration), so
    // it's safe to warn at a lower confidence and let the admin decide —
    // surface the match rather than silently pick a side. See
    // findSimilarSchool()'s own comment for the threshold reasoning.
    // confirmNew is destructured out above — it's not a real School
    // column, so it must never reach the ...dto spread below.
    if (!confirmNew) {
      const similar = await findSimilarSchool(this.prisma, dto.name);
      if (similar) {
        throw new BadRequestException(
          `A very similar school already exists: ${similar.code} "${similar.name}"${similar.verified ? '' : ' (unverified)'}. ` +
            `If this is genuinely a different school, resubmit with confirmNew to create it anyway.`,
        );
      }
    }
    const codes = (
      await this.prisma.school.findMany({ select: { code: true } })
    ).map((s) => s.code);
    const code = nextCode(codes, 'S');
    const defaults = await this.schoolDefaultPasswordFields(dto.phone);
    return this.prisma.school.create({
      data: {
        code,
        ...dto,
        email: dto.email ? dto.email.toLowerCase() : dto.email,
        schoolEmail: dto.schoolEmail ? dto.schoolEmail.toLowerCase() : dto.schoolEmail,
        ...defaults,
      },
    });
  }

  /** One-click sign-in link for a school's portal (Admin > Schools > Magic
   * Link) — the school equivalent of generateStudentAccessToken. Signed and
   * stateless, expires after 7 days, and stops working as soon as the
   * school's password is set or changed (see school-link.util.ts). */
  async generateSchoolLoginLink(code: string, loginAs: SchoolLoginAs) {
    const school = await this.findSchoolByCode(code);
    if (!school) throw new NotFoundException('School not found');
    const { token, expiresAt } = signSchoolLink(school.id, loginAs, school.passwordHash);
    const base = process.env.FRONTEND_BASE_URL ?? 'https://indiamindleague.com';
    return {
      loginUrl: `${base}/schools/link/${token}`,
      expiresAt,
      loginAs,
      schoolCode: school.code,
      schoolName: school.name,
    };
  }

  // ---- schools: merge duplicates ----

  // Case/whitespace-insensitive — the merge box takes whatever an admin
  // types or pastes, and "s216 " shouldn't read as a different school than S216.
  private findSchoolByCode(code: string) {
    return this.prisma.school.findFirst({ where: { code: { equals: code.trim(), mode: 'insensitive' } } });
  }

  /** Counts only — what mergeSchools(keepCode, mergeCode) would move,
   * without touching anything. Surfaces the financial stakes (paid
   * registrations under the duplicate) up front, the same thing checked
   * by hand before every school merge done manually so far. */
  async previewSchoolMerge(keepCode: string, mergeCode: string) {
    const keep = await this.findSchoolByCode(keepCode);
    const merge = await this.findSchoolByCode(mergeCode);
    if (!keep) throw new NotFoundException(`School "${keepCode}" not found`);
    if (!merge) throw new NotFoundException(`School "${mergeCode}" not found`);
    if (keep.id === merge.id) {
      throw new BadRequestException('Pick two different schools to merge.');
    }
    const [studentCount, paidCount] = await Promise.all([
      this.prisma.student.count({ where: { schoolId: merge.id, archived: false } }),
      this.prisma.registration.count({
        where: { student: { schoolId: merge.id }, payments: { some: { status: 'Paid' } } },
      }),
    ]);
    return {
      keep: { code: keep.code, name: keep.name, verified: keep.verified, hasLogin: !!keep.email || !!keep.phone },
      merge: { code: merge.code, name: merge.name, verified: merge.verified, hasLogin: !!merge.email || !!merge.phone },
      studentsToMove: studentCount,
      paidRegistrationsToMove: paidCount,
    };
  }

  /** Moves every student (and broadcast history) from `merge` onto `keep`,
   * then deletes the now-empty duplicate school. `keep`'s own row —
   * name, verified flag, and crucially its login (email/phone/password)
   * and coordinator name — is never written to, so the surviving school's
   * principal/coordinator access is exactly what it was before the
   * merge. Mirrors the one-off scripts used to clean up the Vrindavan/etc.
   * duplicates earlier, now a real, repeatable admin action instead of a
   * hand-run Node script. */
  async mergeSchools(keepCode: string, mergeCode: string) {
    const keep = await this.findSchoolByCode(keepCode);
    const merge = await this.findSchoolByCode(mergeCode);
    if (!keep) throw new NotFoundException(`School "${keepCode}" not found`);
    if (!merge) throw new NotFoundException(`School "${mergeCode}" not found`);
    if (keep.id === merge.id) {
      throw new BadRequestException('Pick two different schools to merge.');
    }
    const [students, recipients] = await this.prisma.$transaction([
      this.prisma.student.updateMany({ where: { schoolId: merge.id }, data: { schoolId: keep.id } }),
      this.prisma.broadcastRecipient.updateMany({ where: { schoolId: merge.id }, data: { schoolId: keep.id } }),
      // schoolId on a submission is a plain snapshot (no FK) — re-point it so
      // reporting by school stays whole after a merge.
      this.prisma.assessmentSubmission.updateMany({ where: { schoolId: merge.id }, data: { schoolId: keep.id } }),
    ]);
    await this.prisma.school.delete({ where: { id: merge.id } });
    return {
      keptCode: keep.code,
      mergedCode: merge.code,
      studentsMoved: students.count,
      broadcastRecipientsMoved: recipients.count,
    };
  }

  // ---- schools: bulk upload ----

  // email/phone — optional, the school's own /schools portal login
  // identity (see School.email/phone) — a school just can't sign in
  // until one of these is set, by this import or later from Admin >
  // Schools. schoolEmail is separate — the institution's own address,
  // never a login identity (see School.schoolEmail).
  private static readonly SCHOOL_CSV_COLUMNS = ['name', 'city', 'contact', 'contactSecondary', 'coordinator', 'schoolEmail', 'email', 'phone'];

  sampleSchoolsCsv(): string {
    const header = RegistrationService.SCHOOL_CSV_COLUMNS;
    const example1 = ['Amity International School, Noida', 'Noida', '9876543210', '9876500000', 'Priya Verma', 'info@amitynoida.edu', 'principal@amitynoida.edu', '9876543210'];
    const example2 = ['DAV Public School', 'Delhi', '', '', '', '', '', ''];
    return toCsv([header, example1, example2]);
  }

  async bulkUploadSchools(buffer: Buffer): Promise<BulkUploadResult> {
    const text = buffer.toString('utf8');
    const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
    if (!rows.length) throw new BadRequestException('CSV file is empty');

    const header = rows[0].map((h) => h.trim().toLowerCase());
    if (!header.includes('name')) {
      throw new BadRequestException('CSV is missing required column "name"');
    }
    const colIndex = (name: string) => header.indexOf(name.toLowerCase());
    const dataRows = rows.slice(1);

    const existingCodes = (
      await this.prisma.school.findMany({ select: { code: true } })
    ).map((s) => s.code);
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

      const name = get('name');
      const city = get('city');
      const contact = get('contact');
      const contactSecondary = get('contactSecondary');
      const coordinator = get('coordinator');
      const schoolEmail = get('schoolEmail');
      const email = get('email');
      const phone = get('phone');

      if (!name) { fail('name is required'); continue; }
      if (name.length > 190) { fail('name exceeds 190 characters'); continue; }
      if (city.length > 90) { fail('city exceeds 90 characters'); continue; }
      if (contact.length > 40) { fail('contact exceeds 40 characters'); continue; }
      if (contactSecondary.length > 40) { fail('contactSecondary exceeds 40 characters'); continue; }
      if (coordinator.length > 120) { fail('coordinator exceeds 120 characters'); continue; }
      if (schoolEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(schoolEmail)) { fail(`school email "${schoolEmail}" is not valid`); continue; }
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { fail(`email "${email}" is not valid`); continue; }
      if (phone.length > 20) { fail('phone exceeds 20 characters'); continue; }

      // Same reasoning as createSchool()'s check, but bulk upload has no
      // human reviewing each row in the moment — so a match here always
      // skips the row (recorded as an error, not silently created) rather
      // than offering an inline override. Re-upload just that school on
      // its own via Add School with confirmNew if it's genuinely distinct.
      const similar = await findSimilarSchool(this.prisma, name);
      if (similar) {
        fail(`matches an existing school: ${similar.code} "${similar.name}"${similar.verified ? '' : ' (unverified)'} — skipped, not created`);
        continue;
      }

      const code = nextCode(existingCodes, 'S');
      try {
        const defaults = await this.schoolDefaultPasswordFields(phone || null);
        await this.prisma.school.create({
          data: {
            code,
            name,
            city: city || null,
            contact: contact || null,
            contactSecondary: contactSecondary || null,
            coordinator: coordinator || null,
            schoolEmail: schoolEmail ? schoolEmail.toLowerCase() : null,
            email: email ? email.toLowerCase() : null,
            phone: phone || null,
            ...defaults,
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

  async updateSchool(code: string, dto: PatchSchoolDto) {
    const existing = await this.prisma.school.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('School not found');
    // Re-bootstraps the default (phone-as-password) login whenever there's
    // no real chosen password YET — either no password at all, or one that
    // was itself only ever the bootstrap value (mustChangePassword still
    // true, i.e. this school has never completed first login). Refreshing
    // it here means an admin correcting a wrong/outdated phone number
    // doesn't leave the coordinator locked out with a bootstrap password
    // that no longer matches anything they'd type. Once a coordinator has
    // actually set their own password (mustChangePassword false), a later
    // phone correction here never touches it, same as before.
    const needsBootstrap = !existing.passwordHash || existing.mustChangePassword;
    const defaults = needsBootstrap && dto.phone ? await this.schoolDefaultPasswordFields(dto.phone) : {};
    return this.prisma.school.update({
      where: { code },
      data: {
        ...dto,
        email: dto.email ? dto.email.toLowerCase() : dto.email,
        schoolEmail: dto.schoolEmail ? dto.schoolEmail.toLowerCase() : dto.schoolEmail,
        ...defaults,
      },
    });
  }

  /** Admin-authored password override for a school — sets exactly the
   * password given, and clears mustChangePassword so it's usable
   * immediately rather than forcing yet another reset on top of one the
   * admin just performed. No currentPassword check, same reasoning as
   * setStudentPasswordByAdmin(): this is an admin acting on the school's
   * behalf, not the coordinator authenticating themselves. */
  async setSchoolPassword(code: string, newPassword: string) {
    const existing = await this.prisma.school.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('School not found');
    const passwordHash = await argonHash(newPassword);
    await this.prisma.school.update({
      where: { code },
      data: { passwordHash, mustChangePassword: false },
    });
    return { ok: true };
  }
}
