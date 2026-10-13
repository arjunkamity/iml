import { BadRequestException } from '@nestjs/common';
import { gradeMatches } from '../../common/util';
import { normalizeGrades, publishIssues, validateDimensions } from './assessments-admin.service';

const dim = (over: Record<string, unknown> = {}) => ({
  key: 'THINK',
  label: 'Think',
  intro: '',
  practice: '',
  bands: [
    { label: 'Low', min: 0, max: 3, summary: '' },
    { label: 'High', min: 4, max: 8, summary: '' },
  ],
  ...over,
});

const q = (code: string, category: string, points: number[]) => ({
  id: 1,
  code,
  category,
  prompt: 'p',
  options: points.map((_, i) => `o${i}`),
  optionPoints: points,
});

describe('normalizeGrades', () => {
  it('expands a range, which gradeMatches would otherwise read as only the two ends', () => {
    expect(gradeMatches('9-12', '10')).toBe(false); // the pitfall being guarded against
    const grades = normalizeGrades('9-12')!;
    expect(grades).toBe('9,10,11,12');
    for (const g of ['9', '10', '11', '12']) expect(gradeMatches(grades, g)).toBe(true);
    expect(gradeMatches(grades, '8')).toBe(false);
  });
  it('accepts lists, mixes, spaces and duplicates', () => {
    expect(normalizeGrades('10, 9 ,9')).toBe('9,10');
    expect(normalizeGrades('6-7,9')).toBe('6,7,9');
  });
  it('treats blank / all / any as every grade', () => {
    expect(normalizeGrades('')).toBeNull();
    expect(normalizeGrades('  ')).toBeNull();
    expect(normalizeGrades('All')).toBeNull();
    expect(normalizeGrades(undefined)).toBeNull();
  });
  it('rejects nonsense', () => {
    expect(() => normalizeGrades('ten')).toThrow(BadRequestException);
    expect(() => normalizeGrades('12-9')).toThrow(BadRequestException);
    expect(() => normalizeGrades('0')).toThrow(BadRequestException);
    expect(() => normalizeGrades('9-13')).toThrow(BadRequestException);
  });
});

describe('validateDimensions', () => {
  it('accepts a sound capacity', () => {
    expect(validateDimensions([dim()])).toEqual([]);
  });
  it('needs at least one capacity', () => {
    expect(validateDimensions([])).toHaveLength(1);
    expect(validateDimensions(undefined)).toHaveLength(1);
  });
  it('rejects bad or duplicate keys and missing labels', () => {
    expect(validateDimensions([dim({ key: 'think' })]).join(' ')).toMatch(/key must be/);
    expect(validateDimensions([dim(), dim()]).join(' ')).toMatch(/used twice/);
    expect(validateDimensions([dim({ label: ' ' })]).join(' ')).toMatch(/label is required/);
  });
  it('rejects overlapping and inverted bands', () => {
    const overlap = dim({ bands: [{ label: 'A', min: 0, max: 5, summary: '' }, { label: 'B', min: 5, max: 8, summary: '' }] });
    expect(validateDimensions([overlap]).join(' ')).toMatch(/overlap/);
    const inverted = dim({ bands: [{ label: 'A', min: 6, max: 2, summary: '' }] });
    expect(validateDimensions([inverted]).join(' ')).toMatch(/min ≤ max/);
  });
});

describe('publishIssues', () => {
  const config = (dimensions: unknown[]) => ({ dimensions, consent: '', disclaimer: '', howScored: '' }) as never;

  it('is empty when every capacity has questions and its bands cover the possible scores', () => {
    // two questions of 1..4 points => 2..8, covered by 0-3 and 4-8
    expect(publishIssues(config([dim()]), [q('A-Q1', 'THINK', [1, 2, 3, 4]), q('A-Q2', 'THINK', [1, 2, 3, 4])])).toEqual([]);
  });
  it('blocks an assessment with no questions', () => {
    expect(publishIssues(config([dim()]), []).join(' ')).toMatch(/Add questions/);
  });
  it('blocks a capacity with no questions and a question tagged with an unknown capacity', () => {
    const issues = publishIssues(config([dim(), dim({ key: 'LEAD', label: 'Lead' })]), [q('A-Q1', 'THINK', [1, 4]), q('A-Q2', 'NOPE', [1, 4])]).join(' ');
    expect(issues).toMatch(/Lead has no questions/);
    expect(issues).toMatch(/NOPE/);
  });
  it('blocks bands that leave some reachable scores uncovered', () => {
    const gappy = dim({ bands: [{ label: 'Low', min: 0, max: 2, summary: '' }, { label: 'High', min: 6, max: 8, summary: '' }] });
    const issues = publishIssues(config([gappy]), [q('A-Q1', 'THINK', [1, 4]), q('A-Q2', 'THINK', [1, 4])]).join(' ');
    expect(issues).toMatch(/no band covers 3, 4, 5/);
  });
  it('blocks questions whose points do not line up with their options', () => {
    const bad = { ...q('A-Q1', 'THINK', [1, 2, 3, 4]), optionPoints: [1, 2] };
    expect(publishIssues(config([dim()]), [bad]).join(' ')).toMatch(/needs points for every option/);
  });
});
