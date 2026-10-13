import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { nextCode } from '../../common/util';
import { toXlsxBuffer } from '../../common/xlsx.util';
import { CreatePaymentDto, PatchPaymentDto } from './finance.dto';

type ListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  comp?: string;
  school?: string;
  grade?: string;
  dateFrom?: string;
  dateTo?: string;
};

const paymentInclude = {
  registration: {
    include: {
      student: { select: { code: true, name: true, grade: true, school: { select: { code: true, name: true } } } },
      competition: { select: { title: true, code: true } },
    },
  },
  stage: { select: { name: true, position: true } },
} satisfies Prisma.PaymentInclude;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private buildPaymentWhere(q: {
    search?: string;
    status?: string;
    comp?: string;
    school?: string;
    grade?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = {};
    if (q.status) where.status = q.status;

    const registrationWhere: Prisma.RegistrationWhereInput = {};
    if (q.comp) registrationWhere.competition = { code: q.comp };
    if (q.school || q.grade) {
      registrationWhere.student = {
        ...(q.school ? { school: { code: q.school } } : {}),
        ...(q.grade ? { grade: q.grade } : {}),
      };
    }
    if (Object.keys(registrationWhere).length > 0) where.registration = registrationWhere;

    // Inclusive date range on createdAt (the payment attempt's own
    // timestamp — paidAt is null for anything that never succeeded, so
    // filtering on that would silently drop every Pending/Failed row from
    // a "payments this week" export).
    if (q.dateFrom || q.dateTo) {
      where.createdAt = {};
      if (q.dateFrom) where.createdAt.gte = new Date(`${q.dateFrom}T00:00:00.000Z`);
      if (q.dateTo) where.createdAt.lte = new Date(`${q.dateTo}T23:59:59.999Z`);
    }
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
    return where;
  }

  private toPaymentRow(p: PaymentRow) {
    return {
      code: p.code,
      student: p.registration.student.name,
      studentCode: p.registration.student.code,
      grade: p.registration.student.grade,
      // The school the paying student belongs to — Payment has no
      // school reference of its own, always resolved via the student.
      school: p.registration.student.school?.name ?? null,
      competition: p.registration.competition.title,
      competitionCode: p.registration.competition.code,
      stage: p.stage?.name ?? null,
      stagePosition: p.stage?.position ?? null,
      amount: p.amount,
      mode: p.mode,
      status: p.status,
      providerTxn: p.providerTxn,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    };
  }

  async listPayments(
    q: ListQuery,
  ): Promise<ListResult<Record<string, unknown>>> {
    const where = this.buildPaymentWhere(q);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(
      rows.map((p) => this.toPaymentRow(p)),
      total,
      q.page,
      q.limit,
    );
  }

  // Same filters as listPayments, minus pagination — see
  // RegistrationService.exportRegistrations for the same shape/rationale.
  async exportPayments(q: {
    search?: string;
    status?: string;
    comp?: string;
    school?: string;
    grade?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Buffer> {
    const where = this.buildPaymentWhere(q);
    const rows = await this.prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    });
    const headers = [
      'Payment Code', 'Student', 'Student Code', 'Grade', 'School', 'Competition',
      'Stage', 'Amount', 'Mode', 'Status', 'Provider Txn', 'Paid At', 'Created At',
    ];
    const body = rows.map((p) => {
      const row = this.toPaymentRow(p);
      return [
        row.code, row.student, row.studentCode, row.grade, row.school ?? '',
        row.competition, row.stage ?? '', Number(row.amount), row.mode, row.status,
        row.providerTxn ?? '', row.paidAt ? row.paidAt.toISOString() : '',
        row.createdAt.toISOString(),
      ];
    });
    return toXlsxBuffer('Payments', headers, body);
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
