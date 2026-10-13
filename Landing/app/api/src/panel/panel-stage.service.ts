import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FrameworkScale, normalizeConfig, standardEdpaScale } from '../common/scorecard-config';
import { FormSnapshot, buildSnapshot, normalizePanelSettings } from '../common/panel-form';
import { StageAggregate, SubmittedRating, aggregateStage, RatingMap } from '../common/panel-scoring';
import { OVERRIDE_TARGET, PanelState, closeWarnings, isPanelState, openBlockers, readyIssues } from '../common/panel-lifecycle';

export interface RosterRow {
  registrationId: number;
  studentCode: string;
  studentName: string;
  grade: string;
  schoolId: number | null;
  school: string | null;
}

// The shared core of panel-rated stages (#76, #78, #81): the roster, the form and scale a stage
// uses, the lifecycle (Draft -> Ready -> Open -> Closed -> Finalized -> Selected -> Released) with
// the rules enforced on the server, aggregation, and the audit trail of every override.
@Injectable()
export class PanelStageService {
  constructor(private readonly prisma: PrismaService) {}

  async audit(competitionCode: string, action: string, admin: { id: number | null } | null, summary: Record<string, unknown>) {
    const a = admin?.id ? await this.prisma.admin.findUnique({ where: { id: admin.id }, select: { name: true } }) : null;
    await this.prisma.configAuditLog.create({
      data: { entity: 'panel', entityCode: competitionCode, action, adminId: admin?.id ?? null, adminName: a?.name ?? null, summary: summary as Prisma.InputJsonValue },
    });
  }

  // ------------------------------------------------------------------ lookup

  /** The competition stage plus its panel row (created empty the first time). */
  async load(competitionCode: string, stagePosition: number) {
    const competition = await this.prisma.competition.findUnique({ where: { code: competitionCode }, include: { season: { include: { framework: true } } } });
    if (!competition) throw new NotFoundException('Competition not found');
    const stage = await this.prisma.competitionStage.findUnique({ where: { competitionId_position: { competitionId: competition.id, position: stagePosition } } });
    if (!stage) throw new NotFoundException(`This competition has no stage ${stagePosition}.`);
    const panel = await this.prisma.panelStage.upsert({ where: { stageId: stage.id }, create: { stageId: stage.id }, update: {} });
    return { competition, stage, panel };
  }

  async loadById(stageId: number) {
    const stage = await this.prisma.competitionStage.findUnique({ where: { id: stageId }, include: { competition: { include: { season: { include: { framework: true } } } } } });
    if (!stage) throw new NotFoundException('Stage not found');
    const panel = await this.prisma.panelStage.findUnique({ where: { stageId } });
    if (!panel) throw new NotFoundException('This stage is not panel-rated.');
    return { competition: stage.competition, stage, panel };
  }

  /** The level scale of the competition's season framework (or the standard one). */
  scaleFor(competition: { scaleKey: string | null; season: { scaleKey: string | null; framework: { config: unknown } } | null }): FrameworkScale {
    const fw = competition.season?.framework;
    if (!fw) return standardEdpaScale();
    const cfg = normalizeConfig(fw.config);
    const key = competition.scaleKey ?? competition.season?.scaleKey ?? cfg.defaultScale;
    return cfg.scales.find((s) => s.key === key) ?? cfg.scales[0] ?? standardEdpaScale();
  }

  /** The form as panelists see it: frozen when the stage opened, otherwise built live from the form. */
  async snapshot(panel: { formId: number | null; formSnapshot: unknown }): Promise<FormSnapshot | null> {
    if (panel.formSnapshot) return panel.formSnapshot as FormSnapshot;
    if (!panel.formId) return null;
    const form = await this.prisma.assessment.findUnique({ where: { id: panel.formId } });
    if (!form) return null;
    const qs = await this.prisma.question.findMany({ where: { assessmentId: form.id }, orderBy: { id: 'asc' } });
    return buildSnapshot(
      { code: form.code, title: form.title },
      qs.map((q) => ({ code: q.code, category: q.category, label: q.label, prompt: q.prompt, options: q.options, optionPoints: q.optionPoints, optionHints: q.optionHints, weight: q.weight })),
      normalizePanelSettings({ ...(((form.config as { panel?: object })?.panel) ?? {}) }),
    );
  }

