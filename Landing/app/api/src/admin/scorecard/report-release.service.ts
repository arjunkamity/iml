import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from '../../messaging/messaging.service';
import { mayShare, newCode, newToken, hashCode, hashToken, normalizeDeliverySettings, visibleReport } from '../../common/report-access';
import { ReleaseDto, SendToParentsDto, WithdrawDto } from './template.dto';

// Where students, parents and schools open reports. The site address matches the one the
// certificate emails already use.
export const SITE_BASE_URL = 'https://indiamindleague.com';

export interface Skip {
  student: string;
  reason: string;
}

// Releasing, withdrawing and sending scorecard reports (#74). A report is invisible to
// everyone until an admin releases it; every action is written to the audit log.
@Injectable()
export class ReportReleaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  private async audit(entityCode: string, action: string, adminId: number | null, summary: Record<string, unknown>) {
    const admin = adminId ? await this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
    await this.prisma.configAuditLog.create({
      data: { entity: 'report', entityCode, action, adminId, adminName: admin?.name ?? null, summary: summary as Prisma.InputJsonValue },
    });
  }

  private async competition(code: string) {
    if (!code) throw new BadRequestException('Choose a competition.');
    const c = await this.prisma.competition.findUnique({ where: { code }, include: { season: true } });
    if (!c) throw new NotFoundException('Competition not found');
    return c;
  }

  /** Every report of the competition (optionally one stage, optionally some students), newest version first, grouped by student and stage. */
  private async groups(competitionId: number, stage?: number, students?: string[]) {
    const rows = await this.prisma.scorecardReport.findMany({
      where: {
        registration: { competitionId, ...(students?.length ? { student: { code: { in: students } } } : {}) },
        ...(stage ? { stagePosition: stage } : {}),
      },
      orderBy: { version: 'desc' },
      include: { registration: { select: { id: true, student: { select: { id: true, code: true, name: true, email: true, phone: true, parent: true, parentPhone: true, archived: true } } } } },
    });
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = `${r.registrationId}:${r.stagePosition}`;
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.values()];
  }

  // ----------------------------------------------------------------- release

  async release(competitionCode: string, dto: ReleaseDto, adminId: number | null) {
    const comp = await this.competition(competitionCode);
    const settings = normalizeDeliverySettings(comp.season?.deliverySettings);
    const admin = adminId ? await this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
    const stageNames = new Map((await this.prisma.competitionStage.findMany({ where: { competitionId: comp.id }, select: { position: true, name: true } })).map((s) => [s.position, s.name]));
    let released = 0;
    let notified = 0;
    const skipped: Skip[] = [];
    for (const rows of await this.groups(comp.id, dto.stage, dto.students)) {
      const student = rows[0].registration.student;
      const newest = rows.find((r) => r.status === 'Ready');
      if (!newest) {
        skipped.push({ student: student.code, reason: 'No finished report yet.' });
        continue;
      }
      if (newest.releasedAt && !newest.withdrawnAt) continue; // already out; nothing to do
      const gaps = ((newest.warnings ?? {}) as { gaps?: string[] }).gaps ?? [];
      if (gaps.length && !dto.force) {
        skipped.push({ student: student.code, reason: `Wording is missing from the report (${gaps.length}). Fix it and make the report again, or release with “even with missing wording”.` });
        continue;
      }
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.scorecardReport.update({ where: { id: newest.id }, data: { releasedAt: now, releasedById: adminId, releasedByName: admin?.name ?? null, withdrawnAt: null, withdrawnReason: null } }),
        // an older version that was out is replaced; it stays on record and its code says so
        this.prisma.scorecardReport.updateMany({
          where: { registrationId: newest.registrationId, stagePosition: newest.stagePosition, id: { not: newest.id }, version: { lt: newest.version }, supersededAt: null },
          data: { supersededAt: now },
        }),
        this.prisma.scorecardReport.updateMany({
          where: { registrationId: newest.registrationId, stagePosition: newest.stagePosition, id: { not: newest.id }, version: { lt: newest.version }, releasedAt: { not: null }, withdrawnAt: null },
          data: { withdrawnAt: now, withdrawnReason: `Replaced by version ${newest.version}` },
        }),
      ]);
      released++;
      if (settings.notifyStudent && !student.archived && (student.email || student.phone)) {
        void this.messaging.dispatch(
          'SCORECARD_REPORT_READY',
          { email: student.email, phone: student.phone },
          { StudentName: student.name, StageName: stageNames.get(newest.stagePosition) ?? `Stage ${newest.stagePosition}`, ReportLink: `${SITE_BASE_URL}/account/reports` },
        );
        notified++;
      }
    }
    await this.audit(competitionCode, 'release', adminId, { stage: dto.stage ?? 'all', students: dto.students?.length ?? 'all', released, skipped: skipped.length, force: !!dto.force });
    return { released, notified, skipped: skipped.slice(0, 25), skippedCount: skipped.length };
  }

  async withdraw(competitionCode: string, dto: WithdrawDto, adminId: number | null) {
    const comp = await this.competition(competitionCode);
    const reason = dto.reason?.trim() || 'Withdrawn by an administrator';
    const now = new Date();
    let withdrawn = 0;
    let linksRevoked = 0;
    for (const rows of await this.groups(comp.id, dto.stage, dto.students)) {
      const out = rows.filter((r) => r.releasedAt && !r.withdrawnAt);
      if (!out.length) continue;
      await this.prisma.scorecardReport.updateMany({ where: { id: { in: out.map((r) => r.id) } }, data: { withdrawnAt: now, withdrawnReason: reason.slice(0, 255) } });
      withdrawn++;
      const r = await this.prisma.scorecardShareLink.updateMany({ where: { registrationId: rows[0].registrationId, stagePosition: rows[0].stagePosition, revokedAt: null }, data: { revokedAt: now } });
      linksRevoked += r.count;
    }
    await this.audit(competitionCode, 'withdraw', adminId, { stage: dto.stage ?? 'all', students: dto.students?.length ?? 'all', withdrawn, linksRevoked, reason });
    return { withdrawn, linksRevoked };
  }

  // ------------------------------------------------------------------ parents

  /**
   * Sends each parent a link to the student's released report, with a 6-digit code that must be
   * typed to open it. Needs the report released, a parent phone number, and — when the season
   * asks for it — the student's consent. An older link for the same report is revoked.
   */
  async sendToParents(competitionCode: string, dto: SendToParentsDto, adminId: number | null) {
    const comp = await this.competition(competitionCode);
    const settings = normalizeDeliverySettings(comp.season?.deliverySettings);
    const admin = adminId ? await this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
    const stage = dto.stage === 0 ? { name: 'Future Readiness Scorecard' } : await this.prisma.competitionStage.findUnique({ where: { competitionId_position: { competitionId: comp.id, position: dto.stage } }, select: { name: true } });
    if (!stage) throw new NotFoundException(`This competition has no stage ${dto.stage}.`);
    let sent = 0;
    const skipped: Skip[] = [];
    for (const rows of await this.groups(comp.id, dto.stage, dto.students)) {
      const student = rows[0].registration.student;
      if (!visibleReport(rows)) {
        skipped.push({ student: student.code, reason: 'The report is not released.' });
        continue;
      }
      if (!student.parentPhone || student.parentPhone.replace(/\D/g, '').length < 10) {
        skipped.push({ student: student.code, reason: 'No parent phone number on record.' });
        continue;
      }
      const consent = await this.prisma.scorecardConsent.findFirst({ where: { studentId: student.id, audience: 'parent', withdrawnAt: null, OR: [{ seasonId: comp.seasonId }, { seasonId: null }] } });
      const decision = mayShare('parent', settings, !!consent);
      if (!decision.allowed) {
        skipped.push({ student: student.code, reason: decision.reason ?? 'No consent.' });
        continue;
      }
      const token = newToken();
      const code = newCode();
      const tokenHash = hashToken(token);
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.scorecardShareLink.updateMany({ where: { registrationId: rows[0].registrationId, stagePosition: dto.stage, revokedAt: null }, data: { revokedAt: now } }),
        this.prisma.scorecardShareLink.create({
          data: {
            tokenHash,
            codeHash: hashCode(tokenHash, code),
            registrationId: rows[0].registrationId,
            stagePosition: dto.stage,
            phone: student.parentPhone,
            expiresAt: new Date(now.getTime() + settings.linkValidDays * 86_400_000),
            createdByName: admin?.name ?? null,
          },
        }),
      ]);
      void this.messaging.dispatch(
        'SCORECARD_REPORT_PARENT',
        { phone: student.parentPhone },
        { ParentName: student.parent || 'Parent', StudentName: student.name, StageName: stage.name, ReportLink: `${SITE_BASE_URL}/report/${token}`, Code: code, Days: settings.linkValidDays },
      );
      sent++;
    }
    await this.audit(competitionCode, 'send_parents', adminId, { stage: dto.stage, sent, skipped: skipped.length });
    return { sent, skipped: skipped.slice(0, 25), skippedCount: skipped.length };
  }
}
