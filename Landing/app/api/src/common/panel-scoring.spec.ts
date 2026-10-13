import { standardEdpaScale } from './scorecard-config';
import { FormSnapshot, buildSnapshot, normalizePanelSettings, panelPublishIssues, standardScaleOptions, toCompetency, validateCompetency, validatePanelSettings } from './panel-form';
import { RatingMap, aggregateStage, combine, rankResults, validateRating } from './panel-scoring';

const scale = standardEdpaScale();
const std = standardScaleOptions(scale);

const q = (code: string, label: string, dimension: string, weight = 1) => ({
  code, label, category: dimension, prompt: `${label} observed`, options: std.options, optionPoints: std.points, optionHints: std.hints, weight,
});

const form: FormSnapshot = buildSnapshot({ code: 'AS9', title: 'Live Showdown' }, [q('AS9-Q1', 'Critical Thinking', 'THINK'), q('AS9-Q2', 'Empathy', 'CONNECT'), q('AS9-Q3', 'Decision Making', 'LEAD', 2)], normalizePanelSettings({ requiredRaters: 2, disagreementGap: 2 }));

const rating = (panelistId: number, idx: [number, number, number]) => ({
  panelistId,
  ratings: Object.fromEntries(['AS9-Q1', 'AS9-Q2', 'AS9-Q3'].map((c, i) => [c, { optionIndex: idx[i], points: std.points[idx[i]] }])) as RatingMap,
});

describe('panel form settings and competencies', () => {
  it('fills the standard scale from a level scale', () => {
    expect(std.options).toEqual(['Emerging', 'Developing', 'Proficient', 'Advanced']);
    expect(std.points).toEqual([1, 2, 3, 4]);
    expect(std.hints[3]).toMatch(/maturity/i);
  });
  it('reads settings with defaults and limits', () => {
    expect(normalizePanelSettings(undefined)).toMatchObject({ requiredRaters: 2, disagreementGap: 2, method: 'mean', requireComment: false });
    expect(normalizePanelSettings({ requiredRaters: 99, method: 'trimmed' })).toMatchObject({ requiredRaters: 9, method: 'trimmed' });
    expect(validatePanelSettings({ requiredRaters: 0 })).toHaveLength(1);
    expect(validatePanelSettings({ method: 'median' })).toHaveLength(1);
  });
  it('validates a competency', () => {
    const ok = { label: 'Empathy', dimension: 'CONNECT', prompt: 'p', options: std.options, points: std.points, hints: std.hints, weight: 1 };
    expect(validateCompetency(ok)).toEqual([]);
    expect(validateCompetency({ ...ok, label: ' ' })).toContain('Give the competency a name.');
    expect(validateCompetency({ ...ok, options: ['a'], points: [1] })).toContain('A competency needs at least two rating options.');
    expect(validateCompetency({ ...ok, points: [1, 2, 3] })).toContain('Give points for every option.');
    expect(validateCompetency({ ...ok, points: [1, 3, 2, 4] }).join()).toMatch(/go up/);
    expect(validateCompetency({ ...ok, weight: 0 }).join()).toMatch(/weight/);
  });
  it('lists what stops a form being published', () => {
    expect(panelPublishIssues([], form.settings)).toEqual(['Add at least one competency before publishing.']);
    expect(panelPublishIssues([q('a', 'X', 'D'), q('b', 'x', 'D')], form.settings)).toContain('The competency name "x" is used twice.');
    expect(panelPublishIssues([q('a', 'X', 'D'), q('b', 'Y', 'D')], form.settings)).toEqual([]);
  });
  it('keeps option order and hints in a competency', () => {
    const c = toCompetency(q('Q', 'Empathy', 'CONNECT'));
    expect(c.options.map((o) => o.label)).toEqual(['Emerging', 'Developing', 'Proficient', 'Advanced']);
    expect(c.options[0].hint).toMatch(/Beginning/);
  });
});

describe('validateRating', () => {
  it('takes points from the form, not the request', () => {
    const r = validateRating(form, { 'AS9-Q1': { optionIndex: 3 } }, { requireAll: false });
    expect(r.errors).toEqual([]);
    expect(r.ratings['AS9-Q1']).toEqual({ optionIndex: 3, points: 4 });
  });
  it('allows a partial draft but requires everything on submit', () => {
    expect(validateRating(form, { 'AS9-Q1': { optionIndex: 1 } }, { requireAll: false }).errors).toEqual([]);
    const s = validateRating(form, { 'AS9-Q1': { optionIndex: 1 } }, { requireAll: true });
    expect(s.errors).toEqual(['Empathy: choose a rating.', 'Decision Making: choose a rating.']);
  });
  it('rejects an unknown competency and an out-of-range option', () => {
    const r = validateRating(form, { NOPE: { optionIndex: 0 }, 'AS9-Q2': { optionIndex: 9 } }, { requireAll: false });
    expect(r.errors).toHaveLength(2);
    expect(Object.keys(r.ratings)).toEqual([]);
  });
  it('asks for comments when the form says so', () => {
    const strict: FormSnapshot = { ...form, settings: { ...form.settings, requireComment: true } };
    const all = { 'AS9-Q1': { optionIndex: 1, comment: 'x' }, 'AS9-Q2': { optionIndex: 1 }, 'AS9-Q3': { optionIndex: 1, comment: ' ' } };
    expect(validateRating(strict, all, { requireAll: true }).errors).toEqual(['Empathy: a comment is required.', 'Decision Making: a comment is required.']);
  });
});

