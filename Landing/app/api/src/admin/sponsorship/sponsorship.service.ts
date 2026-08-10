import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { nextCode } from '../../common/util';
import {
  CreatePlanDto,
  CreateSponsorDto,
  PatchPlanDto,
  PatchSponsorDto,
} from './sponsorship.dto';

type ListQuery = {
  page: number;
  limit: number;
  search?: string;
  tier?: string;
};

@Injectable()
export class SponsorshipService {
  constructor(private readonly prisma: PrismaService) {}

  async listSponsors(
    q: ListQuery,
  ): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.SponsorWhereInput = {};
    if (q.tier) where.tier = q.tier;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { contact: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sponsor.findMany({
        where,
        include: {
          events: {
            include: { competition: { select: { code: true, title: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.sponsor.count({ where }),
    ]);
    return paginate(
      rows.map((s) => ({
        code: s.code,
        name: s.name,
        contact: s.contact,
        email: s.email,
        phone: s.phone,
        tier: s.tier,
        status: s.status,
        amount: s.amount?.toString() ?? null,
        since: s.since,
        events: s.events.map((e) => e.competition.title),
        competitionCodes: s.events.map((e) => e.competition.code),
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async getSponsor(code: string) {
    const s = await this.prisma.sponsor.findUnique({
      where: { code },
      include: { events: { include: { competition: true } } },
    });
    if (!s) throw new NotFoundException('Sponsor not found');
    return {
      ...s,
      amount: s.amount?.toString() ?? null,
      competitionCodes: s.events.map((e) => e.competition.code),
    };
  }

  private async setEvents(sponsorId: number, codes?: string[]) {
    if (!codes) return;
    await this.prisma.sponsorEvent.deleteMany({ where: { sponsorId } });
    if (!codes.length) return;
    const competitions = await this.prisma.competition.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    const rows = competitions.map((c) => ({ sponsorId, competitionId: c.id }));
    if (rows.length) await this.prisma.sponsorEvent.createMany({ data: rows });
  }

  async createSponsor(dto: CreateSponsorDto) {
    const codes = (
      await this.prisma.sponsor.findMany({ select: { code: true } })
    ).map((x) => x.code);
    const sponsor = await this.prisma.sponsor.create({
      data: {
        code: nextCode(codes, 'SP'),
        name: dto.name,
        contact: dto.contact ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        tier: dto.tier ?? 'Gold',
        status: dto.status ?? 'Active',
        amount:
          dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : null,
        since: dto.since ?? null,
      },
    });
    await this.setEvents(sponsor.id, dto.competitionCodes);
    return this.getSponsor(sponsor.code);
  }

  async updateSponsor(code: string, dto: PatchSponsorDto) {
    const existing = await this.prisma.sponsor.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Sponsor not found');
    await this.prisma.sponsor.update({
      where: { code },
      data: {
        name: dto.name,
        contact: dto.contact,
        email: dto.email,
        phone: dto.phone,
        tier: dto.tier,
        status: dto.status,
        amount:
          dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        since: dto.since,
      },
    });
    await this.setEvents(existing.id, dto.competitionCodes);
    return this.getSponsor(code);
  }

  async deleteSponsor(code: string) {
    const existing = await this.prisma.sponsor.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Sponsor not found');
    await this.prisma.sponsor.delete({ where: { code } });
    return { ok: true };
  }

  async listPlans(q: ListQuery): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.PlanWhereInput = {};
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.plan.count({ where }),
    ]);
    return paginate(
      rows.map((p) => ({
        code: p.code,
        name: p.name,
        minAmount: p.minAmount.toString(),
        benefits: p.benefits,
        extras: p.extras,
        active: p.active,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async createPlan(dto: CreatePlanDto) {
    const codes = (
      await this.prisma.plan.findMany({ select: { code: true } })
    ).map((x) => x.code);
    return this.prisma.plan.create({
      data: {
        code: nextCode(codes, 'PL'),
        name: dto.name,
        minAmount: new Prisma.Decimal(dto.minAmount),
        benefits: dto.benefits ?? null,
        extras: (dto.extras ?? []) as Prisma.InputJsonValue,
        active: dto.active ?? true,
      },
    });
  }

  async updatePlan(code: string, dto: PatchPlanDto) {
    const existing = await this.prisma.plan.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Plan not found');
    const data: Prisma.PlanUpdateInput = {
      name: dto.name,
      benefits: dto.benefits,
      active: dto.active,
    };
    if (dto.minAmount !== undefined)
      data.minAmount = new Prisma.Decimal(dto.minAmount);
    if (dto.extras !== undefined)
      data.extras = dto.extras as Prisma.InputJsonValue;
    return this.prisma.plan.update({ where: { code }, data });
  }

  async deletePlan(code: string) {
    const existing = await this.prisma.plan.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Plan not found');
    await this.prisma.plan.delete({ where: { code } });
    return { ok: true };
  }
}
