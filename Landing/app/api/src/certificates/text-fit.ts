import type { Page } from 'playwright';
import { CertificateFieldSpec } from './templates/participation-v1';

export interface FitResult {
  /** The largest font size (px) that fits inside the field's box, or null if
   * nothing between fontSize and minFontSize fits — caller must treat that
   * as REVIEW_REQUIRED, never fall back to an unchecked size. */
  fit: number | null;
  testedText: string;
}

const STEP_PX = 2;

/**
 * Measures the ACTUAL rendered element (real browser layout, real font
 * metrics — not an estimate from character count) and binary-walks the
 * font size down from spec.fontSize to spec.minFontSize until it stops
 * overflowing its reserved box. The element must already be in the DOM
 * with id === spec.key.
 */
export async function fitField(page: Page, spec: CertificateFieldSpec): Promise<FitResult> {
  let size = spec.fontSize;
  let fit: number | null = null;

  while (size >= spec.minFontSize) {
    const overflow = await page.evaluate(
      ({ id, px }) => {
        const el = document.getElementById(id) as HTMLElement | null;
        if (!el) return true;
        el.style.fontSize = px + 'px';
        // Reflow-accurate overflow check: covers both the single-line
        // (nowrap, width-based) and multi-line (wrap, height-based) cases
        // with one rule — if the text no longer fits its reserved box in
        // either dimension, it overflows.
        return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      },
      { id: spec.key, px: size },
    );

    if (!overflow) {
      fit = size;
      break;
    }
    size -= STEP_PX;
  }

  const testedText = await page.evaluate((id) => document.getElementById(id)?.textContent ?? '', spec.key);

  if (fit == null) {
    // Leave the element rendered at minFontSize so a reviewer looking at
    // the (rejected) preview can actually see where/how it overflows,
    // rather than silently reverting to the original oversized text.
    await page.evaluate(
      ({ id, px }) => {
        const el = document.getElementById(id) as HTMLElement | null;
        if (el) el.style.fontSize = px + 'px';
      },
      { id: spec.key, px: spec.minFontSize },
    );
  }

  return { fit, testedText };
}
