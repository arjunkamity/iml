import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListQueryDto } from '../../common/list-query.dto';
import { ListResult, paginate } from '../../common/list-result';
import { parseCsv, toCsv } from '../../common/csv.util';
import { toXlsxBuffer } from '../../common/xlsx.util';
import { gradeMatches, nextCode } from '../../common/util';
import {
  AssessmentAnswerError,
  AssessmentBand,
  AssessmentConfig,
  AssessmentDimension,
  ScorableQuestion,
  bandFor,
  scoreAssessment,
} from '../../common/assessment-scoring';
import {
  AssessmentQuestionDto,
  CreateAssessmentCategoryDto,
  CreateAssessmentDto,
  PatchAssessmentCategoryDto,
  PatchAssessmentDto,
  PatchAssessmentQuestionDto,
  PreviewScoreDto,
} from './assessments-admin.dto';

export interface BulkRowError {
  row: number;
  message: string;
}
export interface BulkResult {
  dryRun: boolean;
  total: number;
  created: number;
  failed: number;
  errors: BulkRowError[];
}

type Scores = Record<string, { score: number; max: number; band: string }>;

const MAX_POINTS = 10;
const LOCKED_MESSAGE =
  'This assessment already has completed results, so its questions and scoring are locked. Use "Make a new version" to publish a corrected copy.';

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'assessment'
  );
}

/** Grades as an explicit list ("9,10,11,12"), or null for every grade.
 * gradeMatches() reads "9-12" as just grades 9 and 12 (it splits on the dash,
 * it does not expand a range), so a range typed by an admin is expanded here
 * — otherwise a "9-12" assessment would silently hide from grades 10 and 11. */
export function normalizeGrades(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim().toLowerCase();
  if (!t || t === 'all' || t === 'any') return null;
  const set = new Set<number>();
  for (const part of t.split(/[,&/\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d{1,2})(?:-(\d{1,2}))?$/);
    const a = m ? Number(m[1]) : NaN;
    const b = m ? (m[2] ? Number(m[2]) : a) : NaN;
    if (!m || a < 1 || b > 12 || a > b) {
      throw new BadRequestException(`"${part}" is not a valid grade. Use grades like 9,10 or a range like 9-12.`);
    }
    for (let g = a; g <= b; g++) set.add(g);
  }
  return [...set].sort((x, y) => x - y).join(',');
}

function asConfig(raw: unknown): AssessmentConfig {
  const c = (raw ?? {}) as Partial<AssessmentConfig>;
  return {
    dimensions: Array.isArray(c.dimensions) ? c.dimensions : [],
    consent: c.consent ?? '',
    disclaimer: c.disclaimer ?? '',
    howScored: c.howScored ?? '',
  };
}

/** Problems with the capacities/bands shape, in plain words. Empty = fine. */
export function validateDimensions(dims: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(dims) || dims.length === 0) return ['Add at least one capacity.'];
  const keys = new Set<string>();
  dims.forEach((raw, i) => {
    const d = raw as Partial<AssessmentDimension>;
    const name = `Capacity ${i + 1}`;
    if (!d || typeof d !== 'object') {
      errors.push(`${name} is not valid.`);
      return;
    }
    if (typeof d.key !== 'string' || !/^[A-Z][A-Z0-9_]{1,19}$/.test(d.key)) {
      errors.push(`${name}: the key must be 2–20 capital letters, digits or underscores (e.g. THINK).`);
    } else if (keys.has(d.key)) {
      errors.push(`${name}: the key ${d.key} is used twice.`);
    } else keys.add(d.key);
    if (typeof d.label !== 'string' || !d.label.trim()) errors.push(`${name}: a label is required.`);
    if (!Array.isArray(d.bands) || d.bands.length === 0) {
      errors.push(`${name}: add at least one score band.`);
      return;
    }
    const bands = d.bands as Partial<AssessmentBand>[];
    bands.forEach((b, j) => {
      if (!b || typeof b.label !== 'string' || !b.label.trim()) errors.push(`${name}, band ${j + 1}: a label is required.`);
      if (!Number.isInteger(b?.min) || !Number.isInteger(b?.max) || (b!.min as number) > (b!.max as number)) {
        errors.push(`${name}, band ${j + 1}: min and max must be whole numbers with min ≤ max.`);
      }
    });
    const sorted = bands
      .filter((b) => Number.isInteger(b?.min) && Number.isInteger(b?.max))
      .sort((a, b) => (a.min as number) - (b.min as number));
    for (let j = 1; j < sorted.length; j++) {
      if ((sorted[j].min as number) <= (sorted[j - 1].max as number)) {
        errors.push(`${name}: the bands "${sorted[j - 1].label}" and "${sorted[j].label}" overlap.`);
      }
    }
  });
  return errors;
}

