import { chromium, Browser } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import * as QRCode from 'qrcode';
import { createHash } from 'crypto';

// Where the QR on a report points. The public verify page looks the code up.
export const REPORT_VERIFY_BASE_URL = 'https://indiamindleague.com/verify';

// No 0/O/1/I so a code read aloud or typed from paper is not misread.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** IMLR-XXXX-XXXX-XX: 10 random characters, ~50 bits, so a code cannot be guessed. */
export function newVerificationCode(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(10);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `IMLR-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 10)}`;
}

export const verificationUrl = (code: string): string => `${REPORT_VERIFY_BASE_URL}/${encodeURIComponent(code)}`;

export const qrDataUrl = (code: string): Promise<string> => QRCode.toDataURL(verificationUrl(code), { margin: 1, width: 300, errorCorrectionLevel: 'M' });

export const sha256 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

export const launchBrowser = (): Promise<Browser> => chromium.launch();

export interface PdfOptions {
  /** Printed at the left of every page footer. */
  footerLeft?: string;
  /** Printed at the right of every page footer, before the page number. */
  footerRight?: string;
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Prints report HTML as an A4 PDF with a page-numbered footer. Pass an open browser to
 * reuse it across a batch (launching Chromium is the expensive part); without one a
 * browser is started and closed for this single render.
 */
export async function renderReportPdf(html: string, opts: PdfOptions = {}, browser?: Browser): Promise<{ pdf: Buffer; pages: number }> {
  const own = !browser;
  const b = browser ?? (await launchBrowser());
  try {
    const page = await b.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
      const footer = `<div style="font-size:7.5pt;color:#666;width:100%;padding:0 15mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif;">
        <span>${escHtml(opts.footerLeft ?? '')}</span>
        <span>${escHtml(opts.footerRight ?? '')}${opts.footerRight ? ' · ' : ''}Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: footer,
        margin: { top: '15mm', bottom: '18mm', left: '15mm', right: '15mm' },
      });
      const doc = await PDFDocument.load(pdf);
      return { pdf: Buffer.from(pdf), pages: doc.getPageCount() };
    } finally {
      await page.close();
    }
  } finally {
    if (own) await b.close();
  }
}
