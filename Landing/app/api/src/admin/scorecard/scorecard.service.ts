import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { nextCode } from '../../common/util';
import { normalizeDeliverySettings, validateDeliverySettings } from '../../common/report-access';
import {
  DEFAULT_ID_PATTERN,
  FrameworkConfig,
  formatImlId,
  normalizeConfig,
  standardEdpaScale,
  validateFrameworkConfig,
  validateIdPattern,
} from '../../common/scorecard-config';
import {
  CreateFrameworkDto,
  CreateSeasonDto,
  PatchFrameworkDto,
  PatchSeasonDto,
  SeasonCompetitionsDto,
} from './scorecard.dto';

const PUBLISHED_LOCK =
  'This framework is published, so it can no longer be edited — reports already issued depend on it. Use "Make a new version" to change it.';

@Injectable()
export class ScorecardService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ helpers

  private async audit(entity: string, entityCode: string | null, action: string, adminId: number | null, summary: Record<string, unknown> = {}) {
    const admin = adminId ? await this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
    await this.prisma.configAuditLog.create({
      data: { entity, entityCode, action, adminId, adminName: admin?.name ?? null, summary: summary as Prisma.InputJsonValue },
    });
  }

  private async frameworkByCode(code: string) {
    const f = await this.prisma.scorecardFramework.findUnique({ where: { code } });
    if (!f) throw new NotFoundException('Framework not found');
    return f;
  }

  private async seasonByCode(code: string) {
    const s = await this.prisma.scorecardSeason.findUnique({ where: { code }, include: { framework: true } });
    if (!s) throw new NotFoundException('Season not found');
    return s;
  }

  /** Every framework in the same version family (walks up to the root, then down through all copies). */
  private async lineage(frameworkId: number) {
    const all = await this.prisma.scorecardFramework.findMany({
      select: { id: true, code: true, name: true, version: true, status: true, parentId: true },
    });
    const byId = new Map(all.map((f) => [f.id, f]));
    let root = byId.get(frameworkId);
    while (root?.parentId && byId.get(root.parentId)) root = byId.get(root.parentId);
    if (!root) return [];
    const family: typeof all = [];
    const walk = (id: number) => {
      const node = byId.get(id);
      if (!node) return;
      family.push(node);
      for (const child of all.filter((f) => f.parentId === id)) walk(child.id);
    };
    walk(root.id);
    return family.sort((a, b) => a.version - b.version || a.id - b.id);
  }

  private shapeFramework(f: Awaited<ReturnType<ScorecardService['frameworkByCode']>>) {
    const config = normalizeConfig(f.config);
    return {
      code: f.code,
      name: f.name,
      version: f.version,
      status: f.status,
      notes: f.notes,
      publishedAt: f.publishedAt,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      config,
      issues: validateFrameworkConfig(config),
      locked: f.status !== 'Draft',
    };
  }

  // -------------------------------------------------------------- frameworks

  async listFrameworks() {
    const rows = await this.prisma.scorecardFramework.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { seasons: true } } },
    });
    return rows.map((f) => {
      const c = normalizeConfig(f.config);
      return {
        code: f.code,
        name: f.name,
        version: f.version,
        status: f.status,
        publishedAt: f.publishedAt,
        updatedAt: f.updatedAt,
        dimensions: c.dimensions.length,
        scales: c.scales.length,
        competencies: c.competencies.length,
        seasons: f._count.seasons,
        issues: validateFrameworkConfig(c).length,
      };
    });
  }

  async getFramework(code: string) {
    const f = await this.frameworkByCode(code);
    const [family, seasons] = await Promise.all([
      this.lineage(f.id),
      this.prisma.scorecardSeason.findMany({ where: { frameworkId: f.id }, select: { code: true, name: true } }),
    ]);
    return { ...this.shapeFramework(f), versions: family, seasons };
  }

  async createFramework(dto: CreateFrameworkDto, adminId: number | null) {
    const codes = (await this.prisma.scorecardFramework.findMany({ select: { code: true } })).map((c) => c.code);
    const code = nextCode(codes, 'FW');
    const name = dto.name.trim();

    if (dto.cloneFrom) {
      const src = await this.frameworkByCode(dto.cloneFrom);
      const family = await this.lineage(src.id);
      const version = Math.max(...family.map((x) => x.version), src.version) + 1;
      await this.prisma.scorecardFramework.create({
        data: { code, name, version, status: 'Draft', parentId: src.id, notes: dto.notes ?? src.notes, config: src.config as Prisma.InputJsonValue },
      });
      await this.audit('framework', code, 'copy', adminId, { from: src.code, version });
      return this.getFramework(code);
    }

    // A blank framework starts with the standard development scale so the editor has a shape to follow.
    const config: FrameworkConfig = { dimensions: [], scales: [standardEdpaScale()], defaultScale: 'EDPA', competencies: [] };
    await this.prisma.scorecardFramework.create({
      data: { code, name, version: 1, status: 'Draft', notes: dto.notes ?? null, config: config as unknown as Prisma.InputJsonValue },
    });
    await this.audit('framework', code, 'create', adminId, { name });
    return this.getFramework(code);
  }

  async updateFramework(code: string, dto: PatchFrameworkDto, adminId: number | null) {
    const f = await this.frameworkByCode(code);
    if (f.status !== 'Draft') throw new BadRequestException(PUBLISHED_LOCK);
    const data: Prisma.ScorecardFrameworkUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    if (dto.config !== undefined) data.config = normalizeConfig(dto.config) as unknown as Prisma.InputJsonValue;
    await this.prisma.scorecardFramework.update({ where: { id: f.id }, data });
    await this.audit('framework', code, 'update', adminId, { fields: Object.keys(dto) });
    return this.getFramework(code);
  }

  async publishFramework(code: string, adminId: number | null) {
    const f = await this.frameworkByCode(code);
    if (f.status === 'Published') throw new BadRequestException('This framework is already published.');
    if (f.status === 'Archived') throw new BadRequestException('Restore this framework from the archive first.');
    const issues = validateFrameworkConfig(f.config);
    if (issues.length) throw new BadRequestException(`Not ready to publish: ${issues.join(' ')}`);
    await this.prisma.scorecardFramework.update({ where: { id: f.id }, data: { status: 'Published', publishedAt: new Date() } });
    await this.audit('framework', code, 'publish', adminId, { version: f.version });
    return this.getFramework(code);
  }

  async archiveFramework(code: string, adminId: number | null) {
    const f = await this.frameworkByCode(code);
    if (f.status === 'Archived') throw new BadRequestException('This framework is already archived.');
    if (f.status === 'Draft') throw new BadRequestException('Only a published framework can be archived. Delete the draft instead.');
    const inUse = await this.prisma.scorecardSeason.count({ where: { frameworkId: f.id, active: true } });
    if (inUse) throw new BadRequestException('An active season uses this framework. Switch the season off or move it to another framework first.');
    await this.prisma.scorecardFramework.update({ where: { id: f.id }, data: { status: 'Archived' } });
    await this.audit('framework', code, 'archive', adminId);
    return this.getFramework(code);
  }

  async unarchiveFramework(code: string, adminId: number | null) {
    const f = await this.frameworkByCode(code);
    if (f.status !== 'Archived') throw new BadRequestException('This framework is not archived.');
    await this.prisma.scorecardFramework.update({ where: { id: f.id }, data: { status: 'Published' } });
    await this.audit('framework', code, 'unarchive', adminId);
    return this.getFramework(code);
  }

  async deleteFramework(code: string, adminId: number | null) {
    const f = await this.frameworkByCode(code);
    if (f.status !== 'Draft') throw new BadRequestException('Only a draft can be deleted. Archive a published framework instead.');
    if (await this.prisma.scorecardSeason.count({ where: { frameworkId: f.id } })) {
      throw new BadRequestException('A season uses this framework, so it cannot be deleted.');
    }
    await this.prisma.scorecardFramework.delete({ where: { id: f.id } });
    await this.audit('framework', code, 'delete', adminId, { name: f.name });
    return { ok: true };
  }

  // ----------------------------------------------------------------- seasons

  private shapeSeason(s: Awaited<ReturnType<ScorecardService['seasonByCode']>> & { competitions?: { code: string; title: string; scaleKey: string | null }[] }) {
    const config = normalizeConfig(s.framework.config);
    const year = s.year ?? new Date().getFullYear();
    return {
      code: s.code,
      name: s.name,
      editionLabel: s.editionLabel,
      idPattern: s.idPattern,
      idExample: formatImlId(s.idPattern, { year, seq: 124, season: s.code }),
      year: s.year,
      active: s.active,
      scaleKey: s.scaleKey,
      library: (s as { library?: { code: string; name: string } | null }).library ?? null,
      template: (s as { template?: { code: string; name: string; version: number; status: string } | null }).template ?? null,
      deliverySettings: normalizeDeliverySettings((s as { deliverySettings?: unknown }).deliverySettings),
      effectiveScale: s.scaleKey ?? config.defaultScale,
      framework: { code: s.framework.code, name: s.framework.name, version: s.framework.version, status: s.framework.status },
      scaleOptions: config.scales.map((x) => ({ key: x.key, name: x.name })),
      competitions: s.competitions ?? [],
    };
  }

  async listSeasons() {
    const rows = await this.prisma.scorecardSeason.findMany({
      orderBy: { id: 'asc' },
      include: { framework: true, library: { select: { code: true, name: true } }, template: { select: { code: true, name: true, version: true, status: true } }, competitions: { select: { code: true, title: true, scaleKey: true }, orderBy: { code: 'asc' } } },
    });
    return rows.map((s) => this.shapeSeason(s));
  }

  async getSeason(code: string) {
    const s = await this.prisma.scorecardSeason.findUnique({
      where: { code },
      include: { framework: true, library: { select: { code: true, name: true } }, template: { select: { code: true, name: true, version: true, status: true } }, competitions: { select: { code: true, title: true, scaleKey: true }, orderBy: { code: 'asc' } } },
    });
    if (!s) throw new NotFoundException('Season not found');
    return this.shapeSeason(s);
  }

  private assertScale(framework: { config: unknown }, scaleKey: string | null | undefined) {
    if (!scaleKey) return;
    if (!normalizeConfig(framework.config).scales.some((x) => x.key === scaleKey)) {
      throw new BadRequestException(`The scale "${scaleKey}" does not exist in this framework.`);
    }
  }

  private assertPattern(pattern: string) {
    const problems = validateIdPattern(pattern);
    if (problems.length) throw new BadRequestException(problems.join(' '));
  }

  private async libraryId(code: string | undefined) {
    if (!code) return null;
    const lib = await this.prisma.scorecardLibrary.findUnique({ where: { code }, select: { id: true } });
    if (!lib) throw new BadRequestException(`The content library ${code} does not exist.`);
    return lib.id;
  }

  private deliveryJson(raw: Record<string, unknown> | undefined): Prisma.InputJsonValue {
    if (raw === undefined) return {};
    const issues = validateDeliverySettings(raw);
    if (issues.length) throw new BadRequestException(issues.join(' '));
    return normalizeDeliverySettings(raw) as unknown as Prisma.InputJsonValue;
  }

  /** A season can only use a published template: issued reports depend on it staying as it was. */
  private async templateId(code: string | undefined) {
    if (!code) return null;
    const t = await this.prisma.scorecardTemplate.findUnique({ where: { code }, select: { id: true, status: true } });
    if (!t) throw new BadRequestException(`The report template ${code} does not exist.`);
    if (t.status !== 'Published') throw new BadRequestException(`The report template ${code} is not published. Publish it first.`);
    return t.id;
  }

  private async publishedFramework(code: string) {
    const f = await this.frameworkByCode(code);
    if (f.status !== 'Published') throw new BadRequestException('A season can only use a published framework. Publish it first (or pick another).');
    return f;
  }

  async createSeason(dto: CreateSeasonDto, adminId: number | null) {
    const framework = await this.publishedFramework(dto.frameworkCode);
    const idPattern = dto.idPattern?.trim() || DEFAULT_ID_PATTERN;
    this.assertPattern(idPattern);
    this.assertScale(framework, dto.scaleKey);
    const libraryId = await this.libraryId(dto.libraryCode);
    const templateId = await this.templateId(dto.templateCode);
    const codes = (await this.prisma.scorecardSeason.findMany({ select: { code: true } })).map((c) => c.code);
    const code = nextCode(codes, 'SE');
    await this.prisma.scorecardSeason.create({
      data: {
        code,
        name: dto.name.trim(),
        editionLabel: dto.editionLabel.trim(),
        idPattern,
        year: dto.year ?? null,
        frameworkId: framework.id,
        scaleKey: dto.scaleKey || null,
        libraryId,
        templateId,
        deliverySettings: this.deliveryJson(dto.deliverySettings),
        active: dto.active ?? true,
      },
    });
    await this.audit('season', code, 'create', adminId, { framework: framework.code });
    return this.getSeason(code);
  }

  async updateSeason(code: string, dto: PatchSeasonDto, adminId: number | null) {
    const s = await this.seasonByCode(code);
    const data: Prisma.ScorecardSeasonUpdateInput = {};
    let framework = s.framework;

    if (dto.frameworkCode !== undefined && dto.frameworkCode !== s.framework.code) {
      if (await this.prisma.competition.count({ where: { seasonId: s.id } })) {
        throw new BadRequestException('Remove this season’s competitions before moving it to another framework.');
      }
      framework = await this.publishedFramework(dto.frameworkCode);
      data.framework = { connect: { id: framework.id } };
    }
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.editionLabel !== undefined) data.editionLabel = dto.editionLabel.trim();
    if (dto.idPattern !== undefined) {
      const pattern = dto.idPattern.trim() || DEFAULT_ID_PATTERN;
      this.assertPattern(pattern);
      data.idPattern = pattern;
    }
    if (dto.year !== undefined) data.year = dto.year;
    if (dto.deliverySettings !== undefined) data.deliverySettings = this.deliveryJson(dto.deliverySettings);
    if (dto.templateCode !== undefined) {
      const templateId = await this.templateId(dto.templateCode);
      data.template = templateId ? { connect: { id: templateId } } : { disconnect: true };
    }
    if (dto.libraryCode !== undefined) {
      const libraryId = await this.libraryId(dto.libraryCode);
      data.library = libraryId ? { connect: { id: libraryId } } : { disconnect: true };
    }
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.scaleKey !== undefined) {
      this.assertScale(framework, dto.scaleKey);
      data.scaleKey = dto.scaleKey || null;
    } else if (framework.id !== s.framework.id) {
      data.scaleKey = null; // the old scale key means nothing in the new framework
    }
    await this.prisma.scorecardSeason.update({ where: { id: s.id }, data });
    await this.audit('season', code, 'update', adminId, { fields: Object.keys(dto) });
    return this.getSeason(code);
  }

  async deleteSeason(code: string, adminId: number | null) {
    const s = await this.seasonByCode(code);
    if (await this.prisma.competition.count({ where: { seasonId: s.id } })) {
      throw new BadRequestException('Competitions are assigned to this season. Remove them first.');
    }
    await this.prisma.scorecardSeason.delete({ where: { id: s.id } });
    await this.audit('season', code, 'delete', adminId, { name: s.name });
    return { ok: true };
  }

  /** Replaces the season's competitions (and any per-competition scale). A competition belongs to at most one season. */
  async setSeasonCompetitions(code: string, dto: SeasonCompetitionsDto, adminId: number | null) {
    const s = await this.seasonByCode(code);
    const wanted = new Map<string, string | null>();
    for (const c of dto.competitions) {
      if (wanted.has(c.competitionCode)) throw new BadRequestException(`${c.competitionCode} is listed twice.`);
      this.assertScale(s.framework, c.scaleKey);
      wanted.set(c.competitionCode, c.scaleKey || null);
    }
    const comps = wanted.size
      ? await this.prisma.competition.findMany({ where: { code: { in: [...wanted.keys()] } }, select: { id: true, code: true, seasonId: true, season: { select: { code: true } } } })
      : [];
    for (const code2 of wanted.keys()) {
      const c = comps.find((x) => x.code === code2);
      if (!c) throw new BadRequestException(`Competition ${code2} was not found.`);
      if (c.seasonId && c.seasonId !== s.id) throw new ConflictException(`${code2} already belongs to season ${c.season?.code}. Remove it from there first.`);
    }
    await this.prisma.$transaction([
      this.prisma.competition.updateMany({ where: { seasonId: s.id, code: { notIn: [...wanted.keys()] } }, data: { seasonId: null, scaleKey: null } }),
      ...comps.map((c) => this.prisma.competition.update({ where: { id: c.id }, data: { seasonId: s.id, scaleKey: wanted.get(c.code) ?? null } })),
    ]);
    await this.audit('season', code, 'competitions', adminId, { competitions: [...wanted.keys()] });
    return this.getSeason(code);
  }

  // ------------------------------------------------------------------- audit

  async auditLog(q: { entity?: string; code?: string; limit?: number }) {
    return this.prisma.configAuditLog.findMany({
      where: { ...(q.entity ? { entity: q.entity } : {}), ...(q.code ? { entityCode: q.code } : {}) },
      orderBy: { id: 'desc' },
      take: Math.min(q.limit ?? 50, 200),
    });
  }
}
