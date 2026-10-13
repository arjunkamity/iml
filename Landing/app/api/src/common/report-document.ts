// Builds a scorecard report for one student and stage from three pieces of configuration:
// the stage data (#71), the approved wording (#72) and the template (#73), and turns it into
// A4 HTML. Pure and DB-free: no wording, colours or section order live here, only the rules for
// putting them together. The result records which approved text versions it used and which
// wording was missing, so an issued report can be traced and a gap is visible in the preview.

import { ContentIndex, RenderContext, TextSource, renderTemplate, resolveList, resolveText } from './content-library';
import { StageReportData } from './stage-report';
import { FrameworkLevel } from './scorecard-config';
import { TemplateConfig, TemplateSection } from './report-template';
import { Audience, sectionVisibleTo } from './report-access';
import type { FinalProfile } from './rollup-rules';

/** What one stage contributes to a full report. */
export interface StageData {
  position: number;
  name: string;
  mode: string;
  /** complete: shown. pending / not_reached: left out of the report. */
  status: 'complete' | 'pending' | 'not_reached';
  /** An auto-scored stage: its per-area results. */
  report?: StageReportData;
  /** A panel-rated stage: each competency and its level. */
  competencies?: { key: string; name: string; dimension: string; levelKey: string | null; levelLabel: string | null }[];
  /** The note a panelist approved. */
  note?: string | null;
  /** A scored written assessment tied to the stage. */
  assessment?: { areas: { name: string; percent: number; level: FrameworkLevel | null }[]; overall: { percent: number; level: FrameworkLevel | null } | null };
}

/** The data a full (multi-stage) report adds to a stage report. */
export interface FullData {
  profile: FinalProfile;
  stages: StageData[];
}

export interface StageReportInput {
  student: { code: string; name: string; grade: string; school: string | null; gender: string | null };
  competition: { code: string; title: string };
  /** The stage this report is about. Absent for a full report, which lists its stages in full.stages. */
  stage?: { position: number; name: string };
  season: { code: string; name: string; editionLabel: string } | null;
  framework: { code: string; name: string; version: number };
  scale: { key: string; name: string; levels: FrameworkLevel[] };
  report?: StageReportData;
  full?: FullData;
  /** The report's verification code, link and QR image. Absent in a preview. */
  verification?: { code: string; url: string; qrDataUrl: string };
}

export interface BuildOptions {
  template: TemplateConfig;
  index: ContentIndex;
  language: string;
  defaultLanguage: string;
  /** Build the copy for one audience: sections the template hides from it are left out. Absent = the full admin copy. */
  audience?: Audience;
}

export interface UsedText {
  kind: string;
  key: string;
  levelKey: string;
  language: string;
  position: number;
  version: number;
}

export interface LevelChip {
  key: string;
  label: string;
  color: string;
}

export interface AreaRow {
  name: string;
  /** Null when the area has too few questions. */
  percent: number | null;
  level: LevelChip | null;
}

export interface DimensionBlock {
  label: string;
  subtitle: string | null;
  areas: AreaRow[];
  overall: { percent: number; level: LevelChip | null } | null;
  strength: string[];
  growth: string[];
  practice: string[];
  /** Filled by the stage results section: the overall line for this dimension. */
  overallLabel?: string;
  /** Filled by the narrative section: its headings for this dimension. */
  headings?: { strength: string; growth: string; practice: string };
}

export type DocSection =
  | { key: string; type: 'cover'; pageBreakBefore: boolean; title: string; subtitle: string; tagline: string; details: { label: string; value: string }[] }
  | { key: string; type: 'intro' | 'statement' | 'mantra'; pageBreakBefore: boolean; title: string; paragraphs: string[] }
  | { key: string; type: 'level_scale'; pageBreakBefore: boolean; title: string; colLevel: string; colMeaning: string; levels: { chip: LevelChip; meaning: string }[] }
  | {
      key: string;
      type: 'stage_results';
      pageBreakBefore: boolean;
      title: string;
      color: string;
      subtitle: string | null;
      intro: string[];
      areasHeading: string;
      colArea: string;
      colScore: string;
      colLevel: string;
      notEnough: string;
      decimals: number;
      dimensions: DimensionBlock[];
    }
  | { key: string; type: 'narrative'; pageBreakBefore: boolean; dimensions: DimensionBlock[] }
  | { key: string; type: 'bar_profile'; pageBreakBefore: boolean; title: string; decimals: number; dimensions: DimensionBlock[] }
  | { key: string; type: 'disclaimer'; pageBreakBefore: boolean; title: string; items: { title: string | null; paragraphs: string[] }[] }
  | { key: string; type: 'stage_competencies'; pageBreakBefore: boolean; title: string; color: string; colCompetency: string; colLevel: string; rows: { name: string; level: LevelChip | null }[] }
  | { key: string; type: 'observer_note'; pageBreakBefore: boolean; title: string; paragraphs: string[] }
  | { key: string; type: 'snapshot'; pageBreakBefore: boolean; title: string; items: { label: string; text: string }[] }
  | { key: string; type: 'assessment_areas'; pageBreakBefore: boolean; title: string; colArea: string; colScore: string; colLevel: string; overallLabel: string; decimals: number; areas: { name: string; percent: number; level: LevelChip | null }[]; overall: { percent: number; level: LevelChip | null } | null }
  | { key: string; type: 'dimension_notes'; pageBreakBefore: boolean; title: string; rows: { dimension: string; level: string; text: string }[] }
  | { key: string; type: 'leadership_style'; pageBreakBefore: boolean; title: string; name: string; paragraphs: string[] }
  | { key: string; type: 'profile_summary'; pageBreakBefore: boolean; title: string; colDimension: string; colLevel: string; rows: { dimension: string; subtitle: string | null; level: LevelChip | null }[]; overallHeading: string; overallLabel: string; overallColor: string; oneLineHeading: string; oneLine: string; provisionalNote: string }
  | { key: string; type: 'final_profile'; pageBreakBefore: boolean; title: string; colDimension: string; colLevel: string; colReflects: string; rows: { dimension: string; level: LevelChip | null; reflects: string }[]; strengthsHeading: string; strengths: { title: string; text: string }[]; growthHeading: string; growth: { title: string; text: string }[] }
  | { key: string; type: 'challenge'; pageBreakBefore: boolean; title: string; colWeek: string; colFocus: string; colPractice: string; rows: { week: string; focus: string; practice: string }[] }
  | { key: string; type: 'reflection'; pageBreakBefore: boolean; title: string; questions: string[] }
  | { key: string; type: 'wisdom'; pageBreakBefore: boolean; title: string; intro: string; colCapacity: string; colDimension: string; colMeaning: string; rows: { capacity: string; dimension: string; meaning: string }[] }
  | { key: string; type: 'verification'; pageBreakBefore: boolean; title: string; caption: string; codeLabel: string; code: string; url: string; qrDataUrl: string | null; preview: boolean };

