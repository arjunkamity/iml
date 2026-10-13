import { Body, Controller, Get, Param, ParseIntPipe, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuard } from '../auth/guards/student.guard';
import { SchoolGuard } from '../auth/guards/school.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ScorecardAccessService } from './scorecard-access.service';

const pdf = (data: Buffer, filename: string) => new StreamableFile(data, { type: 'application/pdf', disposition: `attachment; filename="${filename}"` });

class ConsentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  audience!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  season!: string;

  @IsBoolean()
  accept!: boolean;
}

class OpenLinkDto {
  @IsString()
  @MaxLength(12)
  code!: string;
}

// The student's own released reports. The student always comes from the sign-in, never from the request.
@Controller('student/reports')
@UseGuards(JwtAuthGuard, StudentGuard)
export class StudentReportsController {
  constructor(private readonly access: ScorecardAccessService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload) {
    return this.access.forStudent(Number(u.sub));
  }
  @Get('consent')
  consent(@CurrentUser() u: JwtPayload) {
    return this.access.consentState(Number(u.sub));
  }
  @Post('consent')
  setConsent(@CurrentUser() u: JwtPayload, @Body() dto: ConsentDto) {
    return this.access.setConsent(Number(u.sub), dto.audience, dto.accept, dto.season);
  }
  @Get(':id/download')
  async download(@CurrentUser() u: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    const r = await this.access.downloadForStudent(Number(u.sub), id);
    return pdf(r.data, r.filename);
  }
}

// A school sees released reports of its own students whose consent allows it.
@Controller('school/reports')
@UseGuards(JwtAuthGuard, SchoolGuard)
export class SchoolReportsController {
  constructor(private readonly access: ScorecardAccessService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload) {
    return this.access.forSchool(Number(u.sub));
  }
  @Get(':id/download')
  async download(@CurrentUser() u: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    const r = await this.access.downloadForSchool(Number(u.sub), id);
    return pdf(r.data, r.filename);
  }
}

// The secure link a parent receives. No sign-in: the long random link plus a 6-digit code
// (sent with it) open the report; wrong codes lock the link.
@Controller('public/scorecard-links')
export class PublicReportLinksController {
  constructor(private readonly access: ScorecardAccessService) {}

  @Get(':token')
  info(@Param('token') token: string) {
    return this.access.linkInfo(token);
  }
  @Post(':token/open')
  async open(@Param('token') token: string, @Body() dto: OpenLinkDto) {
    const r = await this.access.openLink(token, dto.code);
    return pdf(r.data, r.filename);
  }
}
