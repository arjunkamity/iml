import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { nextCode } from '../common/util';
import { PublicRegisterDto } from './public.dto';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: PublicRegisterDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existing = await this.prisma.student.findFirst({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException(
        'A student with that email is already registered — please log in.',
      );
    }

    const competition = dto.competitionCode
      ? await this.prisma.competition.findUnique({
          where: { code: dto.competitionCode },
        })
      : await this.prisma.competition.findFirst({
          where: { status: 'Live' },
          orderBy: { id: 'asc' },
        });
    if (!competition) {
      throw new BadRequestException(
        'No open competition is available for registration.',
      );
    }

    let schoolId: number | null = null;
    if (dto.school?.trim()) {
      const existingSchool = await this.prisma.school.findFirst({
        where: { name: { equals: dto.school.trim(), mode: 'insensitive' } },
      });
      if (existingSchool) {
        schoolId = existingSchool.id;
      } else {
        const schoolCodes = (
          await this.prisma.school.findMany({ select: { code: true } })
        ).map((s) => s.code);
        const school = await this.prisma.school.create({
          data: { code: nextCode(schoolCodes, 'S'), name: dto.school.trim() },
        });
        schoolId = school.id;
      }
    }

    const codes = (
      await this.prisma.student.findMany({ select: { code: true } })
    ).map((s) => s.code);
    const code = nextCode(codes, 'R');

    const student = await this.prisma.student.create({
      data: {
        code,
        name: dto.name.trim(),
        grade: dto.grade.trim(),
        email: normalizedEmail,
        phone: dto.phone?.trim() ?? null,
        parent: dto.parent?.trim() ?? null,
        schoolId,
      },
    });

    await this.prisma.registration.create({
      data: {
        code,
        studentId: student.id,
        competitionId: competition.id,
        status: 'Registered',
        registeredAt: new Date(),
      },
    });

    return {
      registrationCode: code,
      student: {
        code,
        name: student.name,
        grade: student.grade,
        email: student.email,
      },
      competition: { code: competition.code, title: competition.title },
    };
  }

  async competitions() {
    const rows = await this.prisma.competition.findMany({
      where: { status: { in: ['Live', 'Open'] } },
      orderBy: { id: 'asc' },
      select: { code: true, title: true, status: true },
    });
    return rows;
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
      take: 100,
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
