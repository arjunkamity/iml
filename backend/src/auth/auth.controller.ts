import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { CurrentUser, Public } from './decorators';
import type { JwtPayload } from './auth.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.target, dto.channel, dto.purpose);
  }

  @Public()
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.target, dto.code);
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
