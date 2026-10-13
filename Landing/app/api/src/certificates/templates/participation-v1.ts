import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// LOCKED ARTWORK + CONTROLLED DYNAMIC FIELDS
//
// This file owns all layout, typography, safe areas and field constraints
// for template IML_PARTICIPATION v1. The application only ever supplies
// data (see ParticipationCertificateData / CertificateBrandAssets below) —
// it never supplies coordinates, fonts, or positioning.
//
// Design direction (v1.1 — replaces both an earlier ceremonial gold-frame
// draft and a confetti/Gen-Z draft, per explicit client direction): built
// directly around the client-supplied artwork in
// Landing/app/feedback8-12-26/Certificate/ — a full-bleed background
// (crystal facet corners + gold frame + confetti, already sized ~A4
// landscape), a navy/gold Amity-brand palette, and layout coordinates
// read directly off the client's own "sample full.png" mockup (which is
// that same background with their sample text already composited on it).
//
// Canvas: 2339x1654 CSS px — a working-resolution rectangle at A4
// landscape's aspect ratio (1.414), NOT a physical size (CSS "px" is
// always 96/inch; there's no way to make it mean "200dpi"). The renderer
// (certificate-renderer.ts) prints this at true A4 landscape by scaling
// the whole page down via page.pdf()'s `scale` option — see the comment
// there for why relying on an `@page` size rule to do this doesn't work.
// The background art is 1492x1054 (ratio 1.416, essentially identical to
// this canvas's 1.414) stretched to fill exactly — negligible distortion.
//
// Fonts are loaded from Google Fonts by URL for this Phase 1 proof. Phase 4
// (Azure production hardening, per the requirements doc's own phasing)
// should vendor these as local files instead, so PDF generation never
// depends on an outbound network call at render time.
// ---------------------------------------------------------------------------

export const TEMPLATE_CODE = 'IML_PARTICIPATION';
export const TEMPLATE_VERSION = 1;

export const CANVAS = { width: 2339, height: 1654 };

// Safe-zone discipline, read off the client's background art: the crystal
// wedge in each corner is a right triangle reaching ~21.5% along the edge
// from the corner and fully receding by ~34% depth. Title/name/description
// are centered across the full page width and sit well above that (y <
// 66%), so they never need this margin. The footer row is the one element
// low enough on the page (y ~72-84%) that the bottom-right wedge is still
// present — clear of it by 78%. The left side at that height has only the
// light bottom-left dot-grid (not a hard wedge), so FOOTER_RIGHT is the
// real constraint; mirror it for the left edge to keep the row visually
// centered on the page instead of centering it inside an asymmetric box
// (28%-78% has its own midpoint at 53%, not 50% — that asymmetry was a
// real bug, not a rounding artifact). Keep in sync with certificate-bg.png
// if that artwork ever changes.
const FOOTER_RIGHT = Math.round(CANVAS.width * 0.78); // 1824
const FOOTER_LEFT = CANVAS.width - FOOTER_RIGHT; // 515 — mirrors FOOTER_RIGHT around page-center

export interface CertificateFieldSpec {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fontSize: number;
  minFontSize: number;
  maxLines: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  letterSpacing: number; // px, at fontSize
  overflow: 'review'; // locked — this template never silently clips or truncates
  maxCharacters?: number;
}

export const FIELD_SPECS: Record<'studentName' | 'description', CertificateFieldSpec> = {
  studentName: {
    key: 'studentName',
    x: Math.round(CANVAS.width * 0.1),
    y: 708,
    width: Math.round(CANVAS.width * 0.8),
    height: 205,
    fontFamily: 'Charm',
    fontWeight: 700,
    fontStyle: 'normal',
    fontSize: 159,
    minFontSize: 64,
    maxLines: 1,
    lineHeight: 1.15,
    align: 'center',
    letterSpacing: 0,
    overflow: 'review',
    maxCharacters: 80,
  },
  description: {
    key: 'description',
    x: Math.round(CANVAS.width * 0.18),
    y: 1003,
    width: Math.round(CANVAS.width * 0.64),
    height: 160,
    fontFamily: 'Archivo',
    fontWeight: 400,
    fontStyle: 'normal',
    fontSize: 35,
    minFontSize: 23,
    maxLines: 3,
    lineHeight: 1.55,
    align: 'center',
    letterSpacing: 0,
    overflow: 'review',
    maxCharacters: 320,
  },
};

