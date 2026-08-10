import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nextCode } from '../common/util';
import {
  CreateStudentGrievanceDto,
  SetStudentPasswordDto,
  UpdateStudentProfileDto,
} from './student.dto';

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- profile ----

  async me(studentId: number) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        school: true,
        registrations: {
          include: {
            competition: true,
            stages: {
              include: { stage: true },
              orderBy: { stage: { position: 'asc' } },
            },
            attempts: {
              include: { stage: { select: { name: true, position: true } } },
              orderBy: { finishedAt: 'desc' },
            },
            payments: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { registeredAt: 'desc' },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async updateProfile(studentId: number, dto: UpdateStudentProfileDto) {
    const existing = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!existing) throw new NotFoundException('Student not found');

    let schoolId = existing.schoolId;
    if (dto.school !== undefined) {
      if (dto.school.trim()) {
        const found = await this.prisma.school.findFirst({
          where: { name: { equals: dto.school.trim(), mode: 'insensitive' } },
        });
        if (found) {
          schoolId = found.id;
        } else {
          const codes = (
            await this.prisma.school.findMany({ select: { code: true } })
          ).map((s) => s.code);
          const school = await this.prisma.school.create({
            data: { code: nextCode(codes, 'S'), name: dto.school.trim() },
          });
          schoolId = school.id;
        }
      } else {
        schoolId = null;
      }
    }

    const data: Prisma.StudentUncheckedUpdateInput = {
      name: dto.name,
      grade: dto.grade,
      phone: dto.phone,
      parent: dto.parent,
      parentPhone: dto.parentPhone,
      gender: dto.gender,
      dob: dto.dob ? new Date(`${dto.dob}T00:00:00Z`) : undefined,
      address: dto.address,
      ...(schoolId !== existing.schoolId ? { schoolId } : {}),
    };

    await this.prisma.student.update({ where: { id: studentId }, data });
    return this.me(studentId);
  }

  // ---- security ----

  async setPassword(studentId: number, dto: SetStudentPasswordDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (student.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Enter your current password to change it.',
        );
      }
      let ok = false;
      try {
        ok = await argonVerify(student.passwordHash, dto.currentPassword);
      } catch {
        ok = false;
      }
      if (!ok) throw new BadRequestException('Current password is incorrect.');
    }

    const passwordHash = await argonHash(dto.newPassword);
    await this.prisma.student.update({
      where: { id: studentId },
      data: { passwordHash },
    });
    return { ok: true };
  }

  // ---- schedules ----

  async schedules(studentId: number) {
    const registrations = await this.prisma.registration.findMany({
      where: { studentId },
      select: { competitionId: true },
    });
    const competitionIds = registrations.map((r) => r.competitionId);
    if (!competitionIds.length) return [];

    const exams = await this.prisma.exam.findMany({
      where: {
        competitionId: { in: competitionIds },
        status: { in: ['Scheduled', 'Live'] },
      },
      include: {
        competition: { select: { code: true, title: true } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });

    return exams.map((e) => ({
      code: e.code,
      title: e.title,
      grade: e.grade,
      date: e.date,
      time: e.time,
      durationMin: e.durationMin,
      timing: e.timing,
      status: e.status,
      competitionCode: e.competition?.code ?? null,
      competitionTitle: e.competition?.title ?? null,
    }));
  }

  // ---- results ----

  async results(studentId: number) {
    const attempts = await this.prisma.attempt.findMany({
      where: { registration: { studentId } },
      include: {
        registration: { include: { competition: true } },
        stage: { select: { name: true, position: true } },
        answers: { include: { question: { select: { category: true } } } },
      },
      orderBy: { finishedAt: 'desc' },
    });

    return attempts.map((a) => {
      const cats: Record<string, { correct: number; total: number }> = {};
      for (const ans of a.answers) {
        const cat = ans.question?.category ?? 'Other';
        const slot = (cats[cat] ??= { correct: 0, total: 0 });
        slot.total += 1;
        if (ans.isCorrect) slot.correct += 1;
      }
      const score = Number(a.score);
      const total = Number(a.total);
      return {
        code: a.code,
        competition: a.registration.competition.title,
        competitionCode: a.registration.competition.code,
        stage: a.stage?.name ?? null,
        stagePosition: a.stage?.position ?? null,
        score,
        total,
        percent: total > 0 ? Math.round((score / total) * 100) : 0,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
        categories: Object.entries(cats).map(([name, v]) => ({
          name,
          correct: v.correct,
          total: v.total,
        })),
      };
    });
  }

  // ---- payments ----

  async payments(studentId: number) {
    const payments = await this.prisma.payment.findMany({
      where: { registration: { studentId } },
      include: {
        registration: { include: { competition: true } },
        stage: { select: { name: true, position: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => ({
      code: p.code,
      amount: Number(p.amount),
      mode: p.mode,
      status: p.status,
      providerTxn: p.providerTxn,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      competition: p.registration.competition.title,
      competitionCode: p.registration.competition.code,
      stage: p.stage?.name ?? null,
    }));
  }

  // ---- help desk (grievances) ----

  async grievances(studentId: number) {
    return this.prisma.grievance.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createGrievance(studentId: number, dto: CreateStudentGrievanceDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const codes = (
      await this.prisma.grievance.findMany({ select: { code: true } })
    ).map((g) => g.code);
    const code = nextCode(codes, 'GV');

    return this.prisma.grievance.create({
      data: {
        code,
        gtype: dto.gtype,
        studentId,
        name: student.name,
        contact: student.phone ?? student.email ?? null,
        subject: dto.subject,
        message: dto.message,
        status: 'New',
      },
    });
  }
}
