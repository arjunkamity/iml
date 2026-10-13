import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import {
  CreateQuestionCategoryDto,
  PatchQuestionCategoryDto,
} from './question-categories.dto';

@Injectable()
export class QuestionCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(q: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.QuestionCategoryWhereInput = {};
    if (q.status) where.active = q.status === 'Active';
    if (q.search) {
      where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.questionCategory.findMany({
        where,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.questionCategory.count({ where }),
    ]);
    return paginate(
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position,
        active: c.active,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async getCategory(name: string) {
    const category = await this.prisma.questionCategory.findUnique({
      where: { name },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async createCategory(dto: CreateQuestionCategoryDto) {
    const existing = await this.prisma.questionCategory.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('A category with that name already exists');
    }
    return this.prisma.questionCategory.create({
      data: {
        name: dto.name,
        position: dto.position ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async updateCategory(name: string, dto: PatchQuestionCategoryDto) {
    const existing = await this.prisma.questionCategory.findUnique({
      where: { name },
    });
    if (!existing) throw new NotFoundException('Category not found');
    if (dto.name && dto.name !== name) {
      const clash = await this.prisma.questionCategory.findUnique({
        where: { name: dto.name },
      });
      if (clash) {
        throw new ConflictException(
          'A category with that name already exists',
        );
      }
    }
    return this.prisma.questionCategory.update({
      where: { name },
      data: {
        name: dto.name,
        position: dto.position,
        active: dto.active,
      },
    });
  }

  async deleteCategory(name: string) {
    const existing = await this.prisma.questionCategory.findUnique({
      where: { name },
    });
    if (!existing) throw new NotFoundException('Category not found');
    await this.prisma.questionCategory.delete({ where: { name } });
    return { ok: true };
  }
}
