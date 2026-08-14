import { IsIn } from 'class-validator';
import { PAYMENT_PURPOSES } from '../payment.types';
import type { PaymentPurpose } from '../payment.types';

export class InitiatePaymentDto {
  @IsIn(PAYMENT_PURPOSES)
  purpose!: PaymentPurpose;
}
