/** What the student/parent is paying for. Amounts are looked up server-side
 *  from config (paytm.fees) — never trust an amount from the client. */
export const PAYMENT_PURPOSES = ['STAGE1_REGISTRATION', 'STAGE3_BOOTCAMP'] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface PaymentRow {
  PaymentId: number;
  OrderId: string;
  UserId: number;
  Purpose: PaymentPurpose;
  Amount: number;
  Currency: string;
  Status: PaymentStatus;
  PaytmTxnId: string | null;
  PaytmBankTxnId: string | null;
  PaymentMode: string | null;
  BankName: string | null;
  TxnDate: string | Date | null;
  ResponseCode: string | null;
  ResponseMsg: string | null;
  CreatedAt: string | Date;
  UpdatedAt: string | Date;
}
