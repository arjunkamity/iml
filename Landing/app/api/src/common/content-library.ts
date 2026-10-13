// The scorecard content library (#72): which kinds of wording exist, the placeholders
// a text may use, how a text is rendered for a student (with neutral pronouns by
// default), and how the right text is found, falling back when nothing specific is
// written. Pure and DB-free. No report wording lives here or anywhere in code: this
// only describes the shape of the library; the text itself is data an admin edits
// and approves.

export const WILDCARD = '*';

export type TextScope = 'competency' | 'dimension' | 'stage' | 'style' | 'none';

export interface TextKind {
  key: string;
  label: string;
  help: string;
  /** What the text is about: a competency, a dimension, a stage (its position number), or nothing in particular. */
  scope: TextScope;
  /** Written once per level of the scale. */
  byLevel: boolean;
  /** A list: several items in a fixed order (weeks, questions, paragraphs). */
  ordered: boolean;
  /** Each item also has a short title (a heading or a label). */
  titled: boolean;
}

export const TEXT_KINDS: TextKind[] = [
  { key: 'report_intro', label: 'Report introduction', help: 'The opening paragraph of the report.', scope: 'none', byLevel: false, ordered: false, titled: false },
  { key: 'stage_intro', label: 'Stage introduction', help: 'What a stage assesses, shown at the start of its section. Key is the stage number; the title is the sub-heading (for example Intellectual Intelligence Profile).', scope: 'stage', byLevel: false, ordered: false, titled: true },
  { key: 'dimension_strength', label: 'Dimension strengths paragraph', help: 'The paragraph under "Your strengths" for a dimension at a level (leave the level empty to use it for any level).', scope: 'dimension', byLevel: true, ordered: false, titled: false },
  { key: 'dimension_growth', label: 'Dimension development opportunity', help: 'The "Development opportunity" paragraph for a dimension at a level.', scope: 'dimension', byLevel: true, ordered: false, titled: false },
  { key: 'dimension_practice', label: 'Dimension practice', help: 'The "Build your ... intelligence" practice paragraph for a dimension.', scope: 'dimension', byLevel: true, ordered: false, titled: false },
  { key: 'strength', label: 'Strength (top strengths list)', help: 'One strength a student at this level of a competency can be told about. The title is its name (for example Ethical Judgment), the text what it means.', scope: 'competency', byLevel: true, ordered: false, titled: true },
  { key: 'growth', label: 'Growth opportunity (growth list)', help: 'One growth opportunity for a competency at this level. The title is its name, the text what to do.', scope: 'competency', byLevel: true, ordered: false, titled: true },
  { key: 'dimension_note', label: 'Dimension note', help: 'A short observation about a dimension at a level (the Bootcamp observation: "THINK – Advanced: You approach challenges analytically ...").', scope: 'dimension', byLevel: true, ordered: false, titled: false },
  { key: 'dimension_reflects', label: 'What the dimension reflects', help: 'One line in the complete profile table saying what a final level of a dimension reflects.', scope: 'dimension', byLevel: true, ordered: false, titled: false },
  { key: 'profile_line', label: 'Profile in one line', help: 'Templates for the one-line summary. Several can be written; a rule picks one.', scope: 'none', byLevel: false, ordered: true, titled: false },
  { key: 'observer_opening', label: 'Observer note: opening', help: 'The first line of a system-drafted observer or jury note, before the panelist edits it.', scope: 'none', byLevel: false, ordered: false, titled: false },
  { key: 'observer_strength', label: 'Observer note: strength', help: 'A sentence about a competency the student did well in, by level. Never describes specific behaviour: that comes from the panelist notes.', scope: 'competency', byLevel: true, ordered: false, titled: false },
  { key: 'observer_growth', label: 'Observer note: growth area', help: 'A sentence about a competency to develop, by level.', scope: 'competency', byLevel: true, ordered: false, titled: false },
  { key: 'observer_closing', label: 'Observer note: closing', help: 'The last line of a system-drafted observer or jury note.', scope: 'none', byLevel: false, ordered: false, titled: false },
  { key: 'snapshot_reflection', label: 'Snapshot: reflection question', help: 'The question shown in the stage snapshot when this competency is the growth area.', scope: 'competency', byLevel: false, ordered: false, titled: false },
  { key: 'leadership_style', label: 'Leadership style', help: 'One leadership style: the title is its name (for example The Thoughtful Initiator), the text what it means.', scope: 'style', byLevel: false, ordered: false, titled: true },
  { key: 'statement', label: 'Future readiness statement', help: 'The closing statement on the report.', scope: 'none', byLevel: false, ordered: false, titled: false },
  { key: 'challenge', label: '30-day challenge', help: 'The practice for each week, by dimension. Position is the week number.', scope: 'dimension', byLevel: false, ordered: true, titled: true },
  { key: 'reflection', label: 'Self-reflection question', help: 'Questions for the student to reflect on, in order.', scope: 'none', byLevel: false, ordered: true, titled: false },
  { key: 'wisdom', label: 'Ancient wisdom table', help: 'One row per dimension: the title is the capacity name (for example Buddhi), the text its meaning.', scope: 'dimension', byLevel: false, ordered: false, titled: true },
  { key: 'mantra', label: 'IML mantra', help: 'The closing mantra.', scope: 'none', byLevel: false, ordered: false, titled: false },
  { key: 'disclaimer', label: 'Important note', help: 'The disclaimer paragraphs, in order. The title is an optional heading.', scope: 'none', byLevel: false, ordered: true, titled: true },
  { key: 'consent', label: 'Consent text', help: 'The consent wording shown before a report is shared.', scope: 'none', byLevel: false, ordered: false, titled: false },
];

