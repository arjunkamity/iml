import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { examWindow } from '../common/util';
import { CertificateIssuanceService } from './certificate-issuance.service';

const MAX_ATTEMPTS = 3;
// Exported so the admin "resend certificate email" action (see
// AdminCertificatesService.resendCertificateEmail) can build the exact
// same CertificateLink without duplicating the domain/path.
export const CERTIFICATE_DOWNLOAD_BASE_URL = 'https://indiamindleague.com/api/v1/public/certificates';

/**
 * Drains the certificate send queue (see CertificateJob in schema.prisma)
 * — one job at a time, and ONLY while no exam is currently open anywhere
 * on the platform. Rendering a certificate launches a real headless
 * Chromium instance; doing that on the same server that's serving a live
 * exam's per-second timers and tab-switch guard would compete for CPU with
 * the thing that actually matters in that moment. Enqueuing (see
 * StudentService.submitExam) stays instant either way — this worker is
 * purely about WHEN the heavy rendering work actually happens.
 */
@Injectable()
export class CertificateQueueService {
  private readonly logger = new Logger(CertificateQueueService.name);
  private draining = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly issuance: CertificateIssuanceService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick(): Promise<void> {
    // A previous drain can still be running past this tick's 5s boundary
    // (e.g. a slow render) — never overlap two drains on top of each other.
    if (this.draining) return;
    this.draining = true;
    try {
      if (await this.isAnyExamRunning()) return;
      // Once clear to run, drain the whole backlog now rather than one
      // job per tick — there's no live-exam contention to pace around at
      // this moment, and the queue should still catch up promptly after
      // a busy batch window closes.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const job = await this.claimNextPending();
        if (!job) break;
        await this.processOne(job);
        if (await this.isAnyExamRunning()) break; // a new window opened mid-drain
      }
    } catch (err) {
      this.logger.error(`Queue drain failed: ${String(err)}`);
    } finally {
      this.draining = false;
    }
  }

  /** True if any Live or Scheduled exam has a currently-open window (its
   * own date/time+duration, or — when it has batches — any batch's own
   * window). Mirrors the same gating StudentService applies to a single
   * student's start/schedules, just answered for "any at all".
   *
   * Deliberately window-checks 'Live' exams too, not just 'Scheduled' —
   * an earlier version trusted the status column alone and blocked the
   * queue for good the moment one exam's status was left on Live past its
   * actual end time (no auto-transition flips it back), silently wedging
   * every certificate platform-wide indefinitely. Real status is still
   * used to select candidates; the window decides whether it actually
   * matters right now. */
  async isAnyExamRunning(): Promise<boolean> {
    const exams = await this.prisma.exam.findMany({
      where: { status: { in: ['Live', 'Scheduled'] } },
      select: {
        date: true,
        time: true,
        durationMin: true,
        batches: { select: { startAt: true, durationMin: true } },
      },
    });
    const now = Date.now();
    for (const exam of exams) {
      if (exam.batches.length) {
        for (const b of exam.batches) {
          const end = b.startAt.getTime() + b.durationMin * 60 * 1000;
          if (now >= b.startAt.getTime() && now <= end) return true;
        }
      } else {
        const win = examWindow(exam);
        if (win && now >= win.start.getTime() && now <= win.end.getTime()) return true;
      }
    }
    return false;
  }

  private async claimNextPending() {
    const next = await this.prisma.certificateJob.findFirst({
      where: { status: 'Pending' },
      orderBy: { id: 'asc' },
    });
    if (!next) return null;
    // No concurrent worker in this deployment (single pm2 process), so a
    // plain read-then-write is enough — no SELECT ... FOR UPDATE needed.
    return this.prisma.certificateJob.update({
      where: { id: next.id },
      data: { status: 'Processing' },
    });
  }

  private async processOne(job: { id: number; registrationId: number; eventName: string; attempts: number }): Promise<void> {
    try {
      const cert = await this.issuance.issueForRegistration(job.registrationId, job.eventName);
      if (!cert) throw new Error('Certificate rendering returned REVIEW_REQUIRED (see logs above)');

      const registration = await this.prisma.registration.findUnique({
        where: { id: job.registrationId },
        include: { student: true },
      });

      await this.prisma.certificateJob.update({
        where: { id: job.id },
        data: { status: 'Sent', processedAt: new Date(), attempts: job.attempts + 1 },
      });

      if (registration?.student) {
        void this.messaging.dispatch(
          'CERTIFICATE_AVAILABLE',
          { email: registration.student.email, phone: registration.student.phone },
          {
            StudentName: registration.student.name,
            CertificateType: 'Participation',
            CertificateLink: `${CERTIFICATE_DOWNLOAD_BASE_URL}/${cert.certificateNumber}/download`,
          },
        );
      }
      this.logger.log(`Issued certificate ${cert.certificateNumber} for registration ${job.registrationId}`);
    } catch (err) {
      const attempts = job.attempts + 1;
      const lastError = String(err instanceof Error ? err.message : err).slice(0, 2000);
      await this.prisma.certificateJob.update({
        where: { id: job.id },
        data: {
          status: attempts >= MAX_ATTEMPTS ? 'Failed' : 'Pending',
          attempts,
          lastError,
        },
      });
      this.logger.error(`Certificate job ${job.id} failed (attempt ${attempts}): ${lastError}`);
    }
  }
}
