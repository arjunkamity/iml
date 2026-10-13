import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Browser } from 'playwright';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ListQueryDto } from '../../common/list-query.dto';
import { StageReportService } from './stage-report.service';
import { FinalProfileService } from './final-profile.service';
import { ScorecardContentService } from './content.service';
import { StageReportInput, buildStageDocument, renderReportHtml } from '../../common/report-document';
import { Audience, linkState, releaseState, variantAudiences, visibleReport } from '../../common/report-access';
import { normalizeTemplateConfig, validateTemplateConfig } from '../../common/report-template';
import { qrDataUrl, newVerificationCode, renderReportPdf, sha256, verificationUrl } from '../../scorecard/report-renderer';
import { GenerateReportsDto } from './template.dto';

export const MAX_REPORT_ATTEMPTS = 3;

interface Resolved {
  template: { code: string; version: number; status: string; config: unknown };
  library: { id: number; code: string; defaultLanguage: string };
}

// Scorecard report generation (#73): builds the report for a student and stage from the
// stage data, the season's approved wording and its template, previews it, and queues
// real PDFs. The queue itself is ScorecardReportQueueService; this class holds the work.
@Injectable()
export class ScorecardReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stageReports: StageReportService,
    private readonly content: ScorecardContentService,
    private readonly finalProfile: FinalProfileService,
  ) {}

  private async audit(entityCode: string, action: string, adminId: number | null, summary: Record<string, unknown>) {
    const admin = adminId ? await this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
    await this.prisma.configAuditLog.create({
      data: { entity: 'report', entityCode, action, adminId, adminName: admin?.name ?? null, summary: summary as Prisma.InputJsonValue },
    });
  }

  // ------------------------------------------------------------- resolution

  /**
   * The template and wording library a competition's reports use: its season's, or (for a
   * preview) ones named explicitly, drafts included. A real PDF only ever uses a published template.
   */
  private async resolve(competitionCode: string, over: { templateCode?: string; libraryCode?: string } = {}, preview = false): Promise<Resolved> {
    const competition = await this.prisma.competition.findUnique({ where: { code: competitionCode }, include: { season: { include: { template: true, library: true } } } });
    if (!competition) throw new NotFoundException('Competition not found');
    const season = competition.season;
    const template = over.templateCode ? await this.prisma.scorecardTemplate.findUnique({ where: { code: over.templateCode } }) : season?.template ?? null;
    if (over.templateCode && !template) throw new NotFoundException('Template not found');
    const library = over.libraryCode ? await this.prisma.scorecardLibrary.findUnique({ where: { code: over.libraryCode } }) : season?.library ?? null;
    if (over.libraryCode && !library) throw new NotFoundException('Content library not found');
    if (!template) throw new BadRequestException('No report template is chosen. Pick a template for this competition’s season in Scorecard Setup' + (preview ? ', or choose one to preview with.' : '.'));
    if (!library) throw new BadRequestException('No content library is chosen. Pick one for this competition’s season in Scorecard Setup' + (preview ? ', or choose one to preview with.' : '.'));
    if (!preview && template.status === 'Draft') throw new BadRequestException(`Template ${template.code} is still a draft. Publish it before generating reports.`);
    return { template, library };
  }

  // ----------------------------------------------------------------- build

  /** Builds one student's report document (and its HTML). Throws a plain message if the student has no finished attempt. */
  async build(
    competitionCode: string,
    stage: number,
    studentCode: string,
    opts: { templateCode?: string; libraryCode?: string; frameworkCode?: string; draft?: boolean; preview?: boolean; audience?: Audience; verification?: { code: string; url: string; qrDataUrl: string } } = {},
  ) {
    const resolved = await this.resolve(competitionCode, opts, !!opts.preview);
    if (stage === 0) return this.buildFull(competitionCode, studentCode, opts, resolved);
    const data = await this.stageReports.studentReport(competitionCode, stage, studentCode, opts.frameworkCode);
    if (data.status !== 'ready' || !data.report || !data.student) {
      throw new BadRequestException(data.status === 'in_progress' ? 'This student has not finished the stage yet.' : 'This student has not taken this stage.');
    }
    const config = normalizeTemplateConfig(resolved.template.config);
    if (!config.branding.logoUrl) {
      // no logo in the template: use the IML logo from Site Settings
      const site = await this.prisma.siteSetting.findUnique({ where: { id: 1 }, select: { certImlLogoUrl: true } });
      if (site?.certImlLogoUrl) config.branding.logoUrl = site.certImlLogoUrl;
    }
    const index = opts.draft ? await this.content.draftIndex(resolved.library.id) : await this.content.approvedIndex(resolved.library.id);
    const input: StageReportInput = {
      student: { code: data.student.code, name: data.student.name, grade: data.student.grade, school: data.student.school, gender: data.student.gender },
      competition: data.competition,
      stage: data.stage,
      season: data.season,
      framework: { code: data.framework.code, name: data.framework.name, version: data.framework.version },
      scale: { key: data.scale.key, name: data.scale.name, levels: data.scale.levels },
      report: data.report,
      verification: opts.verification,
    };
    const doc = buildStageDocument(input, { template: config, index, language: resolved.library.defaultLanguage, defaultLanguage: resolved.library.defaultLanguage, audience: opts.audience });
    return { data, doc, html: renderReportHtml(doc, config), config, resolved, input };
  }

  /** The full Future Readiness scorecard: every completed stage, the final profile, the library's closing sections. Stored as stage 0. */
  private async buildFull(
    competitionCode: string,
    studentCode: string,
    opts: { frameworkCode?: string; draft?: boolean; audience?: Audience; verification?: { code: string; url: string; qrDataUrl: string } },
    resolved: Resolved,
  ) {
    const ctx = await this.finalProfile.context(competitionCode, opts.frameworkCode);
    const fp = await this.finalProfile.forStudent(ctx, studentCode);
    if (!fp.stages.some((s) => s.status === 'complete')) throw new BadRequestException('No stage of this student is complete yet, so there is nothing to put in a scorecard.');
    const student = await this.prisma.student.findFirst({ where: { code: studentCode }, select: { code: true, name: true, grade: true, gender: true, school: { select: { name: true } } } });
    if (!student) throw new NotFoundException('Student not found');
    const config = normalizeTemplateConfig(resolved.template.config);
    if (!config.branding.logoUrl) {
      const site = await this.prisma.siteSetting.findUnique({ where: { id: 1 }, select: { certImlLogoUrl: true } });
      if (site?.certImlLogoUrl) config.branding.logoUrl = site.certImlLogoUrl;
    }
    const index = opts.draft ? await this.content.draftIndex(resolved.library.id) : await this.content.approvedIndex(resolved.library.id);
    const input: StageReportInput = {
      student: { code: student.code, name: student.name, grade: student.grade, school: student.school?.name ?? null, gender: student.gender },
      competition: { code: ctx.competition.code, title: ctx.competition.title },
      season: ctx.season,
      framework: { code: ctx.framework.code, name: ctx.framework.name, version: ctx.framework.version },
      scale: { key: ctx.scale.key, name: ctx.scale.name, levels: ctx.scale.levels },
      full: { profile: fp.profile, stages: fp.stages },
      verification: opts.verification,
    };
    const doc = buildStageDocument(input, { template: config, index, language: resolved.library.defaultLanguage, defaultLanguage: resolved.library.defaultLanguage, audience: opts.audience });
    const rollupHash = createHash('sha256').update(JSON.stringify(ctx.rules)).digest('hex').slice(0, 16);
    const data = {
      framework: { code: ctx.framework.code, name: ctx.framework.name, version: ctx.framework.version },
      scale: { key: ctx.scale.key, name: ctx.scale.name, levels: ctx.scale.levels },
      season: ctx.season,
      attempt: null,
      competition: { code: ctx.competition.code, title: ctx.competition.title },
      stage: { position: 0, name: 'Future Readiness Scorecard' },
      student: { code: student.code, name: student.name, grade: student.grade, school: student.school?.name ?? null, gender: student.gender },
      status: 'ready' as const,
      report: null,
    };
    return { data, doc, html: renderReportHtml(doc, config), config, resolved, input, rollupHash, profile: fp.profile, stagesUsed: fp.profile.stagesUsed };
  }

  async preview(competitionCode: string, stage: number, studentCode: string, opts: { templateCode?: string; libraryCode?: string; frameworkCode?: string; draft?: boolean }) {
    const b = await this.build(competitionCode, stage, studentCode, { ...opts, preview: true });
    const issues = validateTemplateConfig(b.resolved.template.config);
    return {
      html: b.html,
      gaps: b.doc.gaps,
      fallbacks: b.doc.fallbacks,
      template: { code: b.resolved.template.code, version: b.resolved.template.version, status: b.resolved.template.status, issues },
      library: b.resolved.library.code,
      framework: b.data.framework,
      draftWording: !!opts.draft,
    };
  }

  async previewPdf(competitionCode: string, stage: number, studentCode: string, opts: { templateCode?: string; libraryCode?: string; frameworkCode?: string; draft?: boolean }) {
    const code = 'PREVIEW';
    const b = await this.build(competitionCode, stage, studentCode, { ...opts, preview: true, verification: { code, url: verificationUrl('PREVIEW'), qrDataUrl: await qrDataUrl('PREVIEW') } });
    const { pdf } = await renderReportPdf(b.html, { footerLeft: b.config.branding.footerText, footerRight: 'PREVIEW — not an issued report' });
    return { pdf, filename: `${studentCode}-stage-${stage}-preview.pdf` };
  }

  // ------------------------------------------------------------- generation

  private async newCode(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = newVerificationCode((n) => randomBytes(n));
      if (!(await this.prisma.scorecardReport.findUnique({ where: { verificationCode: code }, select: { id: true } }))) return code;
    }
    throw new Error('Could not make a unique verification code');
  }

  /** Students with a finished attempt in the stage, as registration ids. */
  private async finishedRegistrations(competitionId: number, stageId: number, only?: string[]) {
    if (stageId === 0) {
      // the full scorecard: anyone with a finished exam attempt or a panel result
      const rows = await this.prisma.registration.findMany({
        where: { competitionId, ...(only?.length ? { student: { code: { in: only } } } : {}), OR: [{ attempts: { some: { finishedAt: { not: null } } } }, { stages: { some: { status: { in: ['Qualified', 'Eliminated'] } } } }] },
        select: { id: true, student: { select: { code: true } } },
      });
      return rows.map((r) => ({ registrationId: r.id, studentCode: r.student.code }));
    }
    const rows = await this.prisma.attempt.findMany({
      where: { stageId, finishedAt: { not: null }, registration: { competitionId, ...(only?.length ? { student: { code: { in: only } } } : {}) } },
      select: { registrationId: true, registration: { select: { student: { select: { code: true } } } } },
      distinct: ['registrationId'],
    });
    return rows.map((r) => ({ registrationId: r.registrationId, studentCode: r.registration.student.code }));
  }

  private async stageOf(competitionCode: string, stagePosition: number) {
    if (!competitionCode) throw new BadRequestException('Choose a competition.');
    const competition = await this.prisma.competition.findUnique({ where: { code: competitionCode }, select: { id: true, code: true, title: true } });
    if (!competition) throw new NotFoundException('Competition not found');
    // stage 0 is the full scorecard, which covers every stage
    if (stagePosition === 0) return { competition, stage: { id: 0, competitionId: competition.id, position: 0, name: 'Future Readiness Scorecard' } };
    const stage = await this.prisma.competitionStage.findUnique({ where: { competitionId_position: { competitionId: competition.id, position: stagePosition } } });
    if (!stage) throw new NotFoundException(`This competition has no stage ${stagePosition}.`);
    return { competition, stage };
  }

  /** Queues reports for every (or the chosen) student with a finished attempt. */
  async generate(competitionCode: string, stagePosition: number, dto: GenerateReportsDto, adminId: number | null) {
    const { competition, stage } = await this.stageOf(competitionCode, stagePosition);
    await this.resolve(competitionCode); // template and library must be set, template published
    const people = await this.finishedRegistrations(competition.id, stage.id, dto.students);
    if (dto.students?.length) {
      const found = new Set(people.map((p) => p.studentCode));
      const missing = dto.students.filter((s) => !found.has(s));
      if (missing.length) throw new BadRequestException(`No finished attempt in this stage for: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
    }
    const admin = adminId ? await this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
    let queued = 0;
    let requeued = 0;
    let skipped = 0;
    for (const p of people) {
      const rows = await this.prisma.scorecardReport.findMany({
        where: { registrationId: p.registrationId, stagePosition },
        orderBy: { version: 'desc' },
        select: { id: true, version: true, status: true },
      });
      const latest = rows[0];
      if (latest && (latest.status === 'Queued' || latest.status === 'Generating')) {
        skipped++;
        continue;
      }
      if (latest && latest.status === 'Failed' && !dto.regenerate) {
        await this.prisma.scorecardReport.update({ where: { id: latest.id }, data: { status: 'Queued', attempts: 0, lastError: null } });
        requeued++;
        continue;
      }
      if (latest && latest.status === 'Ready' && !dto.regenerate) {
        skipped++;
        continue;
      }
      await this.prisma.scorecardReport.create({
        data: {
          verificationCode: await this.newCode(),
          registrationId: p.registrationId,
          stagePosition,
          version: (latest?.version ?? 0) + 1,
          requestedById: adminId,
          requestedByName: admin?.name ?? null,
        },
      });
      queued++;
    }
    await this.audit(competitionCode, 'generate', adminId, { stage: stagePosition, queued, requeued, skipped, regenerate: !!dto.regenerate, students: dto.students?.length ?? 'all' });
    return { queued, requeued, skipped };
  }

  /** Called by the queue worker for one claimed report. Throws on failure so the worker can retry. */
  async generateOne(reportId: number, browser: Browser): Promise<void> {
    const row = await this.prisma.scorecardReport.findUnique({
      where: { id: reportId },
      include: { registration: { select: { competition: { select: { code: true } }, student: { select: { code: true } } } } },
    });
    if (!row) return;
    const verification = { code: row.verificationCode, url: verificationUrl(row.verificationCode), qrDataUrl: await qrDataUrl(row.verificationCode) };
    const b = await this.build(row.registration.competition.code, row.stagePosition, row.registration.student.code, { verification });
    const { pdf, pages } = await renderReportPdf(b.html, { footerLeft: b.config.branding.footerText, footerRight: `Verify: ${row.verificationCode}` }, browser);
    const checksum = sha256(pdf);
    // Audiences the template hides sections from get their own copy; the rest use the full file.
    const variants: { audience: Audience; pdf: Buffer }[] = [];
    for (const audience of variantAudiences(b.config.sections)) {
      const v = await this.build(row.registration.competition.code, row.stagePosition, row.registration.student.code, { verification, audience });
      variants.push({ audience, pdf: (await renderReportPdf(v.html, { footerLeft: v.config.branding.footerText, footerRight: `Verify: ${row.verificationCode}` }, browser)).pdf });
    }
    const configUsed = {
      framework: { code: b.data.framework.code, version: b.data.framework.version },
      scale: b.data.scale.key,
      season: b.data.season?.code ?? null,
      template: { code: b.resolved.template.code, version: b.resolved.template.version },
      library: { code: b.resolved.library.code, language: b.resolved.library.defaultLanguage },
      texts: b.doc.used,
      attempt: b.data.attempt?.code ?? null,
      variants: variants.map((v) => v.audience),
      ...('rollupHash' in b ? { rules: { framework: b.data.framework.code, version: b.data.framework.version, hash: (b as { rollupHash: string }).rollupHash }, stagesUsed: (b as { stagesUsed: number[] }).stagesUsed } : {}),
    };
    await this.prisma.$transaction([
      this.prisma.scorecardReportVariant.deleteMany({ where: { reportId: row.id } }),
      this.prisma.scorecardReportVariant.createMany({ data: variants.map((v) => ({ reportId: row.id, audience: v.audience, checksum: sha256(v.pdf), sizeBytes: v.pdf.length, data: new Uint8Array(v.pdf) })) }),
      this.prisma.scorecardReportFile.upsert({ where: { reportId: row.id }, create: { reportId: row.id, data: new Uint8Array(pdf) }, update: { data: new Uint8Array(pdf) } }),
      this.prisma.scorecardReport.update({
        where: { id: row.id },
        data: {
          status: 'Ready',
          checksum,
          sizeBytes: pdf.length,
          pageCount: pages,
          configUsed: configUsed as unknown as Prisma.InputJsonValue,
          warnings: { gaps: b.doc.gaps, fallbacks: b.doc.fallbacks } as unknown as Prisma.InputJsonValue,
          generatedAt: new Date(),
          lastError: null,
        },
      }),
    ]);
  }

  // ----------------------------------------------------------------- lists

  async list(competitionCode: string, stagePosition: number, q: ListQueryDto) {
    const { competition, stage } = await this.stageOf(competitionCode, stagePosition);
    const people = await this.finishedRegistrations(competition.id, stage.id);
    const regs = await this.prisma.registration.findMany({
      where: { id: { in: people.map((p) => p.registrationId) } },
      select: { id: true, student: { select: { id: true, code: true, name: true, grade: true, parentPhone: true, school: { select: { name: true } } } } },
    });
    const reports = await this.prisma.scorecardReport.findMany({
      where: { stagePosition, registrationId: { in: regs.map((r) => r.id) } },
      orderBy: { version: 'desc' },
      select: { id: true, registrationId: true, verificationCode: true, version: true, status: true, attempts: true, lastError: true, checksum: true, sizeBytes: true, pageCount: true, generatedAt: true, createdAt: true, supersededAt: true, warnings: true, releasedAt: true, withdrawnAt: true, withdrawnReason: true },
    });
    const consents = await this.prisma.scorecardConsent.findMany({ where: { studentId: { in: regs.map((r) => r.student.id) }, withdrawnAt: null }, select: { studentId: true, audience: true } });
    const links = await this.prisma.scorecardShareLink.findMany({ where: { stagePosition, registrationId: { in: regs.map((r) => r.id) } }, orderBy: { id: 'desc' } });
    const byReg = new Map<number, typeof reports>();
    for (const r of reports) byReg.set(r.registrationId, [...(byReg.get(r.registrationId) ?? []), r]);
    let rows = regs.map((r) => {
      const all = byReg.get(r.id) ?? [];
      // the report that counts: the newest Ready one, else the newest of any status
      const current = all.find((x) => x.status === 'Ready' && !x.supersededAt) ?? all[0] ?? null;
      const pending = all[0] && all[0] !== current && (all[0].status === 'Queued' || all[0].status === 'Generating') ? all[0] : null;
      const visible = visibleReport(all);
      const newestReady = all.find((x) => x.status === 'Ready') ?? null;
      const withdrawn = all.find((x) => x.releasedAt && x.withdrawnAt) ?? null;
      const link = links.find((l) => l.registrationId === r.id) ?? null;
      const linkSt = link ? linkState(link) : null;
      return {
        student: { code: r.student.code, name: r.student.name, grade: r.student.grade, school: r.student.school?.name ?? null, hasParentPhone: !!r.student.parentPhone },
        release: {
          state: visible ? ('Released' as const) : withdrawn ? ('Withdrawn' as const) : ('Not released' as const),
          version: visible?.version ?? null,
          releasedAt: visible?.releasedAt ?? null,
          withdrawnReason: !visible ? withdrawn?.withdrawnReason ?? null : null,
          // a newer version is ready but not yet released
          awaiting: !!newestReady && newestReady.id !== visible?.id && !(newestReady.releasedAt && !newestReady.withdrawnAt) ? newestReady.version : null,
        },
        consent: { parent: consents.some((c) => c.studentId === r.student.id && c.audience === 'parent'), school: consents.some((c) => c.studentId === r.student.id && c.audience === 'school') },
        parentLink: link && { state: linkSt, expiresAt: link.expiresAt, openCount: link.openCount, lastOpenedAt: link.lastOpenedAt, sentAt: link.createdAt },
        report: current && this.shapeReport(current),
        pending: pending && this.shapeReport(pending),
        versions: all.length,
      };
    });
    const summary = {
      students: rows.length,
      ready: rows.filter((r) => r.report?.status === 'Ready').length,
      queued: rows.filter((r) => r.report?.status === 'Queued' || r.pending?.status === 'Queued').length,
      generating: rows.filter((r) => r.report?.status === 'Generating' || r.pending?.status === 'Generating').length,
      failed: rows.filter((r) => r.report?.status === 'Failed').length,
      none: rows.filter((r) => !r.report).length,
      released: rows.filter((r) => r.release.state === 'Released').length,
      withdrawn: rows.filter((r) => r.release.state === 'Withdrawn').length,
      toRelease: rows.filter((r) => r.report?.status === 'Ready' && (r.release.state !== 'Released' || r.release.awaiting !== null)).length,
    };
    if (q.search) {
      const needle = q.search.toLowerCase();
      rows = rows.filter((r) => `${r.student.name} ${r.student.code}`.toLowerCase().includes(needle));
    }
    if (q.status) {
      rows = rows.filter((r) =>
        q.status === 'None' ? !r.report
        : q.status === 'Released' || q.status === 'Withdrawn' || q.status === 'Not released' ? r.release.state === q.status
        : r.report?.status === q.status || r.pending?.status === q.status,
      );
    }
    rows.sort((a, b) => a.student.code.localeCompare(b.student.code, undefined, { numeric: true }));
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(500, Math.max(1, q.limit ?? 50));
    return { competition, stage: { position: stage.position, name: stage.name }, summary, total: rows.length, page, limit, rows: rows.slice((page - 1) * limit, page * limit) };
  }

  private shapeReport(r: { id: number; verificationCode: string; version: number; status: string; attempts: number; lastError: string | null; checksum: string | null; sizeBytes: number | null; pageCount: number | null; generatedAt: Date | null; supersededAt: Date | null; warnings: unknown; releasedAt?: Date | null; withdrawnAt?: Date | null; withdrawnReason?: string | null }) {
    const w = (r.warnings ?? {}) as { gaps?: string[]; fallbacks?: string[] };
    return {
      id: r.id,
      code: r.verificationCode,
      version: r.version,
      status: r.status,
      attempts: r.attempts,
      error: r.lastError,
      checksum: r.checksum,
      sizeBytes: r.sizeBytes,
      pages: r.pageCount,
      generatedAt: r.generatedAt,
      superseded: !!r.supersededAt,
      releasedAt: r.releasedAt ?? null,
      withdrawnAt: r.withdrawnAt ?? null,
      withdrawnReason: r.withdrawnReason ?? null,
      gaps: w.gaps?.length ?? 0,
      fallbacks: w.fallbacks?.length ?? 0,
    };
  }

  async get(id: number) {
    const r = await this.prisma.scorecardReport.findUnique({
      where: { id },
      include: { registration: { select: { competition: { select: { code: true, title: true } }, student: { select: { code: true, name: true } } } } },
    });
    if (!r) throw new NotFoundException('Report not found');
    const versions = await this.prisma.scorecardReport.findMany({
      where: { registrationId: r.registrationId, stagePosition: r.stagePosition },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, status: true, generatedAt: true, supersededAt: true, verificationCode: true, releasedAt: true, withdrawnAt: true },
    });
    return {
      ...this.shapeReport(r),
      competition: r.registration.competition,
      student: r.registration.student,
      stage: r.stagePosition,
      configUsed: r.configUsed,
      warnings: r.warnings,
      requestedByName: r.requestedByName,
      createdAt: r.createdAt,
      versions: versions.map((v) => ({ id: v.id, version: v.version, status: v.status, code: v.verificationCode, generatedAt: v.generatedAt, superseded: !!v.supersededAt, release: releaseState(v) })),
    };
  }

  async download(id: number) {
    const r = await this.prisma.scorecardReport.findUnique({ where: { id }, include: { file: true, registration: { select: { student: { select: { code: true } } } } } });
    if (!r || !r.file) throw new NotFoundException('This report has no file yet.');
    return { data: Buffer.from(r.file.data), filename: `${r.registration.student.code}-stage-${r.stagePosition}-v${r.version}.pdf` };
  }

  async retry(id: number, adminId: number | null) {
    const r = await this.prisma.scorecardReport.findUnique({ where: { id }, include: { registration: { select: { competition: { select: { code: true } } } } } });
    if (!r) throw new NotFoundException('Report not found');
    if (r.status !== 'Failed') throw new BadRequestException('Only a failed report can be retried.');
    await this.prisma.scorecardReport.update({ where: { id }, data: { status: 'Queued', attempts: 0, lastError: null } });
    await this.audit(r.registration.competition.code, 'retry', adminId, { report: r.verificationCode });
    return this.get(id);
  }
}
