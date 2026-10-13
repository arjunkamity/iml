import {
  MAX_CODE_ATTEMPTS,
  codesMatch,
  hashCode,
  hashToken,
  linkState,
  mayShare,
  newCode,
  newToken,
  normalizeDeliverySettings,
  releaseState,
  sectionVisibleTo,
  validateDeliverySettings,
  variantAudiences,
  visibleReport,
} from './report-access';
import { normalizeTemplateConfig, validateTemplateConfig } from './report-template';
import { buildStageDocument } from './report-document';
import { buildIndex } from './content-library';

const d = (s: string) => new Date(s);

describe('delivery settings', () => {
  it('defaults to consent required, student notified, 30 days', () => {
    expect(normalizeDeliverySettings(undefined)).toEqual({ consentRequired: true, notifyStudent: true, linkValidDays: 30 });
    expect(normalizeDeliverySettings({})).toEqual({ consentRequired: true, notifyStudent: true, linkValidDays: 30 });
  });
  it('reads explicit values and clamps the link lifetime', () => {
    expect(normalizeDeliverySettings({ consentRequired: false, notifyStudent: false, linkValidDays: 7 })).toEqual({ consentRequired: false, notifyStudent: false, linkValidDays: 7 });
    expect(normalizeDeliverySettings({ linkValidDays: 9999 }).linkValidDays).toBe(180);
    expect(normalizeDeliverySettings({ linkValidDays: 0 }).linkValidDays).toBe(1);
  });
  it('validates what an admin posts', () => {
    expect(validateDeliverySettings({ consentRequired: true, linkValidDays: 14 })).toEqual([]);
    expect(validateDeliverySettings({ consentRequired: 'yes' })).toHaveLength(1);
    expect(validateDeliverySettings({ linkValidDays: 400 })).toHaveLength(1);
    expect(validateDeliverySettings(null)).toHaveLength(1);
  });
});

describe('who sees which section', () => {
  it('a section with no audiences is for everyone', () => {
    expect(sectionVisibleTo({}, 'parent')).toBe(true);
    expect(sectionVisibleTo({ audiences: ['student'] }, 'parent')).toBe(false);
    expect(sectionVisibleTo({ audiences: ['student', 'parent'] }, 'parent')).toBe(true);
  });
  it('only audiences that miss a shown section need their own copy', () => {
    expect(variantAudiences([{ enabled: true }, { enabled: true }])).toEqual([]);
    expect(variantAudiences([{ enabled: true, audiences: ['student'] }])).toEqual(['parent', 'school']);
    expect(variantAudiences([{ enabled: false, audiences: ['student'] }])).toEqual([]);
    expect(variantAudiences([{ enabled: true, audiences: ['school'] }, { enabled: true, audiences: ['student', 'school'] }])).toEqual(['student', 'parent']);
  });
});

describe('consent', () => {
  const on = normalizeDeliverySettings({});
  const off = normalizeDeliverySettings({ consentRequired: false });
  it('the student always sees their own report', () => {
    expect(mayShare('student', on, false)).toEqual({ allowed: true });
  });
  it('parent and school need consent when the season asks for it', () => {
    expect(mayShare('parent', on, false)).toEqual({ allowed: false, reason: 'The student has not agreed to share reports with their parent.' });
    expect(mayShare('school', on, false).allowed).toBe(false);
    expect(mayShare('parent', on, true).allowed).toBe(true);
    expect(mayShare('school', off, false).allowed).toBe(true);
  });
});

describe('release', () => {
  const row = (version: number, over: object = {}) => ({ version, status: 'Ready', releasedAt: d('2026-10-13'), withdrawnAt: null, ...over });
  it('is invisible until released', () => {
    expect(releaseState({ releasedAt: null, withdrawnAt: null })).toBe('Not released');
    expect(visibleReport([row(1, { releasedAt: null })])).toBeNull();
  });
  it('shows the newest released version that is not withdrawn', () => {
    expect(visibleReport([row(1), row(2)])?.version).toBe(2);
    expect(visibleReport([row(1), row(2, { releasedAt: null })])?.version).toBe(1);
    expect(visibleReport([row(1), row(2, { withdrawnAt: d('2026-10-14') })])?.version).toBe(1);
    expect(releaseState({ releasedAt: d('2026-10-13'), withdrawnAt: d('2026-10-14') })).toBe('Withdrawn');
  });
  it('never shows a report that is not Ready', () => {
    expect(visibleReport([row(1, { status: 'Queued' }), row(2, { status: 'Failed' })])).toBeNull();
  });
});