  // ------------------------------------------------------------------ roster

  /** The students who qualified into the stage: everyone for a first stage, else those the previous stage's selection unlocked. */
  async roster(stage: { id: number; competitionId: number; position: number }): Promise<RosterRow[]> {
    const first = await this.prisma.competitionStage.findFirst({ where: { competitionId: stage.competitionId }, orderBy: { position: 'asc' }, select: { id: true } });
    const where: Prisma.RegistrationWhereInput =
      first?.id === stage.id
        ? { competitionId: stage.competitionId }
        : { competitionId: stage.competitionId, stages: { some: { stageId: stage.id, status: { not: 'Locked' } } } };
    const regs = await this.prisma.registration.findMany({
      where: { ...where, student: { archived: false } },
      select: { id: true, student: { select: { code: true, name: true, grade: true, schoolId: true, school: { select: { name: true } } } } },
    });
    return regs
      .map((r) => ({ registrationId: r.id, studentCode: r.student.code, studentName: r.student.name, grade: r.student.grade, schoolId: r.student.schoolId, school: r.student.school?.name ?? null }))
      .sort((a, b) => a.studentCode.localeCompare(b.studentCode, undefined, { numeric: true }));
  }

  /** Whether the stage before this one is closed with its selection committed (online or panel). */
  private async previousFacts(stage: { competitionId: number; position: number }) {
    const prev = await this.prisma.competitionStage.findFirst({ where: { competitionId: stage.competitionId, position: { lt: stage.position } }, orderBy: { position: 'desc' } });
    if (!prev) return null;
    const panel = await this.prisma.panelStage.findUnique({ where: { stageId: prev.id } });
    if (panel && panel.formId) return { position: prev.position, name: prev.name, decided: panel.state === 'Selected' || panel.state === 'Released' };
    const rows = await this.prisma.registrationStage.findMany({ where: { stageId: prev.id, status: { in: ['Attempted', 'Qualified', 'Eliminated'] } }, select: { status: true } });
    const decided = rows.length > 0 && !rows.some((r) => r.status === 'Attempted');
    return { position: prev.position, name: prev.name, decided };
  }

  // ------------------------------------------------------------------- status

  /** Everything the admin screen needs about one stage: setup, checklist, why it cannot open, counts. */
  async status(competitionCode: string, stagePosition: number) {
    const { competition, stage, panel } = await this.load(competitionCode, stagePosition);
    const form = panel.formId ? await this.prisma.assessment.findUnique({ where: { id: panel.formId } }) : null;
    const roster = await this.roster(stage);
    const enrolments = await this.prisma.panelEnrolment.findMany({ where: { panelStageId: panel.id }, include: { panelist: true }, orderBy: { id: 'asc' } });
    const state = panel.state as PanelState;
    const other = await this.prisma.panelStage.findFirst({ where: { state: 'Open', stageId: { not: stage.id }, stage: { competitionId: competition.id } }, include: { stage: { select: { position: true, name: true } } } });
    const ready = readyIssues({ formPublished: form?.status === 'Published', formAssigned: !!form, panelists: enrolments.filter((e) => e.panelist.status !== 'Disabled').length, requiredRaters: panel.requiredRaters, rosterSize: roster.length });
    const blockers = openBlockers({ state: state === 'Draft' && ready.length === 0 ? 'Ready' : state, previous: await this.previousFacts(stage), otherOpen: other ? { position: other.stage.position, name: other.stage.name } : null });
    const ratings = await this.prisma.panelRating.groupBy({ by: ['status'], where: { stageId: stage.id }, _count: { _all: true } });
    return {
      competition: { code: competition.code, title: competition.title },
      stage: { id: stage.id, position: stage.position, name: stage.name, mode: stage.mode, passMark: Number(stage.passMark), maxQualifiers: stage.maxQualifiers },
      state,
      form: form ? { code: form.code, title: form.title, status: form.status } : null,
      requiredRaters: panel.requiredRaters,
      rosterSize: roster.length,
      panelists: enrolments.map((e) => ({ enrolmentId: e.id, panelistId: e.panelistId, code: e.panelist.code, name: e.panelist.name, email: e.panelist.email, status: e.panelist.status, conflictSchools: e.conflictSchools as number[] })),
      readyIssues: ready,
      // Why "Open" is disabled, in plain words (empty when it can be opened)
      openBlockers: state === 'Open' ? [] : blockers,
      canMarkReady: state === 'Draft' && ready.length === 0,
      canOpen: blockers.length === 0,
      ratings: { submitted: ratings.find((r) => r.status === 'Submitted')?._count._all ?? 0, drafts: ratings.find((r) => r.status === 'Draft')?._count._all ?? 0 },
      openedAt: panel.openedAt,
      closedAt: panel.closedAt,
      finalizedAt: panel.finalizedAt,
      selectedAt: panel.selectedAt,
      releasedAt: panel.releasedAt,
    };
  }

