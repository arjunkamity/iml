import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Browser } from 'playwright';
import { PrismaService } from '../../prisma/prisma.service';
import { CertificateQueueService } from '../../certificates/certificate-queue.service';
import { launchBrowser } from '../../scorecard/report-renderer';
import { MAX_REPORT_ATTEMPTS, ScorecardReportService } from './report.service';

/**
 * Drains the scorecard report queue (#73): one report at a time, in order, and — like the
 * certificate queue — only while no exam is open anywhere, because printing a PDF starts a
 * real headless Chromium that would otherwise compete with live exam traffic. One browser
 * is shared by a whole drain. A failed report is retried a few times, then marked Failed
 * with the reason so an admin can see it and retry.
 */
@Injectable()
export class ScorecardReportQueueService implements OnModuleInit {
  private readonly logger = new Logger(ScorecardReportQueueService.name);
  private draining = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ScorecardReportService,
    private readonly certificateQueue: CertificateQueueService,
  ) {}

  /** A report left "Generating" by a restart goes back in the queue. */
  async onModuleInit(): Promise<void> {
    try {
      const r = await this.prisma.scorecardReport.updateMany({ where: { status: 'Generating' }, data: { status: 'Queued' } });
      if (r.count) this.logger.warn(`Re-queued ${r.count} report(s) that were mid-generation at startup`);
    } catch (err) {
      this.logger.error(`Could not recover generating reports: ${String(err)}`);
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    let browser: Browser | null = null;
    try {
      if (!(await this.prisma.scorecardReport.count({ where: { status: 'Queued' } }))) return;
      if (await this.certificateQueue.isAnyExamRunning()) return;
      browser = await launchBrowser();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const job = await this.claimNext();
        if (!job) break;
        await this.processOne(job.id, job.attempts, browser);
        if (await this.certificateQueue.isAnyExamRunning()) break; // a window opened mid-drain
      }
    } catch (err) {
      this.logger.error(`Report queue drain failed: ${String(err)}`);
    } finally {
      this.draining = false;
      if (browser) await browser.close().catch(() => undefined);
    }
  }

  private async claimNext() {
    const next = await this.prisma.scorecardReport.findFirst({ where: { status: 'Queued' }, orderBy: { id: 'asc' }, select: { id: true } });
    if (!next) return null;
    // One worker in this deployment, so a plain read-then-write is enough.
    return this.prisma.scorecardReport.update({ where: { id: next.id }, data: { status: 'Generating' }, select: { id: true, attempts: true } });
  }

  private async processOne(id: number, attempts: number, browser: Browser): Promise<void> {
    try {
      await this.reports.generateOne(id, browser);
      this.logger.log(`Generated scorecard report ${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const used = attempts + 1;
      const done = used >= MAX_REPORT_ATTEMPTS;
      this.logger.error(`Scorecard report ${id} failed (attempt ${used}/${MAX_REPORT_ATTEMPTS}): ${message}`);
      await this.prisma.scorecardReport.update({
        where: { id },
        data: { status: done ? 'Failed' : 'Queued', attempts: used, lastError: message.slice(0, 1000) },
      });
    }
  }
}
