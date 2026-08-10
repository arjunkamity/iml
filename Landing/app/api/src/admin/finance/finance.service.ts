import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { nextCode } from '../../common/util';
import { CreatePaymentDto, PatchPaymentDto } from './finance.dto';

type ListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  comp?: string;
};

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listPayments(
    q: ListQuery,
  ): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.PaymentWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.comp) where.registration = { competition: { code: q.comp } };
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { providerTxn: { contains: q.search, mode: 'insensitive' } },
        {
          registration: {
            student: { name: { contains: q.search, mode: 'insensitive' } },
          },
        },
        {
          registration: {
            student: { email: { contains: q.search, mode: 'insensitive' } },
          },
        },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          registration: {
            include: { student: { select: { code: true, name: true } } },
          },
          stage: { select: { name: true, position: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(
      rows.map((p) => ({
        code: p.code,
        student: p.registration.student.name,
        studentCode: p.registration.student.code,
        stage: p.stage?.name ?? null,
        stagePosition: p.stage?.position ?? null,
        amount: p.amount,
        mode: p.mode,
        status: p.status,
        providerTxn: p.providerTxn,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async getPayment(code: string) {
    const p = await this.prisma.payment.findUnique({
      where: { code },
      include: {
        registration: {
          include: {
            student: { include: { school: true } },
            competition: true,
          },
        },
        stage: true,
      },
    });
    if (!p) throw new NotFoundException('Payment not found');
    return p;
  }

  async createPayment(dto: CreatePaymentDto) {
    const registration = await this.prisma.registration.findUnique({
      where: { code: dto.registrationCode },
    });
    if (!registration) throw new NotFoundException('Registration not found');
    if (dto.stageId) {
      const stage = await this.prisma.competitionStage.findUnique({
        where: { id: dto.stageId },
      });
      if (!stage) throw new NotFoundException('Stage not found');
    }
    const codes = (
      await this.prisma.payment.findMany({ select: { code: true } })
    ).map((x) => x.code);
    return this.prisma.payment.create({
      data: {
        code: nextCode(codes, 'PAY-'),
        registrationId: registration.id,
        stageId: dto.stageId ?? null,
        amount: new Prisma.Decimal(dto.amount),
        mode: dto.mode,
        status: dto.status ?? 'Paid',
        providerTxn: dto.providerTxn ?? null,
        paidAt: (dto.status ?? 'Paid') === 'Paid' ? new Date() : null,
      },
    });
  }

  async updatePayment(code: string, dto: PatchPaymentDto) {
    const existing = await this.prisma.payment.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Payment not found');
    return this.prisma.payment.update({
      where: { code },
      data: {
        ...dto,
        paidAt:
          dto.status === 'Paid'
            ? new Date()
            : dto.status !== undefined
              ? null
              : undefined,
      },
    });
  }
}