describe('parent link', () => {
  const ok = { expiresAt: d('2026-11-01'), revokedAt: null, attempts: 0 };
  const now = d('2026-10-13');
  it('works until it expires, is revoked or is locked', () => {
    expect(linkState(ok, now)).toBe('ok');
    expect(linkState({ ...ok, expiresAt: d('2026-10-12') }, now)).toBe('expired');
    expect(linkState({ ...ok, revokedAt: d('2026-10-12') }, now)).toBe('revoked');
    expect(linkState({ ...ok, attempts: MAX_CODE_ATTEMPTS }, now)).toBe('locked');
    expect(linkState({ ...ok, attempts: MAX_CODE_ATTEMPTS - 1 }, now)).toBe('ok');
  });
  it('makes unguessable tokens and 6-digit codes', () => {
    const t = newToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(t);
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });
  it('checks a code against its hash without revealing it', () => {
    const tokenHash = hashToken('token-1');
    const stored = hashCode(tokenHash, '012345');
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(codesMatch(stored, hashCode(tokenHash, ' 012345 '))).toBe(true);
    expect(codesMatch(stored, hashCode(tokenHash, '012346'))).toBe(false);
    expect(codesMatch(stored, hashCode(hashToken('token-2'), '012345'))).toBe(false);
    expect(codesMatch(stored, 'zz')).toBe(false);
  });
});

describe('template sections and audiences', () => {
  const tpl = normalizeTemplateConfig({
    sections: [
      { key: 'intro', type: 'intro', enabled: true, labels: { title: 'Intro' } },
      { key: 'note', type: 'disclaimer', enabled: true, labels: { title: 'Note' }, audiences: ['student', 'bogus'] },
      { key: 'mantra', type: 'mantra', enabled: true, labels: { title: 'Mantra' }, audiences: ['school'] },
    ],
  });
  it('keeps only real audiences when reading a template', () => {
    expect(tpl.sections[1].audiences).toEqual(['student']);
  });
  it('refuses a section nobody can see', () => {
    const t = normalizeTemplateConfig({ sections: [{ key: 'a', type: 'intro', enabled: true, labels: { title: 'x' }, audiences: [] }] });
    expect(validateTemplateConfig(t)).toContain('Section 1 (Introduction): choose who sees it, or leave it for everyone.');
    expect(validateTemplateConfig(tpl)).toEqual([]);
  });
  it('leaves out the sections hidden from an audience, and keeps everything in the admin copy', () => {
    const input = {
      student: { code: 'S1', name: 'A B', grade: '9', school: null, gender: null },
      competition: { code: 'C', title: 'C' },
      stage: { position: 1, name: 'One' },
      season: null,
      framework: { code: 'F', name: 'F', version: 1 },
      scale: { key: 'K', name: 'K', levels: [] },
      report: { dimensions: [], unmapped: [], totals: { correct: 0, total: 0, percent: null }, minQuestionsPerArea: 5 },
    };
    const o = { template: tpl, index: buildIndex([]), language: 'en', defaultLanguage: 'en' };
    expect(buildStageDocument(input, o).sections.map((s) => s.key)).toEqual(['intro', 'note', 'mantra']);
    expect(buildStageDocument(input, { ...o, audience: 'student' }).sections.map((s) => s.key)).toEqual(['intro', 'note']);
    expect(buildStageDocument(input, { ...o, audience: 'parent' }).sections.map((s) => s.key)).toEqual(['intro']);
    expect(buildStageDocument(input, { ...o, audience: 'school' }).sections.map((s) => s.key)).toEqual(['intro', 'mantra']);
  });
});
