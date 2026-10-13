// The configuration of a scorecard report template (the JSON stored on
// ScorecardTemplate.config): which sections a report has, in what order, which are shown,
// the labels and headings they print, and the colours. Pure and DB-free so the rules can be
// tested. No wording is kept in code: every heading and label is part of the template an
// admin edits, and the narrative text comes from the content library (#72). See #73.

export const SECTION_TYPES = [
  'cover',
  'intro',
  'level_scale',
  'stage_results',
  'narrative',
  'bar_profile',
  'stage_competencies',
  'observer_note',
  'snapshot',
  'assessment_areas',
  'dimension_notes',
  'leadership_style',
  'profile_summary',
  'final_profile',
  'challenge',
  'reflection',
  'wisdom',
  'statement',
  'mantra',
  'disclaimer',
  'verification',
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export interface SectionTypeInfo {
  type: SectionType;
  label: string;
  help: string;
  /** Needs a stage position. */
  stage: boolean;
  /** Labels the section prints; each must be filled in before the template can be published. */
  labels: { key: string; label: string; help?: string }[];
}

export const SECTION_INFO: SectionTypeInfo[] = [
  {
    type: 'cover',
    label: 'Cover and student details',
    help: 'The title block and the student details table.',
    stage: false,
    labels: [
      { key: 'title', label: 'Title', help: 'For example INDIA MIND LEAGUE' },
      { key: 'subtitle', label: 'Subtitle', help: 'For example FUTURE READINESS REPORT' },
      { key: 'tagline', label: 'Tagline' },
      { key: 'name', label: 'Student name label' },
      { key: 'grade', label: 'Grade label' },
      { key: 'school', label: 'School label' },
      { key: 'id', label: 'Student ID label' },
      { key: 'edition', label: 'Edition label' },
    ],
  },
  { type: 'intro', label: 'Introduction', help: 'The report introduction from the content library.', stage: false, labels: [{ key: 'title', label: 'Heading' }] },
  {
    type: 'level_scale',
    label: 'Level scale',
    help: 'Every level of the scale and what it means.',
    stage: false,
    labels: [
      { key: 'title', label: 'Heading' },
      { key: 'colLevel', label: 'Level column' },
      { key: 'colMeaning', label: 'Meaning column' },
    ],
  },
  {
    type: 'stage_results',
    label: 'Stage results',
    help: 'One stage: its introduction, the areas table with scores and levels, and the overall result per dimension.',
    stage: true,
    labels: [
      { key: 'title', label: 'Heading', help: 'Placeholders such as {Stage} work here' },
      { key: 'areasHeading', label: 'Areas heading' },
      { key: 'colArea', label: 'Area column' },
      { key: 'colScore', label: 'Score column' },
      { key: 'colLevel', label: 'Level column' },
      { key: 'overall', label: 'Overall line', help: 'For example OVERALL {Dimension} SCORE' },
      { key: 'notEnough', label: 'Text for an area without enough questions' },
    ],
  },
  {
    type: 'narrative',
    label: 'Strengths and growth text',
    help: 'For each dimension of the stage: strengths, development opportunity and practice paragraphs from the content library.',
    stage: true,
    labels: [
      { key: 'strength', label: 'Strengths heading', help: 'Placeholders such as {Dimension} work here' },
      { key: 'growth', label: 'Development heading' },
      { key: 'practice', label: 'Practice heading' },
    ],
  },
  {
    type: 'stage_competencies',
    label: 'Observed competencies',
    help: 'For a panel-rated stage: each competency the panel rated and its level.',
    stage: true,
    labels: [
      { key: 'title', label: 'Heading', help: 'Placeholders such as {Stage} work here' },
      { key: 'colCompetency', label: 'Competency column' },
      { key: 'colLevel', label: 'Level column' },
    ],
  },
  { type: 'observer_note', label: 'Observer or jury note', help: 'The note a panelist edited and approved for this stage. Left out if nobody approved one.', stage: true, labels: [{ key: 'title', label: 'Heading' }] },
  {
    type: 'snapshot',
    label: 'Stage snapshot',
    help: 'One line each: a strength, a growth area and a reflection question, taken from the stage ratings.',
    stage: true,
    labels: [
      { key: 'title', label: 'Heading' },
      { key: 'strength', label: 'Strength label' },
      { key: 'growth', label: 'Growth area label' },
      { key: 'reflection', label: 'Reflection label' },
    ],
  },
  {
    type: 'assessment_areas',
    label: 'Written assessment',
    help: 'The scored areas of an online written assessment tied to this stage, with percent and level.',
    stage: true,
    labels: [
      { key: 'title', label: 'Heading' },
      { key: 'colArea', label: 'Area column' },
      { key: 'colScore', label: 'Score column' },
      { key: 'colLevel', label: 'Level column' },
      { key: 'overall', label: 'Overall line' },
    ],
  },
  { type: 'dimension_notes', label: 'Dimension notes', help: 'A short observation per dimension at its final level, from the content library.', stage: false, labels: [{ key: 'title', label: 'Heading' }, { key: 'line', label: 'Line shape', help: '{Dimension} – {Level}: ' }] },
  { type: 'leadership_style', label: 'Leadership style', help: 'The style the matching rules gave the student, with its description.', stage: false, labels: [{ key: 'title', label: 'Heading' }] },
  {
    type: 'profile_summary',
    label: 'Profile summary',
    help: 'The final level per dimension, the overall level and the one-line profile.',
    stage: false,
    labels: [
      { key: 'title', label: 'Heading' },
      { key: 'colDimension', label: 'Dimension column' },
      { key: 'colLevel', label: 'Level column' },
      { key: 'overall', label: 'Overall heading' },
      { key: 'oneLine', label: 'One-line profile heading' },
      { key: 'provisional', label: 'Note shown when a stage is still pending' },
    ],
  },
  {
    type: 'final_profile',
    label: 'Complete profile',
    help: 'Final level and what it reflects per dimension, top strengths and growth areas.',
    stage: false,
    labels: [
      { key: 'title', label: 'Heading' },
      { key: 'colDimension', label: 'Dimension column' },
      { key: 'colLevel', label: 'Final level column' },
      { key: 'colReflects', label: 'What it reflects column' },
      { key: 'strengths', label: 'Strengths heading' },
      { key: 'growth', label: 'Growth heading' },
    ],
  },
  {
    type: 'challenge',
    label: '30-day challenge',
    help: 'The weekly practice per dimension from the content library.',
    stage: false,
    labels: [{ key: 'title', label: 'Heading' }, { key: 'colWeek', label: 'Week column' }, { key: 'colFocus', label: 'Focus column' }, { key: 'colPractice', label: 'Practice column' }, { key: 'week', label: 'Week label', help: 'For example Week {n}; leave {n} for the number' }],
  },
  { type: 'reflection', label: 'Self-reflection questions', help: 'The reflection questions from the content library, in order.', stage: false, labels: [{ key: 'title', label: 'Heading' }] },
  {
    type: 'wisdom',
    label: 'Ancient wisdom table',
    help: 'One row per dimension: capacity name and meaning, from the content library.',
    stage: false,
    labels: [{ key: 'title', label: 'Heading' }, { key: 'intro', label: 'Introduction line' }, { key: 'colCapacity', label: 'Capacity column' }, { key: 'colDimension', label: 'Dimension column' }, { key: 'colMeaning', label: 'Meaning column' }],
  },
  { type: 'bar_profile', label: 'Bar profile', help: 'A bar per area showing its score.', stage: true, labels: [{ key: 'title', label: 'Heading' }] },
  { type: 'statement', label: 'Closing statement', help: 'The future readiness statement from the content library.', stage: false, labels: [{ key: 'title', label: 'Heading' }] },
  { type: 'mantra', label: 'Mantra', help: 'The IML mantra from the content library.', stage: false, labels: [{ key: 'title', label: 'Heading' }] },
  { type: 'disclaimer', label: 'Important note', help: 'The disclaimer paragraphs from the content library.', stage: false, labels: [{ key: 'title', label: 'Heading' }] },
  {
    type: 'verification',
    label: 'Verification',
    help: 'A QR code and the report code, so anyone holding the report can check it is genuine.',
    stage: false,
    labels: [
      { key: 'title', label: 'Heading' },
      { key: 'caption', label: 'Text next to the code', help: 'For example Scan to confirm this report is genuine.' },
      { key: 'codeLabel', label: 'Report code label' },
    ],
  },
];

export const sectionInfo = (type: string): SectionTypeInfo | undefined => SECTION_INFO.find((s) => s.type === type);

import { AUDIENCES, Audience } from './report-access';

export interface TemplateSection {
  /** Unique within the template. */
  key: string;
  type: SectionType;
  enabled: boolean;
  /** Start this section on a new page. */
  pageBreakBefore?: boolean;
  /** The stage position, for the section types that are about one stage. */
  stage?: number;
  labels: Record<string, string>;
  /** Decimals shown on percentages (stage_results, bar_profile). Default 0. */
  percentDecimals?: number;
  /** Who sees this section: any of student, parent, school. Not set = everyone (the admin copy always has every section). */
  audiences?: Audience[];
}

export interface TemplateBranding {
  logoUrl?: string;
  /** Headings, table headers. */
  primaryColor: string;
  /** Emphasis, the overall line. */
  accentColor: string;
  /** Rules and highlights. */
  highlightColor: string;
  /** Per-stage colour (key = stage position as text) used for that stage's heading band. */
  stageColors: Record<string, string>;
  /** Per-level colour (key = level key) used for level chips and bars. */
  levelColors: Record<string, string>;
  /** Printed at the left of the page footer. */
  footerText?: string;
}

export interface TemplateConfig {
  branding: TemplateBranding;
  sections: TemplateSection[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const SECTION_KEY = /^[a-z][a-z0-9_]{0,39}$/;

export function emptyTemplateConfig(): TemplateConfig {
  return {
    branding: { primaryColor: '#1d3557', accentColor: '#9b1c31', highlightColor: '#c28a16', stageColors: {}, levelColors: {} },
    sections: [],
  };
}

/** Reads a stored or posted config tolerantly into the full shape. */
export function normalizeTemplateConfig(raw: unknown): TemplateConfig {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const base = emptyTemplateConfig();
  const b = (c.branding && typeof c.branding === 'object' ? c.branding : {}) as Record<string, unknown>;
  const str = (v: unknown, d: string) => (typeof v === 'string' && v.trim() ? v.trim() : d);
  const map = (v: unknown) => {
    const out: Record<string, string> = {};
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === 'string') out[k] = x.trim();
    return out;
  };
  const sections = (Array.isArray(c.sections) ? c.sections : []).map((s): TemplateSection => {
    const r = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    return {
      key: typeof r.key === 'string' ? r.key : '',
      type: r.type as SectionType,
      enabled: r.enabled !== false,
      pageBreakBefore: r.pageBreakBefore === true,
      ...(typeof r.stage === 'number' ? { stage: r.stage } : {}),
      labels: map(r.labels),
      ...(typeof r.percentDecimals === 'number' ? { percentDecimals: r.percentDecimals } : {}),
      ...(Array.isArray(r.audiences) ? { audiences: r.audiences.filter((a): a is Audience => (AUDIENCES as readonly string[]).includes(a as string)) } : {}),
    };
  });
  return {
    branding: {
      logoUrl: typeof b.logoUrl === 'string' && b.logoUrl.trim() ? b.logoUrl.trim() : undefined,
      primaryColor: str(b.primaryColor, base.branding.primaryColor),
      accentColor: str(b.accentColor, base.branding.accentColor),
      highlightColor: str(b.highlightColor, base.branding.highlightColor),
      stageColors: map(b.stageColors),
      levelColors: map(b.levelColors),
      footerText: typeof b.footerText === 'string' ? b.footerText : undefined,
    },
    sections,
  };
}

/** Everything that stops a template from being published, in plain words. Empty = ready. */
export function validateTemplateConfig(raw: unknown): string[] {
  const c = normalizeTemplateConfig(raw);
  const issues: string[] = [];
  const b = c.branding;
  for (const [name, v] of [['primary', b.primaryColor], ['accent', b.accentColor], ['highlight', b.highlightColor]] as const) {
    if (!HEX.test(v)) issues.push(`The ${name} colour must be a hex colour such as #1d3557.`);
  }
  for (const [k, v] of Object.entries(b.stageColors)) if (!HEX.test(v)) issues.push(`The colour for stage ${k} must be a hex colour.`);
  for (const [k, v] of Object.entries(b.levelColors)) if (!HEX.test(v)) issues.push(`The colour for level ${k} must be a hex colour.`);
  if (b.logoUrl && !/^https?:\/\//i.test(b.logoUrl)) issues.push('The logo must be a web address (https://…).');

  if (!c.sections.length) issues.push('Add at least one section.');
  if (c.sections.length && !c.sections.some((s) => s.enabled)) issues.push('Show at least one section.');
  const keys = new Set<string>();
  c.sections.forEach((s, i) => {
    const name = `Section ${i + 1}`;
    const info = sectionInfo(s.type);
    if (!info) {
      issues.push(`${name}: "${String(s.type)}" is not a kind of section.`);
      return;
    }
    if (!SECTION_KEY.test(s.key)) issues.push(`${name}: the key must be lower-case letters, digits or underscores (e.g. stage1_results).`);
    else if (keys.has(s.key)) issues.push(`${name}: the key ${s.key} is used twice.`);
    else keys.add(s.key);
    if (info.stage && (!Number.isInteger(s.stage) || (s.stage as number) < 1)) issues.push(`${name} (${info.label}): choose a stage.`);
    if (s.percentDecimals !== undefined && (!Number.isInteger(s.percentDecimals) || s.percentDecimals < 0 || s.percentDecimals > 2)) {
      issues.push(`${name}: percentages can show 0 to 2 decimals.`);
    }
    if (s.audiences && !s.audiences.length) issues.push(`${name} (${info.label}): choose who sees it, or leave it for everyone.`);
    if (s.enabled) {
      for (const l of info.labels) {
        if (!s.labels[l.key]?.trim()) issues.push(`${name} (${info.label}): fill in "${l.label}".`);
      }
    }
  });
  if (c.sections.filter((s) => s.type === 'cover').length > 1) issues.push('A report has one cover.');
  return issues;
}
