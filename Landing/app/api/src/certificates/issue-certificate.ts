/**
 * Phase 1.5 proof script for real, DB-backed certificate issuance — not
 * wired into an admin endpoint yet (that's a separate "Issue Certificate"
 * admin UI, out of scope for this pass; today this is the only way a
 * Certificate row gets created). Run with:
 *   npx ts-node src/certificates/issue-certificate.ts <registrationId>
 *
 * Renders the certificate, writes the PDF to src/certificates/out/, and
 * inserts a real Certificate row so the public /verify/:code page and the
 * QR printed on the certificate have real data to look up — not a
 * fabricated "Verified ✓" with nothing behind it.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { renderParticipationCertificate } from './certificate-renderer';
import { siteSettingToBrandAssets } from './brand-assets';
import { TEMPLATE_CODE, TEMPLATE_VERSION } from './templates/participation-v1';

const OUT_DIR = path.join(__dirname, 'out');

/** IML-AMT-{year}-{6-digit sequence, unique across all certificates ever
 * issued} — matches the format in the requirements doc (§10). Sequencing
 * off the row count is fine for this scripted-issuance phase; a real
 * concurrent issuance path (Phase 3's queue) would need a proper
 * sequence/lock instead. */
async function nextCertificateNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.certificate.count();
  const seq = String(count + 1).padStart(6, '0');
  return `IML-AMT-${year}-${seq}`;
}

async function main() {
  const registrationId = Number(process.argv[2]);
  if (!registrationId) {
    console.error('Usage: npx ts-node src/certificates/issue-certificate.ts <registrationId>');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { student: { include: { school: true } }, competition: true },
  });
  if (!registration) {
    console.error(`No registration with id ${registrationId}`);
    process.exit(1);
  }

  const existing = await prisma.certificate.findFirst({
    where: { registrationId, certificateType: 'PARTICIPATION' },
  });
  if (existing) {
    console.error(
      `Registration ${registrationId} already has a PARTICIPATION certificate: ${existing.certificateNumber}. ` +
        'Not issuing a duplicate.',
    );
    process.exit(1);
  }

  const certificateNumber = await nextCertificateNumber(prisma);
  const eventName = registration.competition.title;

  const setting = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  const brand = siteSettingToBrandAssets(setting);

  const result = await renderParticipationCertificate(
    {
      studentName: registration.student.name,
      eventName,
      eventDate: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' }),
      certificateNumber,
      schoolName: registration.student.school?.name,
    },
    brand,
  );

  if (result.status === 'REVIEW_REQUIRED') {
    console.error('REVIEW_REQUIRED — not issuing:', result.reviewReasons);
    if (result.previewPngBuffer) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(OUT_DIR, `review-${certificateNumber}.png`), result.previewPngBuffer);
    }
    await prisma.$disconnect();
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pdfPath = path.join(OUT_DIR, `${certificateNumber}.pdf`);
  fs.writeFileSync(pdfPath, result.pdfBuffer!);

  const cert = await prisma.certificate.create({
    data: {
      certificateNumber,
      registrationId,
      certificateType: 'PARTICIPATION',
      templateCode: TEMPLATE_CODE,
      templateVersion: TEMPLATE_VERSION,
      eventName,
      // pdfUrl stays null — no blob storage wired up yet (Phase 4). The
      // PDF exists locally at pdfPath for now.
    },
  });

  console.log('Issued:', cert.certificateNumber);
  console.log('PDF:', pdfPath);
  console.log('Verify at: https://indiamindleague.com/verify/' + cert.certificateNumber);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
