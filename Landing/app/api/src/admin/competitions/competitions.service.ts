import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { nextCode, toDate } from '../../common/util';
import {
  CreateCompetitionDto,
  CreatePrizeDto,
  CreateStageDto,
  PatchCompetitionDto,
  PatchPrizeDto,
  PatchStageDto,
} from './competitions.dto';

const stagesInclude = {
  stages: {
    include: { rules: { orderBy: { position: 'asc' } } },
    orderBy: { position: 'asc' },
  },
} as const;

@Injectable()
export class CompetitionService {
  constructor(private readonly prisma: PrismaService) {}

  private stageData(d: {
    position: number;
    name: string;
    mode: string;
    passMark: number;
    isFree?: boolean;
    price?: number;
    description?: string;
  }) {
    return {
      position: d.position,
      name: d.name,
      mode: d.mode,
      passMark: new Prisma.Decimal(d.passMark),
      isFree: d.isFree ?? false,
      price: new Prisma.Decimal(d.price ?? 0),
      description: d.description ?? null,
    };
  }

  // ---- competitions ----

  async list(q: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.CompetitionWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { title: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.competition.findMany({
        where,
        include: { _count: { select: { registrations: true, stages: true } } },
        orderBy: { code: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.competition.count({ where }),
    ]);
    return paginate(
      rows.map((c) => ({
        code: c.code,
        title: c.title,
        grades: c.grades,
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
        isMulti: c.isMulti,
        registrations: c._count.registrations,
        stages: c._count.stages,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async get(code: string) {
    const comp = await this.prisma.competition.findUnique({
      where: { code },
      include: {
        ...stagesInclude,
        prizes: { orderBy: { id: 'asc' } },
        _count: { select: { registrations: true } },
      },
    });
    if (!comp) throw new NotFoundException('Competition not found');
    return comp;
  }

  async create(dto: CreateCompetitionDto) {
    const codes = (
      await this.prisma.competition.findMany({ select: { code: true } })
    ).map((c) => c.code);
    const code = nextCode(codes, 'C');
    const { stages, ...rest } = dto;
    return this.prisma.competition.create({
      data: {
        code,
        ...rest,
        startDate: toDate(rest.startDate)!,
        endDate: toDate(rest.endDate)!,
        status: rest.status ?? 'Draft',
        stages: stages
          ? { create: stages.map((s) => this.stageData(s)) }
          : undefined,
      },
      include: stagesInclude,
    });
  }

  async update(code: string, dto: PatchCompetitionDto) {
    const existing = await this.prisma.competition.findUnique({
      where: { code },
    });
    if (!existing) throw new NotFoundException('Competition not found');
    const data: Prisma.CompetitionUpdateInput = { ...dto };
    if (dto.startDate) data.startDate = toDate(dto.startDate)!;
    if (dto.endDate) data.endDate = toDate(dto.endDate)!;
    return this.prisma.competition.update({
      where: { code },
      data,
      include: stagesInclude,
    });
  }

  async remove(code: string) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    await this.prisma.$transaction([
      this.prisma.registrationStage.deleteMany({
        where: { stage: { competitionId: comp.id } },
      }),
      this.prisma.attemptAnswer.deleteMany({
        where: { attempt: { stage: { competitionId: comp.id } } },
      }),
      this.prisma.attempt.deleteMany({
        where: { stage: { competitionId: comp.id } },
      }),
      this.prisma.payment.deleteMany({
        where: { stage: { competitionId: comp.id } },
      }),
      this.prisma.stageRule.deleteMany({
        where: { stage: { competitionId: comp.id } },
      }),
      this.prisma.competitionStage.deleteMany({
        where: { competitionId: comp.id },
      }),
      this.prisma.question.deleteMany({ where: { competitionId: comp.id } }),
      this.prisma.exam.deleteMany({ where: { competitionId: comp.id } }),
      this.prisma.prize.deleteMany({ where: { competitionId: comp.id } }),
      this.prisma.sponsorEvent.deleteMany({
        where: { competitionId: comp.id },
      }),
      this.prisma.notification.deleteMany({
        where: { competitionId: comp.id },
      }),
      this.prisma.registration.deleteMany({
        where: { competitionId: comp.id },
      }),
      this.prisma.competition.delete({ where: { id: comp.id } }),
    ]);
    return { ok: true };
  }

  async stages(code: string) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    return this.prisma.competitionStage.findMany({
      where: { competitionId: comp.id },
      include: { rules: { orderBy: { position: 'asc' } } },
      orderBy: { position: 'asc' },
    });
  }

  async addStage(code: string, dto: CreateStageDto) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    return this.prisma.competitionStage.create({
      data: { competitionId: comp.id, ...this.stageData(dto) },
    });
  }

  async updateStage(code: string, stageId: number, dto: PatchStageDto) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    const stage = await this.prisma.competitionStage.findFirst({
      where: { id: stageId, competitionId: comp.id },
    });
    if (!stage) throw new NotFoundException('Stage not found');
    const data: Prisma.CompetitionStageUpdateInput = { ...dto };
    if (dto.passMark !== undefined)
      data.passMark = new Prisma.Decimal(dto.passMark);
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    return this.prisma.competitionStage.update({
      where: { id: stageId },
      data,
    });
  }

  async removeStage(code: string, stageId: number) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    const stage = await this.prisma.competitionStage.findFirst({
      where: { id: stageId, competitionId: comp.id },
    });
    if (!stage) throw new NotFoundException('Stage not found');
    await this.prisma.$transaction([
      this.prisma.registrationStage.deleteMany({ where: { stageId } }),
      this.prisma.attemptAnswer.deleteMany({ where: { attempt: { stageId } } }),
      this.prisma.attempt.deleteMany({ where: { stageId } }),
      this.prisma.payment.deleteMany({ where: { stageId } }),
      this.prisma.stageRule.deleteMany({ where: { stageId } }),
      this.prisma.competitionStage.delete({ where: { id: stageId } }),
    ]);
    return { ok: true };
  }

  async qualifiers(code: string, q: { stage?: number; status?: string }) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    const where: Prisma.RegistrationStageWhereInput = {
      stage: { competitionId: comp.id },
    };
    if (q.stage) where.stage = { competitionId: comp.id, position: q.stage };
    if (q.status) where.status = q.status;
    return this.prisma.registrationStage.findMany({
      where,
      include: {
        registration: { include: { student: { include: { school: true } } } },
        stage: true,
      },
      orderBy: [{ stage: { position: 'asc' } }, { score: 'desc' }],
    });
  }

  // ---- prizes ----

  async listPrizes(q: { comp?: string }) {
    const where: Prisma.PrizeWhereInput = {};
    if (q.comp) where.competition = { code: q.comp };
    return this.prisma.prize.findMany({
      where,
      include: { competition: { select: { code: true, title: true } } },
      orderBy: { id: 'asc' },
    });
  }

  async createPrize(dto: CreatePrizeDto) {
    const comp = await this.prisma.competition.findUnique({
      where: { code: dto.competitionCode },
    });
    if (!comp) throw new NotFoundException('Competition not found');
    const codes = (
      await this.prisma.prize.findMany({ select: { code: true } })
    ).map((p) => p.code);
    return this.prisma.prize.create({
      data: {
        code: nextCode(codes, 'PR'),
        competitionId: comp.id,
        rankLabel: dto.rankLabel,
        money: dto.money !== undefined ? new Prisma.Decimal(dto.money) : null,
        award: dto.award ?? null,
        note: dto.note ?? null,
      },
      include: { competition: { select: { code: true, title: true } } },
    });
  }

  async updatePrize(code: string, dto: PatchPrizeDto) {
    const existing = await this.prisma.prize.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Prize not found');
    const data: Prisma.PrizeUpdateInput = { ...dto };
    if (dto.money !== undefined) data.money = new Prisma.Decimal(dto.money);
    return this.prisma.prize.update({
      where: { code },
      data,
      include: { competition: { select: { code: true, title: true } } },
    });
  }

  async removePrize(code: string) {
    const existing = await this.prisma.prize.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Prize not found');
    await this.prisma.prize.delete({ where: { code } });
    return { ok: true };
  }
}
