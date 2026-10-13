import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListQueryDto } from '../../common/list-query.dto';
import { toXlsxBuffer } from '../../common/xlsx.util';
import { FrameworkConfig, FrameworkScale, normalizeConfig } from '../../common/scorecard-config';
import { AnsweredQuestion, StageReportData, buildAutoScoredStageReport } from '../../common/stage-report';

interface Context {
  competition: { id: number; code: string; title: string };
  stage: { id: number; position: number; name: string };
  framework: { code: string; name: string; version: number; status: string };
  config: FrameworkConfig;
  scale: FrameworkScale;
  season: { code: string; name: string; editionLabel: string } | null;
}

type AttemptWithAnswers = Prisma.AttemptGetPayload<{
  include: {
    registration: { include: { student: { select: { code: true; name: true; grade: true; gender: true; school: { select: { code: true; name: true } } } } } };
    answers: { select: { category: true; isCorrect: true; question: { select: { category: true } } } };
  };
}>;

// Stage 1 report data (#71): per-area percentage and level for an auto-scored stage,
// built from the answers' saved categories, for one student (preview) or a whole
// stage (roster and Excel export). The configuration decides which exam categories
// feed which area, how many questions an area needs, and what the levels are.
@Injectable()
export class StageReportService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ context

  /**
   * Which framework and scale apply: the competition's season framework (it must be
   * published), or — for previewing before a season exists — a framework chosen
   * explicitly, drafts included.
   */
  private async context(competitionCode: string, stagePosition: number, frameworkCode?: string): Promise<Context> {
    if (!competitionCode) throw new BadRequestException('Choose a competition.');
    if (!Number.isInteger(stagePosition) || stagePosition < 1) throw new BadRequestException('Choose a stage.');
    const competition = await this.prisma.competition.findUnique({
      where: { code: competitionCode },
      include: { season: { include: { framework: true } } },
    });
    if (!competition) throw new NotFoundException('Competition not found');
    const stage = await this.prisma.competitionStage.findUnique({
      where: { competitionId_position: { competitionId: competition.id, position: stagePosition } },
    });
    if (!stage) throw new NotFoundException(`This competition has no stage ${stagePosition}.`);

    let framework = competition.season?.framework ?? null;
    if (frameworkCode) {
      framework = await this.prisma.scorecardFramework.findUnique({ where: { code: frameworkCode } });
      if (!framework) throw new NotFoundException('Framework not found');
    } else if (!framework) {
      throw new BadRequestException('This competition is not in a scorecard season yet. Add it to a season in Scorecard Setup, or pick a framework to preview with.');
    } else if (framework.status !== 'Published' && framework.status !== 'Archived') {
      throw new BadRequestException('The season’s framework is not published.');
    }
    const config = normalizeConfig(framework.config);
    const scaleKey = (!frameworkCode ? competition.scaleKey ?? competition.season?.scaleKey : null) || config.defaultScale;
    const scale = config.scales.find((s) => s.key === scaleKey);
    if (!scale) throw new BadRequestException(`The scale "${scaleKey}" does not exist in framework ${framework.code}.`);
    if (!config.competencies.some((c) => (c.examCategories?.length ?? 0) > 0)) {
      throw new BadRequestException(`Framework ${framework.code} does not map any exam categories to competencies yet. Set them under Competencies.`);
    }
    return {
      competition: { id: competition.id, code: competition.code, title: competition.title },
      stage: { id: stage.id, position: stage.position, name: stage.name },
      framework: { code: framework.code, name: framework.name, version: framework.version, status: framework.status },
      config,
      scale,
      season: competition.season ? { code: competition.season.code, name: competition.season.name, editionLabel: competition.season.editionLabel } : null,
    };
  }

  private answersOf(a: AttemptWithAnswers): AnsweredQuestion[] {
    // The category saved at submit time wins; the live question's is only a fallback for old rows.
    return a.answers.map((x) => ({ category: x.category ?? x.question?.category ?? null, isCorrect: x.isCorrect }));
  }

  private studentOf(a: AttemptWithAnswers) {
    const s = a.registration.student;
    return { code: s.code, name: s.name, grade: s.grade, gender: s.gender, school: s.school?.name ?? null, schoolCode: s.school?.code ?? null };
  }

  private readonly include = {
    registration: { include: { student: { select: { code: true, name: true, grade: true, gender: true, school: { select: { code: true, name: true } } } } } },
    answers: { select: { category: true, isCorrect: true, question: { select: { category: true } } } },
  } as const;

  // ------------------------------------------------------------ one student

  async studentReport(competitionCode: string, stagePosition: number, studentCode: string, frameworkCode?: string) {
    const ctx = await this.context(competitionCode, stagePosition, frameworkCode);
    const reg = await this.prisma.registration.findFirst({
      where: { competitionId: ctx.competition.id, student: { code: studentCode } },
      select: { id: true, code: true },
    });
    if (!reg) throw new NotFoundException(`${studentCode} is not registered for ${ctx.competition.code}.`);

    // Only one attempt per registration and stage is kept; if more than one finished one
    // ever exists, the latest counts (same rule as the stage selection).
    const attempts = await this.prisma.attempt.findMany({
      where: { registrationId: reg.id, stageId: ctx.stage.id },
      include: this.include,
      orderBy: { id: 'desc' },
    });
    const finished = attempts.filter((a) => a.finishedAt).sort((a, b) => (b.finishedAt as Date).getTime() - (a.finishedAt as Date).getTime())[0];
    const student = await this.prisma.student.findFirst({
      where: { code: studentCode },
      select: { code: true, name: true, grade: true, gender: true, school: { select: { code: true, name: true } } },
    });

    const base = {
      competition: ctx.competition,
      stage: { position: ctx.stage.position, name: ctx.stage.name },
      framework: ctx.framework,
      season: ctx.season,
      scale: { key: ctx.scale.key, name: ctx.scale.name, levels: ctx.scale.levels },
      student: student ? { code: student.code, name: student.name, grade: student.grade, gender: student.gender, school: student.school?.name ?? null, schoolCode: student.school?.code ?? null } : null,
    };
    if (!finished) {
      return { ...base, status: attempts.length ? ('in_progress' as const) : ('not_attempted' as const), attempt: null, report: null };
    }
    const report = buildAutoScoredStageReport(ctx.config, ctx.scale, ctx.stage.position, this.answersOf(finished));
    return {
      ...base,
      status: 'ready' as const,
      attempt: { code: finished.code, finishedAt: finished.finishedAt, score: Number(finished.score), total: Number(finished.total) },
      report,
    };
  }

  // ------------------------------------------------------------------ roster

  /** Latest finished attempt per registration for the stage, with the student filters applied. */
  private async latestAttempts(ctx: Context, q: ListQueryDto) {
    const studentWhere: Prisma.StudentWhereInput = {};
    if (q.grade) studentWhere.grade = q.grade;
    if (q.school) studentWhere.school = { code: q.school };
    if (q.search) studentWhere.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { code: { contains: q.search, mode: 'insensitive' } }];
    const rows = await this.prisma.attempt.findMany({
      where: { stageId: ctx.stage.id, finishedAt: { not: null }, registration: { competitionId: ctx.competition.id, student: studentWhere } },
      select: { id: true, registrationId: true, finishedAt: true, registration: { select: { student: { select: { code: true } } } } },
    });
    const latest = new Map<number, (typeof rows)[number]>();
    for (const r of rows) {
      const prev = latest.get(r.registrationId);
      if (!prev || (r.finishedAt as Date) > (prev.finishedAt as Date)) latest.set(r.registrationId, r);
    }
    return [...latest.values()].sort((a, b) => a.registration.student.code.localeCompare(b.registration.student.code, undefined, { numeric: true }));
  }

  private columns(ctx: Context) {
    const areas = ctx.config.dimensions.flatMap((d) =>
      ctx.config.competencies
        .filter((c) => c.dimension === d.key && (c.examCategories?.length ?? 0) > 0)
        .map((c) => ({ competency: c.key, dimension: d.key, name: c.stageNames?.[String(ctx.stage.position)] || c.name, categories: c.examCategories ?? [] })),
    );
    const dimensions = ctx.config.dimensions.filter((d) => areas.some((a) => a.dimension === d.key)).map((d) => ({ key: d.key, label: d.label }));
    return { areas, dimensions };
  }

  private rosterRow(a: AttemptWithAnswers, ctx: Context) {
    const report = buildAutoScoredStageReport(ctx.config, ctx.scale, ctx.stage.position, this.answersOf(a));
    const areas: Record<string, { percent: number | null; level: string | null; correct: number; total: number; status: string }> = {};
    const dimensions: Record<string, { percent: number | null; level: string | null }> = {};
    for (const d of report.dimensions) {
      dimensions[d.dimension] = { percent: d.overall?.percent ?? null, level: d.overall?.level?.label ?? null };
      for (const x of d.areas) areas[x.competency] = { percent: x.percent, level: x.level?.label ?? null, correct: x.correct, total: x.total, status: x.status };
    }
    return {
      student: this.studentOf(a),
      attemptCode: a.code,
      finishedAt: a.finishedAt,
      areas,
      dimensions,
      unmapped: report.unmapped.reduce((n, u) => n + u.total, 0),
    };
  }

  async roster(competitionCode: string, stagePosition: number, q: ListQueryDto, frameworkCode?: string) {
    const ctx = await this.context(competitionCode, stagePosition, frameworkCode);
    const all = await this.latestAttempts(ctx, q);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(500, Math.max(1, q.limit ?? 50));
    const slice = all.slice((page - 1) * limit, page * limit);
    const full = slice.length
      ? await this.prisma.attempt.findMany({ where: { id: { in: slice.map((s) => s.id) } }, include: this.include })
      : [];
    const byId = new Map(full.map((a) => [a.id, a]));
    return {
      competition: ctx.competition,
      stage: { position: ctx.stage.position, name: ctx.stage.name },
      framework: ctx.framework,
      scale: { key: ctx.scale.key, name: ctx.scale.name, levels: ctx.scale.levels },
      minQuestionsPerArea: ctx.config.autoScore?.minQuestionsPerArea,
      columns: this.columns(ctx),
      rows: slice.map((s) => this.rosterRow(byId.get(s.id) as AttemptWithAnswers, ctx)),
      total: all.length,
      page,
      limit,
    };
  }

  async exportRoster(competitionCode: string, stagePosition: number, q: ListQueryDto, frameworkCode?: string): Promise<Buffer> {
    const ctx = await this.context(competitionCode, stagePosition, frameworkCode);
    const all = await this.latestAttempts(ctx, q);
    const cols = this.columns(ctx);
    const headers = ['Student code', 'Student name', 'Grade', 'School code', 'School', 'Attempt'];
    for (const a of cols.areas) headers.push(`${a.name} correct`, `${a.name} out of`, `${a.name} %`, `${a.name} level`);
    for (const d of cols.dimensions) headers.push(`${d.label} overall %`, `${d.label} overall level`);
    const data: unknown[][] = [];
    for (let i = 0; i < all.length; i += 100) {
      const chunk = all.slice(i, i + 100);
      const full = await this.prisma.attempt.findMany({ where: { id: { in: chunk.map((c) => c.id) } }, include: this.include });
      const byId = new Map(full.map((a) => [a.id, a]));
      for (const c of chunk) {
        const row = this.rosterRow(byId.get(c.id) as AttemptWithAnswers, ctx);
        const line: unknown[] = [row.student.code, row.student.name, row.student.grade, row.student.schoolCode ?? '', row.student.school ?? '', row.attemptCode];
        for (const a of cols.areas) {
          const x = row.areas[a.competency];
          line.push(x?.correct ?? '', x?.total ?? '', x?.percent === null || x === undefined ? (x?.status === 'not_enough_questions' ? 'not enough questions' : '') : Number(x.percent.toFixed(2)), x?.level ?? '');
        }
        for (const d of cols.dimensions) {
          const x = row.dimensions[d.key];
          line.push(x?.percent === null || x === undefined ? '' : Number(x.percent.toFixed(2)), x?.level ?? '');
        }
        data.push(line);
      }
    }
    return toXlsxBuffer('Stage report', headers, data);
  }
}

export type { StageReportData };
