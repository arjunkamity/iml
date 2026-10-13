import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const rows = await this.prisma.$queryRawUnsafe<Record<string, bigint>[]>(
      'SELECT * FROM dashboard_summary',
    );
    const row = rows[0] ?? {};
    const [schools, paidAmount] = await Promise.all([
      this.prisma.school.count(),
      this.prisma.payment.aggregate({ where: { status: 'Paid' }, _sum: { amount: true } }),
    ]);
    return {
      registrations: Number(row.registrations ?? 0),
      competitions: Number(row.competitions ?? 0),
      questions: Number(row.questions ?? 0),
      upcomingExams: Number(row.upcoming_exams ?? 0),
      students: Number(row.students ?? 0),
      paidPayments: Number(row.paid_payments ?? 0),
      schools,
      paidAmount: Number(paidAmount._sum.amount ?? 0),
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

  /**
   * Everything the dashboard's charts need, in one call. Small aggregate
   * queries only — grouped counts and a couple of raw SQL joins/date
   * truncations Prisma's own query builder can't express portably — never
   * pulls full row sets to aggregate in app code, so this stays cheap
   * regardless of how many students/registrations/answers exist.
   */
  async analytics() {
    const [
      registrationTrend,
      topSchools,
      genderRows,
      paymentRows,
      classRows,
      cityRows,
      categoryRows,
    ] = await Promise.all([
      this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE(registered_at) AS date, COUNT(*) AS count
        FROM registrations
        WHERE registered_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(registered_at)
        ORDER BY date ASC
      `,
      this.prisma.$queryRaw<{ id: number; name: string; count: bigint }[]>`
        SELECT s.id AS id, s.name AS name, COUNT(DISTINCT st.id) AS count
        FROM schools s
        JOIN students st ON st.school_id = s.id
        WHERE EXISTS (SELECT 1 FROM registrations r WHERE r.student_id = st.id)
        GROUP BY s.id, s.name
        ORDER BY count DESC
        LIMIT 10
      `,
      this.prisma.student.groupBy({ by: ['gender'], _count: { _all: true } }),
      this.prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.student.groupBy({ by: ['grade'], _count: { _all: true } }),
      this.prisma.$queryRaw<{ city: string | null; count: bigint }[]>`
        SELECT s.city AS city, COUNT(*) AS count
        FROM students st
        JOIN schools s ON s.id = st.school_id
        GROUP BY s.city
        ORDER BY count DESC
        LIMIT 8
      `,
      // % correct per question category, across every answer ever recorded
      // (not just finished attempts — an in-progress attempt's answers are
      // still real signal on how a category is trending).
      this.prisma.$queryRaw<{ category: string; total: bigint; correct: bigint }[]>`
        SELECT q.category AS category,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE a.is_correct) AS correct
        FROM attempt_answers a
        JOIN questions q ON q.id = a.question_id
        GROUP BY q.category
        ORDER BY q.category ASC
      `,
    ]);

    // Top 5 schools' own daily registration count over the same 30-day
    // window as registrationTrend above — a second query rather than
    // folded into the first, since it needs the top-5 ids that query
    // just resolved. Explicit day-by-day axis (not just whatever dates
    // happen to have rows) so every school's series lines up on the same
    // x position even on a day it personally had zero registrations.
    const top5 = topSchools.slice(0, 5);
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const schoolDayRows = top5.length
      ? await this.prisma.$queryRaw<{ school_id: number; date: Date; count: bigint }[]>`
          SELECT st.school_id AS school_id, DATE(r.registered_at) AS date, COUNT(*) AS count
          FROM registrations r
          JOIN students st ON st.id = r.student_id
          WHERE st.school_id IN (${Prisma.join(top5.map((s) => Number(s.id)))})
            AND r.registered_at >= NOW() - INTERVAL '30 days'
          GROUP BY st.school_id, DATE(r.registered_at)
        `
      : [];
    const countFor = (schoolId: number, date: string) => {
      const row = schoolDayRows.find(
        (r) => Number(r.school_id) === schoolId && r.date.toISOString().slice(0, 10) === date,
      );
      return row ? Number(row.count) : 0;
    };
    const topSchoolsTrend = {
      days,
      series: top5.map((s) => ({
        label: s.name,
        counts: days.map((d) => countFor(Number(s.id), d)),
      })),
    };

    return {
      registrationTrend: registrationTrend.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        count: Number(r.count),
      })),
      topSchools: topSchools.map((s) => ({ label: s.name, count: Number(s.count) })),
      topSchoolsTrend,
      genderRatio: genderRows.map((g) => ({
        label: g.gender ?? 'Not specified',
        count: g._count._all,
      })),
      paymentStatus: paymentRows.map((p) => ({ label: p.status, count: p._count._all })),
      classRatio: classRows
        .map((c) => ({ label: c.grade, count: c._count._all }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
      cityRatio: cityRows.map((c) => ({ label: c.city ?? 'Not specified', count: Number(c.count) })),
      categoryPerformance: categoryRows.map((c) => ({
        category: c.category,
        total: Number(c.total),
        correct: Number(c.correct),
        percent: Number(c.total) > 0 ? Math.round((Number(c.correct) / Number(c.total)) * 100) : 0,
      })),
    };
  }
}