export interface ReportDocument {
  title: string;
  sections: DocSection[];
  used: UsedText[];
  /** Wording the template asked for that the library has no approved text for. */
  gaps: string[];
  /** Wording that was found only as a default or in another language. */
  fallbacks: string[];
}

const paragraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** Lays out one student's stage report as a list of rendered sections, following the template. */
export function buildStageDocument(input: StageReportInput, opts: BuildOptions): ReportDocument {
  const { template, index, language, defaultLanguage } = opts;
  const used: UsedText[] = [];
  const gaps: string[] = [];
  const fallbacks: string[] = [];
  const base: RenderContext = {
    name: input.student.name,
    gender: input.student.gender,
    edition: input.season?.editionLabel ?? null,
    stage: input.stage?.name ?? null,
    competition: input.competition.title,
  };
  const fill = (text: string, over: RenderContext = {}) => renderTemplate(text, { ...base, ...over }).text;
  const colorOf = (levelKey: string, level?: FrameworkLevel): string => template.branding.levelColors[levelKey] || level?.color || template.branding.accentColor;
  const chip = (level: FrameworkLevel | null): LevelChip | null => (level ? { key: level.key, label: level.label, color: colorOf(level.key, level) } : null);

  const note = (source: TextSource, what: string) => {
    if (source === 'missing') gaps.push(what);
    else if (source !== 'exact') fallbacks.push(`${what}: ${source === 'default' ? 'default wording used' : 'shown in the default language'}`);
  };
  const text = (kind: string, key: string, level: string, ctx: RenderContext, what: string): { title: string | null; paragraphs: string[] } | null => {
    const r = resolveText(index, { kind, key, level, language, defaultLanguage });
    note(r.source, what);
    if (!r.item) return null;
    const i = r.item;
    used.push({ kind: i.kind, key: i.key, levelKey: i.levelKey, language: i.language, position: i.position, version: i.version });
    return { title: i.title ? fill(i.title, ctx) : null, paragraphs: paragraphs(fill(i.text, ctx)) };
  };
  const list = (kind: string, key: string, ctx: RenderContext, what: string) => {
    const r = resolveList(index, { kind, key, language, defaultLanguage });
    note(r.source, what);
    for (const i of r.items) used.push({ kind: i.kind, key: i.key, levelKey: i.levelKey, language: i.language, position: i.position, version: i.version });
    return r.items.map((i) => ({ title: i.title ? fill(i.title, ctx) : null, paragraphs: paragraphs(fill(i.text, ctx)) }));
  };

  /** The data of a stage: the primary one this report is about, or one a full report lists. Only a completed stage is shown. */
  const stageInfo = (n: number): StageData | null => {
    if (input.stage && input.report && input.stage.position === n) return { position: n, name: input.stage.name, mode: '', status: 'complete', report: input.report };
    const sd = input.full?.stages.find((x) => x.position === n);
    return sd && sd.status === 'complete' ? sd : null;
  };

  const dims = (report: StageReportData | undefined): DimensionBlock[] =>
    (report?.dimensions ?? [])
      .filter((d) => d.areas.length)
      .map((d) => {
        const ctx: RenderContext = { dimension: d.label };
        const levelKey = d.overall?.level?.key ?? '';
        const ctxLevel: RenderContext = { ...ctx, level: d.overall?.level?.label ?? null };
        const pick = (kind: string, what: string) => (levelKey ? text(kind, d.dimension, levelKey, ctxLevel, `${what} for ${d.label} at ${d.overall?.level?.label}`)?.paragraphs ?? [] : []);
        return {
          label: d.label,
          subtitle: d.subtitle ?? null,
          areas: d.areas.map((a) => ({ name: a.name, percent: a.percent, level: chip(a.level) })),
          overall: d.overall ? { percent: d.overall.percent, level: chip(d.overall.level) } : null,
          strength: pick('dimension_strength', 'Strengths paragraph'),
          growth: pick('dimension_growth', 'Development paragraph'),
          practice: pick('dimension_practice', 'Practice paragraph'),
        };
      });

  const sections: DocSection[] = [];
  for (const s of template.sections as TemplateSection[]) {
    if (!s.enabled) continue;
    if (opts.audience && !sectionVisibleTo(s, opts.audience)) continue;
    const sd = s.stage !== undefined ? stageInfo(s.stage) : null;
    // a stage still pending stays out of the report, and a stage never reached is not shown
    if (s.stage !== undefined && !sd) continue;
    const stageCtx: RenderContext = sd ? { stage: sd.name } : {};
    const pageBreakBefore = s.pageBreakBefore === true;
    const L = s.labels;
    switch (s.type) {
      case 'cover': {
        const details = [
          { label: L.name, value: input.student.name },
          { label: L.grade, value: input.student.grade },
          { label: L.school, value: input.student.school ?? '' },
          { label: L.id, value: input.student.code },
          { label: L.edition, value: input.season?.editionLabel ?? input.competition.title },
        ].filter((d) => d.label && d.value);
        sections.push({ key: s.key, type: 'cover', pageBreakBefore, title: fill(L.title ?? ''), subtitle: fill(L.subtitle ?? ''), tagline: fill(L.tagline ?? ''), details });
        break;
      }
      case 'intro': {
        const t = text('report_intro', '', '', {}, 'Report introduction');
        sections.push({ key: s.key, type: 'intro', pageBreakBefore, title: fill(L.title ?? ''), paragraphs: t?.paragraphs ?? [] });
        break;
      }
      case 'statement':
      case 'mantra': {
        const kind = s.type === 'statement' ? 'statement' : 'mantra';
        const t = text(kind, '', '', {}, s.type === 'statement' ? 'Future readiness statement' : 'Mantra');
        sections.push({ key: s.key, type: s.type, pageBreakBefore, title: fill(L.title ?? ''), paragraphs: t?.paragraphs ?? [] });
        break;
      }
      case 'level_scale':
        sections.push({
          key: s.key,
          type: 'level_scale',
          pageBreakBefore,
          title: fill(L.title ?? ''),
          colLevel: L.colLevel ?? '',
          colMeaning: L.colMeaning ?? '',
          levels: input.scale.levels.map((lv) => ({ chip: chip(lv) as LevelChip, meaning: lv.meaning })),
        });
        break;
      case 'stage_results': {
        if (!sd?.report) break;
        const intro = text('stage_intro', String(sd.position), '', stageCtx, `Stage ${sd.position} introduction`);
        const dimensions = dims(sd.report);
        sections.push({
          key: s.key,
          type: 'stage_results',
          pageBreakBefore,
          title: fill(L.title ?? '', stageCtx),
          color: template.branding.stageColors[String(sd.position)] || template.branding.primaryColor,
          subtitle: intro?.title ?? null,
          intro: intro?.paragraphs ?? [],
          areasHeading: fill(L.areasHeading ?? ''),
          colArea: L.colArea ?? '',
          colScore: L.colScore ?? '',
          colLevel: L.colLevel ?? '',
          notEnough: L.notEnough ?? '',
          decimals: s.percentDecimals ?? 0,
          dimensions: dimensions.map((d) => ({ ...d, overallLabel: fill(L.overall ?? '', { dimension: d.label }) })),
        });
        break;
      }
      case 'narrative': {
        if (!sd?.report) break;
        const dimensions = dims(sd.report).map((d) => {
          const ctx: RenderContext = { dimension: d.label };
          return { ...d, headings: { strength: fill(L.strength ?? '', ctx), growth: fill(L.growth ?? '', ctx), practice: fill(L.practice ?? '', ctx) } };
        });
        sections.push({ key: s.key, type: 'narrative', pageBreakBefore, dimensions });
        break;
      }
      case 'bar_profile':
        if (!sd?.report) break;
        sections.push({ key: s.key, type: 'bar_profile', pageBreakBefore, title: fill(L.title ?? '', stageCtx), decimals: s.percentDecimals ?? 0, dimensions: dims(sd.report) });
        break;
      case 'stage_competencies': {
        if (!sd?.competencies?.length) break;
        sections.push({
          key: s.key,
          type: 'stage_competencies',
          pageBreakBefore,
          title: fill(L.title ?? '', stageCtx),
          color: template.branding.stageColors[String(sd.position)] || template.branding.primaryColor,
          colCompetency: L.colCompetency ?? '',
          colLevel: L.colLevel ?? '',
          rows: sd.competencies.map((c) => ({ name: c.name, level: c.levelKey ? chip(input.scale.levels.find((l) => l.key === c.levelKey) ?? null) : null })),
        });
        break;
      }
      case 'observer_note': {
        if (!sd?.note?.trim()) break; // only a note a panelist approved is ever shown
        sections.push({ key: s.key, type: 'observer_note', pageBreakBefore, title: fill(L.title ?? '', stageCtx), paragraphs: paragraphs(sd.note) });
        break;
      }
      case 'snapshot': {
        const comps = (sd?.competencies ?? []).filter((c) => c.levelKey);
        if (!comps.length) break;
        const pts = (k: string | null) => input.scale.levels.find((l) => l.key === k)?.points ?? 0;
        const sorted = [...comps].sort((a, b) => pts(b.levelKey) - pts(a.levelKey) || a.name.localeCompare(b.name));
        const top = sorted[0];
        const low = [...comps].sort((a, b) => pts(a.levelKey) - pts(b.levelKey) || a.name.localeCompare(b.name))[0];
        const items: { label: string; text: string }[] = [{ label: L.strength ?? '', text: top.name }];
        if (low && low.key !== top.key) {
          items.push({ label: L.growth ?? '', text: low.name });
          const q = text('snapshot_reflection', low.key, '', { competency: low.name }, `Snapshot reflection for ${low.name}`);
          if (q) items.push({ label: L.reflection ?? '', text: q.paragraphs.join(' ') });
        }
        sections.push({ key: s.key, type: 'snapshot', pageBreakBefore, title: fill(L.title ?? '', stageCtx), items });
        break;
      }
      case 'assessment_areas': {
        if (!sd?.assessment) break;
        sections.push({
          key: s.key,
          type: 'assessment_areas',
          pageBreakBefore,
          title: fill(L.title ?? '', stageCtx),
          colArea: L.colArea ?? '',
          colScore: L.colScore ?? '',
          colLevel: L.colLevel ?? '',
          overallLabel: fill(L.overall ?? '', stageCtx),
          decimals: s.percentDecimals ?? 0,
          areas: sd.assessment.areas.map((a) => ({ name: a.name, percent: a.percent, level: chip(a.level) as LevelChip | null })),
          overall: sd.assessment.overall ? { percent: sd.assessment.overall.percent, level: chip(sd.assessment.overall.level) } : null,
        });
        break;
      }
      case 'dimension_notes': {
        const prof = input.full?.profile;
        if (!prof) break;
        const rows: { dimension: string; level: string; text: string }[] = [];
        for (const d of prof.dimensions) {
          if (!d.level) continue;
          const t = text('dimension_note', d.key, d.level.key, { dimension: d.label, level: d.level.label }, `Dimension note for ${d.label} at ${d.level.label}`);
          if (t) rows.push({ dimension: d.label, level: d.level.label, text: t.paragraphs.join(' ') });
        }
        sections.push({ key: s.key, type: 'dimension_notes', pageBreakBefore, title: fill(L.title ?? ''), rows });
        break;
      }
      case 'leadership_style': {
        const style = input.full?.profile.style;
        if (!style) break;
        const t = text('leadership_style', style.key, '', {}, `Leadership style ${style.name}`);
        sections.push({ key: s.key, type: 'leadership_style', pageBreakBefore, title: fill(L.title ?? ''), name: t?.title ?? style.name, paragraphs: t?.paragraphs ?? [] });
        break;
      }
      case 'profile_summary': {
        const prof = input.full?.profile;
        if (!prof) break;
        const items = prof.profileLine ? list('profile_line', '', {}, 'Profile in one line') : [];
        const picked = prof.profileLine ? items.find((_, i) => i + 1 === prof.profileLine!.position) ?? null : null;
        sections.push({
          key: s.key,
          type: 'profile_summary',
          pageBreakBefore,
          title: fill(L.title ?? ''),
          colDimension: L.colDimension ?? '',
          colLevel: L.colLevel ?? '',
          rows: prof.dimensions.map((d) => ({ dimension: d.label, subtitle: config_subtitle(input, d.key), level: chip(d.level) })),
          overallHeading: L.overall ?? '',
          overallLabel: prof.overall.label,
          overallColor: prof.overall.level ? colorOf(prof.overall.level.key, prof.overall.level) : template.branding.accentColor,
          oneLineHeading: L.oneLine ?? '',
          oneLine: picked ? picked.paragraphs.join(' ') : '',
          provisionalNote: prof.provisional ? L.provisional ?? '' : '',
        });
        break;
      }
      case 'final_profile': {
        const prof = input.full?.profile;
        if (!prof) break;
        const rows = prof.dimensions.map((d) => {
          const t = d.level ? text('dimension_reflects', d.key, d.level.key, { dimension: d.label, level: d.level.label }, `What ${d.label} reflects at ${d.level.label}`) : null;
          return { dimension: d.label, level: chip(d.level), reflects: t?.paragraphs.join(' ') ?? '' };
        });
        const pick = (items: FinalProfile['strengths'], kind: 'strength' | 'growth') =>
          items.flatMap((c) => {
            const t = c.level ? text(kind, c.competency, c.level.key, { competency: c.name, level: c.level.label }, `${kind === 'strength' ? 'Strength' : 'Growth'} wording for ${c.name} at ${c.level.label}`) : null;
            return t ? [{ title: t.title ?? c.name, text: t.paragraphs.join(' ') }] : [];
          });
        sections.push({
          key: s.key,
          type: 'final_profile',
          pageBreakBefore,
          title: fill(L.title ?? ''),
          colDimension: L.colDimension ?? '',
          colLevel: L.colLevel ?? '',
          colReflects: L.colReflects ?? '',
          rows,
          strengthsHeading: fill(L.strengths ?? ''),
          strengths: pick(prof.strengths, 'strength'),
          growthHeading: fill(L.growth ?? ''),
          growth: pick(prof.growth, 'growth'),
        });
        break;
      }
      case 'challenge': {
        const prof = input.full?.profile;
        const rows: { week: string; focus: string; practice: string }[] = [];
        for (const d of prof?.dimensions ?? config_dims(input)) {
          const key = 'key' in d ? d.key : '';
          for (const it of list('challenge', key, {}, `30-day challenge for ${'label' in d ? d.label : key}`)) {
            rows.push({ week: '', focus: it.title ?? ('label' in d ? d.label : key), practice: it.paragraphs.join(' ') });
          }
        }
        rows.forEach((r, i) => (r.week = (L.week ?? '{n}').replace('{n}', String(i + 1))));
        sections.push({ key: s.key, type: 'challenge', pageBreakBefore, title: fill(L.title ?? ''), colWeek: L.colWeek ?? '', colFocus: L.colFocus ?? '', colPractice: L.colPractice ?? '', rows });
        break;
      }
      case 'reflection': {
        const items = list('reflection', '', {}, 'Self-reflection questions');
        sections.push({ key: s.key, type: 'reflection', pageBreakBefore, title: fill(L.title ?? ''), questions: items.map((i) => i.paragraphs.join(' ')) });
        break;
      }
      case 'wisdom': {
        const prof = input.full?.profile;
        const rows: { capacity: string; dimension: string; meaning: string }[] = [];
        for (const d of prof?.dimensions ?? []) {
          const t = text('wisdom', d.key, '', {}, `Ancient wisdom for ${d.label}`);
          if (t) rows.push({ capacity: t.title ?? '', dimension: d.label, meaning: t.paragraphs.join(' ') });
        }
        sections.push({ key: s.key, type: 'wisdom', pageBreakBefore, title: fill(L.title ?? ''), intro: fill(L.intro ?? ''), colCapacity: L.colCapacity ?? '', colDimension: L.colDimension ?? '', colMeaning: L.colMeaning ?? '', rows });
        break;
      }
      case 'verification': {
        const v = input.verification;
        sections.push({
          key: s.key,
          type: 'verification',
          pageBreakBefore,
          title: fill(L.title ?? ''),
          caption: fill(L.caption ?? ''),
          codeLabel: L.codeLabel ?? '',
          code: v?.code ?? 'PREVIEW',
          url: v?.url ?? '',
          qrDataUrl: v?.qrDataUrl ?? null,
          preview: !v,
        });
        break;
      }
      case 'disclaimer': {
        const items = list('disclaimer', '', {}, 'Important note');
        sections.push({ key: s.key, type: 'disclaimer', pageBreakBefore, title: fill(L.title ?? ''), items });
        break;
      }
    }
  }
  return { title: `${input.student.name} — ${input.stage?.name ?? input.competition.title}`, sections, used: dedupe(used), gaps: [...new Set(gaps)], fallbacks: [...new Set(fallbacks)] };
}