export const kindByKey = (key: string): TextKind | undefined => TEXT_KINDS.find((k) => k.key === key);

/** The lookup key of one text item. Wildcards and empties are part of it. */
export function textId(kind: string, key: string, levelKey: string, language: string, position: number): string {
  return [kind, key, levelKey, language, position].join('|');
}

// ------------------------------------------------------------- placeholders

/** Everything a text may use. {verb:word} is also allowed. */
export const PLACEHOLDERS: { token: string; help: string }[] = [
  { token: 'Name', help: "The student's full name" },
  { token: 'FirstName', help: "The student's first name" },
  { token: 'Dimension', help: 'The dimension (for example THINK)' },
  { token: 'Competency', help: 'The competency, as the stage names it' },
  { token: 'Level', help: 'The level (for example Proficient)' },
  { token: 'Edition', help: 'The edition label' },
  { token: 'Stage', help: 'The stage name' },
  { token: 'Competition', help: 'The competition title' },
  { token: 'subject', help: 'he, she or they ({Subject} starts with a capital)' },
  { token: 'object', help: 'him, her or them' },
  { token: 'possessive', help: 'his, her or their' },
  { token: 'reflexive', help: 'himself, herself or themself' },
  { token: 'verb:demonstrate', help: 'a verb that agrees with {subject}: demonstrates (he, she) or demonstrate (they). Use it right after {subject}; when a text starts with the name, write it in the past tense instead.' },
];

const SIMPLE_TOKENS = new Set(['Name', 'FirstName', 'Dimension', 'Competency', 'Level', 'Edition', 'Stage', 'Competition']);
const PRONOUN_TOKENS = new Set(['subject', 'object', 'possessive', 'reflexive']);

export interface RenderContext {
  name?: string | null;
  firstName?: string | null;
  dimension?: string | null;
  competency?: string | null;
  level?: string | null;
  edition?: string | null;
  stage?: string | null;
  competition?: string | null;
  /** The recorded gender, if any. Unset or anything else gives neutral wording. */
  gender?: string | null;
}

export interface Pronouns {
  subject: string;
  object: string;
  possessive: string;
  reflexive: string;
  /** "they" takes a plural verb; he and she take the -s form. */
  plural: boolean;
}

/** Neutral by default: only a recorded gender changes the pronouns. */
export function pronounsFor(gender: string | null | undefined): Pronouns {
  const g = (gender ?? '').trim().toLowerCase();
  if (['m', 'male', 'man', 'boy'].includes(g)) return { subject: 'he', object: 'him', possessive: 'his', reflexive: 'himself', plural: false };
  if (['f', 'female', 'woman', 'girl'].includes(g)) return { subject: 'she', object: 'her', possessive: 'her', reflexive: 'herself', plural: false };
  return { subject: 'they', object: 'them', possessive: 'their', reflexive: 'themself', plural: true };
}

const IRREGULAR: Record<string, [string, string]> = { be: ['is', 'are'], have: ['has', 'have'], do: ['does', 'do'], go: ['goes', 'go'] };

/** "demonstrate" gives "demonstrates" for he or she and "demonstrate" for they. */
export function conjugate(verb: string, plural: boolean): string {
  const v = verb.trim().toLowerCase();
  if (IRREGULAR[v]) return IRREGULAR[v][plural ? 1 : 0];
  if (plural) return v;
  if (/(s|x|z|ch|sh|o)$/.test(v)) return `${v}es`;
  if (/[^aeiou]y$/.test(v)) return `${v.slice(0, -1)}ies`;
  return `${v}s`;
}

const TOKEN_RE = /\{([^{}]*)\}/g;

/** The names inside {braces} in a text, in order. */
export function templateTokens(text: string): string[] {
  return [...text.matchAll(TOKEN_RE)].map((m) => m[1]);
}

function tokenKnown(token: string): boolean {
  if (SIMPLE_TOKENS.has(token)) return true;
  if (PRONOUN_TOKENS.has(token) || PRONOUN_TOKENS.has(token.charAt(0).toLowerCase() + token.slice(1))) return true;
  const verb = token.match(/^verb:([A-Za-z]+)$/);
  return !!verb;
}