  async setup(competitionCode: string, stagePosition: number, dto: { formCode?: string; requiredRaters?: number }, admin: { id: number | null }) {
    const { stage, panel } = await this.load(competitionCode, stagePosition);
    if (panel.state !== 'Draft' && panel.state !== 'Ready') throw new BadRequestException('The setup is locked once the stage has opened.');
    const data: Prisma.PanelStageUpdateInput = {};
    if (dto.formCode !== undefined) {
      if (dto.formCode === '') data.formId = null;
      else {
        const form = await this.prisma.assessment.findUnique({ where: { code: dto.formCode } });
        if (!form || form.kind !== 'panel') throw new BadRequestException('Choose a panel evaluation form.');
        data.formId = form.id;
        if (dto.requiredRaters === undefined) data.requiredRaters = normalizePanelSettings((form.config as { panel?: unknown })?.panel).requiredRaters;
      }
    }
    if (dto.requiredRaters !== undefined) data.requiredRaters = dto.requiredRaters;
    data.state = 'Draft';
    await this.prisma.panelStage.update({ where: { id: panel.id }, data });
    await this.audit(competitionCode, 'stage_setup', admin, { stage: stage.position, ...dto });
    return this.status(competitionCode, stagePosition);
  }

  // ---------------------------------------------------------------- lifecycle

  async markReady(competitionCode: string, stagePosition: number, admin: { id: number | null }) {
    const s = await this.status(competitionCode, stagePosition);
    if (s.state !== 'Draft') throw new BadRequestException(`This stage is ${s.state}.`);
    if (s.readyIssues.length) throw new BadRequestException(`Not ready: ${s.readyIssues.join(' ')}`);
    await this.prisma.panelStage.update({ where: { stageId: s.stage.id }, data: { state: 'Ready' } });
    await this.audit(competitionCode, 'stage_ready', admin, { stage: stagePosition });
    return this.status(competitionCode, stagePosition);
  }

  async open(competitionCode: string, stagePosition: number, admin: { id: number | null }) {
    let s = await this.status(competitionCode, stagePosition);
    if (s.state === 'Draft' && s.readyIssues.length === 0) {
      await this.prisma.panelStage.update({ where: { stageId: s.stage.id }, data: { state: 'Ready' } });
      s = await this.status(competitionCode, stagePosition);
    }
    if (s.state !== 'Ready') throw new BadRequestException(s.openBlockers.join(' ') || `This stage is ${s.state}.`);
    if (s.openBlockers.length) throw new BadRequestException(s.openBlockers.join(' '));
    const { panel } = await this.load(competitionCode, stagePosition);
    const snapshot = await this.snapshot(panel);
    if (!snapshot) throw new BadRequestException('Choose the evaluation form first.');
    // the form is frozen from here on: later edits to the form never change what is rated
    await this.prisma.panelStage.update({ where: { id: panel.id }, data: { state: 'Open', openedAt: new Date(), formSnapshot: snapshot as unknown as Prisma.InputJsonValue } });
    await this.audit(competitionCode, 'stage_open', admin, { stage: stagePosition, form: snapshot.code });
    return this.status(competitionCode, stagePosition);
  }

