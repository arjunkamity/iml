import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { formatIstDate } from '../common/util';
import { PaytmService, PaytmOrderStatus } from './paytm.service';

type ReconcilablePayment = {
  code: string;
  registrationId: number;
  stageId: number | null;
  amount: Prisma.Decimal;
  registration: { code: string; student: { id: number; name: string; email: string | null; phone: string | null } };
};

/**
 * Paytm's classic Web Checkout callback is delivered by the STUDENT'S OWN
 * BROWSER redirecting back to us after paying — not a true server-to-
 * server webhook. If that final round-trip never completes (closed tab,
 * paid via a separate UPI app like GPay/PhonePe and never returned,
 * network dropped), the payment can succeed OR fail on Paytm's side and
 * we simply never hear about it either way — the row sits "Pending"
 * forever with nothing to correct it (this is exactly what happened to
 * PAY-1028 and 6 others found and fixed by hand on 2026-09-10).
 *
 * This closes that gap for good: every few minutes, ask Paytm's own
 * Order Status API — the authoritative source, see
 * PaytmService.fetchOrderStatus — about every Paytm payment that's been
 * Pending longer than a short grace window, and apply whatever actually
 * happened. Same update shape as PublicService.paytmCallback() (which
 * delegates to applyResult() below so both paths can never drift apart)
 * — the callback handles the fast/common case, this catches whatever it
 * missed.
 */
@Injectable()
export class PaymentReconcileService {
  private readonly logger = new Logger(PaymentReconcileService.name);
  private running = false;

  // Give the callback its normal chance first — a payment only a minute
  // or two old might still get its redirect any second; no need to race it.
  private static readonly GRACE_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paytm: PaytmService,
    private readonly messaging: MessagingService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick(): Promise<void> {
    // A previous run can still be going (many pending + slow Paytm API) —
    // never overlap two reconciliation passes.
    if (this.running) return;
    this.running = true;
    try {
      await this.reconcileAll();
    } catch (err) {
      this.logger.error(`Payment reconciliation failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  async reconcileAll(): Promise<{ checked: number; corrected: number }> {
    const cutoff = new Date(Date.now() - PaymentReconcileService.GRACE_MS);
    const pending = await this.prisma.payment.findMany({
      where: { mode: 'Paytm', status: 'Pending', createdAt: { lt: cutoff } },
      include: { registration: { include: { student: true } } },
    });

    let corrected = 0;
    for (const payment of pending) {
      try {
        const result = await this.paytm.fetchOrderStatus(payment.code);
        if (await this.applyResult(payment, result)) corrected++;
      } catch (err) {
        this.logger.warn(`Reconcile check failed for ${payment.code}: ${String(err)}`);
      }
    }
    if (pending.length) {
      this.logger.log(`Payment reconciliation: checked ${pending.length}, corrected ${corrected}.`);
    }
    return { checked: pending.length, corrected };
  }

  /** Applies one Paytm Order Status result to its Payment row — shared by
   * the reconciliation sweep above and PublicService.paytmCallback().
   * Returns false (no-op, left Pending) if Paytm itself still says
   * PENDING — never guess in that case, just leave it for the next pass. */
  async applyResult(payment: ReconcilablePayment, result: PaytmOrderStatus): Promise<boolean> {
    const status = result.resultStatus === 'TXN_SUCCESS' ? 'Paid' : result.resultStatus === 'TXN_FAILURE' ? 'Failed' : 'Pending';
    if (status === 'Pending') return false;

    await this.prisma.payment.update({
      where: { code: payment.code },
      data: { status, providerTxn: result.txnId ?? null, paidAt: status === 'Paid' ? new Date() : null },
    });

    if (status === 'Paid' && payment.stageId) {
      await this.prisma.registrationStage.updateMany({
        where: { registrationId: payment.registrationId, stageId: payment.stageId },
        data: { status: 'Paid', paidAt: new Date() },
      });
    }

    const student = payment.registration.student;
    void this.messaging.dispatch(
      status === 'Paid' ? 'PAYMENT_SUCCESSFUL' : 'PAYMENT_FAILED',
      { email: student.email, phone: student.phone },
      {
        StudentName: student.name,
        RegID: payment.registration.code,
        Amount: payment.amount.toString(),
        TransactionID: result.txnId ?? '',
        PaymentDate: formatIstDate(),
        DashboardLink: 'https://indiamindleague.com/account/payments',
        PaymentLink: 'https://indiamindleague.com/account/payments',
      },
    );

    return true;
  }
}