/** The subtitle of a dimension (for example Intellectual Intelligence), from the stage reports that carry it. */
function config_subtitle(input: StageReportInput, key: string): string | null {
  const fromPrimary = input.report?.dimensions.find((d) => d.dimension === key)?.subtitle;
  if (fromPrimary) return fromPrimary;
  for (const s of input.full?.stages ?? []) {
    const sub = s.report?.dimensions.find((d) => d.dimension === key)?.subtitle;
    if (sub) return sub;
  }
  return null;
}

function config_dims(input: StageReportInput): { key: string; label: string }[] {
  return (input.report?.dimensions ?? []).map((d) => ({ key: d.dimension, label: d.label }));
}

function dedupe(items: UsedText[]): UsedText[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = [i.kind, i.key, i.levelKey, i.language, i.position, i.version].join('|');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ------------------------------------------------------------------- HTML

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const paras = (list: string[]): string => list.map((p) => `<p>${esc(p)}</p>`).join('');

const pct = (n: number, decimals: number): string => `${Number(n.toFixed(decimals))}%`;

const chipHtml = (c: LevelChip | null): string => (c ? `<span class="chip" style="background:${esc(c.color)}">${esc(c.label)}</span>` : '');

function sectionHtml(s: DocSection, template: TemplateConfig): string {
  const brk = s.pageBreakBefore ? ' brk' : '';
  switch (s.type) {
    case 'cover':
      return `<section class="cover${brk}">
  ${template.branding.logoUrl ? `<img class="logo" src="${esc(template.branding.logoUrl)}" alt="" />` : ''}
  <div class="banner"><div class="t1">${esc(s.title)}</div><div class="t2">${esc(s.subtitle)}</div>${s.tagline ? `<div class="t3">${esc(s.tagline)}</div>` : ''}</div>
  <table class="details"><tbody>${s.details.map((d) => `<tr><th>${esc(d.label)}</th><td>${esc(d.value)}</td></tr>`).join('')}</tbody></table>
</section>`;
    case 'intro':
    case 'statement':
    case 'mantra':
      if (!s.paragraphs.length && !s.title) return '';
      return `<section class="${s.type}${brk}"><h2>${esc(s.title)}</h2>${paras(s.paragraphs)}</section>`;
    case 'level_scale':
      return `<section class="scale${brk}"><h2>${esc(s.title)}</h2>
  <table class="grid"><thead><tr><th>${esc(s.colLevel)}</th><th>${esc(s.colMeaning)}</th></tr></thead>
  <tbody>${s.levels.map((l) => `<tr><td class="nowrap">${chipHtml(l.chip)}</td><td>${esc(l.meaning)}</td></tr>`).join('')}</tbody></table></section>`;
    case 'stage_results':
      return `<section class="stage${brk}">
  <div class="band" style="background:${esc(s.color)}">${esc(s.title)}</div>
  ${s.subtitle ? `<h3>${esc(s.subtitle)}</h3>` : ''}${paras(s.intro)}
  ${s.dimensions
    .map(
      (d) => `<div class="dim">
    <div class="sub">${esc(s.areasHeading)}</div>
    <table class="grid"><thead><tr><th>${esc(s.colArea)}</th><th class="num">${esc(s.colScore)}</th><th>${esc(s.colLevel)}</th></tr></thead>
    <tbody>${d.areas
      .map((a) =>
        a.percent === null
          ? `<tr><td>${esc(a.name)}</td><td class="num muted" colspan="2">${esc(s.notEnough)}</td></tr>`
          : `<tr><td>${esc(a.name)}</td><td class="num">${pct(a.percent, s.decimals)}</td><td>${chipHtml(a.level)}</td></tr>`,
      )
      .join('')}</tbody></table>
    ${d.overall ? `<div class="overall"><span>${esc(d.overallLabel ?? '')}</span><b>${pct(d.overall.percent, s.decimals)}</b>${chipHtml(d.overall.level)}</div>` : ''}
  </div>`,
    )
    .join('')}
</section>`;
    case 'narrative':
      return `<section class="narr${brk}">${s.dimensions
        .map((d) => {
          const hd = d.headings ?? { strength: '', growth: '', practice: '' };
          const block = (title: string, ps: string[]) => (ps.length ? `<div class="para"><h4>${esc(title)}</h4>${paras(ps)}</div>` : '');
          return block(hd.strength, d.strength) + block(hd.growth, d.growth) + block(hd.practice, d.practice);
        })
        .join('')}</section>`;
    case 'bar_profile':
      return `<section class="bars${brk}"><h2>${esc(s.title)}</h2>${s.dimensions
        .map((d) =>
          d.areas
            .filter((a) => a.percent !== null)
            .map(
              (a) => `<div class="bar"><div class="lab">${esc(a.name)}</div><div class="track"><i style="width:${Math.max(0, Math.min(100, a.percent as number))}%;background:${esc(a.level?.color ?? template.branding.accentColor)}"></i></div><div class="val">${pct(a.percent as number, s.decimals)}</div></div>`,
            )
            .join(''),
        )
        .join('')}</section>`;
    case 'stage_competencies':
      return `<section class="stage${brk}"><div class="band" style="background:${esc(s.color)}">${esc(s.title)}</div>
  <table class="grid"><thead><tr><th>${esc(s.colCompetency)}</th><th>${esc(s.colLevel)}</th></tr></thead>
  <tbody>${s.rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${chipHtml(r.level)}</td></tr>`).join('')}</tbody></table></section>`;
    case 'observer_note':
      return `<section class="obs${brk}"><h3>${esc(s.title)}</h3><div class="para">${paras(s.paragraphs)}</div></section>`;
    case 'snapshot':
      return `<section class="snap${brk}"><div class="snapbox"><b>${esc(s.title)}</b>${s.items.map((i) => `<div><span>${esc(i.label)}</span> ${esc(i.text)}</div>`).join('')}</div></section>`;
    case 'assessment_areas':
      return `<section class="wa${brk}"><h3>${esc(s.title)}</h3>
  <table class="grid"><thead><tr><th>${esc(s.colArea)}</th><th class="num">${esc(s.colScore)}</th><th>${esc(s.colLevel)}</th></tr></thead>
  <tbody>${s.areas.map((a) => `<tr><td>${esc(a.name)}</td><td class="num">${pct(a.percent, s.decimals)}</td><td>${chipHtml(a.level)}</td></tr>`).join('')}</tbody></table>
  ${s.overall ? `<div class="overall"><span>${esc(s.overallLabel)}</span><b>${pct(s.overall.percent, s.decimals)}</b>${chipHtml(s.overall.level)}</div>` : ''}</section>`;
    case 'dimension_notes':
      if (!s.rows.length) return '';
      return `<section class="dnotes${brk}"><h2>${esc(s.title)}</h2>${s.rows.map((r) => `<div class="para"><b>${esc(r.dimension)} – ${esc(r.level)}:</b> ${esc(r.text)}</div>`).join('')}</section>`;
    case 'leadership_style':
      return `<section class="style${brk}"><h2>${esc(s.title)}</h2><div class="para"><b>${esc(s.name)}</b>${paras(s.paragraphs)}</div></section>`;
    case 'profile_summary':
      return `<section class="psum${brk}"><h2>${esc(s.title)}</h2>
  <table class="grid"><thead><tr><th>${esc(s.colDimension)}</th><th>${esc(s.colLevel)}</th></tr></thead>
  <tbody>${s.rows.map((r) => `<tr><td>${esc(r.dimension)}${r.subtitle ? ` – ${esc(r.subtitle)}` : ''}</td><td>${chipHtml(r.level)}</td></tr>`).join('')}</tbody></table>
  ${s.overallLabel ? `<div class="overallbig" style="border-color:${esc(s.overallColor)}"><small>${esc(s.overallHeading)}</small><b>${esc(s.overallLabel)}</b></div>` : ''}
  ${s.provisionalNote ? `<p class="prov">${esc(s.provisionalNote)}</p>` : ''}
  ${s.oneLine ? `<div class="para"><b>${esc(s.oneLineHeading)}</b><p>${esc(s.oneLine)}</p></div>` : ''}</section>`;
    case 'final_profile':
      return `<section class="fprof${brk}"><h2>${esc(s.title)}</h2>
  <table class="grid"><thead><tr><th>${esc(s.colDimension)}</th><th>${esc(s.colLevel)}</th><th>${esc(s.colReflects)}</th></tr></thead>
  <tbody>${s.rows.map((r) => `<tr><td>${esc(r.dimension)}</td><td class="nowrap">${chipHtml(r.level)}</td><td>${esc(r.reflects)}</td></tr>`).join('')}</tbody></table>
  ${s.strengths.length ? `<h3>${esc(s.strengthsHeading)}</h3><ol class="hl">${s.strengths.map((x) => `<li><b>${esc(x.title)}</b> — ${esc(x.text)}</li>`).join('')}</ol>` : ''}
  ${s.growth.length ? `<h3>${esc(s.growthHeading)}</h3><ol class="hl">${s.growth.map((x) => `<li><b>${esc(x.title)}</b> — ${esc(x.text)}</li>`).join('')}</ol>` : ''}</section>`;
    case 'challenge':
      return `<section class="chal${brk}"><h2>${esc(s.title)}</h2>
  <table class="grid"><thead><tr><th>${esc(s.colWeek)}</th><th>${esc(s.colFocus)}</th><th>${esc(s.colPractice)}</th></tr></thead>
  <tbody>${s.rows.map((r) => `<tr><td class="nowrap">${esc(r.week)}</td><td class="nowrap"><b>${esc(r.focus)}</b></td><td>${esc(r.practice)}</td></tr>`).join('')}</tbody></table></section>`;
    case 'reflection':
      return `<section class="refl${brk}"><h2>${esc(s.title)}</h2><ul class="qs">${s.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></section>`;
    case 'wisdom':
      return `<section class="wis${brk}"><h2>${esc(s.title)}</h2>${s.intro ? `<p>${esc(s.intro)}</p>` : ''}
  <table class="grid"><thead><tr><th>${esc(s.colCapacity)}</th><th>${esc(s.colDimension)}</th><th>${esc(s.colMeaning)}</th></tr></thead>
  <tbody>${s.rows.map((r) => `<tr><td><b>${esc(r.capacity)}</b></td><td>${esc(r.dimension)}</td><td>${esc(r.meaning)}</td></tr>`).join('')}</tbody></table></section>`;
    case 'verification':
      return `<section class="verify${brk}"><h2>${esc(s.title)}</h2><div class="vbox">${s.qrDataUrl ? `<img src="${esc(s.qrDataUrl)}" alt="" />` : '<div class="noqr">QR</div>'}<div><p>${esc(s.caption)}</p><p class="code">${esc(s.codeLabel)}: <b>${esc(s.code)}</b></p>${s.url ? `<p class="url">${esc(s.url)}</p>` : ''}</div></div></section>`;
    case 'disclaimer':
      return `<section class="note${brk}"><h2>${esc(s.title)}</h2>${s.items.map((i) => `${i.title ? `<h4>${esc(i.title)}</h4>` : ''}${paras(i.paragraphs)}`).join('')}</section>`;
  }
}

const CSS = (t: TemplateConfig): string => `
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", sans-serif; color: #333; font-size: 10.5pt; line-height: 1.5; }
  h2 { color: ${t.branding.primaryColor}; font-size: 13pt; letter-spacing: 0.04em; text-transform: uppercase; margin: 18pt 0 6pt; padding-bottom: 3pt; border-bottom: 1.5pt solid ${t.branding.highlightColor}; break-after: avoid; }
  h3 { color: ${t.branding.primaryColor}; font-size: 12pt; margin: 8pt 0 4pt; break-after: avoid; }
  h4 { color: ${t.branding.primaryColor}; font-size: 10.5pt; margin: 0 0 2pt; break-after: avoid; }
  p { margin: 0 0 6pt; }
  .brk { break-before: page; }
  section { margin-bottom: 4pt; }
  .logo { height: 34pt; margin-bottom: 8pt; }
  .banner { background: ${t.branding.primaryColor}; color: #fff; text-align: center; padding: 26pt 14pt; border-radius: 4pt; }
  .banner .t1 { font-size: 22pt; font-weight: 700; letter-spacing: 0.08em; }
  .banner .t2 { font-size: 14pt; margin-top: 6pt; color: #f5f5f5; letter-spacing: 0.1em; }
  .banner .t3 { font-size: 10pt; margin-top: 8pt; color: ${t.branding.highlightColor}; letter-spacing: 0.22em; }
  table { border-collapse: collapse; width: 100%; }
  table.details { margin-top: 14pt; }
  table.details th { text-align: left; width: 32%; background: #eef4fa; color: ${t.branding.primaryColor}; padding: 6pt 8pt; border: 0.5pt solid #d6e0ea; font-weight: 600; }
  table.details td { padding: 6pt 8pt; border: 0.5pt solid #d6e0ea; }
  table.grid { margin: 4pt 0 8pt; }
  table.grid thead { display: table-header-group; }
  table.grid tr { break-inside: avoid; }
  table.grid th { background: ${t.branding.primaryColor}; color: #fff; text-align: left; padding: 6pt 8pt; font-size: 9.5pt; letter-spacing: 0.03em; }
  table.grid td { padding: 6pt 8pt; border-bottom: 0.5pt solid #dde4ec; }
  table.grid tbody tr:nth-child(even) td { background: #f6f8fb; }
  .num { text-align: right; width: 18%; font-variant-numeric: tabular-nums; }
  .nowrap { white-space: nowrap; width: 22%; }
  .muted { color: #777; font-style: italic; }
  .chip { display: inline-block; color: #fff; padding: 1.5pt 8pt; border-radius: 9pt; font-size: 9pt; font-weight: 600; }
  .band { color: #fff; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 7pt 10pt; border-radius: 3pt; margin: 16pt 0 6pt; break-after: avoid; }
  .sub { font-size: 9pt; letter-spacing: 0.1em; text-transform: uppercase; color: #777; margin: 8pt 0 2pt; break-after: avoid; }
  .overall { display: flex; align-items: center; gap: 10pt; background: #fff7e2; border-left: 3pt solid ${t.branding.highlightColor}; padding: 7pt 10pt; margin: 4pt 0 8pt; break-inside: avoid; }
  .overall > span:first-child { flex: 1; font-weight: 700; color: ${t.branding.primaryColor}; letter-spacing: 0.04em; }
  .overall b { font-size: 13pt; color: ${t.branding.accentColor}; }
  .para { background: #f6f8fb; border-radius: 3pt; padding: 8pt 10pt; margin: 6pt 0; break-inside: avoid; }
  .bars .bar { display: flex; align-items: center; gap: 8pt; margin: 5pt 0; break-inside: avoid; }
  .bars .lab { width: 32%; font-size: 9.5pt; }
  .bars .track { flex: 1; height: 10pt; background: #e8edf3; border-radius: 5pt; overflow: hidden; }
  .bars .track i { display: block; height: 100%; border-radius: 5pt; }
  .bars .val { width: 10%; text-align: right; font-variant-numeric: tabular-nums; font-size: 9.5pt; }
  .mantra p, .statement p { font-size: 12pt; font-style: italic; color: ${t.branding.primaryColor}; text-align: center; margin: 8pt 0; }
  .note p { font-size: 9pt; color: #555; }
  .snapbox { border: 1pt solid ${t.branding.highlightColor}; border-radius: 3pt; padding: 7pt 10pt; margin: 6pt 0; font-size: 9.5pt; break-inside: avoid; }
  .snapbox div { margin-top: 3pt; }
  .snapbox span { font-weight: 700; color: ${t.branding.primaryColor}; text-transform: uppercase; font-size: 8.5pt; letter-spacing: 0.06em; margin-right: 4pt; }
  .overallbig { border-left: 4pt solid ${t.branding.accentColor}; background: #fff7e2; padding: 8pt 12pt; margin: 8pt 0; break-inside: avoid; }
  .overallbig small { display: block; font-size: 8.5pt; letter-spacing: 0.1em; text-transform: uppercase; color: #777; }
  .overallbig b { font-size: 13pt; color: ${t.branding.primaryColor}; }
  .prov { background: #fff1f2; border-left: 3pt solid ${t.branding.accentColor}; padding: 6pt 10pt; font-size: 9pt; }
  .hl { margin: 4pt 0 8pt 16pt; padding: 0; display: grid; gap: 3pt; font-size: 10pt; }
  .qs { margin: 4pt 0 8pt 16pt; padding: 0; display: grid; gap: 4pt; }
  .vbox { display: flex; align-items: center; gap: 14pt; break-inside: avoid; }
  .vbox img, .vbox .noqr { width: 80pt; height: 80pt; flex: none; }
  .vbox .noqr { display: flex; align-items: center; justify-content: center; border: 1pt dashed #aaa; color: #aaa; }
  .vbox .code b { letter-spacing: 0.08em; color: ${t.branding.primaryColor}; }
  .vbox .url { font-size: 8.5pt; color: #777; word-break: break-all; }
  .note h4 { margin-top: 6pt; }
`;

/** The whole report as one HTML document, ready for Chromium to print as A4. */
export function renderReportHtml(doc: ReportDocument, template: TemplateConfig): string {
  const body = doc.sections.map((s) => sectionHtml(s, template)).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${esc(doc.title)}</title><style>${CSS(template)}</style></head><body>${body}</body></html>`;
}
