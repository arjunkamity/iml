import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshDto } from './dto/refresh.dto';
import { StudentLoginDto } from './dto/student-login.dto';
import { SchoolLoginDto } from './dto/school-login.dto';
import { SchoolFirstLoginDto, SchoolFirstLoginResendDto } from './dto/school-first-login.dto';
import { RequestSchoolRegisterOtpDto, SchoolRegisterDto } from './dto/school-register.dto';
import { ConsumeExamLinkDto } from './dto/consume-exam-link.dto';
import { ConsumeAccessTokenDto } from './dto/consume-access-token.dto';
import { ConsumeSchoolLinkDto } from './dto/consume-school-link.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto);
  }

  @Post('student/login')
  @HttpCode(HttpStatus.OK)
  studentLogin(@Body() dto: StudentLoginDto) {
    return this.auth.studentLogin(dto);
  }

  @Post('student/request-otp')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Post('student/verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Post('school/login')
  @HttpCode(HttpStatus.OK)
  schoolLogin(@Body() dto: SchoolLoginDto) {
    return this.auth.schoolLogin(dto);
  }

  @Post('school/link/consume')
  @HttpCode(HttpStatus.OK)
  consumeSchoolLink(@Body() dto: ConsumeSchoolLinkDto) {
    return this.auth.consumeSchoolLink(dto.token);
  }

  @Post('school/request-otp')
  @HttpCode(HttpStatus.OK)
  requestSchoolOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestSchoolOtp(dto);
  }

  @Post('school/verify-otp')
  @HttpCode(HttpStatus.OK)
  verifySchoolOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifySchoolOtp(dto);
  }

  @Post('school/first-login/complete')
  @HttpCode(HttpStatus.OK)
  completeSchoolFirstLogin(@Body() dto: SchoolFirstLoginDto) {
    return this.auth.completeSchoolFirstLogin(dto);
  }

  @Post('school/first-login/resend-otp')
  @HttpCode(HttpStatus.OK)
  resendSchoolFirstLoginOtp(@Body() dto: SchoolFirstLoginResendDto) {
    return this.auth.resendSchoolFirstLoginOtp(dto);
  }

  @Post('school/register/otp')
  @HttpCode(HttpStatus.OK)
  requestSchoolRegisterOtp(@Body() dto: RequestSchoolRegisterOtpDto) {
    return this.auth.requestSchoolRegisterOtp(dto);
  }

  @Post('school/register')
  @HttpCode(HttpStatus.OK)
  registerSchool(@Body() dto: SchoolRegisterDto) {
    return this.auth.registerSchool(dto);
  }

  @Post('exam-link/consume')
  @HttpCode(HttpStatus.OK)
  consumeExamLink(@Body() dto: ConsumeExamLinkDto) {
    return this.auth.consumeExamLink(dto.token);
  }

  @Post('student/access-token/consume')
  @HttpCode(HttpStatus.OK)
  consumeStudentAccessToken(@Body() dto: ConsumeAccessTokenDto) {
    return this.auth.consumeStudentAccessToken(dto.sid, dto.token);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    if (user.kind === 'admin') {
      const admin = await this.auth.adminProfile(user.sub);
      return { admin };
    }
    if (user.kind === 'school') {
      const school = await this.auth.schoolProfile(user.sub);
      return { school };
    }
    const student = await this.auth.studentProfile(user.sub);
    return { student };
  }
}
