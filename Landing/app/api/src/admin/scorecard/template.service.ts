import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { nextCode } from '../../common/util';
import { SECTION_INFO, TemplateConfig, emptyTemplateConfig, normalizeTemplateConfig, validateTemplateConfig } from '../../common/report-template';
import { CreateTemplateDto, PatchTemplateDto } from './template.dto';

const PUBLISHED_LOCK =
  'This template is published, so it can no longer be edited — reports already issued depend on it. Use "Make a new version" to change it.';

// Report templates (#73): the layout of a scorecard report as data, versioned like a
// framework. Draft -> Published (locked) -> Archived; a change is a new draft copy.
@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  private async audit(code: string, action: string, adminId: number | null, summary: Record<string, unknown> = {}) {
    const admin = adminId ? await this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
    await this.prisma.configAuditLog.create({
      data: { entity: 'template', entityCode: code, action, adminId, adminName: admin?.name ?? null, summary: summary as Prisma.InputJsonValue },
    });
  }

  private async byCode(code: string) {
    const t = await this.prisma.scorecardTemplate.findUnique({ where: { code } });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  meta() {
    return { sectionTypes: SECTION_INFO };
  }

  private shape(t: Awaited<ReturnType<TemplateService['byCode']>>, extra: { seasons?: { code: string; name: string }[]; versions?: { code: string; version: number; status: string; name: string }[] } = {}) {
    const config = normalizeTemplateConfig(t.config);
    const issues = validateTemplateConfig(config);
    return {
      code: t.code,
      name: t.name,
      version: t.version,
      status: t.status,
      notes: t.notes,
      publishedAt: t.publishedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      locked: t.status !== 'Draft',
      config,
      issues,
      seasons: extra.seasons ?? [],
      versions: extra.versions ?? [],
    };
  }

  /** Every template in the same version family. */
  private async family(id: number) {
    const all = await this.prisma.scorecardTemplate.findMany({ select: { id: true, code: true, name: true, version: true, status: true, parentId: true } });
    const byId = new Map(all.map((t) => [t.id, t]));
    let root = byId.get(id);
    while (root?.parentId && byId.get(root.parentId)) root = byId.get(root.parentId);
    if (!root) return [];
    const out: typeof all = [];
    const walk = (nid: number) => {
      const n = byId.get(nid);
      if (!n) return;
      out.push(n);
      for (const c of all.filter((x) => x.parentId === nid)) walk(c.id);
    };
    walk(root.id);
    return out.sort((a, b) => a.version - b.version || a.id - b.id);
  }

  async list() {
    const rows = await this.prisma.scorecardTemplate.findMany({ orderBy: { id: 'asc' }, include: { seasons: { select: { code: true, name: true } } } });
    return rows.map((t) => {
      const s = this.shape(t, { seasons: t.seasons });
      return { code: s.code, name: s.name, version: s.version, status: s.status, sections: s.config.sections.length, issues: s.issues.length, seasons: s.seasons, updatedAt: s.updatedAt };
    });
  }

  async get(code: string) {
    const t = await this.prisma.scorecardTemplate.findUnique({ where: { code }, include: { seasons: { select: { code: true, name: true } } } });
    if (!t) throw new NotFoundException('Template not found');
    const versions = (await this.family(t.id)).map((v) => ({ code: v.code, version: v.version, status: v.status, name: v.name }));
    return this.shape(t, { seasons: t.seasons, versions });
  }

  async create(dto: CreateTemplateDto, adminId: number | null) {
    const codes = (await this.prisma.scorecardTemplate.findMany({ select: { code: true } })).map((c) => c.code);
    const code = nextCode(codes, 'TP');
    let config: TemplateConfig = emptyTemplateConfig();
    let version = 1;
    let parentId: number | null = null;
    if (dto.cloneFrom) {
      const src = await this.byCode(dto.cloneFrom);
      config = normalizeTemplateConfig(src.config);
      const family = await this.family(src.id);
      version = Math.max(...family.map((f) => f.version)) + 1;
      parentId = src.id;
    }
    await this.prisma.scorecardTemplate.create({
      data: { code, name: dto.name.trim(), version, parentId, notes: dto.notes?.trim() || null, config: config as unknown as Prisma.InputJsonValue },
    });
    await this.audit(code, dto.cloneFrom ? 'copy' : 'create', adminId, { name: dto.name, ...(dto.cloneFrom ? { from: dto.cloneFrom, version } : {}) });
    return this.get(code);
  }

  async update(code: string, dto: PatchTemplateDto, adminId: number | null) {
    const t = await this.byCode(code);
    if (t.status !== 'Draft') throw new BadRequestException(PUBLISHED_LOCK);
    const data: Prisma.ScorecardTemplateUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    if (dto.config !== undefined) data.config = normalizeTemplateConfig(dto.config) as unknown as Prisma.InputJsonValue;
    await this.prisma.scorecardTemplate.update({ where: { id: t.id }, data });
    await this.audit(code, 'update', adminId, { fields: Object.keys(dto) });
    return this.get(code);
  }

  async publish(code: string, adminId: number | null) {
    const t = await this.byCode(code);
    if (t.status === 'Published') throw new BadRequestException('This template is already published.');
    if (t.status === 'Archived') throw new BadRequestException('Restore this template from the archive first.');
    const issues = validateTemplateConfig(t.config);
    if (issues.length) throw new BadRequestException(`Not ready to publish: ${issues.join(' ')}`);
    await this.prisma.scorecardTemplate.update({ where: { id: t.id }, data: { status: 'Published', publishedAt: new Date() } });
    await this.audit(code, 'publish', adminId, { version: t.version });
    return this.get(code);
  }

  async archive(code: string, adminId: number | null) {
    const t = await this.byCode(code);
    if (t.status === 'Archived') throw new BadRequestException('This template is already archived.');
    if (t.status === 'Draft') throw new BadRequestException('Only a published template can be archived. Delete the draft instead.');
    if (await this.prisma.scorecardSeason.count({ where: { templateId: t.id, active: true } })) {
      throw new BadRequestException('An active season uses this template. Move the season to another template first.');
    }
    await this.prisma.scorecardTemplate.update({ where: { id: t.id }, data: { status: 'Archived' } });
    await this.audit(code, 'archive', adminId);
    return this.get(code);
  }

  async unarchive(code: string, adminId: number | null) {
    const t = await this.byCode(code);
    if (t.status !== 'Archived') throw new BadRequestException('This template is not archived.');
    await this.prisma.scorecardTemplate.update({ where: { id: t.id }, data: { status: 'Published' } });
    await this.audit(code, 'unarchive', adminId);
    return this.get(code);
  }

  async remove(code: string, adminId: number | null) {
    const t = await this.byCode(code);
    if (t.status !== 'Draft') throw new BadRequestException('Only a draft can be deleted. Archive a published template instead.');
    if (await this.prisma.scorecardSeason.count({ where: { templateId: t.id } })) throw new BadRequestException('A season uses this template, so it cannot be deleted.');
    await this.prisma.scorecardTemplate.delete({ where: { id: t.id } });
    await this.audit(code, 'delete', adminId, { name: t.name });
    return { ok: true };
  }
}
