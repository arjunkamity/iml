import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshDto } from './dto/refresh.dto';
import { StudentLoginDto } from './dto/student-login.dto';
import { SchoolLoginDto } from './dto/school-login.dto';
import { SchoolFirstLoginDto, SchoolFirstLoginResendDto } from './dto/school-first-login.dto';
import { RequestSchoolRegisterOtpDto, SchoolRegisterDto } from './dto/school-register.dto';
import { findSimilarSchool, nextCode } from '../common/util';
import { passwordFingerprint, verifySchoolLink } from '../common/school-link.util';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

const ADMIN_ACCESS_TTL = '15m';
// Students have no refresh flow (see issueStudentToken) — the access token
// itself is the whole session, so it needs to be long enough to actually
// keep them signed in. 24h, then they're asked to log in again.
const STUDENT_ACCESS_TTL = '24h';
// Same no-refresh shape as students — a school coordinator's session is
// just as low-friction, sign in again after a day rather than silently
// refreshing in the background.
const SCHOOL_ACCESS_TTL = '24h';
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly messaging: MessagingService,
  ) {}

  // ---- admin ----

  async adminLogin({ email, password }: AdminLoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!admin || admin.status !== 'Active') {
      throw new UnauthorizedException('Invalid email or password');
    }
    let ok = false;
    try {
      ok = await argonVerify(admin.passwordHash, password);
    } catch {
      ok = false;
    }
    if (!ok) throw new UnauthorizedException('Invalid email or password');

    const tokens = await this.issueTokens({
      sub: admin.id,
      kind: 'admin',
      role: admin.role,
    });
    await this.persistRefresh(admin.id, tokens.refreshToken);
    return { ...tokens, admin: await this.safeAdmin(admin) };
  }

  /** Students get one long-lived access token, no refresh — see STUDENT_ACCESS_TTL. */
  private async issueStudentToken(studentId: number) {
    const accessToken = await this.jwt.signAsync(
      { sub: studentId, kind: 'student' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: STUDENT_ACCESS_TTL },
    );
    return { accessToken };
  }

  /**
   * Same session shape as studentLogin/verifyOtp, but callable right after a
   * fresh registration so the student lands on their dashboard already
   * signed in — no separate login step between "registered" and "can pay".
   */
  async issueStudentSession(studentId: number) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new UnauthorizedException('Student not found');
    const tokens = await this.issueStudentToken(studentId);
    return { ...tokens, student: this.safeStudent(student) };
  }

  /**
   * Consumes an ExamMagicLink token (the {TestLink} in the "Go for it" batch
   * reminder) — logs the student straight in and hands back which exam to
   * land them on. Not single-use: a student refreshing/re-clicking the same
   * link before it expires should not get bounced to a login screen.
   */
  async consumeExamLink(token: string) {
    const link = await this.prisma.examMagicLink.findUnique({
      where: { token },
      include: { registration: true, exam: { select: { code: true } } },
    });
    if (!link) throw new NotFoundException('This link is invalid.');
    if (link.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This link has expired. Please log in normally.');
    }
    if (!link.usedAt) {
      await this.prisma.examMagicLink.update({
        where: { id: link.id },
        data: { usedAt: new Date() },
      });
    }
    const session = await this.issueStudentSession(link.registration.studentId);
    return { ...session, examCode: link.exam.code };
  }

  /**
   * Consumes an admin-generated direct-login token (Student.accessToken —
   * see RegistrationService.generateStudentAccessToken) — bypasses OTP
   * entirely. Built for when a student's own inbox is unreachable (e.g.
   * testing against a disposable address that never receives mail); an
   * admin copies the link from Admin > Registrations and hands it to
   * whoever needs to get in. Not single-use and no fixed expiry — the
   * token stays valid until an admin regenerates it, which overwrites the
   * old value outright (the only revoke path).
   */
  async consumeStudentAccessToken(sid: string, token: string) {
    const student = await this.prisma.student.findFirst({
      where: { code: sid, accessToken: token },
    });
    if (!student) throw new UnauthorizedException('This login link is invalid.');
    return this.issueStudentSession(student.id);
  }

  async adminProfile(adminId: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new UnauthorizedException('Admin not found');
    return this.safeAdmin(admin);
  }

  // ---- student password login ----

  async studentLogin({ email, password }: StudentLoginDto) {
    const normalized = email.toLowerCase().trim();
    const student = await this.prisma.student.findFirst({
      where: { email: normalized },
    });
    if (!student) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!student.passwordHash) {
      throw new UnauthorizedException(
        'No password set for this account. Sign in with OTP and set one in Security.',
      );
    }
    let ok = false;
    try {
      ok = await argonVerify(student.passwordHash, password);
    } catch {
      ok = false;
    }
    if (!ok) throw new UnauthorizedException('Invalid email or password');

    const tokens = await this.issueStudentToken(student.id);
    return { ...tokens, student: this.safeStudent(student) };
  }

  // ---- student OTP (sent via email/SMS using the REGISTRATION_OTP template) ----
  async requestOtp({ email, phone }: RequestOtpDto) {
    const normalizedEmail = email?.toLowerCase().trim() || undefined;
    const normalizedPhone = phone?.trim() || undefined;
    if (!normalizedEmail && !normalizedPhone) {
      throw new BadRequestException('Email or phone is required');
    }

    const student = await this.prisma.student.findFirst({
      where: normalizedPhone
        ? { phone: normalizedPhone }
        : { email: normalizedEmail },
    });
    if (!student)
      throw new NotFoundException(
        normalizedPhone
          ? 'No student account found for that phone number'
          : 'No student account found for that email',
      );

    await this.prisma.otp.updateMany({
      where: normalizedPhone
        ? { phone: normalizedPhone, purpose: 'login', used: false }
        : { email: normalizedEmail, purpose: 'login', used: false },
      data: { used: true },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.otp.create({
      data: {
        email: normalizedPhone ? null : normalizedEmail,
        phone: normalizedPhone ?? null,
        code,
        purpose: 'login',
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    // Fire-and-forget — dispatch() never throws, so a messaging outage never
    // blocks the OTP request itself.
    void this.messaging.dispatch(
      'REGISTRATION_OTP',
      { email: student.email, phone: student.phone },
      { OTP: code, StudentName: student.name },
    );

    return { expiresIn: OTP_TTL_MS / 1000 };
  }

  async verifyOtp({ email, phone, code }: VerifyOtpDto) {
    const normalizedEmail = email?.toLowerCase().trim() || undefined;
    const normalizedPhone = phone?.trim() || undefined;
    if (!normalizedEmail && !normalizedPhone) {
      throw new BadRequestException('Email or phone is required');
    }

    const otp = await this.prisma.otp.findFirst({
      where: normalizedPhone
        ? { phone: normalizedPhone, purpose: 'login', used: false }
        : { email: normalizedEmail, purpose: 'login', used: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    // Local-dev convenience only — DEV_OTP_BYPASS is never set in prod's
    // .env, so this is unreachable there regardless of the code entered.
    const devBypass = process.env.DEV_OTP_BYPASS === 'true' && code.trim() === '123456';
    if (!devBypass) {
      if (otp.code !== code.trim()) {
        throw new BadRequestException('Invalid or expired OTP');
      }
      if (otp.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException('OTP has expired');
      }
    }
    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { used: true },
    });

    const student = await this.prisma.student.findFirst({
      where: normalizedPhone
        ? { phone: normalizedPhone }
        : { email: normalizedEmail },
    });
    if (!student) throw new UnauthorizedException('Student not found');

    const tokens = await this.issueStudentToken(student.id);
    return { ...tokens, student: this.safeStudent(student) };
  }

  async studentProfile(studentId: number) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new UnauthorizedException('Student not found');
    return this.safeStudent(student);
  }

  // ---- school (the school's own portal — /schools — not admin) ----
  // Same no-refresh, one-long-access-token shape as students. A school
  // doesn't self-register: an admin sets its login email/phone (see
  // Admin > Schools), and the school signs in with OTP the first time to
  // set its own password from there — identical bootstrap to a student's.

  private async issueSchoolToken(schoolId: number) {
    const accessToken = await this.jwt.signAsync(
      { sub: schoolId, kind: 'school' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: SCHOOL_ACCESS_TTL },
    );
    return { accessToken };
  }

  /** Consumes an admin-generated school login link (Admin > Schools > Magic
   * Link — see school-link.util.ts). Bypasses the password/OTP step the
   * same way a student's direct-login link does. Rejected if the link has
   * expired or the school's password has changed since it was generated. */
  async consumeSchoolLink(token: string) {
    const link = verifySchoolLink(token);
    const invalid = new UnauthorizedException('This login link is invalid or has expired.');
    if (!link) throw invalid;
    const school = await this.prisma.school.findUnique({ where: { id: link.schoolId } });
    if (!school || passwordFingerprint(school.passwordHash) !== link.fingerprint) throw invalid;
    const tokens = await this.issueSchoolToken(school.id);
    return { ...tokens, school: this.safeSchool(school) };
  }

  async schoolLogin({ email, phone, password }: SchoolLoginDto) {
    const normalizedEmail = email?.toLowerCase().trim() || undefined;
    const normalizedPhone = phone?.trim() || undefined;
    if (!normalizedEmail && !normalizedPhone) {
      throw new UnauthorizedException('Invalid email/phone or password');
    }
    const school = await this.prisma.school.findFirst({
      where: normalizedEmail ? { email: normalizedEmail } : { phone: normalizedPhone },
    });
    if (!school) {
      throw new UnauthorizedException('Invalid email/phone or password');
    }
    if (!school.passwordHash) {
      throw new UnauthorizedException(
        'No password set for this account. Sign in with OTP and set one from Profile Settings.',
      );
    }
    let ok = false;
    try {
      ok = await argonVerify(school.passwordHash, password);
    } catch {
      ok = false;
    }
    if (!ok) throw new UnauthorizedException('Invalid email/phone or password');

    // A school whose password is still the auto-set default (its own phone
    // number — see registrations.service.ts/backfill script) never gets a
    // real session from a plain login: instead we immediately OTP-verify
    // both its registered contacts and make it pick a real password (see
    // completeSchoolFirstLogin) before any token is issued at all.
    if (school.mustChangePassword) {
      await this.dispatchSchoolForceResetOtp(school);
      return { mustChangePassword: true, schoolId: school.id };
    }

    const tokens = await this.issueSchoolToken(school.id);
    return { ...tokens, school: this.safeSchool(school) };
  }

  // Own OTP purpose ('school-force-reset'), separate from 'school-login' —
  // this one is never requested by choice, only auto-fired the moment a
  // default-password login is detected, and it dispatches to BOTH the
  // school's registered email and phone at once (MessagingService.dispatch
  // already sends to every non-null channel it's given) so completing it
  // proves ownership of both, not just whichever one was typed in.
  private async dispatchSchoolForceResetOtp(school: { id: number; name: string; email: string | null; phone: string | null }) {
    await this.prisma.otp.updateMany({
      where: {
        purpose: 'school-force-reset',
        used: false,
        ...(school.email ? { email: school.email } : { phone: school.phone ?? undefined }),
      },
      data: { used: true },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.otp.create({
      data: {
        email: school.email ?? null,
        phone: school.phone ?? null,
        code,
        purpose: 'school-force-reset',
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    void this.messaging.dispatch(
      'REGISTRATION_OTP',
      { email: school.email, phone: school.phone },
      { OTP: code, StudentName: school.name },
    );

    return { expiresIn: OTP_TTL_MS / 1000 };
  }

  /** Step 2 of the forced first-login flow: the OTP dispatched by
   * schoolLogin() proves the school actually controls its registered
   * email/phone, and a real password replaces the default one in the same
   * call — only after both succeed does a session get issued. */
  async completeSchoolFirstLogin({ schoolId, code, newPassword }: SchoolFirstLoginDto) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new UnauthorizedException('School not found');
    if (!school.mustChangePassword) {
      throw new BadRequestException('This account has already completed its first-time setup.');
    }

    const otp = await this.prisma.otp.findFirst({
      where: {
        purpose: 'school-force-reset',
        used: false,
        ...(school.email ? { email: school.email } : { phone: school.phone ?? undefined }),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Invalid or expired OTP');
    const devBypass = process.env.DEV_OTP_BYPASS === 'true' && code.trim() === '123456';
    if (!devBypass) {
      if (otp.code !== code.trim()) throw new BadRequestException('Invalid or expired OTP');
      if (otp.expiresAt.getTime() < Date.now()) throw new BadRequestException('OTP has expired');
    }
    await this.prisma.otp.update({ where: { id: otp.id }, data: { used: true } });

    const passwordHash = await argonHash(newPassword);
    const updated = await this.prisma.school.update({
      where: { id: schoolId },
      data: { passwordHash, mustChangePassword: false },
    });

    const tokens = await this.issueSchoolToken(updated.id);
    return { ...tokens, school: this.safeSchool(updated) };
  }

  /** Lets a school still stuck on the forced-reset screen get a fresh code
   * (its default-password login already fired one, but that's easy to
   * lose track of across two inboxes/a phone). */
  async resendSchoolFirstLoginOtp({ schoolId }: SchoolFirstLoginResendDto) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new UnauthorizedException('School not found');
    if (!school.mustChangePassword) {
      throw new BadRequestException('This account has already completed its first-time setup.');
    }
    return this.dispatchSchoolForceResetOtp(school);
  }

  // Own OTP purpose ('school-login') rather than reusing the student
  // flow's 'login' — keeps the two fully separate even on the rare
  // overlap of a school's contact email/phone matching some student's.
  async requestSchoolOtp({ email, phone }: RequestOtpDto) {
    const normalizedEmail = email?.toLowerCase().trim() || undefined;
    const normalizedPhone = phone?.trim() || undefined;
    if (!normalizedEmail && !normalizedPhone) {
      throw new BadRequestException('Email or phone is required');
    }

    const school = await this.prisma.school.findFirst({
      where: normalizedPhone ? { phone: normalizedPhone } : { email: normalizedEmail },
    });
    if (!school) {
      throw new NotFoundException(
        normalizedPhone
          ? 'No school account found for that phone number'
          : 'No school account found for that email',
      );
    }

    await this.prisma.otp.updateMany({
      where: normalizedPhone
        ? { phone: normalizedPhone, purpose: 'school-login', used: false }
        : { email: normalizedEmail, purpose: 'school-login', used: false },
      data: { used: true },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.otp.create({
      data: {
        email: normalizedPhone ? null : normalizedEmail,
        phone: normalizedPhone ?? null,
        code,
        purpose: 'school-login',
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    void this.messaging.dispatch(
      'REGISTRATION_OTP',
      { email: school.email, phone: school.phone },
      { OTP: code, StudentName: school.name },
    );

    return { expiresIn: OTP_TTL_MS / 1000 };
  }

  async verifySchoolOtp({ email, phone, code }: VerifyOtpDto) {
    const normalizedEmail = email?.toLowerCase().trim() || undefined;
    const normalizedPhone = phone?.trim() || undefined;
    if (!normalizedEmail && !normalizedPhone) {
      throw new BadRequestException('Email or phone is required');
    }

    const otp = await this.prisma.otp.findFirst({
      where: normalizedPhone
        ? { phone: normalizedPhone, purpose: 'school-login', used: false }
        : { email: normalizedEmail, purpose: 'school-login', used: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    const devBypass = process.env.DEV_OTP_BYPASS === 'true' && code.trim() === '123456';
    if (!devBypass) {
      if (otp.code !== code.trim()) {
        throw new BadRequestException('Invalid or expired OTP');
      }
      if (otp.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException('OTP has expired');
      }
    }
    await this.prisma.otp.update({ where: { id: otp.id }, data: { used: true } });

    const school = await this.prisma.school.findFirst({
      where: normalizedPhone ? { phone: normalizedPhone } : { email: normalizedEmail },
    });
    if (!school) throw new UnauthorizedException('School not found');

    const tokens = await this.issueSchoolToken(school.id);
    return { ...tokens, school: this.safeSchool(school) };
  }

  async schoolProfile(schoolId: number) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new UnauthorizedException('School not found');
    return this.safeSchool(school);
  }

  // ---- school self-signup (/schools/register) ----
  // The one place a School row gets created outside Admin > Schools. Own
  // OTP purpose ('school-register') since 'school-login' assumes a School
  // row already exists to look up by that email/phone, which isn't true
  // yet here.

  async requestSchoolRegisterOtp({ email, phone }: RequestSchoolRegisterOtpDto) {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.trim();

    await this.prisma.otp.updateMany({
      where: { email: normalizedEmail, purpose: 'school-register', used: false },
      data: { used: true },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.otp.create({
      data: {
        email: normalizedEmail,
        phone: normalizedPhone,
        code,
        purpose: 'school-register',
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    void this.messaging.dispatch(
      'REGISTRATION_OTP',
      { email: normalizedEmail, phone: normalizedPhone },
      { OTP: code, StudentName: 'there' },
    );

    return { expiresIn: OTP_TTL_MS / 1000 };
  }

  /** Unlike every admin-created school (always a bootstrap phone-number
   * password, always mustChangePassword:true — see
   * registrations.service.ts), a self-registered school sets its own real
   * password right here and gets a session immediately, same as any other
   * new signup. `verified` still starts false, same as a school
   * PublicService auto-creates from a student typing an unrecognized name
   * — it's a review flag for admin, not an access gate (see
   * crud.config.ts's Verified help text): this school can use the portal
   * right away.
   *
   * An exact (case-insensitive) name match against an existing school is
   * refused outright rather than merged. There's no unique DB constraint
   * on School.name to lean on (see schema.prisma), so this is an
   * application-level check only — same best-effort shape as
   * PublicService.resolveOrCreateSchoolId's dedupe. If a name is wrongly
   * squatted, Admin > Schools can still rename the conflicting row (there
   * is no delete) to free it up. */
  async registerSchool(dto: SchoolRegisterDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const normalizedPhone = dto.phone.trim();

    const otp = await this.prisma.otp.findFirst({
      where: { email: normalizedEmail, purpose: 'school-register', used: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Invalid or expired OTP');
    const devBypass = process.env.DEV_OTP_BYPASS === 'true' && dto.otp.trim() === '123456';
    if (!devBypass) {
      if (otp.code !== dto.otp.trim()) throw new BadRequestException('Invalid or expired OTP');
      if (otp.expiresAt.getTime() < Date.now()) throw new BadRequestException('OTP has expired');
    }

    // Fuzzy, not just exact — see findSimilarSchool()'s own comment. A
    // school typing their own name with slightly different
    // punctuation/spacing than however it's already on file shouldn't be
    // able to slip past this and create a second record for themselves.
    const nameTaken = await findSimilarSchool(this.prisma, dto.name.trim());
    if (nameTaken) {
      throw new BadRequestException(
        `A school named "${nameTaken.name}" is already registered. If this is your school, sign in instead, or contact support if you can't access it.`,
      );
    }
    const emailTaken = await this.prisma.school.findFirst({ where: { email: normalizedEmail } });
    if (emailTaken) {
      throw new BadRequestException('An account already exists for this email. Sign in instead.');
    }

    await this.prisma.otp.update({ where: { id: otp.id }, data: { used: true } });

    const codes = (await this.prisma.school.findMany({ select: { code: true } })).map((s) => s.code);
    const passwordHash = await argonHash(dto.password);
    const school = await this.prisma.school.create({
      data: {
        code: nextCode(codes, 'S'),
        name: dto.name.trim(),
        city: dto.city || null,
        contact: dto.contact || null,
        contactSecondary: dto.contactSecondary || null,
        schoolEmail: dto.schoolEmail ? dto.schoolEmail.toLowerCase() : null,
        coordinator: dto.coordinator,
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        mustChangePassword: false,
        verified: false,
      },
    });

    const tokens = await this.issueSchoolToken(school.id);
    return { ...tokens, school: this.safeSchool(school) };
  }

  // ---- refresh / logout (admin refresh tokens) ----

  async refresh({ refreshToken }: RefreshDto) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.kind !== 'admin')
      throw new UnauthorizedException('Invalid refresh token');

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { adminId: payload.sub, tokenHash },
    });
    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(
        'Refresh token has expired or was revoked',
      );
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
    });
    if (!admin) throw new UnauthorizedException('Admin not found');

    const tokens = await this.issueTokens({
      sub: admin.id,
      kind: 'admin',
      role: admin.role,
    });
    await this.persistRefresh(admin.id, tokens.refreshToken);
    return { ...tokens, admin: await this.safeAdmin(admin) };
  }

  async logout({ refreshToken }: RefreshDto) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    return { ok: true };
  }

  // ---- internals ----

  private async issueTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(
      { sub: payload.sub, kind: payload.kind, role: payload.role },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ADMIN_ACCESS_TTL },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: payload.sub, kind: payload.kind },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: REFRESH_TTL_MS / 1000,
      },
    );
    return { accessToken, refreshToken };
  }

  private async persistRefresh(adminId: number, token: string) {
    await this.prisma.refreshToken.create({
      data: {
        adminId,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * The admin shape sent to the frontend on login, refresh, and /auth/me
   * alike — MUST include modules every time. This used to omit modules
   * entirely on login/refresh (only /auth/me, via a since-removed
   * duplicate of this same fetch, ever got them) — an admin's own
   * AuthService.hasModule() reads modules off exactly this response, so a
   * fresh login left every non-Super-Admin with modules undefined and,
   * because that reads as "no modules", NOTHING in the sidebar rather
   * than "everything" — a real permissions bug either way, just not the
   * direction it looks like at a glance.
   */
  private async safeAdmin(admin: {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
  }) {
    const modules = await this.prisma.adminModule.findMany({
      where: { adminId: admin.id },
      select: { moduleCode: true },
    });
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      modules: modules.map((m) => m.moduleCode),
    };
  }

  private safeStudent(student: {
    id: number;
    code: string;
    name: string;
    grade: string;
    email: string | null;
    phone: string | null;
  }) {
    return {
      id: student.id,
      code: student.code,
      name: student.name,
      grade: student.grade,
      email: student.email,
      phone: student.phone,
    };
  }

  private safeSchool(school: {
    id: number;
    code: string;
    name: string;
    city: string | null;
    contact: string | null;
    coordinator: string | null;
    email: string | null;
    phone: string | null;
    passwordHash: string | null;
  }) {
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
    };
  }
}
