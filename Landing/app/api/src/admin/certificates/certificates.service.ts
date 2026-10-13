import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { MessagingService } from '../../messaging/messaging.service';
import { renderParticipationCertificate } from '../../certificates/certificate-renderer';
import { siteSettingToBrandAssets } from '../../certificates/brand-assets';
import { CERTIFICATE_DOWNLOAD_BASE_URL } from '../../certificates/certificate-queue.service';
import { paginate } from '../../common/list-result';

type ListQuery = { page: number; limit: number; status?: string };

@Injectable()
export class AdminCertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly messaging: MessagingService,
  ) {}

  /** The certificate send queue — see CertificateJob in schema.prisma and
   * CertificateQueueService for the worker that drains this. certificateNumber
   * is looked up from the Certificate table by registrationId directly
   * (not inferred from job.status) — issuance and the fire-and-forget email
   * dispatch are two separate steps, so a certificate can exist even for a
   * job that isn't (or no longer shows as) Sent. Powers the admin's
   * Download/Resend actions below. */
  async listQueue(q: ListQuery) {
    const where = q.status ? { status: q.status } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.certificateJob.findMany({
        where,
        include: {
          registration: {
            select: {
              code: true,
              student: { select: { code: true, name: true, email: true } },
              competition: { select: { code: true, title: true } },
            },
          },
        },
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.certificateJob.count({ where }),
    ]);

    const certs = rows.length
      ? await this.prisma.certificate.findMany({
          where: { registrationId: { in: rows.map((r) => r.registrationId) } },
          select: { registrationId: true, certificateNumber: true },
        })
      : [];
    const certByReg = new Map(certs.map((c) => [c.registrationId, c.certificateNumber]));

    return paginate(
      rows.map(({ registration, ...rest }) => ({
        ...rest,
        registrationCode: registration.code,
        studentCode: registration.student.code,
        studentName: registration.student.name,
        studentEmail: registration.student.email,
        competitionCode: registration.competition.code,
        competitionTitle: registration.competition.title,
        certificateNumber: certByReg.get(rest.registrationId) ?? null,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  /** Re-dispatches the CERTIFICATE_AVAILABLE email for an already-issued
   * certificate — for a student who says they never got it, or a bounced
   * address that's since been corrected. Doesn't touch the CertificateJob
   * row or re-render anything; the certificate itself already exists. */
  async resendCertificateEmail(certificateNumber: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificateNumber },
      include: { registration: { include: { student: true } } },
    });
    if (!cert) throw new NotFoundException(`No certificate ${certificateNumber}`);

    const student = cert.registration.student;
    await this.messaging.dispatch(
      'CERTIFICATE_AVAILABLE',
      { email: student.email, phone: student.phone },
      {
        StudentName: student.name,
        CertificateType: 'Participation',
        CertificateLink: `${CERTIFICATE_DOWNLOAD_BASE_URL}/${cert.certificateNumber}/download`,
      },
    );
    return { ok: true };
  }

  /** Puts a Failed job back to Pending so the next drain retries it — for
   * a job that hit MAX_ATTEMPTS after a transient issue (e.g. a bad
   * template setting an admin has since fixed). Resets the attempt
   * counter too, so it gets a full fresh set of retries. */
  async retryQueueJob(id: number) {
    const job = await this.prisma.certificateJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Certificate job not found');
    if (job.status !== 'Failed') {
      throw new BadRequestException('Only a Failed job can be retried.');
    }
    return this.prisma.certificateJob.update({
      where: { id },
      data: { status: 'Pending', attempts: 0, lastError: null },
    });
  }

  /**
   * Re-renders an already-issued certificate on demand, using whatever
   * logos/signatures/background are currently saved in Site Settings —
   * so an admin who just uploaded a real signature image can immediately
   * download a fresh PDF and see it applied, without a script or a
   * redeploy. Never returns a stale cached file: this always renders
   * live, the same way the original issuance did.
   */
  async downloadPdf(certificateNumber: string): Promise<Buffer> {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificateNumber },
      include: {
        registration: {
          include: { student: { include: { school: true } } },
        },
      },
    });
    if (!cert) throw new NotFoundException(`No certificate ${certificateNumber}`);

    const setting = await this.settings.get();
    const brand = siteSettingToBrandAssets(setting);

    const result = await renderParticipationCertificate(
      {
        studentName: cert.registration.student.name,
        eventName: cert.eventName,
        eventDate: cert.issuedAt.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
        certificateNumber: cert.certificateNumber,
        schoolName: cert.registration.student.school?.name,
      },
      brand,
    );

    if (result.status === 'REVIEW_REQUIRED') {
      throw new BadGatewayException(
        `Certificate ${certificateNumber} could not be rendered with the current template settings: ` +
          (result.reviewReasons ?? []).join('; '),
      );
    }

    return result.pdfBuffer!;
  }

  /**
   * Renders a certificate with fixed sample data — no real registration
   * or Certificate row needed. Lets an admin see how a newly-uploaded
   * signature/logo/background looks without first having to issue a
   * real certificate and remember its number. The sample number can
   * never collide with a real one (real ones follow IML-AMT-{year}-{seq}).
   */
  async downloadSamplePdf(): Promise<Buffer> {
    const setting = await this.settings.get();
    const brand = siteSettingToBrandAssets(setting);

    const result = await renderParticipationCertificate(
      {
        studentName: 'Aarav Sharma',
        eventName: 'Digital Qualifier — Stage 1',
        eventDate: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' }),
        certificateNumber: 'SAMPLE-PREVIEW',
        schoolName: 'Amity International School, Noida',
      },
      brand,
    );

    if (result.status === 'REVIEW_REQUIRED') {
      throw new BadGatewayException(
        `Sample certificate could not be rendered with the current template settings: ` +
          (result.reviewReasons ?? []).join('; '),
      );
    }

    return result.pdfBuffer!;
  }
}
