import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { hashToken } from '../common/report-access';
import { SITE_URL } from './panel-admin.service';
import { newToken } from '../common/report-access';

const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL = '12h';
const MAX_PASSWORD_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const MAX_CODE_TRIES = 5;

const GENERIC = 'That user ID and password do not match.';

// Panelist sign-in (#77): user ID (email or phone) and password, then a one-time code sent to the
// panelist's email AND phone (either one completes it). The result is a session of its own kind,
// "panel", which the admin, student and school endpoints refuse. Attempt counters live in memory
// (one API process), expiry and single use are in the OTP table.
@Injectable()
export class PanelAuthService {
  private readonly fails = new Map<number, { count: number; lockedUntil: number }>();
  private readonly codeTries = new Map<number, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly messaging: MessagingService,
  ) {}

  private async find(userId: string) {
    const id = userId.trim();
    if (!id) return null;
    const email = id.toLowerCase();
    const digits = id.replace(/\D/g, '');
    return this.prisma.panelist.findFirst({ where: { OR: [{ email }, ...(digits.length >= 8 ? [{ phone: id }, { phone: digits }] : [])] } });
  }

  private locked(id: number): boolean {
    const f = this.fails.get(id);
    return !!f && f.lockedUntil > Date.now();
  }

  private fail(id: number) {
    const f = this.fails.get(id) ?? { count: 0, lockedUntil: 0 };
    f.count += 1;
    if (f.count >= MAX_PASSWORD_FAILS) {
      f.lockedUntil = Date.now() + LOCK_MS;
      f.count = 0;
    }
    this.fails.set(id, f);
  }

  /** Step 1: user ID and password. Returns a challenge to carry to step 2; the code goes to email and phone. */
  async login(userId: string, password: string) {
    const p = await this.find(userId);
    if (!p) throw new UnauthorizedException(GENERIC);
    if (this.locked(p.id)) throw new ForbiddenException('Too many wrong passwords. Try again in 15 minutes.');
    if (p.status === 'Disabled') throw new ForbiddenException('This account is disabled. Contact the India Mind League team.');
    if (!p.passwordHash) throw new BadRequestException('Set your password with the link in your invitation email first.');
    let ok = false;
    try {
      ok = await argonVerify(p.passwordHash, password);
    } catch {
      ok = false;
    }
    if (!ok) {
      this.fail(p.id);
      throw new UnauthorizedException(GENERIC);
    }
    this.fails.delete(p.id);
    await this.prisma.otp.updateMany({ where: { email: p.email, purpose: 'panel-login', used: false }, data: { used: true } });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const otp = await this.prisma.otp.create({ data: { email: p.email, phone: p.phone, code, purpose: 'panel-login', expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
    void this.messaging.dispatch('PANEL_LOGIN_OTP', { email: p.email, phone: p.phone }, { OTP: code, Name: p.name });
    const challenge = await this.jwt.signAsync({ sub: p.id, otp: otp.id, purpose: 'panel-challenge' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: Math.floor(OTP_TTL_MS / 1000) });
    return { challenge, expiresIn: OTP_TTL_MS / 1000, sentTo: { email: true, phone: !!p.phone } };
  }

  /** Step 2: the one-time code. Either channel's copy is the same code. */
  async verify(challenge: string, code: string) {
    let payload: { sub: number; otp: number; purpose: string };
    try {
      payload = await this.jwt.verifyAsync(challenge, { secret: process.env.JWT_ACCESS_SECRET });
    } catch {
      throw new BadRequestException('This sign-in has expired. Start again.');
    }
    if (payload.purpose !== 'panel-challenge') throw new BadRequestException('This sign-in has expired. Start again.');
    const p = await this.prisma.panelist.findUnique({ where: { id: payload.sub } });
    if (!p || p.status !== 'Active') throw new ForbiddenException('This account cannot sign in.');
    const tries = (this.codeTries.get(payload.otp) ?? 0) + 1;
    this.codeTries.set(payload.otp, tries);
    if (tries > MAX_CODE_TRIES) {
      await this.prisma.otp.updateMany({ where: { id: payload.otp }, data: { used: true } });
      throw new ForbiddenException('Too many wrong codes. Start again.');
    }
    const otp = await this.prisma.otp.findFirst({ where: { id: payload.otp, purpose: 'panel-login', used: false }, orderBy: { id: 'desc' } });
    if (!otp) throw new BadRequestException('Invalid or expired code');
    // local development only: DEV_OTP_BYPASS is never set in production
    const bypass = process.env.DEV_OTP_BYPASS === 'true' && code.trim() === '123456';
    if (!bypass) {
      if (otp.code !== code.trim()) throw new BadRequestException('Invalid or expired code');
      if (otp.expiresAt.getTime() < Date.now()) throw new BadRequestException('That code has expired. Start again.');
    }
    await this.prisma.otp.update({ where: { id: otp.id }, data: { used: true } });
    this.codeTries.delete(payload.otp);
    await this.prisma.panelist.update({ where: { id: p.id }, data: { lastLoginAt: new Date() } });
    const accessToken = await this.jwt.signAsync({ sub: p.id, kind: 'panel' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: SESSION_TTL });
    return { accessToken, panelist: { id: p.id, code: p.code, name: p.name, email: p.email } };
  }

  /** From the invitation (or reset) link: the token and the new password. */
  async setPassword(token: string, password: string) {
    const p = await this.prisma.panelist.findFirst({ where: { inviteTokenHash: hashToken(token.trim()) } });
    if (!p || !p.inviteExpiresAt || p.inviteExpiresAt.getTime() < Date.now()) throw new BadRequestException('This link is not valid any more. Ask for a new invitation.');
    if (p.status === 'Disabled') throw new ForbiddenException('This account is disabled.');
    if (password.length < 8) throw new BadRequestException('Use at least 8 characters.');
    await this.prisma.panelist.update({ where: { id: p.id }, data: { passwordHash: await argonHash(password), status: 'Active', inviteTokenHash: null, inviteExpiresAt: null } });
    this.fails.delete(p.id);
    return { ok: true };
  }

  /** Forgot password: always answers the same, so it does not reveal who has an account. */
  async forgot(userId: string) {
    const p = await this.find(userId);
    if (p && p.status !== 'Disabled') {
      const token = newToken();
      await this.prisma.panelist.update({ where: { id: p.id }, data: { inviteTokenHash: hashToken(token), inviteExpiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
      void this.messaging.dispatch('PANEL_INVITE', { email: p.email, phone: p.phone }, { Name: p.name, InviteLink: `${SITE_URL}/panel/set-password/${token}`, Days: 1, Purpose: 'reset your password' });
    }
    return { ok: true };
  }
}
