import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Audience, MAX_CODE_ATTEMPTS, codesMatch, hashCode, hashToken, isAudience, linkState, mayShare, normalizeDeliverySettings, visibleReport } from '../common/report-access';
import { buildIndex, renderTemplate, resolveText } from '../common/content-library';

export interface ConsentEntry {
  season: { code: string; name: string; edition: string };
  required: boolean;
  text: string | null;
  textMissing: boolean;
  accepted: { parent: boolean; school: boolean };
}

export interface SchoolReportRow {
  id: number;
  student: { code: string; name: string; grade: string };
  competition: { code: string; title: string };
  stage: { position: number; name: string };
  version: number;
  releasedAt: Date | null;
  pages: number | null;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

// What students, schools and parents can see of the scorecard reports (#74). Everything
// here only ever reads a report that an admin has released and not withdrawn, and hands out
// the copy built for that audience (the full file unless the template hides sections from it).
@Injectable()
export class ScorecardAccessService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ helpers

  /** The report each audience sees per registration and stage. */
  private async visibleFor(registrationIds: number[]) {
    if (!registrationIds.length) return [];
    const rows = await this.prisma.scorecardReport.findMany({
      where: { registrationId: { in: registrationIds }, status: 'Ready', releasedAt: { not: null }, withdrawnAt: null },
      include: { registration: { select: { id: true, studentId: true, competition: { select: { id: true, code: true, title: true, seasonId: true, season: { select: { id: true, code: true, name: true, editionLabel: true, deliverySettings: true } } } } } } },
    });
    const by = new Map<string, typeof rows>();
    for (const r of rows) by.set(`${r.registrationId}:${r.stagePosition}`, [...(by.get(`${r.registrationId}:${r.stagePosition}`) ?? []), r]);
    const out: typeof rows = [];
    for (const group of by.values()) {
      const v = visibleReport(group);
      if (v) out.push(v);
    }
    return out;
  }

  private async stageNames(competitionIds: number[]) {
    const stages = await this.prisma.competitionStage.findMany({ where: { competitionId: { in: competitionIds } }, select: { competitionId: true, position: true, name: true } });
    return new Map(stages.map((s) => [`${s.competitionId}:${s.position}`, s.name]));
  }

  private async fileFor(reportId: number, audience: Audience): Promise<Buffer> {
    const variant = await this.prisma.scorecardReportVariant.findUnique({ where: { reportId_audience: { reportId, audience } } });
    if (variant) return Buffer.from(variant.data);
    const file = await this.prisma.scorecardReportFile.findUnique({ where: { reportId } });
    if (!file) throw new NotFoundException('This report has no file.');
    return Buffer.from(file.data);
  }

  private async activeConsent(studentId: number, audience: 'parent' | 'school', seasonId: number | null) {
    return this.prisma.scorecardConsent.findFirst({ where: { studentId, audience, withdrawnAt: null, OR: [{ seasonId }, { seasonId: null }] } });
  }

  // ------------------------------------------------------------------ student

  async forStudent(studentId: number) {
    const regs = await this.prisma.registration.findMany({ where: { studentId }, select: { id: true } });
    const visible = await this.visibleFor(regs.map((r) => r.id));
    const names = await this.stageNames(visible.map((v) => v.registration.competition.id));
    return visible
      .map((v) => ({
        id: v.id,
        competition: { code: v.registration.competition.code, title: v.registration.competition.title },
        edition: v.registration.competition.season?.editionLabel ?? v.registration.competition.title,
        stage: { position: v.stagePosition, name: v.stagePosition === 0 ? 'Future Readiness Scorecard' : names.get(`${v.registration.competition.id}:${v.stagePosition}`) ?? `Stage ${v.stagePosition}` },
        version: v.version,
        releasedAt: v.releasedAt,
        pages: v.pageCount,
        sizeBytes: v.sizeBytes,
      }))
      .sort((a, b) => (b.releasedAt?.getTime() ?? 0) - (a.releasedAt?.getTime() ?? 0));
  }

  async downloadForStudent(studentId: number, reportId: number) {
    const regs = await this.prisma.registration.findMany({ where: { studentId }, select: { id: true } });
    const visible = (await this.visibleFor(regs.map((r) => r.id))).find((v) => v.id === reportId);
    if (!visible) throw new NotFoundException('Report not found');
    return { data: await this.fileFor(visible.id, 'student'), filename: `IML-report-stage-${visible.stagePosition}.pdf` };
  }

