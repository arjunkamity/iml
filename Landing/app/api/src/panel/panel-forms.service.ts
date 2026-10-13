import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nextCode } from '../common/util';
import { normalizeConfig, standardEdpaScale } from '../common/scorecard-config';
import {
  CompetencyInput,
  FormQuestionRow,
  normalizePanelSettings,
  panelPublishIssues,
  standardScaleOptions,
  toCompetency,
  validateCompetency,
  validatePanelSettings,
} from '../common/panel-form';
import { CompetencyDto, CreatePanelFormDto, PatchPanelFormDto } from './panel.dto';

const LOCKED = 'This form is in use: a stage using it is open or has ratings, so its competencies are locked. Use "Make a new version" to change a copy.';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'panel-form';
}

// Panel-rated evaluation forms (#75): Assessments of kind "panel". Each competency is a Question
// Bank row tied to the form (label = name, prompt = what is observed, category = dimension).
@Injectable()
export class PanelFormsService {
  constructor(private readonly prisma: PrismaService) {}

  private async byCode(code: string) {
    const a = await this.prisma.assessment.findUnique({ where: { code } });
    if (!a || a.kind !== 'panel') throw new NotFoundException('Panel form not found');
    return a;
  }

  private questions(assessmentId: number) {
    return this.prisma.question.findMany({ where: { assessmentId }, orderBy: { id: 'asc' } });
  }

  private rows(qs: Awaited<ReturnType<PanelFormsService['questions']>>): FormQuestionRow[] {
    return qs.map((q) => ({ code: q.code, category: q.category, label: q.label, prompt: q.prompt, options: q.options, optionPoints: q.optionPoints, optionHints: q.optionHints, weight: q.weight }));
  }

  /** The stages using this form, and whether any of them has started. */
  private async usage(assessmentId: number) {
    const stages = await this.prisma.panelStage.findMany({ where: { formId: assessmentId }, include: { stage: { select: { position: true, name: true, competition: { select: { code: true, title: true } } } } } });
    const started = stages.filter((s) => s.state !== 'Draft' && s.state !== 'Ready');
    const ratings = stages.length ? await this.prisma.panelRating.count({ where: { stageId: { in: stages.map((s) => s.stageId) } } }) : 0;
    return {
      stages: stages.map((s) => ({ competition: s.stage.competition.code, competitionTitle: s.stage.competition.title, stage: s.stage.position, stageName: s.stage.name, state: s.state })),
      locked: started.length > 0 || ratings > 0,
    };
  }

  private async assertUnlocked(assessmentId: number) {
    if ((await this.usage(assessmentId)).locked) throw new BadRequestException(LOCKED);
  }

  private shapeCompetency(q: FormQuestionRow) {
    const c = toCompetency(q);
    return { code: c.code, label: c.label, dimension: c.dimension, prompt: c.prompt, weight: c.weight, options: c.options };
  }

  async list() {
    const rows = await this.prisma.assessment.findMany({ where: { kind: 'panel' }, orderBy: { id: 'asc' } });
    const out: Record<string, unknown>[] = [];
    for (const a of rows) {
      const qs = await this.questions(a.id);
      const u = await this.usage(a.id);
      const settings = normalizePanelSettings((a.config as { panel?: unknown })?.panel);
      out.push({ code: a.code, title: a.title, status: a.status, kind: 'panel' as const, competencies: qs.length, requiredRaters: settings.requiredRaters, usedBy: u.stages.length, locked: u.locked, updatedAt: a.updatedAt });
    }
    return out;
  }

  async get(code: string) {
    const a = await this.byCode(code);
    const qs = await this.questions(a.id);
    const settings = normalizePanelSettings((a.config as { panel?: unknown })?.panel);
    const u = await this.usage(a.id);
    return {
      code: a.code,
      title: a.title,
      summary: a.summary,
      status: a.status,
      kind: 'panel' as const,
      settings,
      competencies: this.rows(qs).map((q) => this.shapeCompetency(q)),
      issues: panelPublishIssues(this.rows(qs), settings),
      locked: u.locked,
      usedBy: u.stages,
      publishedAt: a.publishedAt,
      archivedAt: a.archivedAt,
      updatedAt: a.updatedAt,
    };
  }

  private settingsFrom(raw: unknown) {
    const issues = validatePanelSettings(raw ?? {});
    if (issues.length) throw new BadRequestException(issues.join(' '));
    return normalizePanelSettings(raw);
  }

