import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const rows = await this.prisma.$queryRawUnsafe<Record<string, bigint>[]>(
      'SELECT * FROM dashboard_summary',
    );
    const row = rows[0] ?? {};
    return {
      registrations: Number(row.registrations ?? 0),
      competitions: Number(row.competitions ?? 0),
      questions: Number(row.questions ?? 0),
      upcomingExams: Number(row.upcoming_exams ?? 0),
      students: Number(row.students ?? 0),
      paidPayments: Number(row.paid_payments ?? 0),
    };
  }

  async recent() {
    const recentRegistrations = await this.prisma.registration.findMany({
      orderBy: { registeredAt: 'desc' },
      take: 6,
      select: {
        code: true,
        status: true,
        student: { select: { name: true, grade: true, email: true } },
        competition: { select: { title: true } },
      },
    });
    const upcomingExams = await this.prisma.exam.findMany({
      where: { status: { in: ['Scheduled', 'Live'] } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 6,
      select: {
        code: true,
        title: true,
        grade: true,
        date: true,
        time: true,
        status: true,
        competition: { select: { title: true } },
      },
    });
    return { recentRegistrations, upcomingExams };
  }
}
