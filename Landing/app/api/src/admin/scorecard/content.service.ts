import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { nextCode } from '../../common/util';
import { parseCsv, toCsv } from '../../common/csv.util';
import { FrameworkConfig, normalizeConfig } from '../../common/scorecard-config';
import { normalizeRollup } from '../../common/rollup-rules';
import {
  ApprovedText,
  ContentIndex,
  PLACEHOLDERS,
  TEXT_KINDS,
  TextKind,
  WILDCARD,
  buildIndex,
  kindByKey,
  renderTemplate,
  resolveList,
  resolveText,
  textId,
  validateTemplate,
} from '../../common/content-library';
import { CreateLibraryDto, ImportTextsDto, PatchLibraryDto, PreviewTemplateDto, PreviewTextDto, SaveTextDto } from './content.dto';

const LANGUAGE_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
const KEY_RE = /^[A-Z0-9_]+$/;

type TextRow = Prisma.ScorecardTextGetPayload<{ include: { approvedVersion: true } }>;

/** How a text stands: never approved, approved and unchanged, edited since approval, or approval withdrawn. */
export type TextState = 'draft' | 'approved' | 'changed' | 'withdrawn';

// The wording the scorecard reports use (#72): libraries of text items, each with a
// draft and immutable approved versions. Reports read only approved text; the editor
// reads and writes drafts. Everything an admin changes is written to the audit log.
@Injectable()
export class ScorecardContentService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ helpers

  private async admin(adminId: number | null) {
    return adminId ? this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
  }

  private async audit(entityCode: string | null, action: string, adminId: number | null, summary: Record<string, unknown> = {}) {
    const admin = await this.admin(adminId);
    await this.prisma.configAuditLog.create({
      data: { entity: 'library', entityCode, action, adminId, adminName: admin?.name ?? null, summary: summary as Prisma.InputJsonValue },
    });
  }

  private async libraryByCode(code: string) {
    const lib = await this.prisma.scorecardLibrary.findUnique({ where: { code } });
    if (!lib) throw new NotFoundException('Library not found');
    return lib;
  }

  private languagesOf(lib: { languages: unknown; defaultLanguage: string }): string[] {
    const raw = Array.isArray(lib.languages) ? (lib.languages as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    return raw.includes(lib.defaultLanguage) ? raw : [lib.defaultLanguage, ...raw];
  }

  private stateOf(t: TextRow, versioned: Set<number>): TextState {
    if (!t.approvedVersion) return versioned.has(t.id) ? 'withdrawn' : 'draft';
    const same = t.approvedVersion.text === t.draftText && (t.approvedVersion.title ?? null) === (t.title ?? null);
    return same ? 'approved' : 'changed';
  }

  // Ids of texts with at least one version, so "never approved" can be told from "withdrawn".
  private async versionedIds(libraryId: number): Promise<Set<number>> {
    const rows = await this.prisma.scorecardTextVersion.findMany({ where: { textRow: { libraryId } }, select: { textId: true }, distinct: ['textId'] });
    return new Set(rows.map((r) => r.textId));
  }

  private shapeText(t: TextRow, versioned: Set<number>) {
    return {
      id: t.id,
      kind: t.kind,
      key: t.key,
      levelKey: t.levelKey,
      language: t.language,
      position: t.position,
      title: t.title,
      text: t.draftText,
      state: this.stateOf(t, versioned),
      approvedVersion: t.approvedVersion ? t.approvedVersion.version : null,
      approvedText: t.approvedVersion ? t.approvedVersion.text : null,
      approvedTitle: t.approvedVersion ? t.approvedVersion.title : null,
      approvedAt: t.approvedVersion ? t.approvedVersion.approvedAt : null,
      approvedByName: t.approvedVersion ? t.approvedVersion.approvedByName : null,
      updatedByName: t.updatedByName,
      updatedAt: t.updatedAt,
    };
  }

  /** The approved wording of a library, ready for the resolver. */
  async approvedIndex(libraryId: number): Promise<ContentIndex> {
    const rows = await this.prisma.scorecardText.findMany({ where: { libraryId, approvedVersionId: { not: null } }, include: { approvedVersion: true } });
    return buildIndex(rows.filter((r) => r.approvedVersion).map((r) => this.toApproved(r.kind, r.key, r.levelKey, r.language, r.position, r.approvedVersion!.title, r.approvedVersion!.text, r.approvedVersion!.version)));
  }

  async draftIndex(libraryId: number): Promise<ContentIndex> {
    const rows = await this.prisma.scorecardText.findMany({ where: { libraryId } });
    return buildIndex(rows.map((r) => this.toApproved(r.kind, r.key, r.levelKey, r.language, r.position, r.title, r.draftText, 0)));
  }

  private toApproved(kind: string, key: string, levelKey: string, language: string, position: number, title: string | null, text: string, version: number): ApprovedText {
    return { kind, key, levelKey, language, position, title, text, version };
  }

  // ---------------------------------------------------------------- meta

  meta() {
    return { kinds: TEXT_KINDS, placeholders: PLACEHOLDERS, wildcard: WILDCARD };
  }

  // ------------------------------------------------------------- libraries

  private shapeLibrary(
    lib: Awaited<ReturnType<ScorecardContentService['libraryByCode']>>,
    counts: { total: number; approved: number; changed: number; draft: number },
    seasons: { code: string; name: string }[],
  ) {
    return {
      code: lib.code,
      name: lib.name,
      notes: lib.notes,
      defaultLanguage: lib.defaultLanguage,
      languages: this.languagesOf(lib),
      createdAt: lib.createdAt,
      updatedAt: lib.updatedAt,
      counts,
      seasons,
    };
  }

  private async countsFor(libraryId: number) {
    const versioned = await this.versionedIds(libraryId);
    const rows = await this.prisma.scorecardText.findMany({ where: { libraryId }, include: { approvedVersion: true } });
    const states = rows.map((r) => this.stateOf(r, versioned));
    return {
      total: rows.length,
      approved: states.filter((s) => s === 'approved').length,
      changed: states.filter((s) => s === 'changed').length,
      draft: states.filter((s) => s === 'draft' || s === 'withdrawn').length,
    };
  }

  async listLibraries() {
    const libs = await this.prisma.scorecardLibrary.findMany({ orderBy: { id: 'asc' }, include: { seasons: { select: { code: true, name: true } } } });
    const out: ReturnType<ScorecardContentService["shapeLibrary"]>[] = [];
    for (const lib of libs) out.push(this.shapeLibrary(lib, await this.countsFor(lib.id), lib.seasons));
    return out;
  }

  async getLibrary(code: string) {
    const lib = await this.prisma.scorecardLibrary.findUnique({ where: { code }, include: { seasons: { select: { code: true, name: true } } } });
    if (!lib) throw new NotFoundException('Library not found');
    return this.shapeLibrary(lib, await this.countsFor(lib.id), lib.seasons);
  }

  private checkLanguages(defaultLanguage: string, languages: string[]) {
    for (const l of languages) {
      if (!LANGUAGE_RE.test(l)) throw new BadRequestException(`"${l}" is not a language code. Use a short code such as en or hi.`);
    }
    if (new Set(languages).size !== languages.length) throw new BadRequestException('A language is listed twice.');
    if (!languages.includes(defaultLanguage)) throw new BadRequestException('The default language must be one of the languages.');
  }

  async createLibrary(dto: CreateLibraryDto, adminId: number | null) {
    const defaultLanguage = (dto.defaultLanguage || 'en').trim();
    const languages = (dto.languages?.length ? dto.languages : [defaultLanguage]).map((l) => l.trim());
    this.checkLanguages(defaultLanguage, languages);
    const codes = (await this.prisma.scorecardLibrary.findMany({ select: { code: true } })).map((c) => c.code);
    const code = nextCode(codes, 'CL');
    const src = dto.cloneFrom ? await this.libraryByCode(dto.cloneFrom) : null;
    const lib = await this.prisma.scorecardLibrary.create({
      data: { code, name: dto.name.trim(), notes: dto.notes?.trim() || null, defaultLanguage, languages },
    });
    let copied = 0;
    if (src) {
      const texts = await this.prisma.scorecardText.findMany({ where: { libraryId: src.id } });
      const admin = await this.admin(adminId);
      const keep = new Set(languages);
      const rows = texts.filter((t) => keep.has(t.language));
      if (rows.length) {
        await this.prisma.scorecardText.createMany({
          data: rows.map((t) => ({
            libraryId: lib.id,
            kind: t.kind,
            key: t.key,
            levelKey: t.levelKey,
            language: t.language,
            position: t.position,
            title: t.title,
            draftText: t.draftText,
            updatedById: adminId,
            updatedByName: admin?.name ?? null,
          })),
        });
        copied = rows.length;
      }
    }
    await this.audit(code, 'create', adminId, { name: lib.name, ...(src ? { cloneFrom: src.code, copied } : {}) });
    return this.getLibrary(code);
  }

  async updateLibrary(code: string, dto: PatchLibraryDto, adminId: number | null) {
    const lib = await this.libraryByCode(code);
    const data: Prisma.ScorecardLibraryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    if (dto.defaultLanguage !== undefined || dto.languages !== undefined) {
      const defaultLanguage = (dto.defaultLanguage ?? lib.defaultLanguage).trim();
      const languages = (dto.languages ?? this.languagesOf(lib)).map((l) => l.trim());
      this.checkLanguages(defaultLanguage, languages);
      const used = await this.prisma.scorecardText.groupBy({ by: ['language'], where: { libraryId: lib.id }, _count: { _all: true } });
      const dropped = used.filter((u) => !languages.includes(u.language));
      if (dropped.length) {
        throw new BadRequestException(`There is wording in ${dropped.map((d) => d.language).join(', ')}. Delete it before removing the language.`);
      }
      data.defaultLanguage = defaultLanguage;
      data.languages = languages;
    }
    await this.prisma.scorecardLibrary.update({ where: { id: lib.id }, data });
    await this.audit(code, 'update', adminId, { fields: Object.keys(dto) });
    return this.getLibrary(code);
  }

  async deleteLibrary(code: string, adminId: number | null) {
    const lib = await this.libraryByCode(code);
    if (await this.prisma.scorecardSeason.count({ where: { libraryId: lib.id } })) {
      throw new BadRequestException('A season uses this library. Move the season to another library first.');
    }
    await this.prisma.scorecardLibrary.delete({ where: { id: lib.id } });
    await this.audit(code, 'delete', adminId, { name: lib.name });
    return { ok: true };
  }

  // ----------------------------------------------------------------- texts

  async listTexts(code: string, q: { kind?: string; language?: string; key?: string; state?: string; search?: string }) {
    const lib = await this.libraryByCode(code);
    const versioned = await this.versionedIds(lib.id);
    const where: Prisma.ScorecardTextWhereInput = { libraryId: lib.id };
    if (q.kind) where.kind = q.kind;
    if (q.language) where.language = q.language;
    if (q.key) where.key = q.key;
    const rows = await this.prisma.scorecardText.findMany({
      where,
      include: { approvedVersion: true },
      orderBy: [{ kind: 'asc' }, { key: 'asc' }, { levelKey: 'asc' }, { language: 'asc' }, { position: 'asc' }],
    });
    let items = rows.map((r) => this.shapeText(r, versioned));
    if (q.state) items = items.filter((i) => i.state === q.state);
    if (q.search) {
      const needle = q.search.toLowerCase();
      items = items.filter((i) => `${i.title ?? ''} ${i.text} ${i.key}`.toLowerCase().includes(needle));
    }
    return { total: items.length, items };
  }

  /** Checks one text against its kind. Returns the normalised address and any problem. */
  private normalise(lib: { defaultLanguage: string; languages: unknown }, dto: { kind: string; key?: string; levelKey?: string; language?: string; position?: number; title?: string; text: string }) {
    const kind = kindByKey(dto.kind) as TextKind | undefined;
    if (!kind) throw new BadRequestException(`"${dto.kind}" is not a kind of text.`);
    const language = (dto.language || lib.defaultLanguage).trim();
    if (!this.languagesOf(lib as { languages: unknown; defaultLanguage: string }).includes(language)) {
      throw new BadRequestException(`"${language}" is not a language of this library. Add it in the library settings first.`);
    }
    let key = (dto.key ?? '').trim();
    if (kind.scope === 'none') {
      if (key) throw new BadRequestException(`${kind.label} is not written per competency or dimension, so leave the key empty.`);
    } else {
      key = key === WILDCARD ? key : key.toUpperCase();
      if (!key) throw new BadRequestException(`${kind.label} needs ${kind.scope === 'stage' ? 'a stage number' : `a ${kind.scope}`} (or * for the default).`);
      if (kind.scope === 'stage' ? key !== WILDCARD && !/^\d{1,2}$/.test(key) : key !== WILDCARD && !KEY_RE.test(key)) {
        throw new BadRequestException(kind.scope === 'stage' ? 'A stage key is its position number (1, 2, 3 ...) or *.' : `"${key}" is not a valid key. Use capital letters, digits and underscores, or *.`);
      }
    }
    let levelKey = (dto.levelKey ?? '').trim().toUpperCase();
    if (!kind.byLevel && levelKey) throw new BadRequestException(`${kind.label} is not written by level, so leave the level empty.`);
    if (levelKey && !KEY_RE.test(levelKey)) throw new BadRequestException(`"${levelKey}" is not a valid level key.`);
    let position = dto.position ?? 0;
    if (kind.ordered) {
      if (position < 1) throw new BadRequestException(`${kind.label} is a list, so give each item a position (1, 2, 3 ...).`);
    } else position = 0;
    const title = kind.titled ? (dto.title ?? '').trim() || null : null;
    if (!kind.titled && dto.title?.trim()) throw new BadRequestException(`${kind.label} has no title.`);
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('The text is empty.');
    const problems = [...validateTemplate(text), ...(title ? validateTemplate(title) : [])];
    if (problems.length) throw new BadRequestException(problems.join(' '));
    levelKey = kind.byLevel ? levelKey : '';
    return { kind: kind.key, key, levelKey, language, position, title, text };
  }

  async saveText(code: string, dto: SaveTextDto, adminId: number | null) {
    const lib = await this.libraryByCode(code);
    const n = this.normalise(lib, dto);
    const admin = await this.admin(adminId);
    const where = { libraryId_kind_key_levelKey_language_position: { libraryId: lib.id, kind: n.kind, key: n.key, levelKey: n.levelKey, language: n.language, position: n.position } };
    const existed = await this.prisma.scorecardText.findUnique({ where, select: { id: true } });
    const row = await this.prisma.scorecardText.upsert({
      where,
      create: { libraryId: lib.id, kind: n.kind, key: n.key, levelKey: n.levelKey, language: n.language, position: n.position, title: n.title, draftText: n.text, updatedById: adminId, updatedByName: admin?.name ?? null },
      update: { title: n.title, draftText: n.text, updatedById: adminId, updatedByName: admin?.name ?? null },
    });
    await this.audit(code, existed ? 'text_update' : 'text_create', adminId, { id: row.id, kind: n.kind, key: n.key, level: n.levelKey, language: n.language, position: n.position });
    return this.getText(code, row.id);
  }

  private async textRow(code: string, id: number) {
    const lib = await this.libraryByCode(code);
    const t = await this.prisma.scorecardText.findFirst({ where: { id, libraryId: lib.id }, include: { approvedVersion: true } });
    if (!t) throw new NotFoundException('Text not found');
    return { lib, t, versioned: await this.versionedIds(lib.id) };
  }

  async getText(code: string, id: number) {
    const { t, versioned } = await this.textRow(code, id);
    return this.shapeText(t, versioned);
  }

  async deleteText(code: string, id: number, adminId: number | null) {
    const { t, versioned } = await this.textRow(code, id);
    if (versioned.has(t.id)) {
      throw new BadRequestException('This wording has been approved before, so it is kept for the record. Withdraw its approval instead.');
    }
    await this.prisma.scorecardText.delete({ where: { id: t.id } });
    await this.audit(code, 'text_delete', adminId, { kind: t.kind, key: t.key, level: t.levelKey, language: t.language, position: t.position });
    return { ok: true };
  }

  private async approveRow(t: TextRow, versioned: Set<number>, adminId: number | null, adminName: string | null, note?: string) {
    if (this.stateOf(t, versioned) === 'approved') return null;
    const last = await this.prisma.scorecardTextVersion.aggregate({ where: { textId: t.id }, _max: { version: true } });
    const version = (last._max.version ?? 0) + 1;
    const v = await this.prisma.scorecardTextVersion.create({
      data: { textId: t.id, version, title: t.title, text: t.draftText, approvedById: adminId, approvedByName: adminName, note: note?.trim() || null },
    });
    await this.prisma.scorecardText.update({ where: { id: t.id }, data: { approvedVersionId: v.id } });
    return version;
  }

  async approve(code: string, id: number, note: string | undefined, adminId: number | null) {
    const { t, versioned } = await this.textRow(code, id);
    const admin = await this.admin(adminId);
    const version = await this.approveRow(t, versioned, adminId, admin?.name ?? null, note);
    if (version === null) throw new BadRequestException('Nothing has changed since the approved version.');
    await this.audit(code, 'text_approve', adminId, { id: t.id, kind: t.kind, key: t.key, level: t.levelKey, language: t.language, version, note: note ?? null });
    return this.getText(code, id);
  }

  async approveAll(code: string, q: { kind?: string; language?: string; note?: string }, adminId: number | null) {
    const lib = await this.libraryByCode(code);
    const versioned = await this.versionedIds(lib.id);
    const where: Prisma.ScorecardTextWhereInput = { libraryId: lib.id };
    if (q.kind) where.kind = q.kind;
    if (q.language) where.language = q.language;
    const rows = await this.prisma.scorecardText.findMany({ where, include: { approvedVersion: true } });
    const admin = await this.admin(adminId);
    let approved = 0;
    for (const t of rows) {
      if ((await this.approveRow(t, versioned, adminId, admin?.name ?? null, q.note)) !== null) approved++;
    }
    await this.audit(code, 'bulk_approve', adminId, { approved, kind: q.kind ?? null, language: q.language ?? null, note: q.note ?? null });
    return { approved };
  }

  /** Puts the approved wording back as the draft. */
  async revert(code: string, id: number, adminId: number | null) {
    const { t } = await this.textRow(code, id);
    if (!t.approvedVersion) throw new BadRequestException('There is no approved version to go back to.');
    const admin = await this.admin(adminId);
    await this.prisma.scorecardText.update({
      where: { id: t.id },
      data: { draftText: t.approvedVersion.text, title: t.approvedVersion.title, updatedById: adminId, updatedByName: admin?.name ?? null },
    });
    await this.audit(code, 'text_revert', adminId, { id: t.id, kind: t.kind, key: t.key, version: t.approvedVersion.version });
    return this.getText(code, id);
  }

  /** Stops reports using this wording. Earlier versions stay on record; approving again makes a new version. */
  async withdraw(code: string, id: number, adminId: number | null) {
    const { t } = await this.textRow(code, id);
    if (!t.approvedVersionId) throw new BadRequestException('This wording is not approved.');
    await this.prisma.scorecardText.update({ where: { id: t.id }, data: { approvedVersionId: null } });
    await this.audit(code, 'text_withdraw', adminId, { id: t.id, kind: t.kind, key: t.key, level: t.levelKey, language: t.language, version: t.approvedVersion?.version ?? null });
    return this.getText(code, id);
  }

  async versions(code: string, id: number) {
    const { t } = await this.textRow(code, id);
    const rows = await this.prisma.scorecardTextVersion.findMany({ where: { textId: t.id }, orderBy: { version: 'desc' } });
    return rows.map((v) => ({
      version: v.version,
      title: v.title,
      text: v.text,
      approvedAt: v.approvedAt,
      approvedByName: v.approvedByName,
      note: v.note,
      live: v.id === t.approvedVersionId,
    }));
  }

  // ------------------------------------------------------------ CSV in/out

  async exportCsv(code: string, language?: string) {
    const lib = await this.libraryByCode(code);
    const rows = await this.prisma.scorecardText.findMany({
      where: { libraryId: lib.id, ...(language ? { language } : {}) },
      orderBy: [{ kind: 'asc' }, { key: 'asc' }, { levelKey: 'asc' }, { language: 'asc' }, { position: 'asc' }],
    });
    return toCsv([['kind', 'key', 'level', 'language', 'position', 'title', 'text'], ...rows.map((r) => [r.kind, r.key, r.levelKey, r.language, r.position, r.title ?? '', r.draftText])]);
  }

  /** Reads a CSV into drafts (never approves). Reports every row problem; with dryRun nothing is saved. */
  async importCsv(code: string, dto: ImportTextsDto, adminId: number | null) {
    const lib = await this.libraryByCode(code);
    const rows = parseCsv(dto.csv).filter((r) => r.some((c) => c.trim() !== ''));
    if (rows.length < 2) throw new BadRequestException('The file has no rows. The first row must be the headings: kind, key, level, language, position, title, text.');
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (n: string) => head.indexOf(n);
    for (const need of ['kind', 'text']) if (col(need) < 0) throw new BadRequestException(`The file has no "${need}" column.`);
    const get = (r: string[], n: string) => (col(n) >= 0 ? (r[col(n)] ?? '').trim() : '');
    const errors: { row: number; message: string }[] = [];
    const parsed: ReturnType<ScorecardContentService['normalise']>[] = [];
    const seen = new Set<string>();
    rows.slice(1).forEach((r, i) => {
      const rowNo = i + 2;
      try {
        const posRaw = get(r, 'position');
        const n = this.normalise(lib, {
          kind: get(r, 'kind'),
          key: get(r, 'key'),
          levelKey: get(r, 'level'),
          language: get(r, 'language') || undefined,
          position: posRaw ? Number(posRaw) : 0,
          title: get(r, 'title') || undefined,
          text: r[col('text')] ?? '',
        });
        if (posRaw && !Number.isInteger(Number(posRaw))) throw new BadRequestException('The position must be a whole number.');
        const id = textId(n.kind, n.key, n.levelKey, n.language, n.position);
        if (seen.has(id)) throw new BadRequestException('This kind, key, level, language and position appears twice in the file.');
        seen.add(id);
        parsed.push(n);
      } catch (e) {
        errors.push({ row: rowNo, message: e instanceof BadRequestException ? String((e.getResponse() as { message?: string }).message ?? e.message) : 'Could not read this row.' });
      }
    });
    const existing = await this.prisma.scorecardText.findMany({ where: { libraryId: lib.id }, select: { kind: true, key: true, levelKey: true, language: true, position: true, draftText: true, title: true } });
    const byId = new Map(existing.map((e) => [textId(e.kind, e.key, e.levelKey, e.language, e.position), e]));
    const toCreate = parsed.filter((p) => !byId.has(textId(p.kind, p.key, p.levelKey, p.language, p.position)));
    const toUpdate = parsed.filter((p) => {
      const e = byId.get(textId(p.kind, p.key, p.levelKey, p.language, p.position));
      return e && (e.draftText !== p.text || (e.title ?? null) !== p.title);
    });
    const unchanged = parsed.length - toCreate.length - toUpdate.length;
    const result = { dryRun: !!dto.dryRun, rows: rows.length - 1, created: toCreate.length, updated: toUpdate.length, unchanged, errors };
    if (dto.dryRun) return result;
    if (errors.length) throw new BadRequestException({ message: `${errors.length} row(s) have problems. Nothing was imported.`, ...result });
    const admin = await this.admin(adminId);
    await this.prisma.$transaction(async (tx) => {
      for (const p of [...toCreate, ...toUpdate]) {
        const where = { libraryId_kind_key_levelKey_language_position: { libraryId: lib.id, kind: p.kind, key: p.key, levelKey: p.levelKey, language: p.language, position: p.position } };
        await tx.scorecardText.upsert({
          where,
          create: { libraryId: lib.id, kind: p.kind, key: p.key, levelKey: p.levelKey, language: p.language, position: p.position, title: p.title, draftText: p.text, updatedById: adminId, updatedByName: admin?.name ?? null },
          update: { title: p.title, draftText: p.text, updatedById: adminId, updatedByName: admin?.name ?? null },
        });
      }
    });
    await this.audit(code, 'import', adminId, { created: toCreate.length, updated: toUpdate.length, unchanged });
    return result;
  }

  // -------------------------------------------------------------- coverage

  /**
   * Which wording exists for a framework: for every kind, every competency / dimension
   * (and level) it would be needed for, and whether it is approved, only a draft, or
   * missing (so a report would show the default or a gap).
   */
  async coverage(code: string, frameworkCode: string, languageArg?: string) {
    const lib = await this.libraryByCode(code);
    const fw = await this.prisma.scorecardFramework.findUnique({ where: { code: frameworkCode } });
    if (!fw) throw new NotFoundException('Framework not found');
    const config: FrameworkConfig = normalizeConfig(fw.config);
    const language = languageArg || lib.defaultLanguage;
    const scale = config.scales.find((s) => s.key === config.defaultScale) ?? config.scales[0];
    const levels = scale?.levels ?? [];
    const approved = await this.approvedIndex(lib.id);
    const drafts = await this.draftIndex(lib.id);
    // A framework does not list its stages, so use those its competencies are named for plus any the library already has wording for.
    const written = await this.prisma.scorecardText.findMany({ where: { libraryId: lib.id, kind: { in: TEXT_KINDS.filter((k) => k.scope === 'stage').map((k) => k.key) } }, select: { key: true }, distinct: ['key'] });
    const stageKeys = [...new Set([...config.competencies.flatMap((c) => Object.keys(c.stageNames ?? {})), ...written.map((w) => w.key).filter((k) => /^\d+$/.test(k))])].sort((a, b) => Number(a) - Number(b));

    type Cell = { key: string; keyLabel: string; level: string; levelLabel: string; state: 'approved' | 'default' | 'draft' | 'missing'; position?: number };
    const kinds = TEXT_KINDS.map((kind) => {
      const subjects: { key: string; label: string }[] =
        kind.scope === 'competency' ? config.competencies.map((c) => ({ key: c.key, label: c.name }))
        : kind.scope === 'dimension' ? config.dimensions.map((d) => ({ key: d.key, label: d.label }))
        : kind.scope === 'stage' ? stageKeys.map((s) => ({ key: s, label: `Stage ${s}` }))
        : kind.scope === 'style' ? normalizeRollup(config.rollup).styles.map((x) => ({ key: x.key, label: x.name }))
        : [{ key: '', label: '' }];
      const lvls = kind.byLevel ? levels.map((l) => ({ key: l.key, label: l.label })) : [{ key: '', label: '' }];
      const cells: Cell[] = [];
      for (const s of subjects) {
        for (const l of lvls) {
          let state: Cell['state'];
          if (kind.ordered) {
            const a = resolveList(approved, { kind: kind.key, key: s.key, language, defaultLanguage: lib.defaultLanguage });
            const d = resolveList(drafts, { kind: kind.key, key: s.key, language, defaultLanguage: lib.defaultLanguage });
            state = a.items.length ? 'approved' : d.items.length ? 'draft' : 'missing';
          } else {
            const q = { kind: kind.key, key: s.key, level: l.key, language, defaultLanguage: lib.defaultLanguage };
            const a = resolveText(approved, q);
            const d = resolveText(drafts, q);
            state = a.item ? (a.source === 'exact' ? 'approved' : 'default') : d.item ? 'draft' : 'missing';
          }
          cells.push({ key: s.key, keyLabel: s.label, level: l.key, levelLabel: l.label, state });
        }
      }
      const count = (st: Cell['state']) => cells.filter((c) => c.state === st).length;
      return {
        kind: kind.key,
        label: kind.label,
        scope: kind.scope,
        byLevel: kind.byLevel,
        ordered: kind.ordered,
        cells,
        approved: count('approved'),
        defaulted: count('default'),
        draft: count('draft'),
        missing: count('missing'),
      };
    });
    return {
      library: lib.code,
      framework: { code: fw.code, name: fw.name, version: fw.version, status: fw.status },
      language,
      scale: scale ? { key: scale.key, name: scale.name } : null,
      kinds,
    };
  }

  // --------------------------------------------------------------- preview

  /** What a report would show for one piece of wording, with a flag when it fell back to a default or is missing. */
  async preview(code: string, dto: PreviewTextDto) {
    const lib = await this.libraryByCode(code);
    const kind = kindByKey(dto.kind);
    if (!kind) throw new BadRequestException(`"${dto.kind}" is not a kind of text.`);
    const language = dto.language || lib.defaultLanguage;
    const index = dto.draft ? await this.draftIndex(lib.id) : await this.approvedIndex(lib.id);
    const ctx = {
      name: dto.name || 'Aarav Mehta',
      gender: dto.gender || null,
      dimension: dto.dimension || null,
      competency: dto.competency || null,
      level: dto.levelLabel || null,
      edition: dto.edition || null,
      stage: dto.stage || null,
      competition: dto.competition || null,
    };
    const base = { kind: kind.key, key: (dto.key ?? '').toUpperCase() === WILDCARD ? WILDCARD : (dto.key ?? '').toUpperCase(), level: (dto.level ?? '').toUpperCase(), language, defaultLanguage: lib.defaultLanguage };
    const fallbackNote = (source: string) =>
      source === 'exact' ? null
      : source === 'default' ? 'Using the default wording; nothing specific is written for this competency or level.'
      : source === 'language_fallback' ? `Not written in ${language} yet; showing ${lib.defaultLanguage}.`
      : source === 'default_language_fallback' ? `Using the default wording in ${lib.defaultLanguage}.`
      : 'Nothing is written for this. The report would show a gap.';
    if (kind.ordered) {
      const r = resolveList(index, base);
      const items = r.items.map((i) => ({ position: i.position, title: i.title ? renderTemplate(i.title, ctx).text : null, ...renderTemplate(i.text, ctx) }));
      return { source: r.source, note: fallbackNote(r.source), approvedOnly: !dto.draft, items };
    }
    const r = resolveText(index, { ...base, position: dto.position ?? 0 });
    if (!r.item) return { source: r.source, note: fallbackNote(r.source), approvedOnly: !dto.draft, item: null };
    const text = renderTemplate(r.item.text, ctx);
    return {
      source: r.source,
      note: fallbackNote(r.source),
      approvedOnly: !dto.draft,
      item: { title: r.item.title ? renderTemplate(r.item.title, ctx).text : null, text: text.text, missing: text.missing, version: r.item.version || null, key: r.item.key, level: r.item.levelKey },
    };
  }

  /** Renders any template text typed in the editor, before it is saved. */
  previewTemplate(body: PreviewTemplateDto) {
    const problems = validateTemplate(body.text ?? '');
    const r = renderTemplate(body.text ?? '', {
      name: body.name || 'Aarav Mehta',
      gender: body.gender || null,
      dimension: body.dimension || null,
      competency: body.competency || null,
      level: body.levelLabel || null,
      edition: body.edition || null,
      stage: body.stage || null,
      competition: body.competition || null,
    });
    return { problems, text: r.text, missing: r.missing };
  }
}
