import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { PaytmService } from './paytm.service';
import type { JwtPayload } from '../auth/auth.types';
import type { PaymentPurpose, PaymentRow, PaymentStatus } from './payment.types';

interface StudentContact {
  Email: string | null;
  Phone: string | null;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly paytm: PaytmService,
    private readonly config: ConfigService,
  ) {}

  private amountFor(purpose: PaymentPurpose): number {
    const amount = this.config.get<number>(`paytm.fees.${purpose}`);
    if (!amount || amount <= 0) {
      throw new BadRequestException(`No fee configured for ${purpose}`);
    }
    return amount;
  }

  private generateOrderId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = randomBytes(4).toString('hex').toUpperCase();
    return `IML${ts}${rand}`;
  }

  /** Create a Payments row and return the Paytm Web Checkout form params. */
  async initiate(userId: number, purpose: PaymentPurpose) {
    const amount = this.amountFor(purpose);
    const contact = await this.db.queryOne<StudentContact>(
      `SELECT Email, Phone FROM dbo.Users WHERE UserId = @id`,
      { id: userId },
    );
    if (!contact) throw new NotFoundException('User not found');

    const orderId = this.generateOrderId();
    await this.db.query(
      `INSERT INTO dbo.Payments (OrderId, UserId, Purpose, Amount, Status)
       VALUES (@orderId, @userId, @purpose, @amount, N'CREATED')`,
      { orderId, userId, purpose, amount },
    );

    const init = await this.paytm.buildInitParams({
      MID: this.config.getOrThrow<string>('paytm.merchantId'),
      ORDER_ID: orderId,
      CUST_ID: String(userId),
      INDUSTRY_TYPE_ID: this.config.getOrThrow<string>('paytm.industryTypeId'),
      CHANNEL_ID: this.config.getOrThrow<string>('paytm.channelId'),
      TXN_AMOUNT: amount.toFixed(2),
      WEBSITE: this.config.getOrThrow<string>('paytm.website'),
      CALLBACK_URL: this.config.getOrThrow<string>('paytm.callbackUrl'),
      EMAIL: contact.Email ?? undefined,
      MOBILE_NO: contact.Phone ?? undefined,
    });

    return {
      orderId,
      amount,
      action: this.config.getOrThrow<string>('paytm.requestUrl'),
      params: init,
    };
  }

  /** Map Paytm's v3 resultStatus to our stored Status. */
  private mapStatus(resultStatus: string): PaymentStatus {
    if (resultStatus === 'TXN_SUCCESS') return 'SUCCESS';
    if (resultStatus === 'TXN_FAILURE') return 'FAILED';
    return 'PENDING';
  }

  /**
   * The single source of truth for "what actually happened": always re-checks
   * with Paytm's Order Status API rather than trusting a caller-supplied status,
   * then persists the result. Safe to call repeatedly (idempotent).
   */
  private async refreshFromPaytm(orderId: string): Promise<PaymentRow> {
    const existing = await this.db.queryOne<PaymentRow>(
      `SELECT * FROM dbo.Payments WHERE OrderId = @orderId`,
      { orderId },
    );
    if (!existing) throw new NotFoundException('Payment not found');

    const result = await this.paytm.fetchOrderStatus(orderId);
    const status = this.mapStatus(result.resultStatus);

    await this.db.query(
      `UPDATE dbo.Payments SET
         Status = @status,
         PaytmTxnId = @txnId,
         PaytmBankTxnId = @bankTxnId,
         PaymentMode = @paymentMode,
         BankName = @bankName,
         TxnDate = TRY_CONVERT(datetime2(3), @txnDate),
         ResponseCode = @respCode,
         ResponseMsg = @respMsg,
         GatewayResponse = @raw,
         UpdatedAt = SYSUTCDATETIME()
       WHERE OrderId = @orderId`,
      {
        orderId,
        status,
        txnId: result.txnId ?? null,
        bankTxnId: result.bankTxnId ?? null,
        paymentMode: result.paymentMode ?? null,
        bankName: result.bankName ?? null,
        txnDate: result.txnDate ?? null,
        respCode: result.resultCode ?? null,
        respMsg: result.resultMsg ?? null,
        raw: JSON.stringify(result.raw),
      },
    );

    this.logger.log(`Payment ${orderId} -> ${status} (${result.resultCode ?? ''} ${result.resultMsg ?? ''})`);
    return { ...existing, Status: status };
  }

  /**
   * Handle Paytm's callback POST. The checksum only proves the payload came
   * from Paytm at some point — it is not trusted as the final word on the
   * transaction outcome. We always re-verify against the Order Status API.
   */
  async handleCallback(body: Record<string, string>): Promise<PaymentRow> {
    const orderId = body['ORDERID'];
    if (!orderId) throw new BadRequestException('Missing ORDERID in callback');

    const validChecksum = await this.paytm.verifyCallback(body);
    if (!validChecksum) {
      this.logger.warn(`Callback checksum failed to verify for order ${orderId}`);
    }
    return this.refreshFromPaytm(orderId);
  }

  /** Admin/manual re-check against Paytm — useful for stuck/pending orders. */
  async reconcile(orderId: string): Promise<PaymentRow> {
    return this.refreshFromPaytm(orderId);
  }

  /** All of the current student's payments, most recent first. */
  async listMine(userId: number): Promise<PaymentRow[]> {
    return this.db.query<PaymentRow>(
      `SELECT * FROM dbo.Payments WHERE UserId = @userId ORDER BY CreatedAt DESC`,
      { userId },
    );
  }

  async getStatus(orderId: string, user: JwtPayload): Promise<PaymentRow> {
    const row = await this.db.queryOne<PaymentRow>(
      `SELECT p.*, u.SchoolId AS PayerSchoolId
         FROM dbo.Payments p
         JOIN dbo.Users u ON u.UserId = p.UserId
        WHERE p.OrderId = @orderId`,
      { orderId },
    );
    if (!row) throw new NotFoundException('Payment not found');

    const payerSchoolId = (row as PaymentRow & { PayerSchoolId: number | null }).PayerSchoolId;
    // UserId is BIGINT — mssql returns it as a string, so compare numerically.
    if (user.role === 'STUDENT' && Number(row.UserId) !== Number(user.sub)) {
      throw new ForbiddenException('Not your payment');
    }
    if (user.role === 'COORDINATOR' && payerSchoolId !== user.schoolId) {
      throw new ForbiddenException('Not your school');
    }
    return row;
  }
}