  /** For each season the student has a released report in: the consent wording and what they have agreed to. */
  async consentState(studentId: number) {
    const regs = await this.prisma.registration.findMany({ where: { studentId }, select: { id: true } });
    const visible = await this.visibleFor(regs.map((r) => r.id));
    const seasons = new Map<number, (typeof visible)[number]['registration']['competition']['season']>();
    for (const v of visible) if (v.registration.competition.season) seasons.set(v.registration.competition.season.id, v.registration.competition.season);
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { name: true, parent: true } });
    const out: ConsentEntry[] = [];
    for (const season of seasons.values()) {
      if (!season) continue;
      const settings = normalizeDeliverySettings(season.deliverySettings);
      const text = await this.consentText(season.id, student?.name ?? '', season.editionLabel);
      out.push({
        season: { code: season.code, name: season.name, edition: season.editionLabel },
        required: settings.consentRequired,
        text: text?.text ?? null,
        textMissing: settings.consentRequired && !text,
        accepted: {
          parent: !!(await this.activeConsent(studentId, 'parent', season.id)),
          school: !!(await this.activeConsent(studentId, 'school', season.id)),
        },
      });
    }
    return out;
  }

  /** The approved consent wording of the season's library, filled in for this student. */
  private async consentText(seasonId: number, studentName: string, edition: string) {
    const season = await this.prisma.scorecardSeason.findUnique({ where: { id: seasonId }, include: { library: true } });
    if (!season?.library) return null;
    const rows = await this.prisma.scorecardText.findMany({ where: { libraryId: season.library.id, kind: 'consent', approvedVersionId: { not: null } }, include: { approvedVersion: true } });
    const index = buildIndex(
      rows.filter((r) => r.approvedVersion).map((r) => ({ kind: r.kind, key: r.key, levelKey: r.levelKey, language: r.language, position: r.position, title: r.approvedVersion!.title, text: r.approvedVersion!.text, version: r.approvedVersion!.version })),
    );
    const r = resolveText(index, { kind: 'consent', language: season.library.defaultLanguage, defaultLanguage: season.library.defaultLanguage });
    if (!r.item) return null;
    return { libraryCode: season.library.code, version: r.item.version, text: renderTemplate(r.item.text, { name: studentName, edition }).text };
  }

  async setConsent(studentId: number, audienceRaw: string, accept: boolean, seasonCode: string) {
    if (!isAudience(audienceRaw) || audienceRaw === 'student') throw new BadRequestException('Consent is given for the parent or the school.');
    const audience = audienceRaw as 'parent' | 'school';
    const state = (await this.consentState(studentId)).find((s) => s.season.code === seasonCode);
    if (!state) throw new NotFoundException('Nothing to consent to for this season.');
    const season = await this.prisma.scorecardSeason.findUnique({ where: { code: seasonCode }, select: { id: true } });
    if (!season) throw new NotFoundException('Season not found');
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
    const now = new Date();
    if (!accept) {
      await this.prisma.scorecardConsent.updateMany({ where: { studentId, audience, seasonId: season.id, withdrawnAt: null }, data: { withdrawnAt: now } });
      if (audience === 'parent') {
        // a parent link stops working as soon as the student takes their consent back
        const regs = await this.prisma.registration.findMany({ where: { studentId }, select: { id: true } });
        await this.prisma.scorecardShareLink.updateMany({ where: { registrationId: { in: regs.map((r) => r.id) }, revokedAt: null }, data: { revokedAt: now } });
      }
      return this.consentState(studentId);
    }
    const text = await this.consentText(season.id, student?.name ?? '', state.season.edition);
    if (!text) throw new BadRequestException('The consent wording has not been approved yet, so it cannot be accepted.');
    if (state.accepted[audience]) return this.consentState(studentId);
    await this.prisma.scorecardConsent.create({
      data: { studentId, seasonId: season.id, audience, libraryCode: text.libraryCode, textVersion: text.version, consentText: text.text, acceptedBy: 'student' },
    });
    return this.consentState(studentId);
  }

  // ------------------------------------------------------------------- school

  async forSchool(schoolId: number) {
    const regs = await this.prisma.registration.findMany({ where: { student: { schoolId, archived: false } }, select: { id: true, student: { select: { id: true, code: true, name: true, grade: true } } } });
    const visible = await this.visibleFor(regs.map((r) => r.id));
    const names = await this.stageNames(visible.map((v) => v.registration.competition.id));
    const studentOf = new Map(regs.map((r) => [r.id, r.student]));
    const reports: SchoolReportRow[] = [];
    let awaitingConsent = 0;
    for (const v of visible) {
      const student = studentOf.get(v.registrationId);
      if (!student) continue;
      const settings = normalizeDeliverySettings(v.registration.competition.season?.deliverySettings);
      const consent = await this.activeConsent(student.id, 'school', v.registration.competition.seasonId);
      if (!mayShare('school', settings, !!consent).allowed) {
        awaitingConsent++;
        continue;
      }
      reports.push({
        id: v.id,
        student: { code: student.code, name: student.name, grade: student.grade },
        competition: { code: v.registration.competition.code, title: v.registration.competition.title },
        stage: { position: v.stagePosition, name: v.stagePosition === 0 ? 'Future Readiness Scorecard' : names.get(`${v.registration.competition.id}:${v.stagePosition}`) ?? `Stage ${v.stagePosition}` },
        version: v.version,
        releasedAt: v.releasedAt,
        pages: v.pageCount,
      });
    }
    reports.sort((a, b) => a.student.code.localeCompare(b.student.code, undefined, { numeric: true }) || a.stage.position - b.stage.position);
    return { reports, awaitingConsent };
  }

  async downloadForSchool(schoolId: number, reportId: number) {
    const row = await this.prisma.scorecardReport.findUnique({ where: { id: reportId }, include: { registration: { select: { id: true, student: { select: { id: true, schoolId: true } }, competition: { select: { seasonId: true, season: { select: { deliverySettings: true } } } } } } } });
    // a report of another school's student looks exactly like one that does not exist
    if (!row || row.registration.student.schoolId !== schoolId) throw new NotFoundException('Report not found');
    const visible = (await this.visibleFor([row.registrationId])).find((v) => v.id === reportId);
    if (!visible) throw new NotFoundException('Report not found');
    const settings = normalizeDeliverySettings(row.registration.competition.season?.deliverySettings);
    const consent = await this.activeConsent(row.registration.student.id, 'school', row.registration.competition.seasonId);
    const d = mayShare('school', settings, !!consent);
    if (!d.allowed) throw new ForbiddenException(d.reason);
    return { data: await this.fileFor(reportId, 'school'), filename: `IML-report-stage-${row.stagePosition}.pdf` };
  }

  // ------------------------------------------------------------------- parent

  private async link(token: string) {
    const link = await this.prisma.scorecardShareLink.findUnique({ where: { tokenHash: hashToken(token.trim()) } });
    if (!link) throw new NotFoundException('This link is not valid.');
    return link;
  }

  private async visibleOfLink(link: { registrationId: number; stagePosition: number }) {
    return (await this.visibleFor([link.registrationId])).find((v) => v.stagePosition === link.stagePosition) ?? null;
  }

  /** What the link page shows before the code is typed: only a first name and the stage. */
  async linkInfo(token: string) {
    const link = await this.link(token);
    const state = linkState(link);
    const visible = await this.visibleOfLink(link);
    const reg = await this.prisma.registration.findUnique({ where: { id: link.registrationId }, select: { student: { select: { name: true } }, competition: { select: { id: true, title: true, season: { select: { editionLabel: true } } } } } });
    const stage = reg ? await this.prisma.competitionStage.findUnique({ where: { competitionId_position: { competitionId: reg.competition.id, position: link.stagePosition } }, select: { name: true } }) : null;
    const effective = state === 'ok' && !visible ? ('withdrawn' as const) : state;
    return {
      state: effective,
      ...(effective === 'ok' || effective === 'locked'
        ? { studentFirstName: firstName(reg?.student.name ?? ''), stage: link.stagePosition === 0 ? 'Future Readiness Scorecard' : stage?.name ?? `Stage ${link.stagePosition}`, edition: reg?.competition.season?.editionLabel ?? reg?.competition.title ?? '' }
        : {}),
      triesLeft: Math.max(0, MAX_CODE_ATTEMPTS - link.attempts),
    };
  }

  async openLink(token: string, code: string) {
    const link = await this.link(token);
    const state = linkState(link);
    if (state === 'expired') throw new ForbiddenException('This link has expired. Ask the school or IML to send a new one.');
    if (state === 'revoked') throw new ForbiddenException('This link is no longer active.');
    if (state === 'locked') throw new ForbiddenException('Too many wrong codes. Ask the school or IML to send a new link.');
    const visible = await this.visibleOfLink(link);
    if (!visible) throw new ForbiddenException('This report is not available.');
    if (!/^\d{6}$/.test((code ?? '').trim()) || !codesMatch(link.codeHash, hashCode(link.tokenHash, code))) {
      const attempts = link.attempts + 1;
      await this.prisma.scorecardShareLink.update({ where: { id: link.id }, data: { attempts } });
      const left = MAX_CODE_ATTEMPTS - attempts;
      throw new ForbiddenException(left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Ask the school or IML to send a new link.');
    }
    await this.prisma.scorecardShareLink.update({ where: { id: link.id }, data: { attempts: 0, openCount: { increment: 1 }, lastOpenedAt: new Date() } });
    return { data: await this.fileFor(visible.id, 'parent'), filename: `IML-report-stage-${link.stagePosition}.pdf` };
  }
}
