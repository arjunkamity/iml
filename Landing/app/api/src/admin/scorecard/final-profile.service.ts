import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StageReportService } from './stage-report.service';
import { FrameworkConfig, FrameworkScale, normalizeConfig, standardEdpaScale } from '../../common/scorecard-config';
import { EvidenceItem, StageEvidence, levelByKey, levelForPercent } from '../../common/level-engine';
import { FinalProfile, RollupRules, buildFinalProfile, normalizeRollup } from '../../common/rollup-rules';
import { StageData } from '../../common/report-document';
import { asConfig, scoreKey } from './final-profile.util';

export interface ProfileContext {
  competition: { id: number; code: string; title: string };
  season: { code: string; name: string; editionLabel: string } | null;
  framework: { code: string; name: string; version: number; status: string };
  config: FrameworkConfig;
  scale: FrameworkScale;
  rules: RollupRules;
  /** Set when a framework was chosen explicitly (a preview), rather than the season's. */
  explicitFramework?: string;
  stages: {
    id: number;
    position: number;
    name: string;
    mode: string;
    panel: { state: string; formId: number | null } | null;
    roster: Set<number>;
    results: Map<number, { status: string; competencies: { code: string; label: string; dimension: string; weight: number; levelKey: string | null; final: number | null }[] }>;
    notes: Map<number, string>;
  }[];
}

