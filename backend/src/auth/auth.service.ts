import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import type { JwtPayload, RoleCode } from './auth.types';

interface UserRow {
  UserId: number;
  RoleCode: RoleCode;
  SchoolId: number | null;
  FullName: string;
  PasswordHash: string | null;
  Status: string;
}

interface OtpRow {
  OtpId: number;
  CodeHash: string;
  ExpiresAt: Date;
  AttemptCount: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private issueToken(u: {
    UserId: number;
    RoleCode: RoleCode;
    SchoolId: number | null;
    FullName: string;
  }) {
    const payload: JwtPayload = {
      sub: u.UserId,
      role: u.RoleCode,
      schoolId: u.SchoolId,
      name: u.FullName,
    };
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: u.UserId,
        role: u.RoleCode,
        schoolId: u.SchoolId,
        name: u.FullName,
      },
    };
  }

  /** Password login for Admin / Coordinator. */
  async login(email: string, password: string) {
    const user = await this.db.queryOne<UserRow>(
      `SELECT u.UserId, r.Code AS RoleCode, u.SchoolId, u.FullName, u.PasswordHash, u.Status
         FROM dbo.Users u
         JOIN dbo.Roles r ON r.RoleId = u.RoleId
        WHERE u.Email = @email`,
      { email },
    );
    if (!user || !user.PasswordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.Status !== 'Active') {
      throw new UnauthorizedException('Account is not active');
    }
    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.db.query(
      `UPDATE dbo.Users SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @id`,
      { id: user.UserId },
    );
    return this.issueToken(user);
  }

  /** Generate + store an OTP. In dev the code is logged and returned. */
  async requestOtp(
    target: string,
    channel: 'SMS' | 'Email',
    purpose: 'Registration' | 'Login',
  ) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const ttl = this.config.getOrThrow<number>('otp.ttlSeconds');
    const codeHash = await bcrypt.hash(code, 8);

    await this.db.query(
      `INSERT INTO dbo.OtpRequests (Target, Channel, Purpose, CodeHash, ExpiresAt)
       VALUES (@target, @channel, @purpose, @codeHash, DATEADD(second, @ttl, SYSUTCDATETIME()))`,
      { target, channel, purpose, codeHash, ttl },
    );

    // TODO(prod): send via MSG91/Twilio (SMS) or email provider; never return the code.
    this.logger.log(`OTP for ${target} (${purpose}): ${code}`);
    return { sent: true, devCode: code };
  }

  /** Validate and consume an OTP for a target. Throws on any failure. */
  async consumeOtp(target: string, code: string): Promise<void> {
    const otp = await this.db.queryOne<OtpRow>(
      `SELECT TOP 1 OtpId, CodeHash, ExpiresAt, AttemptCount
         FROM dbo.OtpRequests
        WHERE Target = @target AND ConsumedAt IS NULL
        ORDER BY CreatedAt DESC`,
      { target },
    );
    if (!otp) throw new BadRequestException('No active OTP for this target');
    if (new Date(otp.ExpiresAt).getTime() < Date.now()) {
      throw new BadRequestException('OTP has expired');
    }
    if (otp.AttemptCount >= 5) {
      throw new BadRequestException('Too many attempts; request a new OTP');
    }

    const ok = await bcrypt.compare(code, otp.CodeHash);
    if (!ok) {
      await this.db.query(
        `UPDATE dbo.OtpRequests SET AttemptCount = AttemptCount + 1 WHERE OtpId = @id`,
        { id: otp.OtpId },
      );
      throw new BadRequestException('Invalid OTP');
    }

    await this.db.query(
      `UPDATE dbo.OtpRequests SET ConsumedAt = SYSUTCDATETIME() WHERE OtpId = @id`,
      { id: otp.OtpId },
    );
  }

  /** Verify an OTP. If a user already exists for the target, log them in. */
  async verifyOtp(target: string, code: string) {
    await this.consumeOtp(target, code);

    const user = await this.db.queryOne<UserRow>(
      `SELECT u.UserId, r.Code AS RoleCode, u.SchoolId, u.FullName, u.PasswordHash, u.Status
         FROM dbo.Users u
         JOIN dbo.Roles r ON r.RoleId = u.RoleId
        WHERE u.Phone = @target OR u.Email = @target`,
      { target },
    );
    if (user) {
      return { verified: true, isNewUser: false, ...this.issueToken(user) };
    }
    // New participant — frontend proceeds to student registration.
    return { verified: true, isNewUser: true };
  }

  /** Issue a token for an existing user id (used after student registration). */
  async issueTokenForUserId(userId: number) {
    const user = await this.db.queryOne<UserRow>(
      `SELECT u.UserId, r.Code AS RoleCode, u.SchoolId, u.FullName, u.PasswordHash, u.Status
         FROM dbo.Users u
         JOIN dbo.Roles r ON r.RoleId = u.RoleId
        WHERE u.UserId = @id`,
      { id: userId },
    );
    if (!user) throw new UnauthorizedException('User not found');
    return this.issueToken(user);
  }
}