describe('combine', () => {
  it('is the mean, or the mean without the extremes from three raters', () => {
    expect(combine([1, 3], 'mean')).toBe(2);
    expect(combine([1, 3, 4], 'trimmed')).toBe(3);
    expect(combine([1, 4], 'trimmed')).toBe(2.5);
    expect(combine([1, 2, 3, 4, 4], 'trimmed')).toBeCloseTo(3);
    expect(combine([], 'mean')).toBeNull();
  });
});

describe('aggregateStage', () => {
  it('is NotRated until enough raters have submitted, never zero', () => {
    const r = aggregateStage(form, [rating(1, [3, 3, 3])], scale);
    expect(r).toMatchObject({ status: 'NotRated', ratersCount: 1, requiredRaters: 2, percent: null, levelKey: null });
  });
  it('averages two raters per competency, weights them, and finds the level', () => {
    const r = aggregateStage(form, [rating(1, [3, 2, 3]), rating(2, [3, 2, 3])], scale);
    expect(r.status).toBe('Rated');
    expect(r.competencies.map((c) => c.final)).toEqual([4, 3, 4]);
    // average = (4*1 + 3*1 + 4*2) / 4 = 3.75 ; percent = 15/16 = 93.75
    expect(r.average).toBeCloseTo(3.75);
    expect(r.percent).toBeCloseTo(93.75);
    expect(r.levelKey).toBe('ADVANCED');
  });
  it('mixes ratings and flags a disagreement of two or more levels', () => {
    const r = aggregateStage(form, [rating(1, [0, 3, 3]), rating(2, [3, 3, 3])], scale);
    expect(r.competencies[0]).toMatchObject({ values: [1, 4], mean: 2.5, spread: 3, flagged: true });
    expect(r.flagged).toBe(true);
    expect(r.competencies[1].flagged).toBe(false);
  });
  it('does not flag a one-level difference, and the check can be switched off', () => {
    expect(aggregateStage(form, [rating(1, [1, 3, 3]), rating(2, [2, 3, 3])], scale).flagged).toBe(false);
    const off: FormSnapshot = { ...form, settings: { ...form.settings, disagreementGap: 0 } };
    expect(aggregateStage(off, [rating(1, [0, 3, 3]), rating(2, [3, 3, 3])], scale).flagged).toBe(false);
  });
  it("an admin's decision replaces the average and clears the flag", () => {
    const r = aggregateStage(form, [rating(1, [0, 3, 3]), rating(2, [3, 3, 3])], scale, { overrides: { 'AS9-Q1': 3 } });
    expect(r.competencies[0]).toMatchObject({ mean: 2.5, final: 3, adjudicated: true, flagged: false, levelKey: 'PROFICIENT' });
    expect(r.flagged).toBe(false);
  });
  it('a different number of required raters can be given', () => {
    expect(aggregateStage(form, [rating(1, [3, 3, 3])], scale, { requiredRaters: 1 }).status).toBe('Rated');
    expect(aggregateStage(form, [rating(1, [3, 3, 3]), rating(2, [3, 3, 3])], scale, { requiredRaters: 3 }).status).toBe('NotRated');
  });
  it('a missing competency rating means not rated', () => {
    const partial = { panelistId: 1, ratings: { 'AS9-Q1': { optionIndex: 3, points: 4 } } };
    expect(aggregateStage(form, [partial, partial], scale).status).toBe('NotRated');
  });
  it('is reproducible: the same ratings in any order give the same result', () => {
    const a = aggregateStage(form, [rating(1, [1, 2, 3]), rating(2, [2, 3, 3]), rating(3, [0, 1, 2])], scale);
    const b = aggregateStage(form, [rating(3, [0, 1, 2]), rating(1, [1, 2, 3]), rating(2, [2, 3, 3])], scale);
    expect(a).toEqual(b);
  });
  it('trimmed mean drops the extremes when asked', () => {
    const trimmed: FormSnapshot = { ...form, settings: { ...form.settings, method: 'trimmed', disagreementGap: 0 } };
    const r = aggregateStage(trimmed, [rating(1, [0, 0, 0]), rating(2, [2, 2, 2]), rating(3, [3, 3, 3])], scale, { requiredRaters: 3 });
    expect(r.competencies[0].mean).toBe(3);
  });
});

describe('rankResults', () => {
  it('orders by score, then top-level competencies, then registration, with no ties left', () => {
    const ranked = rankResults([
      { registrationId: 5, percent: 80, topLevelCount: 1 },
      { registrationId: 2, percent: 90, topLevelCount: 0 },
      { registrationId: 4, percent: 80, topLevelCount: 2 },
      { registrationId: 3, percent: 80, topLevelCount: 1 },
    ]);
    expect(ranked.map((r) => r.registrationId)).toEqual([2, 4, 3, 5]);
  });
});
