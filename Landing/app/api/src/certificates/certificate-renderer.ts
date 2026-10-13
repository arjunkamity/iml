import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import * as QRCode from 'qrcode';
import {
  CANVAS,
  CertificateBrandAssets,
  FIELD_SPECS,
  ParticipationCertificateData,
  renderParticipationHtml,
  TEMPLATE_CODE,
  TEMPLATE_VERSION,
} from './templates/participation-v1';
import { fitField } from './text-fit';

// CSS treats "px" as a fixed 96-per-inch reference unit, always — there is
// no way to make it mean "200dpi". A page.pdf() call that both sizes the
// body at CANVAS.width px AND declares the physical page as 297mm (via the
// template's own `@page` rule + preferCSSPageSize) doesn't reconcile them:
// 2339px reads as 2339/96 = 24.4in, nearly double true A4-landscape's
// 11.69in width — Chromium paginates rather than scaling to fit.
//
// Two different fixes were tried and abandoned here (see git history):
// (1) Playwright's `scale` option — the "correct" value drifted with
//     unrelated content changes (different fonts loaded) rather than
//     being derivable from CANVAS's own dimensions, so no fixed constant
//     or formula was trustworthy. (2) A retry loop stepping `scale` down
//     until the output read back as 1 page — self-correcting, but it
//     converges past the true single-page threshold (confirmed via
//     instrumented runs: 18 retries landing at scale=0.23 vs the ~0.48
//     that should have worked), producing a valid-but-tiny certificate.
//
// What actually turned out to be going on: when page.pdf() is asked for a
// page EXACTLY the size of the content (CANVAS.width/height in px, no
// scale at all), Chromium renders page 1 as a perfect, full-bleed,
// 100%-filled certificate — every time — but appends one spurious blank
// page 2. This is a known Chromium/CDP print-to-PDF quirk, not anything
// specific to this template. So instead of fighting Chromium's scale
// heuristics, render at native size (always correct on page 1) and use
// pdf-lib — a real PDF library — to keep only page 1 and resize that page
// down to true A4 landscape. This is deterministic: no retries, no
// hand-tuned constants, no drift.
const A4_LANDSCAPE_WIDTH_PT = 297 * (72 / 25.4); // 841.89pt — PDF's native unit is 1/72in, not CSS px
const A4_LANDSCAPE_HEIGHT_PT = 210 * (72 / 25.4); // 595.28pt

async function renderPdfSinglePage(page: import('playwright').Page): Promise<Buffer> {
  const rawPdf = await page.pdf({
    width: `${CANVAS.width}px`,
    height: `${CANVAS.height}px`,
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });

  const source = await PDFDocument.load(rawPdf);
  const trimmed = await PDFDocument.create();
  const [certPage] = await trimmed.copyPages(source, [0]); // page 1 only — page 2+ is always the spurious blank
  trimmed.addPage(certPage);

  const { width: srcWidthPt, height: srcHeightPt } = certPage.getSize();
  certPage.scale(A4_LANDSCAPE_WIDTH_PT / srcWidthPt, A4_LANDSCAPE_HEIGHT_PT / srcHeightPt);

  return Buffer.from(await trimmed.save());
}

/** `body { overflow: hidden }` clips what you SEE (screenshots, on-screen
 * rendering) but does not clip what Chromium's print pipeline measures —
 * an absolutely-positioned element that visually looks fine can still
 * silently blow the printable content size out to several times
 * CANVAS.height (this happened with an oversized watermark once, and
 * without this check it just produces a correctly-single-page PDF with a
 * huge blank margin instead of an error). Catch it here immediately. */
async function assertContentFitsCanvas(page: import('playwright').Page): Promise<void> {
  const { scrollWidth, scrollHeight } = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    scrollHeight: document.body.scrollHeight,
  }));
  if (scrollWidth > CANVAS.width || scrollHeight > CANVAS.height) {
    throw new Error(
      `Certificate content (${scrollWidth}x${scrollHeight}px) exceeds the ${CANVAS.width}x${CANVAS.height}px ` +
        'canvas. body { overflow:hidden } hides this visually but Chromium\'s print pipeline still measures ' +
        'the true layout size, so it silently produces a correctly-single-page PDF with the content shrunk far ' +
        'smaller than intended. Find the element extending past the canvas (e.g. a fixed-width, height:auto ' +
        'image whose own aspect ratio makes it taller than expected) and give it an explicit height.',
    );
  }
}

