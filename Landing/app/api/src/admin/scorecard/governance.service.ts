import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { nextCode } from '../../common/util';
import { Change, diffConfig } from '../../common/config-diff';
import { normalizeConfig, validateFrameworkConfig } from '../../common/scorecard-config';
import { normalizeTemplateConfig, validateTemplateConfig } from '../../common/report-template';
import { normalizeDeliverySettings } from '../../common/report-access';

export const BUNDLE_FORMAT = 'iml-scorecard-config';

export interface ConfigBundle {
  format: typeof BUNDLE_FORMAT;
  version: 1;
  exportedAt: string;
  season: { name: string; editionLabel: string; idPattern: string; scaleKey: string | null; deliverySettings: unknown };
  framework: { name: string; notes: string | null; version: number; config: unknown };
  template: { name: string; notes: string | null; version: number; config: unknown } | null;
  library: { name: string; defaultLanguage: string; languages: string[]; notes: string | null; texts: { kind: string; key: string; levelKey: string; language: string; position: number; title: string | null; text: string; approved: boolean }[] } | null;
}

// Governance of the scorecard configuration (#87): a diff between versions, export and import of
// a whole configuration, copying it to a new season, and a searchable audit log. Every setting
// is already versioned (a published framework or template is locked) and every issued report
// stores the versions it used; this adds the tools to see and carry that history.
@Injectable()
export class GovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async audit(entity: string, code: string | null, action: string, adminId: number | null, summary: Record<string, unknown>) {
    const admin = adminId ? await this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
    await this.prisma.configAuditLog.create({ data: { entity, entityCode: code, action, adminId, adminName: admin?.name ?? null, summary: summary as Prisma.InputJsonValue } });
  }

  // ------------------------------------------------------------------- diff

  private async diffOf(kind: 'framework' | 'template', code: string, against?: string) {
    const find = (c: string) => (kind === 'framework' ? this.prisma.scorecardFramework.findUnique({ where: { code: c } }) : this.prisma.scorecardTemplate.findUnique({ where: { code: c } }));
    const cur = await find(code);
    if (!cur) throw new NotFoundException(`${kind === 'framework' ? 'Framework' : 'Template'} not found`);
    let prevId = against ? undefined : cur.parentId;
    let other = against ? await find(against) : null;
    if (against && !other) throw new NotFoundException('The version to compare with was not found.');
    if (!against) {
      if (!prevId) throw new BadRequestException('This is the first version, so there is nothing to compare it with. Choose a version.');
      other = kind === 'framework' ? await this.prisma.scorecardFramework.findUnique({ where: { id: prevId } }) : await this.prisma.scorecardTemplate.findUnique({ where: { id: prevId } });
    }
    const o = other!;
    const norm = (c: unknown) => (kind === 'framework' ? normalizeConfig(c) : normalizeTemplateConfig(c));
    const changes: Change[] = [];
    if (o.name !== cur.name) changes.push({ path: 'name', kind: 'changed', before: o.name, after: cur.name });
    changes.push(...diffConfig(norm(o.config), norm(cur.config)));
    return {
      from: { code: o.code, name: o.name, version: o.version, status: o.status },
      to: { code: cur.code, name: cur.name, version: cur.version, status: cur.status },
      changes,
    };
  }

  frameworkDiff(code: string, against?: string) {
    return this.diffOf('framework', code, against);
  }

  templateDiff(code: string, against?: string) {
    return this.diffOf('template', code, against);
  }

  // --------------------------------------------------------- export and import

  async exportSeason(code: string, adminId: number | null): Promise<ConfigBundle> {
    const s = await this.prisma.scorecardSeason.findUnique({ where: { code }, include: { framework: true, template: true, library: true } });
    if (!s) throw new NotFoundException('Season not found');
    const texts = s.library ? await this.prisma.scorecardText.findMany({ where: { libraryId: s.library.id }, include: { approvedVersion: true }, orderBy: { id: 'asc' } }) : [];
    const bundle: ConfigBundle = {
      format: BUNDLE_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      season: { name: s.name, editionLabel: s.editionLabel, idPattern: s.idPattern, scaleKey: s.scaleKey, deliverySettings: normalizeDeliverySettings(s.deliverySettings) },
      framework: { name: s.framework.name, notes: s.framework.notes, version: s.framework.version, config: s.framework.config },
      template: s.template ? { name: s.template.name, notes: s.template.notes, version: s.template.version, config: s.template.config } : null,
      library: s.library
        ? {
            name: s.library.name,
            defaultLanguage: s.library.defaultLanguage,
            languages: (s.library.languages as string[]) ?? ['en'],
            notes: s.library.notes,
            texts: texts.map((t) => ({ kind: t.kind, key: t.key, levelKey: t.levelKey, language: t.language, position: t.position, title: t.approvedVersion?.title ?? t.title, text: t.approvedVersion?.text ?? t.draftText, approved: !!t.approvedVersion })),
          }
        : null,
    };
    await this.audit('season', code, 'export', adminId, { framework: s.framework.code, template: s.template?.code ?? null, library: s.library?.code ?? null });
    return bundle;
  }

  /** Reads a bundle and creates a draft framework, a draft template and a library of drafts from it. Nothing is published or approved. */
  async importBundle(bundle: unknown, dryRun: boolean, adminId: number | null) {
    const b = bundle as Partial<ConfigBundle>;
    if (!b || b.format !== BUNDLE_FORMAT || b.version !== 1 || !b.framework) throw new BadRequestException('This is not a scorecard configuration file (expected an export from Scorecard Setup).');
    const problems = [...validateFrameworkConfig(b.framework.config).map((i) => `Framework: ${i}`), ...(b.template ? validateTemplateConfig(b.template.config).map((i) => `Template: ${i}`) : [])];
    const summary = { framework: b.framework.name, template: b.template?.name ?? null, libraryTexts: b.library?.texts.length ?? 0, problems };
    if (dryRun) return { dryRun: true, ...summary };
    const fwCodes = (await this.prisma.scorecardFramework.findMany({ select: { code: true } })).map((c) => c.code);
    const fwCode = nextCode(fwCodes, 'FW');
    await this.prisma.scorecardFramework.create({ data: { code: fwCode, name: `${b.framework.name} (imported)`, status: 'Draft', notes: b.framework.notes, config: b.framework.config as Prisma.InputJsonValue } });
    let tpCode: string | null = null;
    if (b.template) {
      tpCode = nextCode((await this.prisma.scorecardTemplate.findMany({ select: { code: true } })).map((c) => c.code), 'TP');
      await this.prisma.scorecardTemplate.create({ data: { code: tpCode, name: `${b.template.name} (imported)`, status: 'Draft', notes: b.template.notes, config: normalizeTemplateConfig(b.template.config) as unknown as Prisma.InputJsonValue } });
    }
    let clCode: string | null = null;
    if (b.library) {
      clCode = nextCode((await this.prisma.scorecardLibrary.findMany({ select: { code: true } })).map((c) => c.code), 'CL');
      const lib = await this.prisma.scorecardLibrary.create({ data: { code: clCode, name: `${b.library.name} (imported)`, defaultLanguage: b.library.defaultLanguage, languages: b.library.languages as Prisma.InputJsonValue, notes: b.library.notes } });
      const admin = adminId ? await this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
      if (b.library.texts.length) {
        await this.prisma.scorecardText.createMany({
          data: b.library.texts.map((t) => ({ libraryId: lib.id, kind: t.kind, key: t.key, levelKey: t.levelKey, language: t.language, position: t.position, title: t.title, draftText: t.text, updatedById: adminId, updatedByName: admin?.name ?? 'Import' })),
          skipDuplicates: true,
        });
      }
    }
    await this.audit('framework', fwCode, 'import', adminId, { template: tpCode, library: clCode, problems: problems.length });
    return { dryRun: false, ...summary, created: { framework: fwCode, template: tpCode, library: clCode } };
  }

  // ------------------------------------------------------------ next season

  /** A new season on the same published framework and template, with its own copy of the wording (as drafts, to be reviewed and approved). */
  async copySeason(code: string, dto: { name: string; editionLabel: string; year?: number }, adminId: number | null) {
    const s = await this.prisma.scorecardSeason.findUnique({ where: { code }, include: { library: true } });
    if (!s) throw new NotFoundException('Season not found');
    let libraryId: number | null = null;
    let libraryCode: string | null = null;
    if (s.library) {
      libraryCode = nextCode((await this.prisma.scorecardLibrary.findMany({ select: { code: true } })).map((c) => c.code), 'CL');
      const lib = await this.prisma.scorecardLibrary.create({ data: { code: libraryCode, name: `${dto.name} wording`, defaultLanguage: s.library.defaultLanguage, languages: s.library.languages as Prisma.InputJsonValue, notes: `Copied from ${s.library.code}. Review and approve before use.` } });
      libraryId = lib.id;
      const texts = await this.prisma.scorecardText.findMany({ where: { libraryId: s.library.id } });
      if (texts.length) {
        await this.prisma.scorecardText.createMany({ data: texts.map((t) => ({ libraryId: lib.id, kind: t.kind, key: t.key, levelKey: t.levelKey, language: t.language, position: t.position, title: t.title, draftText: t.draftText })) });
      }
    }
    const newCode = nextCode((await this.prisma.scorecardSeason.findMany({ select: { code: true } })).map((c) => c.code), 'SE');
    await this.prisma.scorecardSeason.create({
      data: {
        code: newCode,
        name: dto.name.trim(),
        editionLabel: dto.editionLabel.trim(),
        idPattern: s.idPattern,
        year: dto.year ?? (s.year ? s.year + 1 : null),
        frameworkId: s.frameworkId,
        scaleKey: s.scaleKey,
        libraryId,
        templateId: s.templateId,
        deliverySettings: s.deliverySettings as Prisma.InputJsonValue,
        active: true,
      },
    });
    await this.audit('season', newCode, 'copy', adminId, { from: code, library: libraryCode });
    return { season: newCode, library: libraryCode, note: libraryCode ? 'The wording was copied as drafts: review and approve it before reports use it.' : null };
  }

  // -------------------------------------------------------------------- audit

  async auditSearch(q: { entity?: string; code?: string; action?: string; admin?: string; from?: string; to?: string; limit?: number; offset?: number }) {
    const where: Prisma.ConfigAuditLogWhereInput = {};
    if (q.entity) where.entity = q.entity;
    if (q.code) where.entityCode = q.code;
    if (q.action) where.action = q.action;
    if (q.admin) where.adminName = { contains: q.admin, mode: 'insensitive' };
    if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
    const [total, items, entities, actions] = await Promise.all([
      this.prisma.configAuditLog.count({ where }),
      this.prisma.configAuditLog.findMany({ where, orderBy: { id: 'desc' }, take: Math.min(q.limit ?? 50, 200), skip: Math.max(0, q.offset ?? 0) }),
      this.prisma.configAuditLog.groupBy({ by: ['entity'], _count: { _all: true } }),
      this.prisma.configAuditLog.groupBy({ by: ['action'], _count: { _all: true } }),
    ]);
    return { total, items, entities: entities.map((e) => e.entity).sort(), actions: actions.map((a) => a.action).sort() };
  }
}