/** Problems in a template, in plain words: unknown placeholders and stray braces. Empty = fine. */
export function validateTemplate(text: string): string[] {
  const issues: string[] = [];
  for (const t of new Set(templateTokens(text))) {
    if (!tokenKnown(t)) issues.push(`"{${t}}" is not a placeholder. Use {Name}, {FirstName}, {Dimension}, {Competency}, {Level}, {Edition}, {Stage}, {Competition}, {subject}, {object}, {possessive}, {reflexive} or {verb:word}.`);
  }
  const stripped = text.replace(TOKEN_RE, '');
  if (/[{}]/.test(stripped)) issues.push('There is a stray { or } — placeholders must be closed, like {Name}.');
  return issues;
}

const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Fills a text's placeholders for one student. A placeholder with no value is
 * left in place as {Name} and listed in `missing`, so a gap in the data shows up
 * in the preview instead of silently printing nothing.
 */
export function renderTemplate(text: string, ctx: RenderContext): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const pro = pronounsFor(ctx.gender);
  const values: Record<string, string | null | undefined> = {
    Name: ctx.name,
    FirstName: ctx.firstName ?? (ctx.name ? ctx.name.trim().split(/\s+/)[0] : undefined),
    Dimension: ctx.dimension,
    Competency: ctx.competency,
    Level: ctx.level,
    Edition: ctx.edition,
    Stage: ctx.stage,
    Competition: ctx.competition,
  };
  const out = text.replace(TOKEN_RE, (whole, token: string) => {
    if (SIMPLE_TOKENS.has(token)) {
      const v = values[token];
      if (v === undefined || v === null || v === '') {
        missing.add(token);
        return whole;
      }
      return v;
    }
    const lower = token.charAt(0).toLowerCase() + token.slice(1);
    if (PRONOUN_TOKENS.has(lower)) {
      const word = pro[lower as 'subject' | 'object' | 'possessive' | 'reflexive'];
      return token === lower ? word : capital(word);
    }
    const verb = token.match(/^verb:([A-Za-z]+)$/);
    if (verb) return conjugate(verb[1], pro.plural);
    return whole; // unknown: left as written (validateTemplate reports it)
  });
  return { text: out, missing: [...missing] };
}

// -------------------------------------------------------------- resolution

export interface ApprovedText {
  kind: string;
  key: string;
  levelKey: string;
  language: string;
  position: number;
  title: string | null;
  text: string;
  version: number;
}

export type TextSource = 'exact' | 'default' | 'language_fallback' | 'default_language_fallback' | 'missing';

export type ContentIndex = Map<string, ApprovedText>;

export function buildIndex(items: ApprovedText[]): ContentIndex {
  return new Map(items.map((i) => [textId(i.kind, i.key, i.levelKey, i.language, i.position), i]));
}

export interface ResolveQuery {
  kind: string;
  /** The competency or dimension; omit for kinds with none. */
  key?: string;
  level?: string;
  language: string;
  defaultLanguage: string;
  /** For list items. */
  position?: number;
}

export interface Resolved {
  item: ApprovedText | null;
  source: TextSource;
}

/**
 * Finds the approved text for a competency or dimension at a level.
 * Order: the specific text in the requested language, then the wildcard ("*")
 * default in that language, then the same two in the library's default language.
 * Within a language the level-specific text beats a level-less one. Only approved
 * text is ever found; a draft is invisible to reports.
 */
export function resolveText(index: ContentIndex, q: ResolveQuery): Resolved {
  const kind = kindByKey(q.kind);
  const key = q.key ?? '';
  const level = kind?.byLevel ? q.level ?? '' : '';
  const position = q.position ?? 0;
  const languages = q.language === q.defaultLanguage ? [q.language] : [q.language, q.defaultLanguage];
  for (let li = 0; li < languages.length; li++) {
    const lang = languages[li];
    const attempts: { key: string; level: string; specific: boolean }[] = [
      { key, level, specific: true },
      ...(kind?.byLevel && level ? [{ key, level: '', specific: true }] : []),
      ...(key !== WILDCARD && kind?.scope !== 'none' ? [{ key: WILDCARD, level, specific: false }] : []),
      ...(key !== WILDCARD && kind?.scope !== 'none' && kind?.byLevel && level ? [{ key: WILDCARD, level: '', specific: false }] : []),
    ];
    for (const a of attempts) {
      const item = index.get(textId(q.kind, a.key, a.level, lang, position));
      if (item) {
        const source: TextSource = li === 0 ? (a.specific ? 'exact' : 'default') : a.specific ? 'language_fallback' : 'default_language_fallback';
        return { item, source };
      }
    }
  }
  return { item: null, source: 'missing' };
}

/** The approved items of a list kind in order (for example the challenge weeks of a dimension). */
export function resolveList(index: ContentIndex, q: { kind: string; key?: string; language: string; defaultLanguage: string }): { items: ApprovedText[]; source: TextSource } {
  const key = q.key ?? '';
  const languages = q.language === q.defaultLanguage ? [q.language] : [q.language, q.defaultLanguage];
  for (let li = 0; li < languages.length; li++) {
    const items = [...index.values()]
      .filter((i) => i.kind === q.kind && i.key === key && i.language === languages[li] && i.levelKey === '')
      .sort((a, b) => a.position - b.position);
    if (items.length) return { items, source: li === 0 ? 'exact' : 'language_fallback' };
  }
  return { items: [], source: 'missing' };
}
