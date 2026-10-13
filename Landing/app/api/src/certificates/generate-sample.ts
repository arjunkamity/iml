/**
 * Phase 1 proof script — not wired into the Nest app yet (that's Phase 2/3).
 * Run with:
 *   npx ts-node src/certificates/generate-sample.ts
 *
 * Produces one PDF + PNG preview per test case into src/certificates/out/,
 * including a deliberately long name to prove the text-fit / REVIEW_REQUIRED
 * logic actually engages instead of overlapping or truncating.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { renderParticipationCertificate } from './certificate-renderer';
import { ParticipationCertificateData } from './templates/participation-v1';
import { siteSettingToBrandAssets } from './brand-assets';

const OUT_DIR = path.join(__dirname, 'out');

const CASES: { label: string; data: ParticipationCertificateData }[] = [
  {
    label: 'normal-name',
    data: {
      studentName: 'Aarav Sharma',
      eventName: 'Digital Qualifier — Stage 1',
      eventDate: '12 September 2026',
      certificateNumber: 'SAMPLE-0001',
      schoolName: 'Amity International School, Noida',
    },
  },
  {
    label: 'long-name',
    data: {
      studentName: 'Venkata Naga Sai Sri Ramachandra Murthy',
      eventName: 'Digital Qualifier — Stage 1',
      eventDate: '12 September 2026',
      certificateNumber: 'SAMPLE-0002',
      schoolName: 'Amity International School, Pushp Vihar',
    },
  },
  {
    label: 'extreme-name-shrinks-to-minimum',
    data: {
      studentName: 'Venkata Naga Sai Sri Ramachandra Padmanabha Subramaniam Iyengar',
      eventName: 'Digital Qualifier — Stage 1',
      eventDate: '12 September 2026',
      certificateNumber: 'SAMPLE-0003',
      schoolName: 'Amity International School',
    },
  },
  {
    label: 'impossible-name-should-flag-review',
    data: {
      studentName:
        'Venkata Naga Sai Sri Ramachandra Padmanabha Subramaniam Iyengar Venkataraman Chandrasekhar Balasubramaniam',
      eventName: 'Digital Qualifier — Stage 1',
      eventDate: '12 September 2026',
      certificateNumber: 'SAMPLE-0004',
      schoolName: 'Amity International School',
    },
  },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Prove the admin-settings -> render pipeline end-to-end: read the real
  // SiteSetting row (whatever an admin has saved under Certificate
  // Template) and pass it through exactly as a future certificates
  // service would. With nothing saved yet, every field falls back to the
  // bundled default asset — this run demonstrates that fallback path.
  const prisma = new PrismaClient();
  const setting = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  const brand = siteSettingToBrandAssets(setting);
  console.log('Brand assets resolved from SiteSetting:', JSON.stringify(brand, null, 2));

  for (const c of CASES) {
    process.stdout.write(`Rendering "${c.label}"... `);
    const result = await renderParticipationCertificate(c.data, brand);
    console.log(result.status, result.fittedFontSizes ?? '');

    if (result.previewPngBuffer) {
      fs.writeFileSync(path.join(OUT_DIR, `${c.label}.png`), result.previewPngBuffer);
    }
    if (result.pdfBuffer) {
      fs.writeFileSync(path.join(OUT_DIR, `${c.label}.pdf`), result.pdfBuffer);
    }
    if (result.reviewReasons) {
      for (const r of result.reviewReasons) console.log('  REVIEW_REQUIRED:', r);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
