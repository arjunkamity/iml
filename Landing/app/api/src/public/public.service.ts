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

    const gradeName = dto.grade.trim();
    const activeGrade = await this.prisma.grade.findUnique({
      where: { name: gradeName },
    });
    if (!activeGrade || !activeGrade.active) {
      throw new BadRequestException(
        'Please choose a valid class / grade from the list.',
      );
    }

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
        grade: gradeName,
        email: normalizedEmail,
        phone: dto.phone?.trim() ?? null,
        parent: dto.parent?.trim() ?? null,
        schoolId,
      },
    });

    const registration = await this.prisma.registration.create({
      data: {
        code,
        studentId: student.id,
        competitionId: competition.id,
        status: 'Registered',
        registeredAt: new Date(),
      },
    });

    const stageRows = await this.prisma.competitionStage.findMany({
      where: { competitionId: competition.id },
      orderBy: { position: 'asc' },
    });
    if (stageRows.length) {
      await this.prisma.registrationStage.createMany({
        data: stageRows.map((s, i) => ({
          registrationId: registration.id,
          stageId: s.id,
          status: i === 0 ? 'Unlocked' : 'Locked',
          unlockedAt: i === 0 ? new Date() : null,
        })),
      });
    }

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

  async grades() {
    const rows = await this.prisma.grade.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { name: true, position: true },
    });
    return rows.map((g) => ({ name: g.name, position: g.position }));
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

  async leaderboardSchools(comp?: string) {
    const rows = await this.prisma.attempt.findMany({
      where: {
        finishedAt: { not: null },
        registration: {
          student: { schoolId: { not: null } },
          ...(comp ? { competition: { code: comp } } : {}),
        },
      },
      select: {
        score: true,
        total: true,
        registration: {
          select: { studentId: true, student: { select: { schoolId: true, school: { select: { name: true } } } } },
        },
      },
    });

    const bySchool = new Map<
      number,
      { name: string; totalScore: number; totalPossible: number; attempts: number; students: Set<number> }
    >();
    for (const a of rows) {
      const schoolId = a.registration.student.schoolId;
      const schoolName = a.registration.student.school?.name;
      if (!schoolId || !schoolName) continue;
      let entry = bySchool.get(schoolId);
      if (!entry) {
        entry = { name: schoolName, totalScore: 0, totalPossible: 0, attempts: 0, students: new Set() };
        bySchool.set(schoolId, entry);
      }
      entry.totalScore += Number(a.score);
      entry.totalPossible += Number(a.total);
      entry.attempts += 1;
      entry.students.add(a.registration.studentId);
    }

    return [...bySchool.values()]
      .map((s) => ({
        school: s.name,
        totalScore: s.totalScore,
        totalPossible: s.totalPossible,
        students: s.students.size,
        avgScore: s.attempts ? Math.round((s.totalScore / s.attempts) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 50)
      .map((s, i) => ({ rank: i + 1, ...s }));
  }

  async gallery() {
    const rows = await this.prisma.gallery.findMany({
      where: { visibility: 'Public', status: 'Active' },
      orderBy: { date: 'desc' },
      select: {
        code: true,
        name: true,
        date: true,
        cover: true,
        description: true,
        photos: true,
      },
    });
    return rows;
  }
}
