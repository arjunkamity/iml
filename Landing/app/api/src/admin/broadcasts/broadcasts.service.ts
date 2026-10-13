import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { nextCode } from '../../common/util';
import { MessagingService } from '../../messaging/messaging.service';
import { CreateBroadcastDto, PatchBroadcastDto } from './broadcasts.dto';

const SAMPLE_VARS = {
  SchoolName: 'Amity International School, Saket',
  SchoolCode: 'S01',
  CoordinatorName: 'Ms. Priya Verma',
  City: 'New Delhi',
  LoginId: 'coordinator@example.edu',
  LoginPassword: '9876543210',
  StudentName: 'Aarav Sharma',
  StudentCode: 'R1001',
  Grade: '10',
  RegID: 'R1001',
  Amount: '500',
  CompetitionName: 'India Mind League 2026',
};

type AudienceRow = { schoolId: number | null; studentId: number | null; email: string; vars: Record<string, string> };

@Injectable()
export class BroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  private async requireBroadcast(code: string) {
    const b = await this.prisma.broadcast.findUnique({ where: { code } });
    if (!b) throw new NotFoundException('Broadcast not found');
    return b;
  }

  /** Per-school merge fields — same shape used both for the live preview
   * and for what actually gets snapshotted onto each BroadcastRecipient
   * at send time (see resolveAudience()).
   *
   * LoginPassword is never a stored secret — it IS the school's own
   * registered phone number (see schoolDefaultPasswordFields() in
   * registrations.service.ts, which argon2-hashes exactly this value as
   * the bootstrap password) and is only meaningful while
   * mustChangePassword is still true. Once a coordinator has completed
   * first login and set their own real password, nobody — including this
   * app — knows it, so it's deliberately left blank rather than showing a
   * stale/wrong value. */
  private schoolVars(s: {
    name: string;
    code: string;
    coordinator: string | null;
    city: string | null;
    email: string | null;
    phone: string | null;
    mustChangePassword: boolean;
  }) {
    return {
      SchoolName: s.name,
      SchoolCode: s.code,
      CoordinatorName: s.coordinator || s.name,
      City: s.city ?? '',
      LoginId: s.email ?? '',
      LoginPassword: s.mustChangePassword && s.phone ? s.phone : '',
    };
  }

  private async resolveSchools(): Promise<AudienceRow[]> {
    const schools = await this.prisma.school.findMany({
      where: { email: { not: null } },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, email: true, coordinator: true, city: true, phone: true, mustChangePassword: true },
    });
    return schools.map((s) => ({
      schoolId: s.id,
      studentId: null,
      email: s.email as string,
      vars: this.schoolVars(s),
    }));
  }

  /** The institution's own address (School.schoolEmail) — front office,
   * info@, etc. — never the coordinator's personal login email, and never
   * carries {LoginId}/{LoginPassword} (schoolEmail isn't a login identity,
   * so there's no credential to show). This is what "All Schools" in
   * Admin > Mass Email actually sends to. */
  private async resolveSchoolsInstitutional(): Promise<AudienceRow[]> {
    const schools = await this.prisma.school.findMany({
      where: { schoolEmail: { not: null } },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, schoolEmail: true, city: true },
    });
    return schools.map((s) => ({
      schoolId: s.id,
      studentId: null,
      email: s.schoolEmail as string,
      vars: { SchoolName: s.name, SchoolCode: s.code, City: s.city ?? '' },
    }));
  }

  /** Same as resolveSchools(), narrowed to schools that (a) haven't
   * completed their first login yet and (b) actually have a phone on file
   * — i.e. exactly the schools where {LoginPassword} resolves to a real,
   * currently-working bootstrap password rather than blank. Purpose-built
   * for a "here are your login details" campaign, so every recipient
   * gets a usable credential instead of some getting an empty field. */
  private async resolveSchoolsPendingSetup(): Promise<AudienceRow[]> {
    const schools = await this.prisma.school.findMany({
      where: { email: { not: null }, mustChangePassword: true, phone: { not: null } },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, email: true, coordinator: true, city: true, phone: true, mustChangePassword: true },
    });
    return schools.map((s) => ({
      schoolId: s.id,
      studentId: null,
      email: s.email as string,
      vars: this.schoolVars(s),
    }));
  }

  private async resolveStudents(): Promise<AudienceRow[]> {
    const students = await this.prisma.student.findMany({
      where: { email: { not: null }, archived: false },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, email: true, grade: true, school: { select: { name: true } } },
    });
    return students.map((s) => ({
      schoolId: null,
      studentId: s.id,
      email: s.email as string,
      vars: {
        StudentName: s.name,
        StudentCode: s.code,
        Grade: s.grade,
        SchoolName: s.school?.name ?? '',
      },
    }));
  }

  /** Registered but never actually paid — one row per student (even if
   * they have more than one such registration), the exact same "hasn't
   * paid" definition the admin Registrations table's own Paid badge uses
   * (no Payment row with status 'Paid' exists at all) and the same
   * amount-due resolution RegistrationService.sendPaymentReminder() uses
   * for the per-row version of this same reminder. A registration whose
   * first stage is free is correctly excluded — there's nothing to remind
   * them to pay. */
  private async resolveUnpaidRegistrations(): Promise<AudienceRow[]> {
    const registrations = await this.prisma.registration.findMany({
      where: { student: { archived: false, email: { not: null } }, payments: { none: { status: 'Paid' } } },
      include: {
        student: { select: { id: true, code: true, name: true, email: true, school: { select: { name: true } } } },
        competition: { select: { title: true, stages: { orderBy: { position: 'asc' }, take: 1 } } },
      },
      orderBy: { registeredAt: 'desc' },
    });
    const rows: AudienceRow[] = [];
    const seenStudents = new Set<number>();
    for (const r of registrations) {
      if (seenStudents.has(r.studentId)) continue;
      const firstStage = r.competition.stages[0];
      if (!firstStage || firstStage.isFree) continue;
      seenStudents.add(r.studentId);
      rows.push({
        schoolId: null,
        studentId: r.studentId,
        email: r.student.email as string,
        vars: {
          StudentName: r.student.name,
          StudentCode: r.student.code,
          RegID: r.code,
          SchoolName: r.student.school?.name ?? '',
          Amount: firstStage.price.toString(),
          CompetitionName: r.competition.title,
        },
      });
    }
    return rows;
  }

  /** Parses the admin's free-text email list (comma/semicolon/newline
   * separated), trims, drops anything that doesn't look like an email,
   * and de-dupes — same forgiving parsing a human pasting from a
   * spreadsheet or another email client would expect. */
  private parseCustomEmails(raw: string | null | undefined): AudienceRow[] {
    if (!raw) return [];
    const seen = new Set<string>();
    const rows: AudienceRow[] = [];
    for (const piece of raw.split(/[\n,;]+/)) {
      const email = piece.trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
      if (seen.has(email)) continue;
      seen.add(email);
      rows.push({ schoolId: null, studentId: null, email, vars: {} });
    }
    return rows;
  }

  /** Who a send would actually reach right now. Not yet materialized as
   * recipient rows; see send() for that. Custom emails are always
   * additive — whatever group is selected, anything typed into the
   * custom-email box is appended on top of it, never a separate mode —
   * de-duped against the group so pasting a coordinator's own address
   * there doesn't double-send to them. */
  private async resolveAudience(audience: string, customEmails?: string | null): Promise<AudienceRow[]> {
    let base: AudienceRow[];
    // 'schools' addresses the named coordinator who actually signs in
    // (School.email); 'schools-all' addresses the institution itself
    // (School.schoolEmail) — a distinct address with no login/credential
    // meaning, so a school with only a coordinator email set (and no
    // schoolEmail) is correctly excluded from "All Schools" rather than
    // falling back to the coordinator's personal inbox.
    if (audience === 'schools') base = await this.resolveSchools();
    else if (audience === 'schools-all') base = await this.resolveSchoolsInstitutional();
    else if (audience === 'schools-pending') base = await this.resolveSchoolsPendingSetup();
    else if (audience === 'students') base = await this.resolveStudents();
    else if (audience === 'unpaid') base = await this.resolveUnpaidRegistrations();
    else if (audience === 'all') {
      const [schools, students] = await Promise.all([this.resolveSchools(), this.resolveStudents()]);
      base = [...schools, ...students];
    } else if (audience === 'custom') {
      // No predefined group at all — the whole audience is whatever's
      // typed into the custom-emails box below. Was previously
      // unhandled here (fell through to the "Unknown audience" throw
      // below) despite being the audience value on real existing
      // drafts (BC-1, BC-2) — those could never actually have been
      // sent as configured until this branch existed.
      base = [];
    } else {
      throw new BadRequestException(`Unknown audience "${audience}"`);
    }
    const seen = new Set(base.map((r) => r.email.toLowerCase()));
    for (const row of this.parseCustomEmails(customEmails)) {
      if (seen.has(row.email)) continue;
      seen.add(row.email);
      base.push(row);
    }
    return base;
  }

  async previewAudience(audience: string, customEmails?: string) {
    const rows = await this.resolveAudience(audience, customEmails);
    return {
      count: rows.length,
      sample: rows.slice(0, 10).map((r) => ({ email: r.email, ...r.vars })),
    };
  }

  async list(q: { page: number; limit: number }): Promise<ListResult<Record<string, unknown>>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.broadcast.findMany({
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.broadcast.count(),
    ]);
    return paginate(
      rows.map((b) => ({
        code: b.code,
        subject: b.subject,
        audience: b.audience,
        status: b.status,
        totalCount: b.totalCount,
        sentCount: b.sentCount,
        failedCount: b.failedCount,
        createdAt: b.createdAt,
        sentAt: b.sentAt,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async get(code: string) {
    const b = await this.requireBroadcast(code);
    const recipients = await this.prisma.broadcastRecipient.findMany({
      where: { broadcastId: b.id },
      orderBy: { id: 'asc' },
      select: { email: true, vars: true, status: true, attempts: true, lastError: true, processedAt: true },
    });
    return { ...b, recipients };
  }

  async create(dto: CreateBroadcastDto) {
    const codes = (await this.prisma.broadcast.findMany({ select: { code: true } })).map((b) => b.code);
    const code = nextCode(codes, 'BC-');
    return this.prisma.broadcast.create({
      data: {
        code,
        subject: dto.subject,
        body: dto.body,
        audience: dto.audience ?? 'schools',
        customEmails: dto.customEmails ?? null,
      },
    });
  }

  async update(code: string, dto: PatchBroadcastDto) {
    const b = await this.requireBroadcast(code);
    if (b.status !== 'Draft') {
      throw new BadRequestException('Only a Draft broadcast can still be edited.');
    }
    return this.prisma.broadcast.update({ where: { code }, data: dto });
  }

  async remove(code: string) {
    const b = await this.requireBroadcast(code);
    if (b.status !== 'Draft') {
      throw new BadRequestException('Only a Draft broadcast can be deleted — a broadcast that has started sending is a permanent record.');
    }
    await this.prisma.broadcast.delete({ where: { code } });
    return { ok: true };
  }

  /** A real, single-recipient preview — same subject/body, sample merge
   * values, sent right now, outside the queue and never recorded as a
   * BroadcastRecipient. Mirrors AdminMessagingService.testSend() for the
   * lifecycle templates. */
  async testSend(code: string, email: string) {
    const b = await this.requireBroadcast(code);
    const ok = await this.messaging.dispatchCustom(`BROADCAST-TEST:${b.code}`, { email }, b.subject, b.body, SAMPLE_VARS);
    return { ok };
  }

  /** Materializes the current audience as BroadcastRecipient rows (status
   * Pending) and flips the broadcast to Sending — BroadcastQueueService's
   * cron tick does the actual sending from here. Irreversible: once a
   * broadcast leaves Draft it can never be edited or deleted again, only
   * watched. */
  async send(code: string) {
    const b = await this.requireBroadcast(code);
    if (b.status !== 'Draft') {
      throw new BadRequestException('This broadcast has already been sent (or is sending).');
    }
    const audience = await this.resolveAudience(b.audience, b.customEmails);
    if (!audience.length) {
      throw new BadRequestException('No recipients match this audience — nothing to send.');
    }
    await this.prisma.$transaction([
      this.prisma.broadcastRecipient.createMany({
        data: audience.map((a) => ({
          broadcastId: b.id,
          schoolId: a.schoolId,
          studentId: a.studentId,
          email: a.email,
          vars: a.vars,
        })),
      }),
      this.prisma.broadcast.update({
        where: { id: b.id },
        data: { status: 'Sending', totalCount: audience.length },
      }),
    ]);
    return { queued: audience.length };
  }
}
