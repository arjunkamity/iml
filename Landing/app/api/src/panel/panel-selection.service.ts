import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { rankResults } from '../common/panel-scoring';

type StageRow = { id: number; competitionId: number; position: number; name: string; passMark: Prisma.Decimal; maxQualifiers: number | null };

// Selection for panel-rated stages (#83): rank by the stage score instead of the online attempt,
// then the same qualified / eliminated statuses, stage cap, next-stage unlock and notification
// templates the online selection uses. Online stages never come through here.
@Injectable()
export class PanelSelectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  /** True for a stage that is rated by a panel (it has an evaluation form). */
  async isPanelStage(stageId: number): Promise<boolean> {
    const p = await this.prisma.panelStage.findUnique({ where: { stageId }, select: { formId: true } });
    return !!p?.formId;
  }

  private async rows(stage: StageRow) {
    const results = await this.prisma.panelResult.findMany({ where: { stageId: stage.id } });
    const regs = await this.prisma.registration.findMany({ where: { id: { in: results.map((r) => r.registrationId) } }, select: { id: true, code: true, student: { select: { code: true, name: true } } } });
    const byId = new Map(regs.map((r) => [r.id, r]));
    const statuses = await this.prisma.registrationStage.findMany({ where: { stageId: stage.id }, select: { registrationId: true, status: true } });
    const statusOf = new Map(statuses.map((s) => [s.registrationId, s.status]));
    const passMark = Number(stage.passMark);
    return results.map((r) => {
      const reg = byId.get(r.registrationId);
      const comps = (r.competencies as { levelKey?: string | null }[]) ?? [];
      const percent = r.percent === null ? null : Number(r.percent);
      return {
        registrationId: r.registrationId,
        registrationCode: reg?.code ?? '',
        studentCode: reg?.student.code ?? '',
        studentName: reg?.student.name ?? '',
        score: percent,
        total: 100,
        percent: percent ?? 0,
        levelKey: r.levelKey,
        rated: r.status === 'Rated',
        eligible: r.status === 'Rated' && (percent ?? 0) >= passMark,
        ratersCount: r.ratersCount,
        topLevelCount: comps.filter((c) => c.levelKey && c.levelKey === r.levelKey).length,
        currentStatus: statusOf.get(r.registrationId) ?? null,
      };
    });
  }

  /** The ranking that commit() would apply right now. Shape matches the online preview so the same screen can show it. */
  async preview(stage: StageRow) {
    const panel = await this.prisma.panelStage.findUnique({ where: { stageId: stage.id } });
    if (!panel || (panel.state !== 'Finalized' && panel.state !== 'Selected' && panel.state !== 'Released')) {
      throw new BadRequestException('Finalize the stage first: selection ranks the finalized stage scores.');
    }
    const all = await this.rows(stage);
    const eligible = all.filter((r) => r.eligible);
    const ineligible = all.filter((r) => !r.eligible && r.rated);
    const notRated = all.filter((r) => !r.rated);
    const cap = stage.maxQualifiers;
    const ranked = rankResults(eligible.map((r) => ({ registrationId: r.registrationId, percent: r.percent, topLevelCount: r.topLevelCount })));
    const picked = new Set(ranked.slice(0, cap ?? ranked.length).map((r) => r.registrationId));
    const order = new Map(ranked.map((r, i) => [r.registrationId, i + 1]));
    const autoPicked = eligible.filter((r) => picked.has(r.registrationId)).sort((a, b) => (order.get(a.registrationId) ?? 0) - (order.get(b.registrationId) ?? 0)).map((r) => ({ ...r, rank: order.get(r.registrationId) }));
    const cut = eligible.filter((r) => !picked.has(r.registrationId)).map((r) => ({ ...r, rank: order.get(r.registrationId) }));
    return {
      stage: { id: stage.id, name: stage.name, position: stage.position, passMark: Number(stage.passMark), maxQualifiers: cap },
      mode: 'panel' as const,
      eligibleCount: eligible.length,
      ineligible: [...ineligible, ...cut],
      notRated,
      cap,
      criteriaStages: [{ criterion: 'percent', label: 'Stage score, highest first (ties: more competencies at the top level, then registration order)', seatsBefore: cap ?? eligible.length, clearCount: autoPicked.length, tiedCount: 0, seatsAfter: Math.max(0, (cap ?? eligible.length) - autoPicked.length), tiedGroup: [] }],
      autoPicked,
      stillContesting: [] as typeof autoPicked,
      seatsLeftForManual: 0,
    };
  }

  async commit(stage: StageRow, admin: { id: number | null } | null) {
    const panel = await this.prisma.panelStage.findUnique({ where: { stageId: stage.id } });
    if (!panel) throw new BadRequestException('This stage is not panel-rated.');
    if (panel.state === 'Selected' || panel.state === 'Released') throw new BadRequestException('This stage has already been decided — selection can only be run once.');
    const preview = await this.preview(stage);
    const qualifySet = new Set(preview.autoPicked.map((r) => r.registrationId));
    const decided = new Set([...preview.autoPicked, ...preview.ineligible].map((r) => r.registrationId));
    const stages = await this.prisma.competitionStage.findMany({ where: { competitionId: stage.competitionId }, orderBy: { position: 'asc' } });
    const idx = stages.findIndex((s) => s.id === stage.id);
    const next = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;
    const scoreOf = new Map([...preview.autoPicked, ...preview.ineligible].map((r) => [r.registrationId, r.percent]));

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const registrationId of decided) {
      const qualifies = qualifySet.has(registrationId);
      ops.push(
        this.prisma.registrationStage.upsert({
          where: { registrationId_stageId: { registrationId, stageId: stage.id } },
          create: { registrationId, stageId: stage.id, status: qualifies ? 'Qualified' : 'Eliminated', qualified: qualifies, score: new Prisma.Decimal(scoreOf.get(registrationId) ?? 0) },
          update: { status: qualifies ? 'Qualified' : 'Eliminated', qualified: qualifies, score: new Prisma.Decimal(scoreOf.get(registrationId) ?? 0) },
        }),
        this.prisma.registration.update({ where: { id: registrationId }, data: { status: qualifies ? 'Qualified' : 'Eliminated' } }),
      );
    }
    ops.push(this.prisma.panelStage.update({ where: { id: panel.id }, data: { state: 'Selected', selectedAt: new Date() } }));
    await this.prisma.$transaction(ops);

    const students = await this.prisma.registration.findMany({ where: { id: { in: [...decided] } }, select: { id: true, student: { select: { name: true, email: true, phone: true } } } });
    for (const r of students) {
      void this.messaging.dispatch(qualifySet.has(r.id) ? 'QUALIFIED_STAGE2' : 'NOT_QUALIFIED_STAGE2', { email: r.student.email, phone: r.student.phone }, { Name: r.student.name, StudentName: r.student.name });
    }
    if (next && next.isFree && qualifySet.size) {
      const existing = await this.prisma.registrationStage.findMany({ where: { stageId: next.id, registrationId: { in: [...qualifySet] } }, select: { registrationId: true } });
      const already = new Set(existing.map((r) => r.registrationId));
      // a row that already exists but is still Locked (a stage added to a running competition) is opened too
      await this.prisma.registrationStage.updateMany({ where: { stageId: next.id, registrationId: { in: [...qualifySet] }, status: 'Locked' }, data: { status: 'Unlocked', unlockedAt: new Date() } });
      const toCreate = [...qualifySet].filter((id) => !already.has(id));
      if (toCreate.length) await this.prisma.registrationStage.createMany({ data: toCreate.map((registrationId) => ({ registrationId, stageId: next.id, status: 'Unlocked', unlockedAt: new Date() })), skipDuplicates: true });
    }
    const comp = await this.prisma.competition.findUnique({ where: { id: stage.competitionId }, select: { code: true } });
    const a = admin?.id ? await this.prisma.admin.findUnique({ where: { id: admin.id }, select: { name: true } }) : null;
    await this.prisma.configAuditLog.create({
      data: { entity: 'panel', entityCode: comp?.code ?? null, action: 'selection_commit', adminId: admin?.id ?? null, adminName: a?.name ?? null, summary: { stage: stage.position, qualified: qualifySet.size, eliminated: decided.size - qualifySet.size, notRated: preview.notRated.length } as Prisma.InputJsonValue },
    });
    return { qualified: qualifySet.size, eliminated: decided.size - qualifySet.size, notRated: preview.notRated.length };
  }
}
