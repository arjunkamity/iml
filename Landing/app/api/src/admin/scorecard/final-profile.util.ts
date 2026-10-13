import type { AssessmentConfig } from '../../common/assessment-scoring';

/** A written assessment's config, read tolerantly. */
export function asConfig(raw: unknown): AssessmentConfig {
  const c = (raw ?? {}) as Partial<AssessmentConfig>;
  return { dimensions: Array.isArray(c.dimensions) ? c.dimensions : [], consent: c.consent ?? '', disclaimer: c.disclaimer ?? '', howScored: c.howScored ?? '' };
}

/** A capacity key as a competency key. */
export const scoreKey = (key: string): string => key.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
