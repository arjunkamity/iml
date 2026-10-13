import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { nextCode } from '../common/util';
import { toXlsxBuffer } from '../common/xlsx.util';
import { hashToken, newToken } from '../common/report-access';
import { RatingMap, aggregateStage, SubmittedRating } from '../common/panel-scoring';
import { PanelStageService } from './panel-stage.service';
import { CreatePanelistDto, PatchPanelistDto } from './panel.dto';

export const SITE_URL = 'https://indiamindleague.com';
const INVITE_DAYS = 7;
const norm = (s: string) => s.trim().toLowerCase();

// Panelist accounts, enrolment and the admin's control of a stage (#76, #81, #82).
@Injectable()
export class PanelAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly stages: PanelStageService,
  ) {}

  private audit(code: string, action: string, adminId: number | null, summary: Record<string, unknown>) {
    return this.stages.audit(code, action, { id: adminId }, summary);
  }

  // ---------------------------------------------------------------- panelists

  private shape(p: { id: number; code: string; name: string; email: string; phone: string | null; status: string; notes: string | null; lastLoginAt: Date | null; inviteExpiresAt: Date | null; createdAt: Date; passwordHash?: string | null }, enrolments = 0) {
    return { id: p.id, code: p.code, name: p.name, email: p.email, phone: p.phone, status: p.status, notes: p.notes, lastLoginAt: p.lastLoginAt, inviteExpiresAt: p.inviteExpiresAt, hasPassword: !!p.passwordHash, enrolments, createdAt: p.createdAt };
  }

  async list(q: { search?: string }) {
    const where: Prisma.PanelistWhereInput = q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }, { code: { contains: q.search, mode: 'insensitive' } }] } : {};
    const rows = await this.prisma.panelist.findMany({ where, orderBy: { id: 'asc' }, include: { _count: { select: { enrolments: true } } } });
    return rows.map((p) => this.shape(p, p._count.enrolments));
  }

  private async byId(id: number) {
    const p = await this.prisma.panelist.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Panelist not found');
    return p;
  }

  private async sendInvite(p: { id: number; name: string; email: string; phone: string | null }, reset = false) {
    const token = newToken();
    await this.prisma.panelist.update({ where: { id: p.id }, data: { inviteTokenHash: hashToken(token), inviteExpiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) } });
    void this.messaging.dispatch('PANEL_INVITE', { email: p.email, phone: p.phone }, { Name: p.name, InviteLink: `${SITE_URL}/panel/set-password/${token}`, Days: INVITE_DAYS, Purpose: reset ? 'reset your password' : 'set your password' });
    return token;
  }

  async create(dto: CreatePanelistDto, adminId: number | null) {
    const email = norm(dto.email);
    if (await this.prisma.panelist.findUnique({ where: { email } })) throw new ConflictException('A panelist with this email already exists.');
    const codes = (await this.prisma.panelist.findMany({ select: { code: true } })).map((c) => c.code);
    const p = await this.prisma.panelist.create({ data: { code: nextCode(codes, 'PN'), name: dto.name.trim(), email, phone: dto.phone?.trim() || null, notes: dto.notes?.trim() || null } });
    await this.sendInvite(p);
    await this.audit(p.code, 'panelist_invite', adminId, { email });
    return this.shape(await this.byId(p.id));
  }

  async update(id: number, dto: PatchPanelistDto, adminId: number | null) {
    const p = await this.byId(id);
    const data: Prisma.PanelistUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) {
      const email = norm(dto.email);
      const other = await this.prisma.panelist.findUnique({ where: { email } });
      if (other && other.id !== id) throw new ConflictException('A panelist with this email already exists.');
      data.email = email;
    }
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    await this.prisma.panelist.update({ where: { id }, data });
    await this.audit(p.code, 'panelist_update', adminId, { fields: Object.keys(dto) });
    return this.shape(await this.byId(id));
  }

  async resendInvite(id: number, adminId: number | null) {
    const p = await this.byId(id);
    if (p.status === 'Disabled') throw new BadRequestException('This panelist is disabled. Enable them first.');
    await this.sendInvite(p, !!p.passwordHash);
    await this.audit(p.code, 'panelist_resend', adminId, {});
    return this.shape(await this.byId(id));
  }

  async setStatus(id: number, disable: boolean, adminId: number | null) {
    const p = await this.byId(id);
    const status = disable ? 'Disabled' : p.passwordHash ? 'Active' : 'Invited';
    await this.prisma.panelist.update({ where: { id }, data: { status } });
    await this.audit(p.code, disable ? 'panelist_disable' : 'panelist_enable', adminId, {});
    return this.shape(await this.byId(id));
  }

  async remove(id: number, adminId: number | null) {
    const p = await this.byId(id);
    if (await this.prisma.panelRating.count({ where: { panelistId: id } })) throw new BadRequestException('This panelist has ratings on record, so the account is kept. Disable it instead.');
    await this.prisma.panelist.delete({ where: { id } });
    await this.audit(p.code, 'panelist_remove', adminId, { email: p.email });
    return { ok: true };
  }

  // --------------------------------------------------------------- enrolment

  async enrol(comp: string, stagePosition: number, panelistId: number, conflictSchools: number[], adminId: number | null) {
    const { panel, stage } = await this.stages.load(comp, stagePosition);
    if (panel.state !== 'Draft' && panel.state !== 'Ready' && panel.state !== 'Open') throw new BadRequestException('Panelists cannot be added once the stage is closed.');
    const p = await this.byId(panelistId);
    if (p.status === 'Disabled') throw new BadRequestException('This panelist is disabled.');
    if (await this.prisma.panelEnrolment.findUnique({ where: { panelStageId_panelistId: { panelStageId: panel.id, panelistId } } })) throw new ConflictException('This panelist is already on the panel.');
    await this.prisma.panelEnrolment.create({ data: { panelStageId: panel.id, panelistId, conflictSchools: conflictSchools as Prisma.InputJsonValue } });
    if (panel.state === 'Ready') await this.prisma.panelStage.update({ where: { id: panel.id }, data: { state: 'Draft' } });
    await this.audit(comp, 'panel_enrol', adminId, { stage: stage.position, panelist: p.code, conflictSchools });
    return this.stages.status(comp, stagePosition);
  }

  async unenrol(comp: string, stagePosition: number, panelistId: number, adminId: number | null) {
    const { panel, stage } = await this.stages.load(comp, stagePosition);
    if (panel.state !== 'Draft' && panel.state !== 'Ready' && panel.state !== 'Open') throw new BadRequestException('The panel is locked once the stage is closed.');
    if (await this.prisma.panelRating.count({ where: { stageId: stage.id, panelistId } })) throw new BadRequestException('This panelist already has ratings in this stage, so they stay on the panel.');
    await this.prisma.panelEnrolment.deleteMany({ where: { panelStageId: panel.id, panelistId } });
    const p = await this.byId(panelistId);
    await this.audit(comp, 'panel_unenrol', adminId, { stage: stage.position, panelist: p.code });
    return this.stages.status(comp, stagePosition);
  }

  async setConflicts(comp: string, stagePosition: number, panelistId: number, conflictSchools: number[], adminId: number | null) {
    const { panel, stage } = await this.stages.load(comp, stagePosition);
    const e = await this.prisma.panelEnrolment.findUnique({ where: { panelStageId_panelistId: { panelStageId: panel.id, panelistId } } });
    if (!e) throw new NotFoundException('This panelist is not on the panel.');
    await this.prisma.panelEnrolment.update({ where: { id: e.id }, data: { conflictSchools: conflictSchools as Prisma.InputJsonValue } });
    await this.audit(comp, 'panel_conflicts', adminId, { stage: stage.position, panelistId, conflictSchools });
    return this.stages.status(comp, stagePosition);
  }

  // ------------------------------------------------------------- control view

  /** Per student: ratings received of required, average, level, flags. Per panelist: progress. */
  async control(comp: string, stagePosition: number) {
    const { competition, stage, panel } = await this.stages.load(comp, stagePosition);
    const status = await this.stages.status(comp, stagePosition);
    const roster = await this.stages.roster(stage);
    const scale = this.stages.scaleFor(competition);
    const form = await this.stages.snapshot(panel);
    const ratings = await this.prisma.panelRating.findMany({ where: { stageId: stage.id } });
    const adjud = new Set((await this.prisma.panelAdjudication.findMany({ where: { stageId: stage.id }, select: { registrationId: true } })).map((a) => a.registrationId));
    const results = form ? (await this.stages.compute(stage.id, panel, scale)).results : new Map();
    const students = roster.map((r) => {
      const mine = ratings.filter((x) => x.registrationId === r.registrationId);
      const submitted = mine.filter((x) => x.status === 'Submitted').length;
      const agg = results.get(r.registrationId);
      return {
        registrationId: r.registrationId,
        code: r.studentCode,
        name: r.studentName,
        grade: r.grade,
        school: r.school,
        required: panel.requiredRaters,
        submitted,
        drafts: mine.length - submitted,
        status: submitted >= panel.requiredRaters ? 'Rated' : 'Not rated',
        percent: agg?.status === 'Rated' ? Number((agg.percent ?? 0).toFixed(2)) : null,
        average: agg?.status === 'Rated' ? Number((agg.average ?? 0).toFixed(2)) : null,
        levelKey: agg?.status === 'Rated' ? agg.levelKey : null,
        levelLabel: agg?.status === 'Rated' ? scale.levels.find((l) => l.key === agg.levelKey)?.label ?? null : null,
        flagged: !!agg?.flagged,
        adjudicated: adjud.has(r.registrationId),
      };
    });
    const panelists = status.panelists.map((p) => {
      const conflicts = new Set(p.conflictSchools);
      const assigned = roster.filter((r) => !r.schoolId || !conflicts.has(r.schoolId)).length;
      const mine = ratings.filter((x) => x.panelistId === p.panelistId);
      const submitted = mine.filter((x) => x.status === 'Submitted').length;
      const drafts = mine.length - submitted;
      return { panelistId: p.panelistId, name: p.name, email: p.email, status: p.status, assigned, submitted, drafts, notStarted: Math.max(0, assigned - mine.length) };
    });
    return {
      ...status,
      levels: scale.levels.map((l) => ({ key: l.key, label: l.label })),
      students,
      panelistProgress: panelists,
      summary: {
        students: students.length,
        rated: students.filter((s) => s.status === 'Rated').length,
        missing: students.filter((s) => s.status !== 'Rated').length,
        flagged: students.filter((s) => s.flagged).length,
      },
    };
  }

  /** One student's ratings by panelist (an admin may see them) and the combined result. */
  async studentDetail(comp: string, stagePosition: number, registrationId: number) {
    const { competition, stage, panel } = await this.stages.load(comp, stagePosition);
    const form = await this.stages.snapshot(panel);
    if (!form) throw new BadRequestException('This stage has no evaluation form.');
    const reg = await this.prisma.registration.findFirst({ where: { id: registrationId, competitionId: stage.competitionId }, include: { student: { select: { code: true, name: true } } } });
    if (!reg) throw new NotFoundException('Student not found in this competition.');
    const scale = this.stages.scaleFor(competition);
    const rows = await this.prisma.panelRating.findMany({ where: { stageId: stage.id, registrationId }, include: { panelist: { select: { name: true, code: true } } }, orderBy: { id: 'asc' } });
    const adj = await this.prisma.panelAdjudication.findUnique({ where: { stageId_registrationId: { stageId: stage.id, registrationId } } });
    const submitted: SubmittedRating[] = rows.filter((r) => r.status === 'Submitted').map((r) => ({ panelistId: r.panelistId, ratings: r.ratings as unknown as RatingMap }));
    const agg = aggregateStage(form, submitted, scale, { requiredRaters: panel.requiredRaters, overrides: (adj?.overrides as Record<string, number> | undefined) ?? {} });
    return {
      student: { registrationId, code: reg.student.code, name: reg.student.name },
      form: { code: form.code, title: form.title, noteLabel: form.settings.noteLabel, competencies: form.competencies },
      ratings: rows.map((r) => ({ id: r.id, panelist: r.panelist.name, panelistCode: r.panelist.code, status: r.status, ratings: r.ratings, note: r.note, submittedAt: r.submittedAt, reopenedAt: r.reopenedAt, reopenedByName: r.reopenedByName })),
      result: agg,
      adjudication: adj ? { overrides: adj.overrides, reason: adj.reason, decidedByName: adj.decidedByName, decidedAt: adj.decidedAt } : null,
    };
  }

  async adjudicate(comp: string, stagePosition: number, registrationId: number, overrides: Record<string, number>, reason: string, adminId: number | null) {
    const { panel, stage } = await this.stages.load(comp, stagePosition);
    if (panel.state !== 'Closed') throw new BadRequestException(`Disagreements are decided after the stage is closed and before it is finalized (this one is ${panel.state}).`);
    const form = await this.stages.snapshot(panel);
    if (!form) throw new BadRequestException('This stage has no evaluation form.');
    const clean: Record<string, number> = {};
    for (const [code, pts] of Object.entries(overrides)) {
      const c = form.competencies.find((x) => x.code === code);
      if (!c) throw new BadRequestException(`"${code}" is not a competency of this form.`);
      if (!c.options.some((o) => o.points === pts)) throw new BadRequestException(`${c.label}: ${pts} is not one of the points this competency can give.`);
      clean[code] = pts;
    }
    if (!Object.keys(clean).length) throw new BadRequestException('Give the decided points for at least one competency.');
    const admin = adminId ? await this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
    await this.prisma.panelAdjudication.upsert({
      where: { stageId_registrationId: { stageId: stage.id, registrationId } },
      create: { stageId: stage.id, registrationId, overrides: clean as Prisma.InputJsonValue, reason, decidedById: adminId, decidedByName: admin?.name ?? null },
      update: { overrides: clean as Prisma.InputJsonValue, reason, decidedById: adminId, decidedByName: admin?.name ?? null, decidedAt: new Date() },
    });
    await this.audit(comp, 'rating_adjudicate', adminId, { stage: stage.position, registrationId, overrides: clean, reason });
    return this.studentDetail(comp, stagePosition, registrationId);
  }

  /** Only an administrator can send a submitted rating back to its panelist; allowed while the stage is open, and always logged. */
  async reopenRating(ratingId: number, reason: string, adminId: number | null) {
    const r = await this.prisma.panelRating.findUnique({ where: { id: ratingId }, include: { panelist: true } });
    if (!r) throw new NotFoundException('Rating not found');
    if (r.status !== 'Submitted') throw new BadRequestException('This rating is not submitted.');
    const { panel, competition, stage } = await this.stages.loadById(r.stageId);
    if (panel.state !== 'Open') throw new BadRequestException(`Ratings can be reopened only while the stage is open (this one is ${panel.state}). Use the stage override first.`);
    const admin = adminId ? await this.prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } }) : null;
    await this.prisma.panelRating.update({ where: { id: ratingId }, data: { status: 'Draft', reopenedAt: new Date(), reopenedByName: admin?.name ?? null, submittedAt: null } });
    await this.audit(competition.code, 'rating_reopen', adminId, { stage: stage.position, registrationId: r.registrationId, panelist: r.panelist.code, reason });
    return { ok: true };
  }

  /** Reminds the panelists who still have students to rate. */
  async remind(comp: string, stagePosition: number, panelistId: number | undefined, adminId: number | null) {
    const c = await this.control(comp, stagePosition);
    if (c.state !== 'Open') throw new BadRequestException('Reminders go out while the stage is open.');
    let sent = 0;
    for (const p of c.panelistProgress) {
      if (panelistId && p.panelistId !== panelistId) continue;
      const pending = p.notStarted + p.drafts;
      if (pending < 1) continue;
      const row = await this.prisma.panelist.findUnique({ where: { id: p.panelistId } });
      if (!row || row.status !== 'Active') continue;
      void this.messaging.dispatch('PANEL_REMINDER', { email: row.email, phone: row.phone }, { Name: row.name, Pending: pending, StageName: c.stage.name, CompetitionTitle: c.competition.title, PanelLink: `${SITE_URL}/panel` });
      sent++;
    }
    await this.audit(comp, 'panel_remind', adminId, { stage: stagePosition, sent, panelistId: panelistId ?? 'all' });
    return { sent };
  }

  async exportXlsx(comp: string, stagePosition: number): Promise<Buffer> {
    const c = await this.control(comp, stagePosition);
    const headers = ['Student code', 'Student name', 'Grade', 'School', 'Ratings received', 'Ratings required', 'Drafts', 'Status', 'Stage score %', 'Average points', 'Level', 'Disagreement', 'Decided by admin'];
    const rows = c.students.map((s) => [s.code, s.name, s.grade, s.school ?? '', s.submitted, s.required, s.drafts, s.status, s.percent ?? '', s.average ?? '', s.levelLabel ?? '', s.flagged ? 'Yes' : '', s.adjudicated ? 'Yes' : '']);
    return toXlsxBuffer('Panel ratings', headers, rows);
  }
}
