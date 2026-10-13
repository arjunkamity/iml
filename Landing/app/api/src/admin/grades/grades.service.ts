import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { CreateGradeDto, PatchGradeDto } from './grades.dto';

@Injectable()
export class GradeService {
  constructor(private readonly prisma: PrismaService) {}

  async listGrades(q: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.GradeWhereInput = {};
    if (q.status) where.active = q.status === 'Active';
    if (q.search) {
      where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.grade.findMany({
        where,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.grade.count({ where }),
    ]);
    return paginate(
      rows.map((g) => ({
        id: g.id,
        name: g.name,
        position: g.position,
        active: g.active,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async getGrade(name: string) {
    const grade = await this.prisma.grade.findUnique({ where: { name } });
    if (!grade) throw new NotFoundException('Grade not found');
    return grade;
  }

  async createGrade(dto: CreateGradeDto) {
    const existing = await this.prisma.grade.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('A grade with that name already exists');
    }
    return this.prisma.grade.create({
      data: {
        name: dto.name,
        position: dto.position ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async updateGrade(name: string, dto: PatchGradeDto) {
    const existing = await this.prisma.grade.findUnique({ where: { name } });
    if (!existing) throw new NotFoundException('Grade not found');
    if (dto.name && dto.name !== name) {
      const clash = await this.prisma.grade.findUnique({
        where: { name: dto.name },
      });
      if (clash) {
        throw new ConflictException('A grade with that name already exists');
      }
    }
    return this.prisma.grade.update({
      where: { name },
      data: {
        name: dto.name,
        position: dto.position,
        active: dto.active,
      },
    });
  }

  async deleteGrade(name: string) {
    const existing = await this.prisma.grade.findUnique({ where: { name } });
    if (!existing) throw new NotFoundException('Grade not found');
    await this.prisma.grade.delete({ where: { name } });
    return { ok: true };
  }
}