  async create(dto: CreatePanelFormDto) {
    const title = dto.title.trim();
    const codes = (await this.prisma.assessment.findMany({ select: { code: true } })).map((c) => c.code);
    const code = nextCode(codes, 'AS');
    if (dto.cloneFrom) {
      const src = await this.byCode(dto.cloneFrom);
      const qs = await this.questions(src.id);
      const a = await this.prisma.$transaction(async (tx) => {
        const created = await tx.assessment.create({
          data: { code, slug: await this.uniqueSlug(slugify(title)), title, summary: dto.summary ?? src.summary, kind: 'panel', status: 'Draft', categoryId: src.categoryId, config: src.config as Prisma.InputJsonValue },
        });
        for (let i = 0; i < qs.length; i++) {
          const q = qs[i];
          await tx.question.create({
            data: { code: `${created.code}-Q${i + 1}`, assessmentId: created.id, grade: q.grade, category: q.category, label: q.label, prompt: q.prompt, options: q.options as Prisma.InputJsonValue, optionPoints: q.optionPoints as Prisma.InputJsonValue, optionHints: q.optionHints as Prisma.InputJsonValue, weight: q.weight, correct: [] },
          });
        }
        return created;
      });
      return this.get(a.code);
    }
    const settings = this.settingsFrom(dto.settings);
    const a = await this.prisma.assessment.create({
      data: { code, slug: await this.uniqueSlug(slugify(title)), title, summary: dto.summary ?? null, kind: 'panel', status: 'Draft', config: { panel: settings } as unknown as Prisma.InputJsonValue },
    });
    return this.get(a.code);
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let n = 2; await this.prisma.assessment.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${base.slice(0, 74)}-${n}`;
    return slug;
  }

  async update(code: string, dto: PatchPanelFormDto) {
    const a = await this.byCode(code);
    if (dto.settings !== undefined) await this.assertUnlocked(a.id);
    const data: Prisma.AssessmentUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.summary !== undefined) data.summary = dto.summary.trim() || null;
    if (dto.settings !== undefined) data.config = { ...((a.config as object) ?? {}), panel: this.settingsFrom({ ...(((a.config as { panel?: object })?.panel) ?? {}), ...dto.settings }) } as unknown as Prisma.InputJsonValue;
    await this.prisma.assessment.update({ where: { id: a.id }, data });
    return this.get(code);
  }

  // ------------------------------------------------------------ competencies

  private input(dto: CompetencyDto, existing?: FormQuestionRow): CompetencyInput {
    const base = existing ? toCompetency(existing) : null;
    return {
      label: dto.label ?? base?.label ?? '',
      dimension: (dto.dimension ?? base?.dimension ?? '').trim().toUpperCase(),
      prompt: dto.prompt ?? base?.prompt ?? '',
      options: (dto.options ?? base?.options.map((o) => o.label) ?? []).map((o) => o.trim()),
      points: dto.points ?? base?.options.map((o) => o.points) ?? [],
      hints: dto.hints ?? base?.options.map((o) => o.hint),
      weight: dto.weight ?? base?.weight ?? 1,
    };
  }

  async addCompetency(code: string, dto: CompetencyDto) {
    const a = await this.byCode(code);
    await this.assertUnlocked(a.id);
    let c = this.input(dto);
    if (dto.useStandardScale) {
      const std = standardScaleOptions(await this.defaultScale(dto.frameworkCode));
      c = { ...c, options: std.options, points: std.points, hints: std.hints };
    }
    const problems = validateCompetency(c);
    if (problems.length) throw new BadRequestException(problems.join(' '));
    const existing = await this.questions(a.id);
    if (existing.some((q) => (q.label ?? '').toLowerCase() === c.label.trim().toLowerCase())) throw new BadRequestException(`A competency called "${c.label.trim()}" already exists in this form.`);
    const prefix = `${a.code}-Q`;
    let max = 0;
    for (const q of existing) max = Math.max(max, parseInt(q.code.slice(prefix.length), 10) || 0);
    const q = await this.prisma.question.create({
      data: {
        code: `${prefix}${max + 1}`,
        assessmentId: a.id,
        grade: 'All',
        category: c.dimension || 'GENERAL',
        label: c.label.trim(),
        prompt: c.prompt.trim(),
        options: c.options as Prisma.InputJsonValue,
        optionPoints: c.points as Prisma.InputJsonValue,
        optionHints: (c.hints ?? []).map((h) => h.trim()) as Prisma.InputJsonValue,
        weight: new Prisma.Decimal(c.weight ?? 1),
        correct: [],
      },
    });
    return this.shapeCompetency({ code: q.code, category: q.category, label: q.label, prompt: q.prompt, options: q.options, optionPoints: q.optionPoints, optionHints: q.optionHints, weight: q.weight });
  }

  private async defaultScale(frameworkCode?: string) {
    if (!frameworkCode) return standardEdpaScale();
    const fw = await this.prisma.scorecardFramework.findUnique({ where: { code: frameworkCode } });
    if (!fw) throw new NotFoundException('Framework not found');
    const cfg = normalizeConfig(fw.config);
    return cfg.scales.find((s) => s.key === cfg.defaultScale) ?? cfg.scales[0] ?? standardEdpaScale();
  }

  private async own(a: { id: number }, qcode: string) {
    const q = await this.prisma.question.findUnique({ where: { code: qcode } });
    if (!q || q.assessmentId !== a.id) throw new NotFoundException('Competency not found in this form');
    return q;
  }

  async updateCompetency(code: string, qcode: string, dto: CompetencyDto) {
    const a = await this.byCode(code);
    await this.assertUnlocked(a.id);
    const q = await this.own(a, qcode);
    const row: FormQuestionRow = { code: q.code, category: q.category, label: q.label, prompt: q.prompt, options: q.options, optionPoints: q.optionPoints, optionHints: q.optionHints, weight: q.weight };
    let c = this.input(dto, row);
    if (dto.useStandardScale) {
      const std = standardScaleOptions(await this.defaultScale(dto.frameworkCode));
      c = { ...c, options: std.options, points: std.points, hints: std.hints };
    }
    const problems = validateCompetency(c);
    if (problems.length) throw new BadRequestException(problems.join(' '));
    const updated = await this.prisma.question.update({
      where: { id: q.id },
      data: {
        category: c.dimension || 'GENERAL',
        label: c.label.trim(),
        prompt: c.prompt.trim(),
        options: c.options as Prisma.InputJsonValue,
        optionPoints: c.points as Prisma.InputJsonValue,
        optionHints: (c.hints ?? []).map((h) => h.trim()) as Prisma.InputJsonValue,
        weight: new Prisma.Decimal(c.weight ?? 1),
      },
    });
    return this.shapeCompetency({ code: updated.code, category: updated.category, label: updated.label, prompt: updated.prompt, options: updated.options, optionPoints: updated.optionPoints, optionHints: updated.optionHints, weight: updated.weight });
  }

  async deleteCompetency(code: string, qcode: string) {
    const a = await this.byCode(code);
    await this.assertUnlocked(a.id);
    const q = await this.own(a, qcode);
    await this.prisma.question.delete({ where: { id: q.id } });
    return { ok: true };
  }

  // -------------------------------------------------------------- lifecycle

  async publish(code: string) {
    const a = await this.byCode(code);
    if (a.status === 'Published') throw new BadRequestException('This form is already published.');
    const settings = normalizePanelSettings((a.config as { panel?: unknown })?.panel);
    const issues = panelPublishIssues(this.rows(await this.questions(a.id)), settings);
    if (issues.length) throw new BadRequestException(`Not ready to publish: ${issues.join(' ')}`);
    await this.prisma.assessment.update({ where: { id: a.id }, data: { status: 'Published', publishedAt: new Date(), archivedAt: null } });
    return this.get(code);
  }

  async archive(code: string) {
    const a = await this.byCode(code);
    const used = await this.prisma.panelStage.count({ where: { formId: a.id, state: { in: ['Open'] } } });
    if (used) throw new BadRequestException('A stage using this form is open.');
    await this.prisma.assessment.update({ where: { id: a.id }, data: { status: 'Archived', archivedAt: new Date() } });
    return this.get(code);
  }

  async unarchive(code: string) {
    const a = await this.byCode(code);
    await this.prisma.assessment.update({ where: { id: a.id }, data: { status: 'Draft', archivedAt: null } });
    return this.get(code);
  }

  async remove(code: string) {
    const a = await this.byCode(code);
    if ((await this.usage(a.id)).stages.length) throw new BadRequestException('A stage uses this form. Remove it from the stage first.');
    await this.prisma.question.deleteMany({ where: { assessmentId: a.id } });
    await this.prisma.assessment.delete({ where: { id: a.id } });
    return { ok: true };
  }

  /** Ratings progress, in place of student completions: per stage using the form, how many students are fully rated. */
  async progress(code: string) {
    const a = await this.byCode(code);
    const stages = await this.prisma.panelStage.findMany({ where: { formId: a.id }, include: { stage: { select: { id: true, position: true, name: true, competition: { select: { code: true, title: true } } } } } });
    const out: Record<string, unknown>[] = [];
    for (const s of stages) {
      const ratings = await this.prisma.panelRating.groupBy({ by: ['registrationId', 'status'], where: { stageId: s.stageId }, _count: { _all: true } });
      const submitted = new Map<number, number>();
      let drafts = 0;
      for (const r of ratings) {
        if (r.status === 'Submitted') submitted.set(r.registrationId, r._count._all);
        else drafts += r._count._all;
      }
      out.push({
        competition: s.stage.competition.code,
        competitionTitle: s.stage.competition.title,
        stage: s.stage.position,
        stageName: s.stage.name,
        state: s.state,
        requiredRaters: s.requiredRaters,
        studentsWithRatings: submitted.size,
        studentsFullyRated: [...submitted.values()].filter((n) => n >= s.requiredRaters).length,
        submittedRatings: [...submitted.values()].reduce((x, y) => x + y, 0),
        draftRatings: drafts,
      });
    }
    return out;
  }
}