interface QuestionRow {
  id: number;
  code: string;
  category: string;
  prompt: string;
  options: unknown;
  optionPoints: unknown;
}

function pointsArray(q: { options: unknown; optionPoints: unknown }): number[] {
  const opts = Array.isArray(q.options) ? q.options : [];
  const pts = Array.isArray(q.optionPoints) ? q.optionPoints.map((p) => Number(p)) : [];
  return opts.map((_, i) => (Number.isFinite(pts[i]) ? pts[i] : 0));
}

/** Everything that stops an assessment from being published, in plain words. */
export function publishIssues(config: AssessmentConfig, questions: QuestionRow[]): string[] {
  const issues = validateDimensions(config.dimensions);
  if (issues.length) return issues;
  const keys = new Set(config.dimensions.map((d) => d.key));
  if (!questions.length) return ['Add questions before publishing.'];
  for (const q of questions) {
    if (!keys.has(q.category)) issues.push(`Question ${q.code} is tagged "${q.category}", which is not one of the capacities.`);
    const opts = Array.isArray(q.options) ? q.options : [];
    if (opts.length < 2) issues.push(`Question ${q.code} needs at least two options.`);
    if (!Array.isArray(q.optionPoints) || q.optionPoints.length !== opts.length) {
      issues.push(`Question ${q.code} needs points for every option.`);
    }
  }
  for (const d of config.dimensions) {
    const qs = questions.filter((q) => q.category === d.key);
    if (!qs.length) {
      issues.push(`${d.label} has no questions.`);
      continue;
    }
    const lo = qs.reduce((s, q) => s + Math.min(...pointsArray(q)), 0);
    const hi = qs.reduce((s, q) => s + Math.max(...pointsArray(q)), 0);
    const uncovered: number[] = [];
    for (let s = lo; s <= hi; s++) if (!bandFor(d, s)) uncovered.push(s);
    if (uncovered.length) {
      const sample = uncovered.slice(0, 4).join(', ');
      issues.push(
        `${d.label}: scores can range from ${lo} to ${hi}, but no band covers ${sample}${uncovered.length > 4 ? '…' : ''}.`,
      );
    }
  }
  return issues;
}

@Injectable()
export class AssessmentsAdminService {
  private readonly logger = new Logger(AssessmentsAdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ helpers

  private async byCode(code: string) {
    const a = await this.prisma.assessment.findUnique({ where: { code } });
    // a panel-rated form has its own editor (see panel/panel-forms.service.ts)
    if (!a || a.kind === 'panel') throw new NotFoundException('Assessment not found');
    return a;
  }

  private submissionCount(assessmentId: number) {
    return this.prisma.assessmentSubmission.count({ where: { assessmentId } });
  }

  private async assertUnlocked(assessmentId: number) {
    if ((await this.submissionCount(assessmentId)) > 0) throw new BadRequestException(LOCKED_MESSAGE);
  }

  private questionsOf(assessmentId: number) {
    return this.prisma.question.findMany({ where: { assessmentId }, orderBy: { id: 'asc' } });
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let n = 2; await this.prisma.assessment.findUnique({ where: { slug }, select: { id: true } }); n++) {
      slug = `${base.slice(0, 74)}-${n}`;
    }
    return slug;
  }

