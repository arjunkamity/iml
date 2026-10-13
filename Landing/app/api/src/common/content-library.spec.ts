import {
  ApprovedText,
  buildIndex,
  conjugate,
  kindByKey,
  pronounsFor,
  renderTemplate,
  resolveList,
  resolveText,
  templateTokens,
  validateTemplate,
} from './content-library';

describe('pronouns and verbs: neutral by default', () => {
  it('uses they/them/their/themself unless a gender is recorded', () => {
    for (const g of [undefined, null, '', 'Other', 'prefer not to say', 'x']) {
      expect(pronounsFor(g)).toMatchObject({ subject: 'they', object: 'them', possessive: 'their', reflexive: 'themself', plural: true });
    }
  });

  it('uses he or she only for a recorded gender, in any common spelling', () => {
    expect(pronounsFor('Male').subject).toBe('he');
    expect(pronounsFor(' m ').possessive).toBe('his');
    expect(pronounsFor('FEMALE').subject).toBe('she');
    expect(pronounsFor('girl').reflexive).toBe('herself');
  });

  it('conjugates a verb to agree with the pronoun', () => {
    expect(conjugate('demonstrate', false)).toBe('demonstrates');
    expect(conjugate('demonstrate', true)).toBe('demonstrate');
    expect(conjugate('reach', false)).toBe('reaches');
    expect(conjugate('try', false)).toBe('tries');
    expect(conjugate('play', false)).toBe('plays');
    expect(conjugate('go', false)).toBe('goes');
    expect(conjugate('have', false)).toBe('has');
    expect(conjugate('have', true)).toBe('have');
    expect(conjugate('be', false)).toBe('is');
    expect(conjugate('be', true)).toBe('are');
  });
});

describe('renderTemplate', () => {
  const t = '{Subject} {verb:demonstrate} strong reasoning. {Subject} {verb:consider} {possessive} choices and {verb:trust} {reflexive}.';

  it('reads naturally with neutral wording when no gender is recorded', () => {
    expect(renderTemplate(t, { name: 'Aarav Mehta' }).text).toBe('They demonstrate strong reasoning. They consider their choices and trust themself.');
  });

  it('agrees with a recorded gender', () => {
    expect(renderTemplate(t, { name: 'Aarav Mehta', gender: 'Male' }).text).toBe('He demonstrates strong reasoning. He considers his choices and trusts himself.');
    expect(renderTemplate('{Subject} {verb:be} ready and {verb:have} {possessive} plan.', { gender: 'F' }).text).toBe('She is ready and has her plan.');
    expect(renderTemplate('{Subject} {verb:be} ready and {verb:have} {possessive} plan.', {}).text).toBe('They are ready and have their plan.');
  });

  it('fills the simple placeholders, deriving the first name', () => {
    const r = renderTemplate('{FirstName} scored {Level} in {Competency} ({Dimension}), {Stage}, {Competition}, {Edition}.', {
      name: 'Aarav Mehta', level: 'Proficient', competency: 'Logical Reasoning', dimension: 'THINK', stage: 'Online Challenge', competition: 'IML2026', edition: '1st Edition',
    });
    expect(r.text).toBe('Aarav scored Proficient in Logical Reasoning (THINK), Online Challenge, IML2026, 1st Edition.');
    expect(r.missing).toEqual([]);
  });

  it('leaves a placeholder with no value in place and reports it, so a data gap is visible', () => {
    const r = renderTemplate('{Name} reached {Level}.', { name: 'Aarav' });
    expect(r.text).toBe('Aarav reached {Level}.');
    expect(r.missing).toEqual(['Level']);
  });

  it('leaves a text with no placeholders untouched', () => {
    expect(renderTemplate('Think wisely. Feel deeply.', {}).text).toBe('Think wisely. Feel deeply.');
  });
});

describe('validateTemplate', () => {
  it('accepts every documented placeholder', () => {
    expect(validateTemplate('{Name} {FirstName} {Dimension} {Competency} {Level} {Edition} {Stage} {Competition} {subject} {Subject} {object} {possessive} {Possessive} {reflexive} {verb:demonstrate}')).toEqual([]);
  });
  it('reports unknown placeholders and stray braces', () => {
    expect(validateTemplate('Hello {name}')[0]).toMatch(/"\{name\}" is not a placeholder/);
    expect(validateTemplate('Hello {Nme} and {verb:}').length).toBe(2);
    expect(validateTemplate('Hello {Name').join(' ')).toMatch(/stray/);
    expect(validateTemplate('Hello }')).toHaveLength(1);
  });
  it('lists the tokens in order', () => {
    expect(templateTokens('{Name} and {Level}')).toEqual(['Name', 'Level']);
  });
});

