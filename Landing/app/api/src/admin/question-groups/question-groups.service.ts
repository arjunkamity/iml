import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListQueryDto } from '../../common/list-query.dto';
import { ListResult, paginate } from '../../common/list-result';
import { nextCode } from '../../common/util';
import { CreateQuestionGroupDto, PatchQuestionGroupDto } from './question-groups.dto';

/** A group needs at least this many sub-questions to be served (a "group" of one is just a question). */
export const MIN_GROUP_QUESTIONS = 2;

const LIVE_LOCK_MESSAGE =
  'A live exam is running for this competition, so the questions in this group can’t be added, removed or reordered right now. You can still edit its title, description and media.';

// Creating, activating, deactivating or deleting a group that has questions changes
// which questions students who start NEXT are served (grouped questions leave the
// single pool, inactive ones are withheld). While a live exam is running that would
// give different students different pools, so it waits until the exam ends.
const POOL_LOCK_MESSAGE =
  'A live exam is running for this competition. Creating, activating, deactivating or deleting a group that has questions would change what students who start now are served, so it is blocked until the exam ends. You can still edit the group’s title, description and media.';

const cleanText = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);

@Injectable()
export class QuestionGroupsService {
  private readonly logger = new Logger(QuestionGroupsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ helpers

  private async byCode(code: string) {
    const g = await this.prisma.questionGroup.findUnique({ where: { code } });
    if (!g) throw new NotFoundException('Question group not found');
    return g;
  }

  private async competitionByCode(code: string) {
    const c = await this.prisma.competition.findUnique({ where: { code }, select: { id: true, code: true, title: true } });
    if (!c) throw new BadRequestException(`Competition "${code}" was not found.`);
    return c;
  }

  private async hasLiveExam(competitionId: number | null): Promise<boolean> {
    if (competitionId == null) return false;
    return (await this.prisma.exam.count({ where: { competitionId, status: 'Live' } })) > 0;
  }

  private async assertPoolStable(competitionId: number | null) {
    if (await this.hasLiveExam(competitionId)) throw new BadRequestException(POOL_LOCK_MESSAGE);
  }

  private memberRows(groupId: number) {
    return this.prisma.question.findMany({
      where: { groupId },
      orderBy: [{ groupPosition: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, prompt: true, category: true, groupPosition: true },
    });
  }

  /**
   * Checks that every code can be a sub-question of this group and returns the
   * rows in the order given. A question can be in only one group, must be an
   * ordinary exam question of the group's competition, and must share the
   * group's category (so the question mix stays exact).
   */
  private async resolveMembers(group: { id: number | null; competitionId: number; category: string }, codes: string[]) {
    const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
    if (unique.length !== codes.filter((c) => c.trim()).length) {
      throw new BadRequestException('The same question is listed twice.');
    }
    if (!unique.length) return [];
    const rows = await this.prisma.question.findMany({ where: { code: { in: unique } } });
    const byCode = new Map(rows.map((r) => [r.code, r]));
    for (const code of unique) {
      const q = byCode.get(code);
      if (!q) throw new BadRequestException(`Question ${code} was not found.`);
      if (q.assessmentId != null) throw new BadRequestException(`${code} belongs to an assessment and can’t be grouped.`);
      if (q.isDemo) throw new BadRequestException(`${code} is a demo question and can’t be grouped.`);
      if (q.competitionId !== group.competitionId) {
        throw new BadRequestException(`${code} is not in this group’s competition.`);
      }
      if (q.category !== group.category) {
        throw new BadRequestException(`${code} is in category ${q.category}, but this group is ${group.category}. All questions in a group must share its category.`);
      }
      if (q.groupId != null && q.groupId !== group.id) {
        const other = await this.prisma.questionGroup.findUnique({ where: { id: q.groupId }, select: { code: true } });
        throw new BadRequestException(`${code} is already in group ${other?.code ?? 'another group'}. A question can be in only one group.`);
      }
    }
    return unique.map((c) => byCode.get(c)!);
  }

  private shape(
    g: {
      code: string;
      title: string;
      description: string | null;
      imageUrl: string | null;
      videoUrl: string | null;
      category: string;
      active: boolean;
      competitionId: number | null;
      createdAt: Date;
      updatedAt: Date;
    },
    competition: { code: string; title: string } | null,
    questions: { code: string; prompt: string; category: string; groupPosition: number | null }[],
  ) {
    return {
      code: g.code,
      title: g.title,
      description: g.description,
      imageUrl: g.imageUrl,
      videoUrl: g.videoUrl,
      category: g.category,
      active: g.active,
      competitionCode: competition?.code ?? null,
      competition: competition?.title ?? null,
      questionCount: questions.length,
      questions: questions.map((q, i) => ({ code: q.code, prompt: q.prompt, category: q.category, position: q.groupPosition ?? i + 1 })),
      ready: questions.length >= MIN_GROUP_QUESTIONS,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }

  // -------------------------------------------------------------------- reads

  async list(q: ListQueryDto): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.QuestionGroupWhereInput = {};
    if (q.comp) where.competition = { code: q.comp };
    if (q.category) where.category = q.category;
    if (q.status === 'Active') where.active = true;
    else if (q.status === 'Inactive') where.active = false;
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { title: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.questionGroup.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { competition: { select: { code: true, title: true } }, _count: { select: { questions: true } } },
      }),
      this.prisma.questionGroup.count({ where }),
    ]);
    return paginate(
      rows.map((g) => ({
        code: g.code,
        title: g.title,
        category: g.category,
        active: g.active,
        competitionCode: g.competition?.code ?? null,
        competition: g.competition?.title ?? null,
        imageUrl: g.imageUrl,
        videoUrl: g.videoUrl,
        questionCount: g._count.questions,
        ready: g._count.questions >= MIN_GROUP_QUESTIONS,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async get(code: string) {
    const g = await this.byCode(code);
    const [competition, questions, live] = await Promise.all([
      g.competitionId ? this.prisma.competition.findUnique({ where: { id: g.competitionId }, select: { code: true, title: true } }) : null,
      this.memberRows(g.id),
      this.hasLiveExam(g.competitionId),
    ]);
    return { ...this.shape(g, competition, questions), membershipLocked: live };
  }

  /** Questions that can still be added to a group: ordinary, ungrouped, same
   * competition and category. Feeds the picker in the admin screen. */
  async candidates(q: { comp?: string; category?: string; search?: string; group?: string; limit?: number }) {
    if (!q.comp || !q.category) throw new BadRequestException('Choose a competition and a category first.');
    const groupId = q.group ? ((await this.prisma.questionGroup.findUnique({ where: { code: q.group }, select: { id: true } }))?.id ?? -1) : null;
    const where: Prisma.QuestionWhereInput = {
      competition: { code: q.comp },
      category: q.category,
      isDemo: false,
      assessmentId: null,
      OR: [{ groupId: null }, ...(groupId != null ? [{ groupId }] : [])],
    };
    if (q.search) {
      where.AND = [
        {
          OR: [
            { code: { contains: q.search, mode: 'insensitive' } },
            { prompt: { contains: q.search, mode: 'insensitive' } },
          ],
        },
      ];
    }
    const rows = await this.prisma.question.findMany({ where, orderBy: { code: 'asc' }, take: Math.min(q.limit ?? 50, 200) });
    return rows.map((r) => ({ code: r.code, prompt: r.prompt, category: r.category, qtype: r.qtype, groupCode: r.groupId != null ? 'this group' : null }));
  }

  // ------------------------------------------------------------------- writes

  async create(dto: CreateQuestionGroupDto) {
    const competition = await this.competitionByCode(dto.competitionCode);
    const category = dto.category.trim();
    const codes = (await this.prisma.questionGroup.findMany({ select: { code: true } })).map((c) => c.code);
    const members = await this.resolveMembers({ id: null, competitionId: competition.id, category }, dto.questionCodes ?? []);
    const wantsActive = dto.active ?? members.length >= MIN_GROUP_QUESTIONS;
    if (wantsActive && members.length < MIN_GROUP_QUESTIONS) {
      throw new BadRequestException(`A group needs at least ${MIN_GROUP_QUESTIONS} questions before it can be active.`);
    }
    // An empty draft changes nothing for students; anything with questions does.
    if (members.length > 0 || wantsActive) await this.assertPoolStable(competition.id);

    const group = await this.prisma.$transaction(async (tx) => {
      const g = await tx.questionGroup.create({
        data: {
          code: nextCode(codes, 'QG'),
          competitionId: competition.id,
          category,
          title: dto.title.trim(),
          description: cleanText(dto.description) ?? null,
          imageUrl: cleanText(dto.imageUrl) ?? null,
          videoUrl: cleanText(dto.videoUrl) ?? null,
          active: wantsActive,
        },
      });
      for (let i = 0; i < members.length; i++) {
        await tx.question.update({ where: { id: members[i].id }, data: { groupId: g.id, groupPosition: i + 1 } });
      }
      return g;
    });
    return this.get(group.code);
  }

  async update(code: string, dto: PatchQuestionGroupDto) {
    const g = await this.byCode(code);
    const current = await this.memberRows(g.id);
    const live = await this.hasLiveExam(g.competitionId);

    // Competition/category tie the sub-questions to the group (they must all
    // match), so changing either is only allowed on a group with no questions
    // or when the new member list is supplied in the same request.
    const competition = dto.competitionCode !== undefined ? await this.competitionByCode(dto.competitionCode) : null;
    const newCompetitionId = competition ? competition.id : g.competitionId;
    const newCategory = dto.category !== undefined ? dto.category.trim() : g.category;
    const identityChanged = newCompetitionId !== g.competitionId || newCategory !== g.category;
    if (identityChanged && current.length && dto.questionCodes === undefined) {
      throw new BadRequestException('Remove this group’s questions (or choose new ones) before changing its competition or category.');
    }

    let members: Awaited<ReturnType<typeof this.resolveMembers>> | null = null;
    if (dto.questionCodes !== undefined) {
      members = await this.resolveMembers({ id: g.id, competitionId: newCompetitionId as number, category: newCategory }, dto.questionCodes);
      const same = members.length === current.length && members.every((m, i) => m.code === current[i].code);
      if (!same && (live || (identityChanged && (await this.hasLiveExam(g.competitionId))))) {
        throw new BadRequestException(LIVE_LOCK_MESSAGE);
      }
    }

    const count = members ? members.length : current.length;
    const active = dto.active ?? g.active;
    if (dto.active !== undefined && dto.active !== g.active && current.length > 0) await this.assertPoolStable(g.competitionId);
    if (active && count < MIN_GROUP_QUESTIONS) {
      if (dto.active === true) throw new BadRequestException(`A group needs at least ${MIN_GROUP_QUESTIONS} questions before it can be active.`);
    }

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.QuestionGroupUpdateInput = {};
      if (dto.title !== undefined) data.title = dto.title.trim();
      if (dto.description !== undefined) data.description = cleanText(dto.description);
      if (dto.imageUrl !== undefined) data.imageUrl = cleanText(dto.imageUrl);
      if (dto.videoUrl !== undefined) data.videoUrl = cleanText(dto.videoUrl);
      if (competition) data.competition = { connect: { id: competition.id } };
      if (dto.category !== undefined) data.category = newCategory;
      // Never leave a group active with too few questions.
      data.active = count < MIN_GROUP_QUESTIONS ? false : active;
      await tx.questionGroup.update({ where: { id: g.id }, data });

      if (members) {
        const keep = members.map((m) => m.code);
        await tx.question.updateMany({ where: { groupId: g.id, code: { notIn: keep } }, data: { groupId: null, groupPosition: null } });
        for (let i = 0; i < members.length; i++) {
          await tx.question.update({ where: { id: members[i].id }, data: { groupId: g.id, groupPosition: i + 1 } });
        }
      }
    });
    return this.get(code);
  }

  /** Deleting a group frees its questions: they become ordinary singles again. */
  async remove(code: string) {
    const g = await this.byCode(code);
    // Freeing its questions puts them back in the single pool (or, if it was inactive,
    // back into play), so a group with questions can't be deleted during a live exam.
    if ((await this.prisma.question.count({ where: { groupId: g.id } })) > 0) await this.assertPoolStable(g.competitionId);
    await this.prisma.$transaction([
      this.prisma.question.updateMany({ where: { groupId: g.id }, data: { groupId: null, groupPosition: null } }),
      this.prisma.questionGroup.delete({ where: { id: g.id } }),
    ]);
    return { ok: true };
  }

  /**
   * Called after a question leaves a group (deleted, or removed by an edit):
   * closes the gaps in the order and, if too few questions remain for the
   * group to be a group, makes it inactive so the exam draw skips it rather
   * than serving a lone question under a group header.
   */
  async normalizeAfterMemberLeft(groupId: number) {
    const members = await this.memberRows(groupId);
    await this.prisma.$transaction([
      ...members.map((m, i) => this.prisma.question.update({ where: { id: m.id }, data: { groupPosition: i + 1 } })),
      ...(members.length < MIN_GROUP_QUESTIONS
        ? [this.prisma.questionGroup.update({ where: { id: groupId }, data: { active: false } })]
        : []),
    ]);
    if (members.length < MIN_GROUP_QUESTIONS) this.logger.warn(`Question group ${groupId} deactivated: ${members.length} question(s) left`);
  }
}
