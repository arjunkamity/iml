import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { nextCode } from '../../common/util';
import { CreateFaqDto, PatchFaqDto } from './faqs.dto';

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  async listFaqs(q: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.FaqWhereInput = {};
    if (q.status) where.active = q.status === 'Active';
    if (q.search) {
      where.OR = [
        { question: { contains: q.search, mode: 'insensitive' } },
        { answer: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.faq.findMany({
        where,
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.faq.count({ where }),
    ]);
    return paginate(rows, total, q.page, q.limit);
  }

  async getFaq(code: string) {
    const faq = await this.prisma.faq.findUnique({ where: { code } });
    if (!faq) throw new NotFoundException('FAQ not found');
    return faq;
  }

  async createFaq(dto: CreateFaqDto) {
    const codes = (
      await this.prisma.faq.findMany({ select: { code: true } })
    ).map((f) => f.code);
    return this.prisma.faq.create({
      data: {
        code: nextCode(codes, 'FAQ'),
        question: dto.question,
        answer: dto.answer,
        position: dto.position ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async updateFaq(code: string, dto: PatchFaqDto) {
    const existing = await this.prisma.faq.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('FAQ not found');
    return this.prisma.faq.update({ where: { code }, data: dto });
  }

  async deleteFaq(code: string) {
    const existing = await this.prisma.faq.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('FAQ not found');
    await this.prisma.faq.delete({ where: { code } });
    return { ok: true };
  }
}