export interface ParticipationCertificateData {
  studentName: string;
  /** e.g. "Digital Qualifier — Stage 1" */
  eventName: string;
  /** e.g. "12 September 2026" (pre-formatted — the template never parses dates) */
  eventDate: string;
  certificateNumber: string;
  grade?: string;
  schoolName?: string;
}

/** One signature slot. `imageUrl` is deliberately optional — until an
 * admin uploads a real signature scan, the template reserves the space
 * with an empty placeholder rather than inventing or hiding it. */
export interface CertificateSignature {
  imageUrl?: string;
  name: string;
  role: string;
}

/** Every field here is admin-configurable (Site Settings → Certificate
 * Template) and optional — omitted values fall back to the bundled
 * default artwork in ./assets, never to a broken image. */
export interface CertificateBrandAssets {
  /** Overrides the full-bleed background art (crystal corners, gold
   * frame, confetti). Every position in this file — the safe-zone
   * margins, the frame-clearance numbers, the watermark's content band —
   * was measured directly off the bundled certificate-bg.png. A
   * differently-shaped background can legally be swapped in here, but
   * nothing re-checks the text against ITS decorative elements; a very
   * different design could overlap. The admin UI carries this warning
   * too — see admin-settings.page.ts. */
  backgroundUrl?: string;
  imlLogoUrl?: string;
  amityLogoUrl?: string;
  badgeUrl?: string;
  signatureLeft?: CertificateSignature;
  signatureRight?: CertificateSignature;
  /** Plain-text template for the body paragraph — see
   * DEFAULT_DESCRIPTION_TEMPLATE for the token syntax. Admin input is
   * always HTML-escaped before token substitution, so it can never inject
   * markup — only the two locked tokens produce the bold-navy emphasis. */
  descriptionTemplate?: string;
}

const DEFAULT_SIGNATURES: { left: CertificateSignature; right: CertificateSignature } = {
  left: { name: 'Program Director', role: 'India Mind League' },
  right: { name: 'Registrar', role: 'Amity Group of Schools' },
};

/** {schoolName} / {studentName} substitute as plain escaped text.
 * {eventNameBold} substitutes to a pre-built, already-safe
 * "<b>India Mind League {eventName}</b>" fragment — the one piece of
 * markup this template allows, and it's never admin-authored. */
