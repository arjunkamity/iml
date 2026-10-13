import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import type { JwtPayload } from '../auth/auth.types';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Roles('STUDENT')
  @Post('initiate')
  initiate(
    @Body() dto: InitiatePaymentDto,
    @CurrentUser('sub', ParseIntPipe) userId: number,
  ) {
    return this.payments.initiate(userId, dto.purpose);
  }

  /** Paytm POSTs the transaction result here (application/x-www-form-urlencoded). */
  @Public()
  @Post('paytm/callback')
  async callback(@Body() body: Record<string, string>, @Res() res: Response) {
    const resultUrl = this.config.getOrThrow<string>('frontend.paymentResultUrl');
    try {
      const payment = await this.payments.handleCallback(body);
      const url = `${resultUrl}?orderId=${encodeURIComponent(payment.OrderId)}&status=${encodeURIComponent(payment.Status)}`;
      res.redirect(302, url);
    } catch {
      res.redirect(302, `${resultUrl}?status=ERROR`);
    }
  }

  @Roles('STUDENT')
  @Get('mine')
  mine(@CurrentUser('sub', ParseIntPipe) userId: number) {
    return this.payments.listMine(userId);
  }

  @Roles('STUDENT', 'ADMIN', 'COORDINATOR')
  @Get(':orderId/status')
  getStatus(@Param('orderId') orderId: string, @CurrentUser() user: JwtPayload) {
    return this.payments.getStatus(orderId, user);
  }

  @Roles('ADMIN')
  @Post(':orderId/reconcile')
  reconcile(@Param('orderId') orderId: string) {
    return this.payments.reconcile(orderId);
  }
}
