import { Module } from '@nestjs/common';
import { PaytmService } from './paytm.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [MessagingModule],
  providers: [PaytmService, PaymentReconcileService],
  exports: [PaytmService, PaymentReconcileService],
})
export class PaymentsModule {}
