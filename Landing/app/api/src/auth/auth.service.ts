import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { verify as argonVerify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshDto } from './dto/refresh.dto';
import { StudentLoginDto } from './dto/student-login.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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
    return { ...tokens, admin: this.safeAdmin(admin) };
  }

  async adminProfile(adminId: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new UnauthorizedException('Admin not found');
    const modules = await this.prisma.adminModule.findMany({
      where: { adminId },
      select: { moduleCode: true },
    });
    return {
      ...this.safeAdmin(admin),
      modules: modules.map((m) => m.moduleCode),
    };
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

    const tokens = await this.issueTokens({ sub: student.id, kind: 'student' });
    return { ...tokens, student: this.safeStudent(student) };
  }

  // ---- student OTP (dev stub: code returned in response + logged) ----
  async requestOtp({ email }: RequestOtpDto) {
    const normalized = email.toLowerCase().trim();
    const student = await this.prisma.student.findFirst({
      where: { email: normalized },
    });
    if (!student)
      throw new NotFoundException('No student account found for that email');

    await this.prisma.otp.updateMany({
      where: { email: normalized, purpose: 'login', used: false },
      data: { used: true },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.otp.create({
      data: {
        email: normalized,
        code,
        purpose: 'login',
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    console.log(`[IML dev-otp] ${student.code} <${normalized}> code=${code}`);

    return {
      devCode: code,
      expiresIn: OTP_TTL_MS / 1000,
      hint: 'Dev stub — remove devCode from the response before production.',
    };
  }

  async verifyOtp({ email, code }: VerifyOtpDto) {
    const normalized = email.toLowerCase().trim();
    const otp = await this.prisma.otp.findFirst({
      where: { email: normalized, purpose: 'login', used: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.code !== code.trim()) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP has expired');
    }
    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { used: true },
    });

    const student = await this.prisma.student.findFirst({
      where: { email: normalized },
    });
    if (!student) throw new UnauthorizedException('Student not found');

    const tokens = await this.issueTokens({ sub: student.id, kind: 'student' });
    return { ...tokens, student: this.safeStudent(student) };
  }

  async studentProfile(studentId: number) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new UnauthorizedException('Student not found');
    return this.safeStudent(student);
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
    return { ...tokens, admin: this.safeAdmin(admin) };
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
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TTL },
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

  private safeAdmin(admin: {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
  }) {
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
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
}
