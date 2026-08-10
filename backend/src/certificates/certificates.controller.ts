import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CertificatesService } from './certificates.service';
import { CurrentUser, Roles } from '../auth/decorators';
import type { JwtPayload } from '../auth/auth.types';

@ApiTags('Certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certs: CertificatesService) {}

  @Roles('STUDENT')
  @Post('issue/:quizId')
  issue(
    @Param('quizId', ParseIntPipe) quizId: number,
    @CurrentUser('sub', ParseIntPipe) userId: number,
  ) {
    return this.certs.issue(userId, quizId);
  }

  @Roles('STUDENT')
  @Get('me')
  mine(@CurrentUser('sub', ParseIntPipe) userId: number) {
    return this.certs.listForStudent(userId);
  }

  @Roles('ADMIN')
  @Post('generate/:quizId')
  generate(@Param('quizId', ParseIntPipe) quizId: number) {
    return this.certs.generateForQuiz(quizId);
  }

  @Roles('STUDENT', 'COORDINATOR', 'ADMIN')
  @Get(':id/download')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const data = await this.certs.getForDownload(id);

    if (user.role === 'STUDENT' && Number(data.UserId) !== Number(user.sub)) {
      throw new ForbiddenException('Not your certificate');
    }
    if (user.role === 'COORDINATOR' && data.SchoolId !== user.schoolId) {
      throw new ForbiddenException('Not your school');
    }

    const pdf = await this.certs.renderPdf(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${data.CertificateNo}.pdf"`,
    });
    res.end(pdf);
  }
}
