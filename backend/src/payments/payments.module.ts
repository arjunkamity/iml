import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaytmService } from './paytm.service';
import { PaymentsController } from './payments.controller';

@Module({
  providers: [PaymentsService, PaytmService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