const item = (over: Partial<ApprovedText>): ApprovedText => ({
  kind: 'strength', key: 'EMPATHY', levelKey: 'ADVANCED', language: 'en', position: 0, title: null, text: 'text', version: 1, ...over,
});

describe('resolveText', () => {
  const idx = buildIndex([
    item({ text: 'specific', key: 'EMPATHY', levelKey: 'ADVANCED' }),
    item({ text: 'default for any competency at Advanced', key: '*', levelKey: 'ADVANCED' }),
    item({ text: 'default for any competency and level', key: '*', levelKey: 'ADVANCED'.replace('ADVANCED', '') }),
    item({ text: 'hindi specific', key: 'EMPATHY', levelKey: 'ADVANCED', language: 'hi' }),
    item({ text: 'only in english', key: 'LISTENING', levelKey: 'ADVANCED', language: 'en' }),
  ]);
  const q = (over: object) => resolveText(idx, { kind: 'strength', key: 'EMPATHY', level: 'ADVANCED', language: 'en', defaultLanguage: 'en', ...over });

  it('finds the specific text first', () => {
    expect(q({})).toMatchObject({ source: 'exact', item: { text: 'specific' } });
  });

  it('falls back to the wildcard default for that level, then for any level', () => {
    expect(q({ key: 'COLLABORATION' })).toMatchObject({ source: 'default', item: { text: 'default for any competency at Advanced' } });
    expect(q({ key: 'COLLABORATION', level: 'DEVELOPING' })).toMatchObject({ source: 'default', item: { text: 'default for any competency and level' } });
  });

  it('is "missing" when nothing is written, so the preview can flag it', () => {
    const empty = buildIndex([]);
    expect(resolveText(empty, { kind: 'strength', key: 'EMPATHY', level: 'ADVANCED', language: 'en', defaultLanguage: 'en' })).toEqual({ item: null, source: 'missing' });
  });

  it('prefers the requested language, then the library default language', () => {
    expect(q({ language: 'hi' })).toMatchObject({ source: 'exact', item: { text: 'hindi specific', language: 'hi' } });
    expect(q({ language: 'hi', key: 'LISTENING' })).toMatchObject({ source: 'language_fallback', item: { text: 'only in english' } });
    expect(q({ language: 'hi', key: 'UNKNOWN' }).source).toBe('default_language_fallback');
  });

  it('ignores level for kinds that are not written by level, and uses no wildcard for kinds with no scope', () => {
    const one = buildIndex([item({ kind: 'mantra', key: '', levelKey: '', text: 'Think wisely.' })]);
    expect(resolveText(one, { kind: 'mantra', level: 'ADVANCED', language: 'en', defaultLanguage: 'en' }).item?.text).toBe('Think wisely.');
    expect(kindByKey('mantra')?.scope).toBe('none');
  });
});

describe('resolveList', () => {
  const idx = buildIndex([
    item({ kind: 'reflection', key: '', levelKey: '', position: 2, text: 'second' }),
    item({ kind: 'reflection', key: '', levelKey: '', position: 1, text: 'first' }),
    item({ kind: 'challenge', key: 'THINK', levelKey: '', position: 1, title: 'THINK', text: 'week 1' }),
    item({ kind: 'reflection', key: '', levelKey: '', position: 1, language: 'hi', text: 'pehla' }),
  ]);
  const l = (q: object) => resolveList(idx, { kind: 'reflection', language: 'en', defaultLanguage: 'en', ...q });

  it('returns a list in order', () => {
    expect(l({}).items.map((i) => i.text)).toEqual(['first', 'second']);
  });
  it('scopes a list to its dimension', () => {
    expect(resolveList(idx, { kind: 'challenge', key: 'THINK', language: 'en', defaultLanguage: 'en' }).items.map((i) => i.text)).toEqual(['week 1']);
    expect(resolveList(idx, { kind: 'challenge', key: 'FEEL', language: 'en', defaultLanguage: 'en' })).toEqual({ items: [], source: 'missing' });
  });
  it('uses the requested language when it has the list, else the default language', () => {
    expect(l({ language: 'hi' })).toMatchObject({ source: 'exact', items: [{ text: 'pehla' }] });
    expect(resolveList(idx, { kind: 'challenge', key: 'THINK', language: 'hi', defaultLanguage: 'en' }).source).toBe('language_fallback');
  });
});
