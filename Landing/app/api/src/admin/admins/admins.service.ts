import { Injectable, NotFoundException } from '@nestjs/common';
import { hash as argonHash } from '@node-rs/argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { CreateAdminDto, PatchAdminDto } from './admins.dto';

type ListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmins(q: ListQuery): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.AdminWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.admin.findMany({
        where,
        include: { modules: true },
        orderBy: { id: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.admin.count({ where }),
    ]);
    return paginate(
      rows.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        status: a.status,
        modules: a.modules.map((m) => m.moduleCode),
        createdAt: a.createdAt,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  private async setModules(adminId: number, modules?: string[]) {
    if (!modules) return;
    await this.prisma.adminModule.deleteMany({ where: { adminId } });
    if (!modules.length) return;
    await this.prisma.adminModule.createMany({
      data: modules.map((moduleCode) => ({ adminId, moduleCode })),
    });
  }

  async createAdmin(dto: CreateAdminDto) {
    const passwordHash = await argonHash(dto.password);
    const admin = await this.prisma.admin.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role ?? 'Editor',
        status: dto.status ?? 'Active',
      },
    });
    await this.setModules(admin.id, dto.modules);
    return this.getAdmin(admin.id);
  }

  async getAdmin(id: number) {
    const a = await this.prisma.admin.findUnique({
      where: { id },
      include: { modules: true },
    });
    if (!a) throw new NotFoundException('Admin not found');
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      modules: a.modules.map((m) => m.moduleCode),
    };
  }

  async updateAdmin(id: number, dto: PatchAdminDto) {
    const existing = await this.prisma.admin.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Admin not found');
    const data: Prisma.AdminUpdateInput = {
      name: dto.name,
      email: dto.email ? dto.email.toLowerCase() : undefined,
      role: dto.role,
      status: dto.status,
    };
    if (dto.password) data.passwordHash = await argonHash(dto.password);
    await this.prisma.admin.update({ where: { id }, data });
    await this.setModules(id, dto.modules);
    return this.getAdmin(id);
  }

  async deleteAdmin(id: number) {
    const existing = await this.prisma.admin.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Admin not found');
    await this.prisma.admin.delete({ where: { id } });
    return { ok: true };
  }
}
