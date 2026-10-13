import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PanelStageService, RosterRow } from './panel-stage.service';
import { RatingMap, SubmittedRating, aggregateStage, validateRating } from '../common/panel-scoring';
import { ContentIndex, buildIndex, resolveText } from '../common/content-library';
import { buildObserverDraft } from '../common/panel-narrative';
import { SaveRatingDto } from './panel.dto';

// What a panelist can do (#79, #80, #85). Every method takes the panelist from the sign-in, and
// every method checks again that they are active, enrolled in the stage, and — for ratings — that
// the stage is open and the student is theirs to rate. Nothing here ever returns another
// panelist's rating.
@Injectable()
export class PanelPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stages: PanelStageService,
  ) {}

  private async me(panelistId: number) {
    const p = await this.prisma.panelist.findUnique({ where: { id: panelistId } });
    if (!p || p.status !== 'Active') throw new ForbiddenException('This account cannot be used.');
    return p;
  }

  /** The stage, if the panelist is enrolled in it. Otherwise it looks like it does not exist. */
  private async enrolled(panelistId: number, stageId: number) {
    const { competition, stage, panel } = await this.stages.loadById(stageId).catch(() => {
      throw new NotFoundException('Stage not found');
    });
    const e = await this.prisma.panelEnrolment.findUnique({ where: { panelStageId_panelistId: { panelStageId: panel.id, panelistId } } });
    if (!e) throw new NotFoundException('Stage not found');
    return { competition, stage, panel, conflicts: new Set((e.conflictSchools as number[]) ?? []) };
  }

  private assigned(roster: RosterRow[], conflicts: Set<number>) {
    return roster.filter((r) => !r.schoolId || !conflicts.has(r.schoolId));
  }

  async profile(panelistId: number) {
    const p = await this.me(panelistId);
    return { id: p.id, code: p.code, name: p.name, email: p.email };
  }

  // --------------------------------------------------------------- dashboard

  async dashboard(panelistId: number) {
    await this.me(panelistId);
    const rows = await this.prisma.panelEnrolment.findMany({
      where: { panelistId, panelStage: { formId: { not: null } } },
      include: { panelStage: { include: { stage: { include: { competition: { select: { code: true, title: true } } } } } } },
      orderBy: { id: 'desc' },
    });
    const out: Record<string, unknown>[] = [];
    for (const e of rows) {
      const stage = e.panelStage.stage;
      const roster = this.assigned(await this.stages.roster(stage), new Set((e.conflictSchools as number[]) ?? []));
      const mine = await this.prisma.panelRating.findMany({ where: { stageId: stage.id, panelistId, registrationId: { in: roster.map((r) => r.registrationId) } }, select: { status: true } });
      const state = e.panelStage.state;
      out.push({
        stageId: stage.id,
        competition: stage.competition.code,
        competitionTitle: stage.competition.title,
        stage: stage.position,
        stageName: stage.name,
        state,
        label: state === 'Open' ? 'Rate now' : state === 'Draft' || state === 'Ready' ? 'Not open yet' : 'Closed',
        canRate: state === 'Open',
        progress: { rated: mine.filter((m) => m.status === 'Submitted').length, drafts: mine.filter((m) => m.status === 'Draft').length, total: roster.length },
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- students

  async students(panelistId: number, stageId: number, q: { search?: string; school?: string; status?: string }) {
    await this.me(panelistId);
    const { stage, panel, conflicts } = await this.enrolled(panelistId, stageId);
    this.stages.assertOpen(panel.state);
    const roster = this.assigned(await this.stages.roster(stage), conflicts);
    const mine = await this.prisma.panelRating.findMany({ where: { stageId, panelistId } });
    const byReg = new Map(mine.map((m) => [m.registrationId, m]));
    let rows = roster.map((r) => {
      const rating = byReg.get(r.registrationId);
      return { registrationId: r.registrationId, code: r.studentCode, name: r.studentName, grade: r.grade, school: r.school, status: rating ? (rating.status === 'Submitted' ? 'Submitted' : 'Draft') : 'Not started' };
    });
    const total = rows.length;
    if (q.search) {
      const n = q.search.toLowerCase();
      rows = rows.filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(n));
    }
    if (q.school) rows = rows.filter((r) => r.school === q.school);
    if (q.status) rows = rows.filter((r) => r.status === q.status);
    const schools = [...new Set(roster.map((r) => r.school).filter((s): s is string => !!s))].sort();
    return { stage: { id: stage.id, position: stage.position, name: stage.name }, total, schools, rows };
  }

  // ------------------------------------------------------------------ rating

  private async studentOf(roster: RosterRow[], registrationId: number) {
    const s = roster.find((r) => r.registrationId === registrationId);
    // a student who is not in this stage's roster (or is another school's conflict) looks like it does not exist
    if (!s) throw new NotFoundException('Student not found');
    return s;
  }

  async rating(panelistId: number, stageId: number, registrationId: number) {
    await this.me(panelistId);
    const { stage, panel, conflicts } = await this.enrolled(panelistId, stageId);
    this.stages.assertOpen(panel.state);
    const student = await this.studentOf(this.assigned(await this.stages.roster(stage), conflicts), registrationId);
    const form = await this.stages.snapshot(panel);
    if (!form) throw new BadRequestException('This stage has no evaluation form.');
    const mine = await this.prisma.panelRating.findUnique({ where: { stageId_registrationId_panelistId: { stageId, registrationId, panelistId } } });
    return {
      stage: { id: stage.id, position: stage.position, name: stage.name },
      student: { registrationId, code: student.studentCode, name: student.studentName, grade: student.grade, school: student.school },
      form: { code: form.code, title: form.title, noteLabel: form.settings.noteLabel, noteRequired: form.settings.noteRequired, requireComment: form.settings.requireComment, competencies: form.competencies },
      rating: mine ? { status: mine.status, ratings: mine.ratings, note: mine.note ?? '', submittedAt: mine.submittedAt } : { status: 'Not started', ratings: {}, note: '', submittedAt: null },
    };
  }

  /** Saves a draft, or submits (validates every competency, then locks). Ratings outside the open window are refused. */
  async save(panelistId: number, stageId: number, registrationId: number, dto: SaveRatingDto) {
    await this.me(panelistId);
    const { stage, panel, conflicts } = await this.enrolled(panelistId, stageId);
    this.stages.assertOpen(panel.state);
    await this.studentOf(this.assigned(await this.stages.roster(stage), conflicts), registrationId);
    const form = await this.stages.snapshot(panel);
    if (!form) throw new BadRequestException('This stage has no evaluation form.');
    const key = { stageId_registrationId_panelistId: { stageId, registrationId, panelistId } };
    const existing = await this.prisma.panelRating.findUnique({ where: key });
    if (existing?.status === 'Submitted') throw new ForbiddenException('This rating has been submitted and is locked. Only an administrator can reopen it.');
    const v = validateRating(form, dto.ratings as Parameters<typeof validateRating>[1], { requireAll: !!dto.submit });
    const note = (dto.note ?? '').trim();
    const errors = [...v.errors];
    if (dto.submit && form.settings.noteRequired && !note) errors.push(`${form.settings.noteLabel}: write a note before submitting.`);
    if (errors.length) throw new BadRequestException({ message: errors[0], errors });
    const data = { ratings: v.ratings as unknown as Prisma.InputJsonValue, note: note || null, status: dto.submit ? 'Submitted' : 'Draft', submittedAt: dto.submit ? new Date() : null };
    await this.prisma.panelRating.upsert({ where: key, create: { stageId, registrationId, panelistId, ...data }, update: data });
    return this.rating(panelistId, stageId, registrationId);
  }

  // --------------------------------------------------------------- narrative

  private async approvedIndex(libraryId: number): Promise<ContentIndex> {
    const rows = await this.prisma.scorecardText.findMany({ where: { libraryId, approvedVersionId: { not: null } }, include: { approvedVersion: true } });
    return buildIndex(rows.filter((r) => r.approvedVersion).map((r) => ({ kind: r.kind, key: r.key, levelKey: r.levelKey, language: r.language, position: r.position, title: r.approvedVersion!.title, text: r.approvedVersion!.text, version: r.approvedVersion!.version })));
  }

  /** Narrative editing opens once ratings are closed, and ends when the stage is released into reports. */
  private assertNarrativeWindow(state: string) {
    if (state === 'Draft' || state === 'Ready' || state === 'Open') throw new BadRequestException('The note can be written once the stage is closed.');
    if (state === 'Released') throw new ForbiddenException('This stage has been released, so its notes are locked.');
  }

  /** The students of a closed stage with the state of their observer note: none yet, draft, or approved. */
  async notes(panelistId: number, stageId: number) {
    await this.me(panelistId);
    const { stage, panel, conflicts } = await this.enrolled(panelistId, stageId);
    this.assertNarrativeWindow(panel.state);
    const roster = this.assigned(await this.stages.roster(stage), conflicts);
    const rows = await this.prisma.panelNarrative.findMany({ where: { stageId } });
    const byReg = new Map(rows.map((r) => [r.registrationId, r]));
    return {
      stage: { id: stage.id, position: stage.position, name: stage.name },
      rows: roster.map((r) => {
        const n = byReg.get(r.registrationId);
        return { registrationId: r.registrationId, code: r.studentCode, name: r.studentName, school: r.school, status: !n ? 'Not started' : n.approvedText && n.approvedText === n.draftText ? 'Approved' : n.approvedText ? 'Edited since approval' : 'Draft' };
      }),
    };
  }

  async narrative(panelistId: number, stageId: number, registrationId: number) {
    await this.me(panelistId);
    const { competition, stage, panel, conflicts } = await this.enrolled(panelistId, stageId);
    this.assertNarrativeWindow(panel.state);
    const student = await this.studentOf(this.assigned(await this.stages.roster(stage), conflicts), registrationId);
    let row = await this.prisma.panelNarrative.findUnique({ where: { stageId_registrationId: { stageId, registrationId } } });
    let gaps: string[] = [];
    if (!row) {
      const form = await this.stages.snapshot(panel);
      if (!form) throw new BadRequestException('This stage has no evaluation form.');
      const submitted = await this.prisma.panelRating.findMany({ where: { stageId, registrationId, status: 'Submitted' }, orderBy: { panelistId: 'asc' } });
      const agg = aggregateStage(form, submitted.map((r): SubmittedRating => ({ panelistId: r.panelistId, ratings: r.ratings as unknown as RatingMap })), this.stages.scaleFor(competition), { requiredRaters: panel.requiredRaters });
      const season = competition.season ? await this.prisma.scorecardSeason.findUnique({ where: { id: competition.season.id }, include: { library: true } }) : null;
      const index = season?.library ? await this.approvedIndex(season.library.id) : buildIndex([]);
      const lang = season?.library?.defaultLanguage ?? 'en';
      const person = await this.prisma.registration.findUnique({ where: { id: registrationId }, select: { student: { select: { gender: true } } } });
      const draft = buildObserverDraft({
        name: student.studentName,
        gender: person?.student.gender,
        competencies: agg.competencies,
        notes: submitted.map((r) => r.note ?? '').filter(Boolean),
        text: (kind, key, level) => resolveText(index, { kind, key, level, language: lang, defaultLanguage: lang }).item?.text ?? null,
      });
      gaps = draft.gaps;
      row = await this.prisma.panelNarrative.create({ data: { stageId, registrationId, systemDraft: draft.text, draftText: draft.text } });
    }
    return { student: { registrationId, code: student.studentCode, name: student.studentName }, systemDraft: row.systemDraft, draftText: row.draftText, approvedText: row.approvedText, approvedAt: row.approvedAt, approvedByName: row.approvedByName, gaps };
  }

  async saveNarrative(panelistId: number, stageId: number, registrationId: number, text: string) {
    await this.narrative(panelistId, stageId, registrationId);
    await this.prisma.panelNarrative.update({ where: { stageId_registrationId: { stageId, registrationId } }, data: { draftText: text.trim() } });
    return this.narrative(panelistId, stageId, registrationId);
  }

  /** Approving stores the text as it is now; later edits make a new draft that is not used until approved again. */
  async approveNarrative(panelistId: number, stageId: number, registrationId: number) {
    const p = await this.me(panelistId);
    await this.narrative(panelistId, stageId, registrationId);
    const row = await this.prisma.panelNarrative.findUnique({ where: { stageId_registrationId: { stageId, registrationId } } });
    if (!row || !row.draftText.trim()) throw new BadRequestException('Write the note first.');
    await this.prisma.panelNarrative.update({ where: { id: row.id }, data: { approvedText: row.draftText, approvedAt: new Date(), approvedById: panelistId, approvedByName: p.name } });
    return this.narrative(panelistId, stageId, registrationId);
  }
}
