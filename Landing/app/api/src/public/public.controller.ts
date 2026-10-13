import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PublicService } from './public.service';
import { PublicRegisterDto, RequestRegisterOtpDto, SubmitDemoExamDto } from './public.dto';

@Controller('public')
export class PublicController {
  constructor(private readonly service: PublicService) {}

  @Post('register/otp')
  requestRegisterOtp(@Body() dto: RequestRegisterOtpDto) {
    return this.service.requestRegisterOtp(dto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: PublicRegisterDto) {
    return this.service.register(dto);
  }

  @Get('competitions')
  competitions() {
    return this.service.competitions();
  }

  @Get('grades')
  grades() {
    return this.service.grades();
  }

  @Get('schools')
  schools() {
    return this.service.schools();
  }

  @Get('leaderboard')
  leaderboard(@Query() q: { comp?: string }) {
    return this.service.leaderboard(q.comp);
  }

  @Get('leaderboard/schools')
  leaderboardSchools(@Query() q: { comp?: string }) {
    return this.service.leaderboardSchools(q.comp);
  }

  @Get('leaderboard/exists')
  leaderboardExists() {
    return this.service.leaderboardHasEntries().then((hasEntries) => ({ hasEntries }));
  }

  @Get('gallery')
  gallery() {
    return this.service.gallery();
  }

  @Get('news')
  news() {
    return this.service.news();
  }

  @Get('announcements')
  announcements() {
    return this.service.announcements();
  }

  @Get('faqs')
  faqs() {
    return this.service.faqs();
  }

  @Get('settings')
  settings() {
    return this.service.siteSettings();
  }

  @Get('demo-exam')
  demoExam() {
    return this.service.getDemoExam();
  }

  @Post('demo-exam/submit')
  @HttpCode(HttpStatus.OK)
  submitDemoExam(@Body() dto: SubmitDemoExamDto) {
    return this.service.submitDemoExam(dto);
  }

  @Get('scorecard-reports/verify/:code')
  verifyScorecardReport(@Param('code') code: string) {
    return this.service.verifyScorecardReport(code);
  }

  @Get('certificates/verify/:certificateNumber')
  verifyCertificate(@Param('certificateNumber') certificateNumber: string) {
    return this.service.verifyCertificate(certificateNumber);
  }

  @Get('certificates/:certificateNumber/download')
  @Header('Content-Type', 'application/pdf')
  async downloadCertificate(@Param('certificateNumber') certificateNumber: string, @Res() res: Response) {
    const pdf = await this.service.downloadCertificatePdf(certificateNumber);
    res.setHeader('Content-Disposition', `attachment; filename="${certificateNumber}.pdf"`);
    res.send(pdf);
  }

  /** Paytm POSTs the transaction result here (application/x-www-form-urlencoded). */
  @Post('payments/paytm/callback')
  async paytmCallback(@Body() body: Record<string, string>, @Res() res: Response) {
    const resultUrl = process.env.FRONTEND_PAYMENT_RESULT_URL ?? '/account/payments';
    try {
      const { orderId, status } = await this.service.paytmCallback(body);
      res.redirect(302, `${resultUrl}?orderId=${encodeURIComponent(orderId)}&status=${encodeURIComponent(status)}`);
    } catch {
      res.redirect(302, `${resultUrl}?status=ERROR`);
    }
  }
}