  /** Counts what closing would leave behind, so an admin can be warned first. */
  async closeFacts(stageId: number, requiredRaters: number, roster: RosterRow[]) {
    const ratings = await this.prisma.panelRating.findMany({ where: { stageId }, select: { registrationId: true, status: true } });
    const submitted = new Map<number, number>();
    let draftRatings = 0;
    for (const r of ratings) {
      if (r.status === 'Submitted') submitted.set(r.registrationId, (submitted.get(r.registrationId) ?? 0) + 1);
      else draftRatings++;
    }
    const underRated = roster.filter((r) => (submitted.get(r.registrationId) ?? 0) < requiredRaters).length;
    return { draftRatings, underRated, roster: roster.length };
  }

  async close(competitionCode: string, stagePosition: number, confirm: boolean, admin: { id: number | null }) {
    const { stage, panel } = await this.load(competitionCode, stagePosition);
    if (panel.state !== 'Open') throw new BadRequestException(`Only an open stage can be closed (this one is ${panel.state}).`);
    const facts = await this.closeFacts(stage.id, panel.requiredRaters, await this.roster(stage));
    const warnings = closeWarnings(facts);
    if (warnings.length && !confirm) throw new BadRequestException({ message: `Closing now would leave: ${warnings.join(' ')} Confirm to close anyway.`, warnings, needsConfirm: true });
    await this.prisma.panelStage.update({ where: { id: panel.id }, data: { state: 'Closed', closedAt: new Date() } });
    await this.audit(competitionCode, 'stage_close', admin, { stage: stagePosition, ...facts, confirmed: confirm });
    return { ...(await this.status(competitionCode, stagePosition)), warnings };
  }

  /** The ratings and decisions that make up a stage result, per student, and the result they give. */
  async compute(stageId: number, panel: { requiredRaters: number; formId: number | null; formSnapshot: unknown }, scale: FrameworkScale) {
    const form = await this.snapshot(panel);
    if (!form) throw new BadRequestException('This stage has no evaluation form.');
    const ratings = await this.prisma.panelRating.findMany({ where: { stageId, status: 'Submitted' } });
    const adj = await this.prisma.panelAdjudication.findMany({ where: { stageId } });
    const byReg = new Map<number, SubmittedRating[]>();
    for (const r of ratings) byReg.set(r.registrationId, [...(byReg.get(r.registrationId) ?? []), { panelistId: r.panelistId, ratings: r.ratings as unknown as RatingMap }]);
    const overrides = new Map(adj.map((a) => [a.registrationId, a.overrides as Record<string, number>]));
    const out = new Map<number, StageAggregate>();
    for (const [reg, list] of byReg) out.set(reg, aggregateStage(form, list, scale, { requiredRaters: panel.requiredRaters, overrides: overrides.get(reg) }));
    // an adjudicated student with no submitted ratings left still needs an entry
    return { form, results: out, adjudicated: new Set(adj.map((a) => a.registrationId)) };
  }

