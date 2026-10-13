import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService, TemplateVars } from '../../messaging/messaging.service';

const MAX_ATTEMPTS = 3;
// How many recipients one tick sends — the real throttle here. Falconide
// has no documented rate limit, so this stays deliberately conservative
// (roughly 90/min at the 10s cadence below) rather than firing hundreds of
// concurrent requests at a provider that's never been load-tested from
// this side.
const BATCH_SIZE = 15;

/**
 * Drains the Mass Email queue (see Broadcast/BroadcastRecipient in
 * schema.prisma) a small batch at a time — mirrors CertificateQueueService's
 * queue-table-plus-cron shape, but paced by BATCH_SIZE instead of gated on
 * an exam window (an email send is cheap; there's nothing here to compete
 * with a live exam for). BroadcastService.send() only ever materializes the
 * Pending rows; this is the only place that actually calls out to
 * MessagingService for a broadcast.
 */
@Injectable()
export class BroadcastQueueService {
  private readonly logger = new Logger(BroadcastQueueService.name);
  private draining = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async tick(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const batch = await this.claimBatch();
      for (const r of batch) {
        await this.processOne(r);
      }
      if (batch.length) await this.settleFinishedBroadcasts();
    } catch (err) {
      this.logger.error(`Broadcast queue drain failed: ${String(err)}`);
    } finally {
      this.draining = false;
    }
  }

  private async claimBatch() {
    const pending = await this.prisma.broadcastRecipient.findMany({
      where: { status: 'Pending' },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      include: { broadcast: { select: { code: true, subject: true, body: true } } },
    });
    if (!pending.length) return [];
    // Single pm2 process (see CertificateQueueService's own note) — a
    // plain read-then-write claim is enough, no SELECT ... FOR UPDATE.
    await this.prisma.broadcastRecipient.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { status: 'Processing' },
    });
    return pending;
  }

  private async processOne(r: {
    id: number;
    email: string;
    vars: Prisma.JsonValue;
    attempts: number;
    broadcast: { code: string; subject: string; body: string };
  }): Promise<void> {
    const attempts = r.attempts + 1;
    try {
      const vars = (r.vars && typeof r.vars === 'object' ? r.vars : {}) as TemplateVars;
      const ok = await this.messaging.dispatchCustom(
        `BROADCAST:${r.broadcast.code}`,
        { email: r.email },
        r.broadcast.subject,
        r.broadcast.body,
        vars,
      );
      if (ok) {
        await this.prisma.broadcastRecipient.update({
          where: { id: r.id },
          data: { status: 'Sent', attempts, processedAt: new Date() },
        });
        await this.prisma.broadcast.update({
          where: { code: r.broadcast.code },
          data: { sentCount: { increment: 1 } },
        });
      } else {
        throw new Error('MessagingService.dispatchCustom returned false — see MessageLog for the provider response');
      }
    } catch (err) {
      const lastError = String(err instanceof Error ? err.message : err).slice(0, 2000);
      const failed = attempts >= MAX_ATTEMPTS;
      await this.prisma.broadcastRecipient.update({
        where: { id: r.id },
        data: { status: failed ? 'Failed' : 'Pending', attempts, lastError },
      });
      if (failed) {
        await this.prisma.broadcast.update({
          where: { code: r.broadcast.code },
          data: { failedCount: { increment: 1 } },
        });
      }
      this.logger.error(`Broadcast recipient ${r.id} (${r.broadcast.code}) failed (attempt ${attempts}): ${lastError}`);
    }
  }

  /** A broadcast whose recipients are all Sent/Failed (none left Pending
   * or Processing) is done — flip it from Sending to Sent so the admin
   * list stops showing it as in-progress. Runs after every batch that
   * touched at least one row, cheap enough not to bother gating further. */
  private async settleFinishedBroadcasts(): Promise<void> {
    const sending = await this.prisma.broadcast.findMany({
      where: { status: 'Sending' },
      select: { id: true, code: true },
    });
    for (const b of sending) {
      const outstanding = await this.prisma.broadcastRecipient.count({
        where: { broadcastId: b.id, status: { in: ['Pending', 'Processing'] } },
      });
      if (outstanding === 0) {
        await this.prisma.broadcast.update({ where: { id: b.id }, data: { status: 'Sent', sentAt: new Date() } });
      }
    }
  }
}
