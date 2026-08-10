import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { nextCode } from '../../common/util';
import {
  AcceptStageDto,
  CreateRegistrationDto,
  CreateSchoolDto,
  CreateStudentDto,
  PatchRegistrationDto,
  PatchSchoolDto,
  PatchStudentDto,
} from './registrations.dto';

const registrationInclude = {
  student: { include: { school: true } },
  competition: true,
} satisfies Prisma.RegistrationInclude;

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- registrations ----

  async listRegistrations(q: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    comp?: string;
  }): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.RegistrationWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.comp) where.competition = { code: q.comp };
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { student: { name: { contains: q.search, mode: 'insensitive' } } },
        { student: { email: { contains: q.search, mode: 'insensitive' } } },
        { student: { phone: { contains: q.search, mode: 'insensitive' } } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.registration.findMany({
        where,
        include: registrationInclude,
        orderBy: { registeredAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.registration.count({ where }),
    ]);
    return paginate(
      rows.map((r) => ({
        code: r.code,
        name: r.student.name,
        grade: r.student.grade,
        school: r.student.school?.name ?? null,
        phone: r.student.phone,
        email: r.student.email,
        parent: r.student.parent,
        competition: r.competition.title,
        competitionCode: r.competition.code,
        status: r.status,
        registeredAt: r.registeredAt,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async getRegistration(code: string) {
    const reg = await this.prisma.registration.findUnique({
      where: { code },
      include: {
        ...registrationInclude,
        stages: {
          include: {
            stage: { include: { rules: { orderBy: { position: 'asc' } } } },
          },
          orderBy: { stage: { position: 'asc' } },
        },
        payments: { orderBy: { createdAt: 'desc' } },
        attempts: { include: { answers: true } },
      },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    return reg;
  }

  async createRegistration(dto: CreateRegistrationDto) {
    const competition = await this.prisma.competition.findUnique({
      where: { code: dto.competitionCode },
    });
    if (!competition) throw new NotFoundException('Competition not found');

    const studentCodes = (
      await this.prisma.student.findMany({ select: { code: true } })
    ).map((s) => s.code);
    const code = nextCode(studentCodes, 'R');

    const schoolId = dto.student.schoolCode
      ? ((
          await this.prisma.school.findUnique({
            where: { code: dto.student.schoolCode },
          })
        )?.id ?? null)
      : null;

    const existing = await this.prisma.student.findFirst({
      where: { email: dto.student.email?.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException(
        'A student with that email is already registered',
      );
    }

    const student = await this.prisma.student.create({
      data: {
        code,
        name: dto.student.name,
        grade: dto.student.grade,
        phone: dto.student.phone,
        email: dto.student.email?.toLowerCase(),
        parent: dto.student.parent,
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
      include: registrationInclude,
    });
    return this.getRegistration(code);
  }

  async updateRegistration(code: string, dto: PatchRegistrationDto) {
    const existing = await this.prisma.registration.findUnique({
      where: { code },
    });
    if (!existing) throw new NotFoundException('Registration not found');
    await this.prisma.registration.update({ where: { code }, data: dto });
    return this.getRegistration(code);
  }

  async deleteRegistration(code: string) {
    const reg = await this.prisma.registration.findUnique({ where: { code } });
    if (!reg) throw new NotFoundException('Registration not found');
    await this.prisma.$transaction([
      this.prisma.payment.deleteMany({ where: { registrationId: reg.id } }),
      this.prisma.attemptAnswer.deleteMany({
        where: { attempt: { registrationId: reg.id } },
      }),
      this.prisma.attempt.deleteMany({ where: { registrationId: reg.id } }),
      this.prisma.registrationStage.deleteMany({
        where: { registrationId: reg.id },
      }),
      this.prisma.registration.delete({ where: { id: reg.id } }),
    ]);
    return { ok: true };
  }

  async acceptStage(code: string, dto: AcceptStageDto) {
    const reg = await this.prisma.registration.findUnique({
      where: { code },
      include: { competition: true },
    });
    if (!reg) throw new NotFoundException('Registration not found');

    const stage = await this.prisma.competitionStage.findUnique({
      where: {
        competitionId_position: {
          competitionId: reg.competitionId,
          position: dto.position,
        },
      },
    });
    if (!stage)
      throw new BadRequestException(
        `Stage ${dto.position} does not exist for this competition`,
      );

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.registrationStage.findUnique({
        where: {
          registrationId_stageId: { registrationId: reg.id, stageId: stage.id },
        },
      });
      if (!existing) {
        await tx.registrationStage.create({
          data: {
            registrationId: reg.id,
            stageId: stage.id,
            status: stage.isFree ? 'Unlocked' : 'Paid',
          },
        });
      } else if (existing.status === 'Locked') {
        await tx.registrationStage.update({
          where: {
            registrationId_stageId: {
              registrationId: reg.id,
              stageId: stage.id,
            },
          },
          data: {
            status: stage.isFree ? 'Unlocked' : 'Paid',
            unlockedAt: new Date(),
            paidAt: stage.isFree ? undefined : new Date(),
          },
        });
      }

      const codes = (await tx.payment.findMany({ select: { code: true } })).map(
        (p) => p.code,
      );
      const payment = await tx.payment.create({
        data: {
          code: nextCode(codes, 'PAY-'),
          registrationId: reg.id,
          stageId: stage.id,
          amount: stage.price,
          mode: dto.payment?.mode ?? 'Offline',
          providerTxn: dto.payment?.providerTxn ?? null,
          status: 'Paid',
          paidAt: new Date(),
        },
      });

      if (reg.status === 'Registered') {
        await tx.registration.update({
          where: { id: reg.id },
          data: { status: 'Test Taken' },
        });
      }

      return {
        registrationId: code,
        acceptedStage: {
          name: stage.name,
          position: stage.position,
          isFree: stage.isFree,
          price: stage.price,
        },
        payment,
      };
    });
  }

  // ---- students ----

  async getStudent(code: string) {
    const student = await this.prisma.student.findUnique({
      where: { code },
      include: {
        school: true,
        registrations: {
          include: { competition: true, stages: true, payments: true },
        },
        grievances: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async updateStudent(code: string, dto: PatchStudentDto) {
    const existing = await this.prisma.student.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Student not found');
    const schoolId = dto.schoolCode
      ? ((
          await this.prisma.school.findUnique({
            where: { code: dto.schoolCode },
          })
        )?.id ?? undefined)
      : undefined;
    const data: Prisma.StudentUncheckedUpdateInput = {
      name: dto.name,
      grade: dto.grade,
      phone: dto.phone,
      email: dto.email?.toLowerCase(),
      parent: dto.parent,
      ...(schoolId !== undefined ? { schoolId } : {}),
    };
    await this.prisma.student.update({
      where: { code },
      data,
    });
    return this.getStudent(code);
  }

  async createStudent(dto: CreateStudentDto) {
    const studentCodes = (
      await this.prisma.student.findMany({ select: { code: true } })
    ).map((s) => s.code);
    const code = nextCode(studentCodes, 'R');
    const schoolId = dto.schoolCode
      ? ((
          await this.prisma.school.findUnique({
            where: { code: dto.schoolCode },
          })
        )?.id ?? null)
      : null;
    return this.prisma.student.create({
      data: {
        code,
        name: dto.name,
        grade: dto.grade,
        phone: dto.phone,
        email: dto.email?.toLowerCase(),
        parent: dto.parent,
        schoolId,
      },
      include: { school: true },
    });
  }

  // ---- schools ----

  async listSchools(q: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.SchoolWhereInput = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
        { city: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.school.findMany({
        where,
        include: { _count: { select: { students: true } } },
        orderBy: { code: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.school.count({ where }),
    ]);
    return paginate(
      rows.map((s) => ({
        code: s.code,
        name: s.name,
        city: s.city,
        contact: s.contact,
        coordinator: s.coordinator,
        students: s._count.students,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async getSchool(code: string) {
    const school = await this.prisma.school.findUnique({
      where: { code },
      include: {
        students: {
          include: { registrations: { include: { competition: true } } },
        },
      },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async createSchool(dto: CreateSchoolDto) {
    const codes = (
      await this.prisma.school.findMany({ select: { code: true } })
    ).map((s) => s.code);
    const code = nextCode(codes, 'S');
    return this.prisma.school.create({ data: { code, ...dto } });
  }

  async updateSchool(code: string, dto: PatchSchoolDto) {
    const existing = await this.prisma.school.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('School not found');
    return this.prisma.school.update({ where: { code }, data: dto });
  }
}