const keyOf = (label: string) => label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// A student's evidence from every stage (#84): an auto-scored exam stage from its answers, a
// panel-rated stage from its finalized and released result, and a scored written assessment from
// its submission. Pending and never-reached stages are told apart, so the roll-up can leave them
// out and mark the profile provisional.
@Injectable()
export class FinalProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stageReports: StageReportService,
  ) {}

  /** Loads what is shared by every student of a competition, once. */
  async context(competitionCode: string, frameworkCode?: string): Promise<ProfileContext> {
    const competition = await this.prisma.competition.findUnique({ where: { code: competitionCode }, include: { season: { include: { framework: true } } } });
    if (!competition) throw new NotFoundException('Competition not found');
    let framework = competition.season?.framework ?? null;
    if (frameworkCode) {
      framework = await this.prisma.scorecardFramework.findUnique({ where: { code: frameworkCode } });
      if (!framework) throw new NotFoundException('Framework not found');
    } else if (!framework) throw new BadRequestException('This competition is not in a scorecard season yet. Add it to a season in Scorecard Setup, or pick a framework to preview with.');
    else if (framework.status === 'Draft') throw new BadRequestException('The season’s framework is not published.');
    const config = normalizeConfig(framework.config);
    const scaleKey = (!frameworkCode ? competition.scaleKey ?? competition.season?.scaleKey : null) || config.defaultScale;
    const scale = config.scales.find((s) => s.key === scaleKey) ?? config.scales[0] ?? standardEdpaScale();
    const rules = normalizeRollup((framework.config as { rollup?: unknown })?.rollup);
    const stages = await this.prisma.competitionStage.findMany({ where: { competitionId: competition.id }, orderBy: { position: 'asc' }, include: { panel: true } });
    const out: ProfileContext['stages'] = [];
    for (const s of stages) {
      const panel = s.panel?.formId ? { state: s.panel.state, formId: s.panel.formId } : null;
      const roster = new Set<number>();
      const results: ProfileContext['stages'][number]['results'] = new Map();
      const notes = new Map<number, string>();
      if (panel) {
        const first = stages[0]?.id === s.id;
        const regs = await this.prisma.registration.findMany({ where: first ? { competitionId: competition.id } : { competitionId: competition.id, stages: { some: { stageId: s.id, status: { not: 'Locked' } } } }, select: { id: true } });
        regs.forEach((r) => roster.add(r.id));
        for (const r of await this.prisma.panelResult.findMany({ where: { stageId: s.id } })) {
          results.set(r.registrationId, { status: r.status, competencies: (r.competencies as never) ?? [] });
        }
        for (const n of await this.prisma.panelNarrative.findMany({ where: { stageId: s.id, approvedText: { not: null } } })) notes.set(n.registrationId, n.approvedText as string);
      }
      out.push({ id: s.id, position: s.position, name: s.name, mode: s.mode, panel, roster, results, notes });
    }
    return {
      competition: { id: competition.id, code: competition.code, title: competition.title },
      season: competition.season ? { code: competition.season.code, name: competition.season.name, editionLabel: competition.season.editionLabel } : null,
      framework: { code: framework.code, name: framework.name, version: framework.version, status: framework.status },
      config,
      scale,
      rules,
      explicitFramework: frameworkCode,
      stages: out,
    };
  }

  /** What one stage gives a student from one source: complete with items, still pending, or never reached. */
  private async panelPart(ctx: ProfileContext, st: ProfileContext['stages'][number], regId: number, names: Map<string, string>) {
    const inRoster = st.roster.has(regId);
    const res = st.results.get(regId);
    if (st.panel?.state !== 'Released') return { status: inRoster ? ('pending' as const) : ('not_reached' as const), items: [] as EvidenceItem[] };
    if (!inRoster || !res || res.status !== 'Rated') return { status: 'not_reached' as const, items: [] as EvidenceItem[] };
    res.competencies.forEach((c) => names.set(keyOf(c.label), c.label));
    return {
      status: 'complete' as const,
      items: res.competencies.filter((c) => c.levelKey).map((c): EvidenceItem => ({ dimension: c.dimension, competency: keyOf(c.label), level: c.levelKey as string, weight: c.weight })),
      competencies: res.competencies.filter((c) => c.levelKey).map((c) => ({ key: keyOf(c.label), name: c.label, dimension: c.dimension, levelKey: c.levelKey, levelLabel: levelByKey(ctx.scale, c.levelKey as string)?.label ?? null })),
      note: st.notes.get(regId) ?? null,
    };
  }

  private async assessmentPart(ctx: ProfileContext, st: ProfileContext['stages'][number], regId: number, studentCode: string, code: string, names: Map<string, string>) {
    const a = await this.prisma.assessment.findUnique({ where: { code } });
    const sub = a ? await this.prisma.assessmentSubmission.findFirst({ where: { assessmentId: a.id, student: { code: studentCode } } }) : null;
    if (!a || !sub) {
      const reached = await this.prisma.registrationStage.findFirst({ where: { registrationId: regId, stageId: st.id, status: { not: 'Locked' } } });
      return { status: reached || st.position === ctx.stages[0]?.position ? ('pending' as const) : ('not_reached' as const), items: [] as EvidenceItem[] };
    }
    const cfg = asConfig(a.config);
    const scores = sub.scores as Record<string, { score: number; max: number }>;
    const areas = Object.entries(scores)
      .filter(([, v]) => v.max > 0)
      .map(([k, v]) => ({ key: k, name: cfg.dimensions.find((d) => d.key === k)?.label ?? k, percent: (v.score * 100) / v.max }));
    areas.forEach((x) => names.set(scoreKey(x.key), x.name));
    const overall = areas.length ? areas.reduce((s, x) => s + x.percent, 0) / areas.length : null;
    return {
      status: 'complete' as const,
      items: areas.map((x): EvidenceItem => ({ dimension: ctx.rules.competencyMap[scoreKey(x.key)] ?? x.key, competency: scoreKey(x.key), percent: x.percent })),
      assessment: { areas: areas.map((x) => ({ name: x.name, percent: x.percent, level: levelForPercent(ctx.scale, x.percent) })), overall: overall === null ? null : { percent: overall, level: levelForPercent(ctx.scale, overall) } },
    };
  }

  /** The evidence of one student, stage by stage, and the document data of each completed stage. */
  async forStudent(ctx: ProfileContext, studentCode: string) {
    const reg = await this.prisma.registration.findFirst({ where: { competitionId: ctx.competition.id, student: { code: studentCode } }, select: { id: true } });
    if (!reg) throw new NotFoundException(`${studentCode} is not registered for ${ctx.competition.code}.`);
    const evidence: StageEvidence[] = [];
    const data: StageData[] = [];
    const names = new Map<string, string>();
    for (const st of ctx.stages) {
      const base = { position: st.position, name: st.name, mode: st.mode };
      // a stage can have several sources at once (a panel and a written assessment); every one of them has to be complete
      const parts: { status: 'complete' | 'pending' | 'not_reached'; items: EvidenceItem[]; competencies?: StageData['competencies']; note?: string | null; assessment?: StageData['assessment']; report?: StageData['report'] }[] = [];
      if (st.panel) parts.push(await this.panelPart(ctx, st, reg.id, names));
      const source = ctx.rules.stageSources[String(st.position)];
      if (source?.type === 'assessment') parts.push(await this.assessmentPart(ctx, st, reg.id, studentCode, source.code, names));
      if (!parts.length) {
        // an auto-scored (exam) stage, if the framework maps its question categories
        try {
          const r = await this.stageReports.studentReport(ctx.competition.code, st.position, studentCode, ctx.explicitFramework);
          if (r.status === 'ready' && r.report) {
            const items: EvidenceItem[] = [];
            for (const d of r.report.dimensions) {
              for (const a of d.areas) {
                if (a.status !== 'ok' || a.percent === null) continue;
                items.push({ dimension: d.dimension, competency: a.competency, percent: a.percent });
                names.set(a.competency, a.name);
              }
            }
            parts.push({ status: 'complete', items, report: r.report });
          } else parts.push({ status: r.status === 'in_progress' ? 'pending' : 'not_reached', items: [] });
        } catch {
          // a stage the framework does not score (no category mapping): it adds nothing to the profile
          continue;
        }
      }
      const status = parts.some((x) => x.status === 'pending') ? ('pending' as const) : parts.every((x) => x.status === 'complete') ? ('complete' as const) : ('not_reached' as const);
      evidence.push({ stage: st.position, status, items: status === 'complete' ? parts.flatMap((x) => x.items) : [] });
      data.push(
        status === 'complete'
          ? { ...base, status, report: parts.find((x) => x.report)?.report, competencies: parts.find((x) => x.competencies)?.competencies, note: parts.find((x) => x.competencies)?.note ?? null, assessment: parts.find((x) => x.assessment)?.assessment }
          : { ...base, status },
      );
    }
    const compName = (k: string) => names.get(k) ?? ctx.config.competencies.find((c) => c.key === k)?.name ?? k;
    const profile: FinalProfile = buildFinalProfile(ctx.config, ctx.scale, ctx.rules, evidence, compName);
    return { registrationId: reg.id, evidence, stages: data, profile };
  }
}