  private async newQuestionCodes(assessment: { id: number; code: string }, count: number): Promise<string[]> {
    const prefix = `${assessment.code}-Q`;
    const existing = await this.prisma.question.findMany({
      where: { code: { startsWith: prefix } },
      select: { code: true },
    });
    let max = 0;
    for (const e of existing) {
      const n = parseInt(e.code.slice(prefix.length), 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
    return Array.from({ length: count }, (_, i) => `${prefix}${max + i + 1}`);
  }

  private cleanOptions(options: string[], points: number[]) {
    const opts = options.map((o) => o.trim());
    if (opts.some((o) => !o)) throw new BadRequestException('Options cannot be blank.');
    if (opts.length !== points.length) throw new BadRequestException('Give points for every option.');
    if (points.some((p) => !Number.isInteger(p) || p < 0 || p > MAX_POINTS)) {
      throw new BadRequestException(`Points must be whole numbers from 0 to ${MAX_POINTS}.`);
    }
    return { opts, points };
  }

  private assertCapacity(config: AssessmentConfig, capacity: string) {
    if (!config.dimensions.some((d) => d.key === capacity)) {
      const keys = config.dimensions.map((d) => d.key).join(', ') || 'none defined yet';
      throw new BadRequestException(`"${capacity}" is not one of this assessment's capacities (${keys}).`);
    }
  }

  // --------------------------------------------------------------- categories

  async listCategories() {
    const rows = await this.prisma.assessmentCategory.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { assessments: true } } },
    });
    return rows.map((c) => ({ id: c.id, name: c.name, position: c.position, active: c.active, assessments: c._count.assessments }));
  }

  async createCategory(dto: CreateAssessmentCategoryDto) {
    const name = dto.name.trim();
    if (await this.prisma.assessmentCategory.findUnique({ where: { name } })) {
      throw new ConflictException(`A category called "${name}" already exists.`);
    }
    return this.prisma.assessmentCategory.create({ data: { name, position: dto.position ?? 0 } });
  }

  async updateCategory(id: number, dto: PatchAssessmentCategoryDto) {
    const existing = await this.prisma.assessmentCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    const data: Prisma.AssessmentCategoryUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const clash = await this.prisma.assessmentCategory.findUnique({ where: { name } });
      if (clash && clash.id !== id) throw new ConflictException(`A category called "${name}" already exists.`);
      data.name = name;
    }
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.active !== undefined) data.active = dto.active;
    return this.prisma.assessmentCategory.update({ where: { id }, data });
  }

  async deleteCategory(id: number) {
    const existing = await this.prisma.assessmentCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    // Assessments in it are kept and show as "Uncategorised" (FK is SET NULL).
    await this.prisma.assessmentCategory.delete({ where: { id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------- dashboard

  async overview() {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [assessments, totalSubs, recent, perAssessment] = await Promise.all([
      this.prisma.assessment.groupBy({ by: ['status'], where: { kind: 'self' }, _count: { _all: true } }),
      this.prisma.assessmentSubmission.count(),
      this.prisma.assessmentSubmission.findMany({ where: { submittedAt: { gte: since } }, select: { submittedAt: true } }),
      this.prisma.assessmentSubmission.groupBy({ by: ['assessmentId'], _count: { _all: true } }),
    ]);
    const names = await this.prisma.assessment.findMany({
      where: { id: { in: perAssessment.map((p) => p.assessmentId) } },
      select: { id: true, code: true, title: true },
    });
    const byDay = new Map<string, number>();
    for (const r of recent) {
      const day = r.submittedAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const days: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 3600 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      days.push({ date, count: byDay.get(date) ?? 0 });
    }
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return {
      byStatus: Object.fromEntries(assessments.map((s) => [s.status, s._count._all])),
      totalCompletions: totalSubs,
      last7Days: recent.filter((r) => r.submittedAt.getTime() >= sevenDaysAgo).length,
      last30Days: recent.length,
      days,
      top: perAssessment
        .map((p) => {
          const a = names.find((n) => n.id === p.assessmentId);
          return { code: a?.code ?? '', title: a?.title ?? '', completions: p._count._all };
        })
        .sort((a, b) => b.completions - a.completions)
        .slice(0, 5),
    };
  }

  // ------------------------------------------------------------- assessments

  async list(q: { status?: string; category?: string; search?: string }) {
    const where: Prisma.AssessmentWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.category === 'none') where.categoryId = null;
    else if (q.category) where.categoryId = Number(q.category) || -1;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, categories] = await Promise.all([
      this.prisma.assessment.findMany({
        where,
        orderBy: { id: 'asc' },
        include: { category: { select: { id: true, name: true } }, _count: { select: { questions: true, submissions: true } } },
      }),
      this.listCategories(),
    ]);
    return {
      categories,
      assessments: rows.map((a) => ({
        kind: a.kind,
        code: a.code,
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        grades: a.grades,
        status: a.status,
        categoryId: a.categoryId,
        category: a.category?.name ?? null,
        questionCount: a._count.questions,
        completions: a._count.submissions,
        publishedAt: a.publishedAt,
        archivedAt: a.archivedAt,
        updatedAt: a.updatedAt,
      })),
    };
  }

  async get(code: string) {
    const a = await this.byCode(code);
    const [questions, completions, category] = await Promise.all([
      this.questionsOf(a.id),
      this.submissionCount(a.id),
      a.categoryId ? this.prisma.assessmentCategory.findUnique({ where: { id: a.categoryId } }) : null,
    ]);
    const config = asConfig(a.config);
    return {
      code: a.code,
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      grades: a.grades,
      status: a.status,
      categoryId: a.categoryId,
      category: category?.name ?? null,
      consent: config.consent,
      disclaimer: config.disclaimer,
      howScored: config.howScored,
      dimensions: config.dimensions,
      questionCount: questions.length,
      completions,
      locked: completions > 0,
      publishedAt: a.publishedAt,
      archivedAt: a.archivedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      // What would stop a publish right now; empty = ready.
      issues: publishIssues(config, questions),
      studentPath: `/account/assessments/${a.slug}`,
    };
  }

  private async assertCategory(categoryId: number | null | undefined) {
    if (categoryId == null) return;
    if (!(await this.prisma.assessmentCategory.findUnique({ where: { id: categoryId }, select: { id: true } }))) {
      throw new BadRequestException('That category does not exist.');
    }
  }

  async create(dto: CreateAssessmentDto) {
    await this.assertCategory(dto.categoryId);
    const title = dto.title.trim();
    const codes = (await this.prisma.assessment.findMany({ select: { code: true } })).map((c) => c.code);
    const code = nextCode(codes, 'AS');
    const slug = await this.uniqueSlug(slugify(title));

    if (dto.cloneFrom) {
      const src = await this.byCode(dto.cloneFrom);
      const srcQuestions = await this.questionsOf(src.id);
      const created = await this.prisma.$transaction(async (tx) => {
        const a = await tx.assessment.create({
          data: {
            code,
            slug,
            title,
            summary: dto.summary ?? src.summary,
            grades: dto.grades === undefined ? src.grades : normalizeGrades(dto.grades),
            categoryId: dto.categoryId === undefined ? src.categoryId : dto.categoryId,
            status: 'Draft',
            config: src.config as Prisma.InputJsonValue,
          },
        });
        const prefix = `${a.code}-Q`;
        for (let i = 0; i < srcQuestions.length; i++) {
          const q = srcQuestions[i];
          await tx.question.create({
            data: {
              code: `${prefix}${i + 1}`,
              assessmentId: a.id,
              grade: q.grade,
              category: q.category,
              qtype: q.qtype,
              mode: q.mode,
              label: q.label,
              prompt: q.prompt,
              options: q.options as Prisma.InputJsonValue,
              optionPoints: q.optionPoints as Prisma.InputJsonValue,
              correct: [],
            },
          });
        }
        return a;
      });
      return this.get(created.code);
    }

    // A blank assessment starts with one example capacity so the editor has a
    // shape to follow; it cannot be published until it is filled in properly.
    const config: AssessmentConfig = {
      dimensions: [
        {
          key: 'CAPACITY1',
          label: 'First capacity',
          intro: 'One line that tells the student what this capacity means.',
          practice: 'A small habit to practise for a week.',
          bands: [{ label: 'Developing', min: 0, max: 100, summary: 'What this band means for the student.' }],
        },
      ],
      consent: '',
      disclaimer: 'This is a reflection, not an exam. It does not label you or predict your future.',
      howScored: '',
    };
    const a = await this.prisma.assessment.create({
      data: {
        code,
        slug,
        title,
        summary: dto.summary ?? null,
        grades: normalizeGrades(dto.grades),
        categoryId: dto.categoryId ?? null,
        status: 'Draft',
        config: config as unknown as Prisma.InputJsonValue,
      },
    });
    return this.get(a.code);
  }

  async update(code: string, dto: PatchAssessmentDto) {
    const a = await this.byCode(code);
    await this.assertCategory(dto.categoryId);
    const config = asConfig(a.config);
    const data: Prisma.AssessmentUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.summary !== undefined) data.summary = dto.summary.trim() || null;
    if (dto.grades !== undefined) data.grades = normalizeGrades(dto.grades);
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId === null ? { disconnect: true } : { connect: { id: dto.categoryId } };
    }
    if (dto.consent !== undefined) config.consent = dto.consent;
    if (dto.disclaimer !== undefined) config.disclaimer = dto.disclaimer;
    if (dto.howScored !== undefined) config.howScored = dto.howScored;
    if (dto.dimensions !== undefined) {
      await this.assertUnlocked(a.id);
      const problems = validateDimensions(dto.dimensions);
      if (problems.length) throw new BadRequestException(problems.join(' '));
      config.dimensions = dto.dimensions as AssessmentDimension[];
      // A live assessment must stay publishable after the change.
      if (a.status === 'Published') {
        const issues = publishIssues(config, await this.questionsOf(a.id));
        if (issues.length) throw new BadRequestException(`This change would break the live assessment: ${issues.join(' ')}`);
      }
    }
    data.config = config as unknown as Prisma.InputJsonValue;
    await this.prisma.assessment.update({ where: { id: a.id }, data });
    return this.get(code);
  }

  async publish(code: string) {
    const a = await this.byCode(code);
    if (a.status === 'Published') throw new BadRequestException('This assessment is already published.');
    if (a.status === 'Archived') throw new BadRequestException('Restore this assessment from the archive first.');
    const issues = publishIssues(asConfig(a.config), await this.questionsOf(a.id));
    if (issues.length) throw new BadRequestException(`Not ready to publish: ${issues.join(' ')}`);
    await this.prisma.assessment.update({
      where: { id: a.id },
      data: { status: 'Published', publishedAt: a.publishedAt ?? new Date(), archivedAt: null },
    });
    return this.get(code);
  }

  async archive(code: string) {
    const a = await this.byCode(code);
    if (a.status === 'Archived') throw new BadRequestException('This assessment is already archived.');
    await this.prisma.assessment.update({ where: { id: a.id }, data: { status: 'Archived', archivedAt: new Date() } });
    return this.get(code);
  }

  /** Back to Draft rather than straight to live, so it is re-checked and
   * re-published deliberately. */
  async unarchive(code: string) {
    const a = await this.byCode(code);
    if (a.status !== 'Archived') throw new BadRequestException('This assessment is not archived.');
    await this.prisma.assessment.update({ where: { id: a.id }, data: { status: 'Draft', archivedAt: null } });
    return this.get(code);
  }

  async remove(code: string) {
    const a = await this.byCode(code);
    if (a.status === 'Published') throw new BadRequestException('Archive this assessment before deleting it.');
    if ((await this.submissionCount(a.id)) > 0) {
      throw new BadRequestException('This assessment has completed results, so it cannot be deleted. Archive it instead.');
    }
    // Its questions belong to it alone — delete them with it rather than
    // leaving orphans in the Question Bank.
    await this.prisma.$transaction([
      this.prisma.question.deleteMany({ where: { assessmentId: a.id } }),
      this.prisma.assessment.delete({ where: { id: a.id } }),
    ]);
    return { ok: true };
  }

  // --------------------------------------------------------------- questions

  private shapeQuestion(q: QuestionRow) {
    const options = (Array.isArray(q.options) ? q.options : []).map(String);
    return { id: q.id, code: q.code, capacity: q.category, prompt: q.prompt, options, points: pointsArray(q) };
  }

  async listQuestions(code: string) {
    const a = await this.byCode(code);
    return (await this.questionsOf(a.id)).map((q) => this.shapeQuestion(q));
  }

  async createQuestion(code: string, dto: AssessmentQuestionDto) {
    const a = await this.byCode(code);
    await this.assertUnlocked(a.id);
    this.assertCapacity(asConfig(a.config), dto.capacity);
    const { opts, points } = this.cleanOptions(dto.options, dto.points);
    const [qcode] = await this.newQuestionCodes(a, 1);
    const row = await this.prisma.question.create({
      data: {
        code: qcode,
        assessmentId: a.id,
        grade: 'All',
        category: dto.capacity,
        prompt: dto.prompt.trim(),
        options: opts as Prisma.InputJsonValue,
        optionPoints: points as Prisma.InputJsonValue,
        correct: [],
      },
    });
    return this.shapeQuestion(row);
  }

  private async ownQuestion(a: { id: number }, qcode: string) {
    const q = await this.prisma.question.findUnique({ where: { code: qcode } });
    if (!q || q.assessmentId !== a.id) throw new NotFoundException('Question not found in this assessment');
    return q;
  }

  async updateQuestion(code: string, qcode: string, dto: PatchAssessmentQuestionDto) {
    const a = await this.byCode(code);
    await this.assertUnlocked(a.id);
    const q = await this.ownQuestion(a, qcode);
    const data: Prisma.QuestionUpdateInput = {};
    if (dto.capacity !== undefined) {
      this.assertCapacity(asConfig(a.config), dto.capacity);
      data.category = dto.capacity;
    }
    if (dto.prompt !== undefined) data.prompt = dto.prompt.trim();
    if (dto.options !== undefined || dto.points !== undefined) {
      const { opts, points } = this.cleanOptions(
        dto.options ?? (q.options as unknown[]).map(String),
        dto.points ?? pointsArray(q),
      );
      data.options = opts as Prisma.InputJsonValue;
      data.optionPoints = points as Prisma.InputJsonValue;
    }
    const row = await this.prisma.question.update({ where: { id: q.id }, data });
    return this.shapeQuestion(row);
  }

  async deleteQuestion(code: string, qcode: string) {
    const a = await this.byCode(code);
    await this.assertUnlocked(a.id);
    const q = await this.ownQuestion(a, qcode);
    await this.prisma.question.delete({ where: { id: q.id } });
    return { ok: true };
  }

  sampleQuestionsCsv(): string {
    const header = ['capacity', 'scenario', 'option_1', 'option_2', 'option_3', 'option_4', 'points_1', 'points_2', 'points_3', 'points_4'];
    const row = [
      'THINK',
      'You are given a task with no clear instructions. What do you do first?',
      'Wait until someone explains it',
      'Start without thinking it through',
      'Break it into smaller parts and begin with the clearest one',
      'Ask what the end result should look like, then plan the steps',
      '1',
      '2',
      '3',
      '4',
    ];
    return toCsv([header, row]);
  }

  /** CSV: capacity, scenario, option_1..option_6, points_1..points_6.
   * dryRun checks the file and reports problems without saving anything. */
  async bulkUploadQuestions(code: string, buffer: Buffer, dryRun: boolean): Promise<BulkResult> {
    const a = await this.byCode(code);
    await this.assertUnlocked(a.id);
    const config = asConfig(a.config);
    const rows = parseCsv(buffer.toString('utf8')).filter((r) => r.some((c) => c.trim() !== ''));
    if (!rows.length) throw new BadRequestException('The CSV file is empty.');
    const norm = (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, '');
    const header = rows[0].map(norm);
    const col = (name: string) => header.indexOf(name);
    const promptCol = col('scenario') >= 0 ? col('scenario') : col('prompt');
    if (col('capacity') < 0) throw new BadRequestException('The CSV is missing the "capacity" column.');
    if (promptCol < 0) throw new BadRequestException('The CSV is missing the "scenario" column.');

    const errors: BulkRowError[] = [];
    const valid: { capacity: string; prompt: string; options: string[]; points: number[] }[] = [];
    const dataRows = rows.slice(1);
    dataRows.forEach((r, i) => {
      const rowNum = i + 2;
      const fail = (message: string) => {
        errors.push({ row: rowNum, message });
      };
      const cell = (idx: number) => (idx >= 0 ? (r[idx] ?? '').trim() : '');
      const capacity = cell(col('capacity')).toUpperCase();
      const prompt = cell(promptCol);
      if (!capacity) return fail('capacity is required');
      if (!config.dimensions.some((d) => d.key === capacity)) {
        return fail(`capacity "${capacity}" is not one of: ${config.dimensions.map((d) => d.key).join(', ')}`);
      }
      if (!prompt) return fail('scenario is required');
      const options: string[] = [];
      const points: number[] = [];
      for (let n = 1; n <= 6; n++) {
        const text = cell(col(`option${n}`));
        const pts = cell(col(`points${n}`));
        if (!text && !pts) continue;
        if (!text) return fail(`option_${n} is empty but points_${n} is filled`);
        if (pts === '') return fail(`points_${n} is required for option_${n}`);
        const p = Number(pts);
        if (!Number.isInteger(p) || p < 0 || p > MAX_POINTS) return fail(`points_${n} must be a whole number from 0 to ${MAX_POINTS}`);
        options.push(text);
        points.push(p);
      }
      if (options.length < 2) return fail('at least 2 options are required');
      valid.push({ capacity, prompt, options, points });
    });

    if (!dryRun && valid.length) {
      const codes = await this.newQuestionCodes(a, valid.length);
      await this.prisma.$transaction(
        valid.map((v, i) =>
          this.prisma.question.create({
            data: {
              code: codes[i],
              assessmentId: a.id,
              grade: 'All',
              category: v.capacity,
              prompt: v.prompt,
              options: v.options as Prisma.InputJsonValue,
              optionPoints: v.points as Prisma.InputJsonValue,
              correct: [],
            },
          }),
        ),
      );
    }
    return { dryRun, total: dataRows.length, created: valid.length, failed: errors.length, errors };
  }

  /** Score a set of picks exactly as a student's would be, without saving —
   * lets an admin check the scoring and bands before publishing. */
  async previewScore(code: string, dto: PreviewScoreDto) {
    const a = await this.byCode(code);
    const config = asConfig(a.config);
    const questions = await this.questionsOf(a.id);
    try {
      const r = scoreAssessment(config, questions as unknown as ScorableQuestion[], dto.answers);
      return {
        dimensions: config.dimensions.map((d) => {
          const s = r.scores[d.key];
          return { key: d.key, label: d.label, score: s.score, max: s.max, band: s.band, summary: bandFor(d, s.score)?.summary ?? '' };
        }),
        strongest: r.strongest,
        practiceFor: r.practiceFor,
      };
    } catch (e) {
      if (e instanceof AssessmentAnswerError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  // ------------------------------------------------------------- submissions

  private async submissionWhere(a: { id: number }, q: ListQueryDto): Promise<Prisma.AssessmentSubmissionWhereInput> {
    const where: Prisma.AssessmentSubmissionWhereInput = { assessmentId: a.id };
    if (q.grade) where.grade = q.grade;
    if (q.school) {
      const s = await this.prisma.school.findUnique({ where: { code: q.school }, select: { id: true } });
      where.schoolId = s?.id ?? -1;
    }
    const range: Prisma.DateTimeFilter = {};
    if (q.dateFrom) range.gte = new Date(`${q.dateFrom}T00:00:00+05:30`);
    if (q.dateTo) range.lte = new Date(`${q.dateTo}T23:59:59.999+05:30`);
    if (range.gte || range.lte) where.submittedAt = range;
    if (q.search) {
      where.student = {
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { code: { contains: q.search, mode: 'insensitive' } },
        ],
      };
    }
    return where;
  }

  private async schoolNames(ids: (number | null)[]) {
    const real = [...new Set(ids.filter((i): i is number => i != null))];
    const schools = real.length
      ? await this.prisma.school.findMany({ where: { id: { in: real } }, select: { id: true, code: true, name: true } })
      : [];
    return new Map(schools.map((s) => [s.id, s]));
  }

  async listSubmissions(code: string, q: ListQueryDto): Promise<ListResult<Record<string, unknown>>> {
    const a = await this.byCode(code);
    const where = await this.submissionWhere(a, q);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.assessmentSubmission.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { student: { select: { code: true, name: true } } },
      }),
      this.prisma.assessmentSubmission.count({ where }),
    ]);
    const schools = await this.schoolNames(rows.map((r) => r.schoolId));
    return paginate(
      rows.map((r) => ({
        id: r.id,
        studentCode: r.student.code,
        studentName: r.student.name,
        grade: r.grade,
        schoolCode: r.schoolId ? (schools.get(r.schoolId)?.code ?? null) : null,
        school: r.schoolId ? (schools.get(r.schoolId)?.name ?? null) : null,
        submittedAt: r.submittedAt,
        scores: r.scores as unknown as Scores,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async submissionDetail(code: string, id: number) {
    const a = await this.byCode(code);
    const row = await this.prisma.assessmentSubmission.findFirst({
      where: { id, assessmentId: a.id },
      include: { student: { select: { code: true, name: true } } },
    });
    if (!row) throw new NotFoundException('Result not found');
    const answers = (row.answers as unknown as { questionId: number; optionIndex: number; points: number }[]) ?? [];
    const questions = await this.prisma.question.findMany({ where: { id: { in: answers.map((x) => x.questionId) } } });
    const byId = new Map(questions.map((q) => [q.id, q]));
    const schools = await this.schoolNames([row.schoolId]);
    return {
      id: row.id,
      studentCode: row.student.code,
      studentName: row.student.name,
      grade: row.grade,
      school: row.schoolId ? (schools.get(row.schoolId)?.name ?? null) : null,
      submittedAt: row.submittedAt,
      scores: row.scores as unknown as Scores,
      answers: answers.map((x) => {
        const q = byId.get(x.questionId);
        const options = q ? (q.options as unknown[]).map(String) : [];
        return {
          code: q?.code ?? '',
          capacity: q?.category ?? '',
          prompt: q?.prompt ?? '(question removed)',
          chosen: options[x.optionIndex] ?? '',
          points: x.points,
        };
      }),
    };
  }

  /** Removes one result so that student can take the assessment again (it is
   * once per student otherwise). */
  async deleteSubmission(code: string, id: number) {
    const a = await this.byCode(code);
    const row = await this.prisma.assessmentSubmission.findFirst({ where: { id, assessmentId: a.id }, select: { id: true, studentId: true } });
    if (!row) throw new NotFoundException('Result not found');
    await this.prisma.assessmentSubmission.delete({ where: { id: row.id } });
    this.logger.warn(`Assessment ${code}: result ${id} (student ${row.studentId}) deleted by an admin`);
    return { ok: true };
  }

  async exportSubmissions(code: string, q: ListQueryDto): Promise<Buffer> {
    const a = await this.byCode(code);
    const config = asConfig(a.config);
    const rows = await this.prisma.assessmentSubmission.findMany({
      where: await this.submissionWhere(a, q),
      orderBy: { submittedAt: 'asc' },
      include: { student: { select: { code: true, name: true } } },
    });
    const schools = await this.schoolNames(rows.map((r) => r.schoolId));
    const headers = ['Student code', 'Student name', 'Grade', 'School code', 'School', 'Completed on (IST)'];
    for (const d of config.dimensions) headers.push(`${d.label} score`, `${d.label} out of`, `${d.label} band`);
    const data = rows.map((r) => {
      const s = r.schoolId ? schools.get(r.schoolId) : undefined;
      const scores = r.scores as unknown as Scores;
      const line: unknown[] = [
        r.student.code,
        r.student.name,
        r.grade ?? '',
        s?.code ?? '',
        s?.name ?? '',
        r.submittedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
      ];
      for (const d of config.dimensions) {
        const x = scores[d.key];
        line.push(x?.score ?? '', x?.max ?? '', x?.band ?? '');
      }
      return line;
    });
    return toXlsxBuffer('Results', headers, data);
  }

  // --------------------------------------------------------------- analytics

  async analytics(code: string, q: ListQueryDto) {
    const a = await this.byCode(code);
    const config = asConfig(a.config);
    const rows = await this.prisma.assessmentSubmission.findMany({
      where: await this.submissionWhere(a, q),
      select: { grade: true, schoolId: true, scores: true, submittedAt: true },
    });

    const perCapacity = config.dimensions.map((d) => {
      const bands = [...d.bands].sort((x, y) => x.min - y.min).map((b) => ({ label: b.label, count: 0 }));
      let sum = 0;
      let maxSum = 0;
      let n = 0;
      for (const r of rows) {
        const s = (r.scores as unknown as Scores)[d.key];
        if (!s) continue;
        n++;
        sum += s.score;
        maxSum += s.max;
        const slot = bands.find((b) => b.label === s.band);
        if (slot) slot.count++;
      }
      return {
        key: d.key,
        label: d.label,
        averageScore: n ? Math.round((sum / n) * 10) / 10 : 0,
        averageMax: n ? Math.round((maxSum / n) * 10) / 10 : 0,
        averagePercent: maxSum ? Math.round((sum / maxSum) * 100) : 0,
        bands,
      };
    });

    const pct = (subset: typeof rows) => {
      const out: Record<string, number> = {};
      for (const d of config.dimensions) {
        let sum = 0;
        let max = 0;
        for (const r of subset) {
          const s = (r.scores as unknown as Scores)[d.key];
          if (s) {
            sum += s.score;
            max += s.max;
          }
        }
        out[d.key] = max ? Math.round((sum / max) * 100) : 0;
      }
      return out;
    };

    const gradeMap = new Map<string, typeof rows>();
    const schoolMap = new Map<number, typeof rows>();
    const dayMap = new Map<string, number>();
    for (const r of rows) {
      const g = r.grade ?? '—';
      gradeMap.set(g, [...(gradeMap.get(g) ?? []), r]);
      if (r.schoolId != null) schoolMap.set(r.schoolId, [...(schoolMap.get(r.schoolId) ?? []), r]);
      const day = r.submittedAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }
    const topSchoolIds = [...schoolMap.entries()].sort((x, y) => y[1].length - x[1].length).slice(0, 10);
    const schools = await this.schoolNames(topSchoolIds.map(([id]) => id));

    // Completion rate against the students who could have taken it.
    const grades = await this.prisma.student.groupBy({ by: ['grade'], where: { archived: false }, _count: { _all: true } });
    const eligible = grades
      .filter((g) => !a.grades || gradeMatches(a.grades, g.grade))
      .reduce((s, g) => s + g._count._all, 0);
    const allCompletions = await this.submissionCount(a.id);

    return {
      total: rows.length,
      eligibleStudents: eligible,
      completionRate: eligible ? Math.round((allCompletions / eligible) * 1000) / 10 : 0,
      perCapacity,
      byGrade: [...gradeMap.entries()]
        .sort((x, y) => x[0].localeCompare(y[0], undefined, { numeric: true }))
        .map(([grade, subset]) => ({ grade, count: subset.length, percent: pct(subset) })),
      bySchool: topSchoolIds.map(([id, subset]) => ({
        code: schools.get(id)?.code ?? '',
        school: schools.get(id)?.name ?? '',
        count: subset.length,
        percent: pct(subset),
      })),
      byDay: [...dayMap.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([date, count]) => ({ date, count })),
    };
  }
}
