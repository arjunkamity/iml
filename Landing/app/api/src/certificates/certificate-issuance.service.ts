import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { renderParticipationCertificate } from './certificate-renderer';
import { siteSettingToBrandAssets } from './brand-assets';
import { TEMPLATE_CODE, TEMPLATE_VERSION } from './templates/participation-v1';

/** IML-AMT-{year}-{6-digit sequence, unique across all certificates ever
 * issued} — see issue-certificate.ts's original scripted-issuance phase
 * for the same numbering scheme; this is the shared, callable version of
 * that logic, used by both the CLI script and the automatic queue below. */
async function nextCertificateNumber(prisma: PrismaService): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.certificate.count();
  const seq = String(count + 1).padStart(6, '0');
  return `IML-AMT-${year}-${seq}`;
}

@Injectable()
export class CertificateIssuanceService {
  private readonly logger = new Logger(CertificateIssuanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Renders and records a PARTICIPATION certificate for one registration.
   * Idempotent: if one already exists for this registration, returns it
   * unchanged rather than issuing a duplicate. Never throws on a rendering
   * problem (a REVIEW_REQUIRED result) — logs and returns null instead, so
   * a bad template setting can't take down the exam-submit flow or wedge
   * the queue; the job that called this marks itself Failed and a person
   * can investigate.
   */
  async issueForRegistration(registrationId: number, eventName: string) {
    const existing = await this.prisma.certificate.findFirst({
      where: { registrationId, certificateType: 'PARTICIPATION' },
    });
    if (existing) return existing;

    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { student: { include: { school: true } } },
    });
    if (!registration) {
      this.logger.error(`issueForRegistration: no registration ${registrationId}`);
      return null;
    }

    const certificateNumber = await nextCertificateNumber(this.prisma);
    const setting = await this.settings.get();
    const brand = siteSettingToBrandAssets(setting);

    const result = await renderParticipationCertificate(
      {
        studentName: registration.student.name,
        eventName,
        eventDate: new Date().toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
        certificateNumber,
        schoolName: registration.student.school?.name,
      },
      brand,
    );

    if (result.status === 'REVIEW_REQUIRED') {
      this.logger.error(
        `Certificate render REVIEW_REQUIRED for registration ${registrationId}: ${(result.reviewReasons ?? []).join('; ')}`,
      );
      return null;
    }

    return this.prisma.certificate.create({
      data: {
        certificateNumber,
        registrationId,
        certificateType: 'PARTICIPATION',
        templateCode: TEMPLATE_CODE,
        templateVersion: TEMPLATE_VERSION,
        eventName,
      },
    });
  }
}
