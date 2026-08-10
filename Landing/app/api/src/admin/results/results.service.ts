import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';

type ListQuery = {
  page: number;
  limit: number;
  search?: string;
  comp?: string;
};

@Injectable()
export class ResultService {
  constructor(private readonly prisma: PrismaService) {}

  async listResults(
    q: ListQuery,
  ): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.AttemptWhereInput = {};
    if (q.comp) where.registration = { competition: { code: q.comp } };
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        {
          registration: {
            student: { name: { contains: q.search, mode: 'insensitive' } },
          },
        },
        {
          registration: {
            student: { code: { contains: q.search, mode: 'insensitive' } },
          },
        },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.attempt.findMany({
        where,
        include: {
          registration: {
            include: {
              student: { select: { code: true, name: true, grade: true } },
              competition: true,
            },
          },
          stage: { select: { name: true, position: true } },
        },
        orderBy: { finishedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.attempt.count({ where }),
    ]);
    return paginate(
      rows.map((a) => ({
        code: a.code,
        student: a.registration.student.name,
        studentCode: a.registration.student.code,
        grade: a.registration.student.grade,
        competition: a.registration.competition.title,
        competitionCode: a.registration.competition.code,
        stage: a.stage?.name ?? null,
        stagePosition: a.stage?.position ?? null,
        score: a.score,
        total: a.total,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async getResult(code: string) {
    return this.prisma.attempt.findUnique({
      where: { code },
      include: {
        registration: {
          include: {
            student: { include: { school: true } },
            competition: true,
          },
        },
        stage: true,
        answers: { include: { question: true }, orderBy: { id: 'asc' } },
      },
    });
  }

  async leaderboard(comp?: string) {
    const rows = await this.prisma.attempt.findMany({
      where: {
        finishedAt: { not: null },
        ...(comp ? { registration: { competition: { code: comp } } } : {}),
      },
      include: {
        registration: { include: { student: { include: { school: true } } } },
        stage: { select: { name: true, position: true } },
      },
      orderBy: [{ score: 'desc' }, { finishedAt: 'asc' }],
    });
    return rows.map((a, i) => ({
      rank: i + 1,
      attemptCode: a.code,
      student: a.registration.student.name,
      studentCode: a.registration.student.code,
      grade: a.registration.student.grade,
      school: a.registration.student.school?.name ?? null,
      score: a.score,
      total: a.total,
      stage: a.stage?.name ?? null,
      finishedAt: a.finishedAt,
    }));
  }
}