const DEFAULT_DESCRIPTION_TEMPLATE =
  'For active participation of {schoolName} in the {eventNameBold}. Your effort, curiosity and ' +
  'determination reflect strong Intellectual, Emotional, Social and Leadership Intelligence — keep inspiring and achieving!';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function assetDataUri(filename: string): string {
  const filePath = path.join(__dirname, '..', 'assets', filename);
  const buf = fs.readFileSync(filePath);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/** Admin-supplied URLs are used as-is (Playwright fetches them over the
 * network at render time, same as a real browser); an empty/missing
 * override falls back to the bundled default asset. */
function resolveAsset(overrideUrl: string | undefined, localFilename: string): string {
  return overrideUrl && overrideUrl.trim() ? overrideUrl : assetDataUri(localFilename);
}

function buildDescription(data: ParticipationCertificateData, template?: string): string {
  const tpl = template && template.trim() ? template : DEFAULT_DESCRIPTION_TEMPLATE;
  const eventNameBold = `<b>India Mind League ${esc(data.eventName)}</b>`;
  // Escape the admin's template text FIRST (so it can never contain live
  // markup), then substitute tokens — the substituted values are inserted
  // after escaping, so eventNameBold's own <b> tag survives intact.
  return esc(tpl)
    .replace(/\{eventNameBold\}/g, eventNameBold)
    .replace(/\{schoolName\}/g, data.schoolName ? esc(data.schoolName) : '')
    .replace(/\{studentName\}/g, esc(data.studentName));
}

function renderSignature(sig: CertificateSignature): string {
  const imgOrPlaceholder = sig.imageUrl
    ? `<img class="sig-img" src="${sig.imageUrl}" alt="Signature" />`
    : `<div class="sig-placeholder">Signature</div>`;
  return `<div class="sig">
    <div class="sig-slot">${imgOrPlaceholder}</div>
    <div class="line"></div>
    <div class="role">${esc(sig.name)}</div>
    <div class="org">${esc(sig.role)}</div>
  </div>`;
}

/**
 * Renders the full HTML document. Dynamic field values are inserted as
 * plain escaped text at the font sizes given (the renderer overwrites them
 * after running the fit algorithm) — this function itself does no
 * measurement or fitting.
 */
export function renderParticipationHtml(
  data: ParticipationCertificateData,
  overrides: { studentNameFontSize?: number; descriptionFontSize?: number } = {},
  brand: CertificateBrandAssets = {},
  /** Pre-rendered QR PNG as a data: URI. QR generation is async (the
   * `qrcode` package has no sync API) so it can't happen inside this
   * function — certificate-renderer.ts generates it and passes it in.
   * Undefined renders the reserved-space placeholder instead, same
   * "never fabricate, just reserve the space" rule as the signatures. */
  qrCodeDataUrl?: string,
): string {
  const nameSpec = FIELD_SPECS.studentName;
  const descSpec = FIELD_SPECS.description;
  const nameSize = overrides.studentNameFontSize ?? nameSpec.fontSize;
  const descSize = overrides.descriptionFontSize ?? descSpec.fontSize;

  const bg = resolveAsset(brand.backgroundUrl, 'certificate-bg.png');
  const divider = assetDataUri('divider-flourish.png'); // locked artwork
  const imlLogo = resolveAsset(brand.imlLogoUrl, 'iml-logo.png');
  const amityLogo = resolveAsset(brand.amityLogoUrl, 'amity-group-logo.png');
  // Badge/seal asset (brand.badgeUrl) is no longer used in this layout —
  // the QR code took its spot in the footer — but the field stays on
  // CertificateBrandAssets and the admin picker in case a future
  // certificate type wants it back.
  const sigLeft = { ...DEFAULT_SIGNATURES.left, ...brand.signatureLeft };
  const sigRight = { ...DEFAULT_SIGNATURES.right, ...brand.signatureRight };

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Charm:wght@400;700&family=Cormorant+Garamond:wght@500;600;700&family=Poppins:wght@500;600;700&family=Archivo:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { margin: 0; } /* physical page size + orientation are set by page.pdf() in certificate-renderer.ts, not here */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${CANVAS.width}px; height: ${CANVAS.height}px; }
  body {
    position: relative;
    background: #fdfaf1 url('${bg}') no-repeat center center;
    background-size: 100% 100%;
    font-family: 'Cormorant Garamond', serif;
    overflow: hidden;
  }

  /* ---- header: hosting institution — centered, larger (there's headroom
     for it). Clear of the top gold flourish (ends ~y:85px) and of both
     crystal wedges (the wedge reaches at most ~449px from the left edge
     at this height, the logo's centered span starts well past that). ---- */
  .amity-header { position: absolute; top: 80px; left: 50%; transform: translateX(-50%); height: 316px; }
  .amity-header img { height: 100%; width: auto; }

  /* ---- IML watermark: near-full-width, dead-centre, deep behind every
     other element (first in DOM, so it paints below all of it) and at
     very low opacity — a real watermark, not a corner logo, so it can
     safely sit "underneath" the title/name/description without ever
     competing with them for legibility, and can safely run wide enough
     to cross over the crystal artwork too (invisible at this opacity). ---- */
  .iml-watermark {
    /* Fixed width AND height (not width + height:auto) — the logo's own
       aspect (0.8, portrait) would otherwise make a "full width" box
       nearly 2.6x CANVAS.height tall. Chromium's print pagination reads
       an absolutely-positioned element's own layout box regardless of an
       ancestor's overflow:hidden (a body-level overflow:hidden was found
       NOT to clip this for print purposes — the PDF still paginated at
       the un-clipped 2625px height), so the box itself must fit inside
       the canvas, not just look clipped on screen. object-fit:cover
       inside this bounded box gives the "big, full width" look the crop
       still reads as a normal bleeding background watermark.
       Centered on the CONTENT band (Amity header bottom ~367px -> bottom
       frame top ~1546px, measured directly off certificate-bg.png), not
       the raw page — the page's own vertical center sits visibly higher
       than where the certificate's content actually is, and a height
       taller than that band pokes out past the frame regardless of
       centering. */
    position: absolute; top: 427px; left: 50%; transform: translateX(-50%);
    width: 2100px; height: 1100px; opacity: 0.055; pointer-events: none; z-index: 0; overflow: hidden;
  }
  .iml-watermark img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }

  /* ---- title block (centered across the full safe zone — this band of
     the page, y:~32-64%, is clear of both corner crystal wedges) ---- */
  .title-block { position: absolute; top: 445px; left: 0; width: 100%; text-align: center; }
  .cert-title {
    font-family: 'Cormorant Garamond', serif; font-weight: 700; font-size: 124px;
    color: #0c1c38; letter-spacing: 0.02em;
  }
  .cert-subtitle-row { margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 24px; }
  /* Solid color, not a CSS linear-gradient — a gradient that starts from
     a fully transparent stop (this one did: transparent -> gold) renders
     inconsistently across PDF viewers. Confirmed reproducible in Chrome's
     built-in PDF.js viewer specifically: the left flourish (transparent
     -> gold) disappeared while the right one (gold -> transparent, ending
     rather than starting transparent) rendered fine — the same shape
     mirrored, one direction survives PDF export and the other doesn't.
     A flat fill has no such ambiguity in any renderer. */
  .cert-subtitle-row .flourish { width: 190px; height: 2px; background: #c9971f; }
  .cert-subtitle {
    font-family: 'Cormorant Garamond', serif; font-weight: 600; font-size: 41px; letter-spacing: 0.16em;
    text-transform: uppercase; color: #2c2c34;
  }

  .presented-to {
    position: absolute; top: 668px; left: 0; width: 100%; text-align: center;
    font-size: 29px; color: #6b6b7a; font-weight: 500;
  }

  /* ---- dynamic: student name ---- */
  .student-name {
    position: absolute;
    left: ${nameSpec.x}px; top: ${nameSpec.y}px; width: ${nameSpec.width}px; height: ${nameSpec.height}px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Charm', cursive; font-weight: 700;
    font-size: ${nameSize}px; line-height: ${nameSpec.lineHeight};
    color: #0c1c38; white-space: nowrap; overflow: hidden;
  }

  .name-divider { position: absolute; top: 915px; left: 50%; transform: translateX(-50%); width: 680px; }
  .name-divider img { width: 100%; height: auto; display: block; }

  /* ---- dynamic: description ---- */
  .description {
    position: absolute;
    left: ${descSpec.x}px; top: ${descSpec.y}px; width: ${descSpec.width}px; height: ${descSpec.height}px;
    font-family: 'Cormorant Garamond', serif; font-weight: 500;
    font-size: ${descSize}px; line-height: ${descSpec.lineHeight};
    color: #3c3c48; text-align: center; overflow: hidden;
  }
  .description b { color: #0c1c38; font-weight: 700; }

  /* ---- footer: signatures + badge (must stay left of the 78% mark —
     the bottom-right crystal wedge is present at this height) ---- */
  .footer-row {
    position: absolute; top: 1213px; left: ${FOOTER_LEFT}px; width: ${FOOTER_RIGHT - FOOTER_LEFT}px;
    display: flex; align-items: flex-end; justify-content: space-between;
  }
  /* margin-bottom shifts the WHOLE column (image, line, role, org — as
     one block, their relative positions to each other unchanged) up from
     the shared bottom-alignment line footer-row uses (align-items:
     flex-end). .qr-wrap has no such margin, so it's untouched. */
  .sig { width: 380px; text-align: center; margin-bottom: 15px; }
  .sig-slot { height: 110px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6px; padding-bottom: 32px; }
  .sig-img { max-height: 78px; max-width: 340px; object-fit: contain; }
  .sig-placeholder {
    width: 100%; height: 100%; border: 1.5px dashed #c8c8ba; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: #b7b7a8; text-transform: uppercase; letter-spacing: 0.08em;
  }
  .sig .line { border-top: 1.5px solid #9db08a; }
  .sig .role { margin-top: 10px; font-size: 28px; font-weight: 700; color: #1c1c24; }
  .sig .org { font-size: 18px; color: #6b6b7a; margin-top: 2px; }

  /* ---- footer center column: QR code (replaces the old badge/seal
     image), with the date and "Scan to verify" styled to match the
     signature blocks' .role/.org typography either side, so all three
     footer columns read as one consistent family. ---- */
  .qr-wrap { width: 280px; text-align: center; flex-shrink: 0; }
  /* 180px on this canvas prints at ~23mm — real decode testing (jsQR
     against rendered output, with simulated blur for a realistic phone
     photo) showed the previous 130px/16.5mm size decoded but with very
     thin margin against a poor-quality scan; 180px keeps comfortable
     headroom for bad lighting, an off-angle photo, or a lower-quality
     printout, without needing any other layout change. */
  .qr-code { width: 180px; height: 180px; display: block; margin: 0 auto; border-radius: 4px; }
  .qr-reserve {
    width: 180px; height: 180px; border: 1.5px dashed #c8c8ba; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; margin: 0 auto;
    font-size: 12px; color: #b7b7a8; text-transform: uppercase; letter-spacing: 0.08em;
  }
  .qr-wrap .qr-date { margin-top: 10px; font-size: 28px; font-weight: 700; color: #1c1c24; }
  .qr-wrap .qr-hint { font-size: 18px; color: #6b6b7a; margin-top: 2px; }
</style>
</head>
<body>
  <div class="iml-watermark"><img src="${imlLogo}" alt="" /></div>
  <div class="amity-header"><img src="${amityLogo}" alt="Amity Group of Schools" /></div>

  <div class="title-block">
    <div class="cert-title">CERTIFICATE</div>
    <div class="cert-subtitle-row">
      <span class="flourish"></span>
      <span class="cert-subtitle">of Participation</span>
      <span class="flourish right"></span>
    </div>
  </div>

  <div class="presented-to">This certificate is proudly presented to</div>

  <div class="student-name" id="studentName">${esc(data.studentName)}</div>
  <div class="name-divider"><img src="${divider}" alt="" /></div>

  <div class="description" id="description">${buildDescription(data, brand.descriptionTemplate)}</div>

  <div class="footer-row">
    ${renderSignature(sigLeft)}
    <div class="qr-wrap">
      ${
        qrCodeDataUrl
          ? `<img class="qr-code" src="${qrCodeDataUrl}" alt="Scan to verify this certificate" />`
          : `<span class="qr-reserve">QR</span>`
      }
      <div class="qr-date">${esc(data.eventDate)}</div>
      <div class="qr-hint">Scan to verify</div>
    </div>
    ${renderSignature(sigRight)}
  </div>
</body>
</html>`;
}