// Public verification landing page — see web/src/app/features/public/verify
// for the page this QR points to. Phase 1 scope: the page confirms the
// certificate number that was scanned but doesn't yet look anything up
// against a real database (there is no certificates table yet — that's
// Phase 2's DB model per the requirements doc). It deliberately doesn't
// fabricate a "Verified ✓" result it can't actually back up.
const VERIFY_BASE_URL = 'https://indiamindleague.com/verify';

async function generateVerifyQrCode(certificateNumber: string): Promise<string> {
  const verifyUrl = `${VERIFY_BASE_URL}/${encodeURIComponent(certificateNumber)}`;
  return QRCode.toDataURL(verifyUrl, { margin: 1, width: 400, errorCorrectionLevel: 'M' });
}

export interface CertificateRenderResult {
  status: 'GENERATED' | 'REVIEW_REQUIRED';
  templateCode: string;
  templateVersion: number;
  pdfBuffer?: Buffer;
  previewPngBuffer?: Buffer;
  fittedFontSizes?: Record<string, number>;
  reviewReasons?: string[];
}

/**
 * Renders one IML Participation certificate. Phase 1 scope: runs entirely
 * in-process (no queue/worker yet — that's Phase 3). Never writes a PDF for
 * a field that failed to fit — REVIEW_REQUIRED short-circuits before
 * page.pdf() is ever called, per the "never produce a broken PDF" rule.
 */
export async function renderParticipationCertificate(
  data: ParticipationCertificateData,
  brand: CertificateBrandAssets = {},
): Promise<CertificateRenderResult> {
  const qrCodeDataUrl = await generateVerifyQrCode(data.certificateNumber);
  const html = renderParticipationHtml(data, {}, brand, qrCodeDataUrl);
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: CANVAS.width, height: CANVAS.height } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => (document as any).fonts.ready);
    await assertContentFitsCanvas(page);

    const reviewReasons: string[] = [];
    const fittedFontSizes: Record<string, number> = {};

    for (const spec of [FIELD_SPECS.studentName, FIELD_SPECS.description]) {
      const result = await fitField(page, spec);
      if (result.fit == null) {
        reviewReasons.push(
          `Field "${spec.key}" does not fit within its ${spec.width}x${spec.height}px reserved area even at ` +
            `minFontSize=${spec.minFontSize}px: "${result.testedText}"`,
        );
      } else {
        fittedFontSizes[spec.key] = result.fit;
      }
    }

    // The auto-fit result is the LARGEST size that fits — a short name
    // often converges well below FIELD_SPECS.studentName.fontSize (the
    // ceiling), so lowering that ceiling alone has no visible effect for
    // most real names. "15% smaller" means 15% off whatever it actually
    // converged to, so apply it here, on the result, clamped to the same
    // minFontSize floor the fit pass itself respects.
    if (fittedFontSizes.studentName != null) {
      const reduced = Math.max(
        FIELD_SPECS.studentName.minFontSize,
        Math.round(fittedFontSizes.studentName * 0.85),
      );
      await page.evaluate(
        ({ id, px }) => {
          const el = document.getElementById(id) as HTMLElement | null;
          if (el) el.style.fontSize = px + 'px';
        },
        { id: FIELD_SPECS.studentName.key, px: reduced },
      );
      fittedFontSizes.studentName = reduced;
    }

    if (reviewReasons.length > 0) {
      const previewPngBuffer = await page.screenshot({ type: 'png' });
      return {
        status: 'REVIEW_REQUIRED',
        templateCode: TEMPLATE_CODE,
        templateVersion: TEMPLATE_VERSION,
        previewPngBuffer,
        fittedFontSizes,
        reviewReasons,
      };
    }

    const [pdfBuffer, previewPngBuffer] = await Promise.all([
      renderPdfSinglePage(page),
      page.screenshot({ type: 'png' }),
    ]);

    return {
      status: 'GENERATED',
      templateCode: TEMPLATE_CODE,
      templateVersion: TEMPLATE_VERSION,
      pdfBuffer,
      previewPngBuffer,
      fittedFontSizes,
    };
  } finally {
    await browser.close();
  }
}