  async finalize(competitionCode: string, stagePosition: number, force: boolean, admin: { id: number | null }) {
    const { competition, stage, panel } = await this.load(competitionCode, stagePosition);
    if (panel.state !== 'Closed') throw new BadRequestException(`Only a closed stage can be finalized (this one is ${panel.state}).`);
    const scale = this.scaleFor(competition);
    const { results } = await this.compute(stage.id, panel, scale);
    const roster = await this.roster(stage);
    const flagged = roster.filter((r) => results.get(r.registrationId)?.flagged);
    if (flagged.length && !force) {
      throw new BadRequestException({ message: `${flagged.length} student(s) have ratings that disagree and no decision yet (${flagged.slice(0, 5).map((f) => f.studentCode).join(', ')}${flagged.length > 5 ? '…' : ''}). Decide them, or finalize anyway.`, flagged: flagged.map((f) => f.studentCode) });
    }
    const rows = roster.map((r) => {
      const agg = results.get(r.registrationId);
      return {
        stageId: stage.id,
        registrationId: r.registrationId,
        status: agg?.status === 'Rated' ? 'Rated' : 'NotRated',
        percent: agg?.status === 'Rated' && agg.percent !== null ? new Prisma.Decimal(agg.percent.toFixed(2)) : null,
        levelKey: agg?.status === 'Rated' ? agg.levelKey : null,
        competencies: (agg?.competencies ?? []) as unknown as Prisma.InputJsonValue,
        ratersCount: agg?.ratersCount ?? 0,
        flagged: agg?.flagged ?? false,
        computedAt: new Date(),
      };
    });
    await this.prisma.$transaction([
      this.prisma.panelResult.deleteMany({ where: { stageId: stage.id } }),
      this.prisma.panelResult.createMany({ data: rows }),
      this.prisma.panelStage.update({ where: { id: panel.id }, data: { state: 'Finalized', finalizedAt: new Date() } }),
    ]);
    await this.audit(competitionCode, 'stage_finalize', admin, { stage: stagePosition, rated: rows.filter((r) => r.status === 'Rated').length, notRated: rows.filter((r) => r.status === 'NotRated').length, forced: flagged.length > 0 });
    return { ...(await this.status(competitionCode, stagePosition)), rated: rows.filter((r) => r.status === 'Rated').length, notRated: rows.filter((r) => r.status === 'NotRated').length };
  }

  /** An administrator sends a closed or finalized stage back one step. Always needs a reason and is always logged. */
  async override(competitionCode: string, stagePosition: number, reason: string, admin: { id: number | null }) {
    const { panel, stage } = await this.load(competitionCode, stagePosition);
    const target = OVERRIDE_TARGET[panel.state];
    if (!target) throw new BadRequestException(panel.state === 'Selected' || panel.state === 'Released' ? 'A committed selection cannot be undone.' : `A stage that is ${panel.state} has nothing to override.`);
    if (target === 'Open') {
      const other = await this.prisma.panelStage.findFirst({ where: { state: 'Open', stageId: { not: stage.id }, stage: { competitionId: stage.competitionId } } });
      if (other) throw new BadRequestException('Another stage of this competition is open.');
    }
    const data: Prisma.PanelStageUpdateInput = { state: target };
    if (target === 'Open') data.closedAt = null;
    if (panel.state === 'Finalized') data.finalizedAt = null;
    await this.prisma.panelStage.update({ where: { id: panel.id }, data });
    if (panel.state === 'Finalized') await this.prisma.panelResult.deleteMany({ where: { stageId: stage.id } });
    await this.audit(competitionCode, 'stage_override', admin, { stage: stagePosition, from: panel.state, to: target, reason });
    return this.status(competitionCode, stagePosition);
  }

  /** Marks a selected stage's results as released for use in student reports. */
  async release(competitionCode: string, stagePosition: number, admin: { id: number | null }) {
    const { panel } = await this.load(competitionCode, stagePosition);
    if (panel.state !== 'Selected') throw new BadRequestException(`Only a stage whose selection is committed can be released (this one is ${panel.state}).`);
    await this.prisma.panelStage.update({ where: { id: panel.id }, data: { state: 'Released', releasedAt: new Date() } });
    await this.audit(competitionCode, 'stage_release', admin, { stage: stagePosition });
    return this.status(competitionCode, stagePosition);
  }

  // ------------------------------------------------------------------- guards

  /** Panel ratings are only taken while the stage is open. Throws otherwise (used by the portal). */
  assertOpen(state: string) {
    if (!isPanelState(state) || state !== 'Open') throw new BadRequestException('This stage is not open for rating.');
  }
}
