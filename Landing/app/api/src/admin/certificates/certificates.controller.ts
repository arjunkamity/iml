import { Controller, Get, Header, Param, ParseIntPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ListQueryDto } from '../../common/list-query.dto';
import { AdminCertificatesService } from './certificates.service';

@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminCertificatesController {
  constructor(private readonly service: AdminCertificatesService) {}

  // Must come before ':certificateNumber/download' — a literal route has
  // to be registered ahead of a param route it would otherwise be
  // swallowed by ("sample" would just be matched as a certificateNumber).
  @Get('queue')
  queue(@Query() q: ListQueryDto) {
    return this.service.listQueue(q);
  }

  @Post('queue/:id/retry')
  retryQueueJob(@Param('id', ParseIntPipe) id: number) {
    return this.service.retryQueueJob(id);
  }

  @Get('sample/download')
  @Header('Content-Type', 'application/pdf')
  async downloadSample(@Res() res: Response) {
    const pdf = await this.service.downloadSamplePdf();
    res.setHeader('Content-Disposition', 'attachment; filename="sample-certificate.pdf"');
    res.send(pdf);
  }

  @Get(':certificateNumber/download')
  @Header('Content-Type', 'application/pdf')
  async download(@Param('certificateNumber') certificateNumber: string, @Res() res: Response) {
    const pdf = await this.service.downloadPdf(certificateNumber);
    res.setHeader('Content-Disposition', `attachment; filename="${certificateNumber}.pdf"`);
    res.send(pdf);
  }

  @Post(':certificateNumber/resend')
  resend(@Param('certificateNumber') certificateNumber: string) {
    return this.service.resendCertificateEmail(certificateNumber);
  }
}
