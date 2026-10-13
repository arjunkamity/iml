import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from '../../messaging/messaging.service';
import { PanelSelectionService } from '../../panel/panel-selection.service';
import { paginate, ListResult } from '../../common/list-result';
import { ensureRegistrationStages, nextCode, toDate } from '../../common/util';
import {
  CreateCompetitionDto,
  CreatePrizeDto,
  CreateStageDto,
  PatchCompetitionDto,
  PatchPrizeDto,
  PatchStageDto,
  QuestionMixRuleDto,
} from './competitions.dto';

const stagesInclude = {
  stages: {
    include: { rules: { orderBy: { position: 'asc' } } },
    orderBy: { position: 'asc' },
  },
} as const;

@Injectable()
export class CompetitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly panelSelection: PanelSelectionService,
  ) {}

  private stageData(d: {
    position: number;
    name: string;
    mode: string;
    passMark: number;
    isFree?: boolean;
    price?: number;
    description?: string;
    maxQualifiers?: number;
  }) {
    return {
      position: d.position,
      name: d.name,
      mode: d.mode,
      passMark: new Prisma.Decimal(d.passMark),
      isFree: d.isFree ?? false,
      price: new Prisma.Decimal(d.price ?? 0),
      maxQualifiers: d.maxQualifiers ?? null,
      description: d.description ?? null,
    };
  }

  // ---- competitions ----

  async list(q: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.CompetitionWhereInput = {};
    // Same "removed but not deleted" convention as Student.archived —
    // Archived competitions are hidden from the default list (and from
    // every other explicit status filter, since they're a different
    // value) but still fully reachable by explicitly filtering for them.
    if (q.status) {
      where.status = q.status;
    } else {
      where.status = { not: 'Archived' };
    }
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { title: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.competition.findMany({
        where,
        include: { _count: { select: { registrations: true, stages: true } } },
        orderBy: { code: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.competition.count({ where }),
    ]);
    return paginate(
      rows.map((c) => ({
        code: c.code,
        title: c.title,
        grades: c.grades,
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
        isMulti: c.isMulti,
        registrations: c._count.registrations,
        stages: c._count.stages,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async get(code: string) {
    const comp = await this.prisma.competition.findUnique({
      where: { code },
      include: {
        ...stagesInclude,
        prizes: { orderBy: { id: 'asc' } },
        _count: { select: { registrations: true } },
      },
    });
    if (!comp) throw new NotFoundException('Competition not found');
    return comp;
  }

  async create(dto: CreateCompetitionDto) {
    const codes = (
      await this.prisma.competition.findMany({ select: { code: true } })
    ).map((c) => c.code);
    const code = nextCode(codes, 'C');
    const { stages, ...rest } = dto;
    return this.prisma.competition.create({
      data: {
        code,
        ...rest,
        startDate: toDate(rest.startDate)!,
        endDate: toDate(rest.endDate)!,
        status: rest.status ?? 'Draft',
        stages: stages
          ? { create: stages.map((s) => this.stageData(s)) }
          : undefined,
      },
      include: stagesInclude,
    });
  }

  async update(code: string, dto: PatchCompetitionDto) {
    const existing = await this.prisma.competition.findUnique({
      where: { code },
    });
    if (!existing) throw new NotFoundException('Competition not found');
    const data: Prisma.CompetitionUpdateInput = { ...dto };
    if (dto.startDate) data.startDate = toDate(dto.startDate)!;
    if (dto.endDate) data.endDate = toDate(dto.endDate)!;
    return this.prisma.competition.update({
      where: { code },
      data,
      include: stagesInclude,
    });
  }

  async remove(code: string) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    await this.prisma.$transaction([
      this.prisma.registrationStage.deleteMany({
        where: { stage: { competitionId: comp.id } },
      }),
      this.prisma.attemptAnswer.deleteMany({
        where: { attempt: { stage: { competitionId: comp.id } } },
      }),
      this.prisma.attempt.deleteMany({
        where: { stage: { competitionId: comp.id } },
      }),
      this.prisma.payment.deleteMany({
        where: { stage: { competitionId: comp.id } },
      }),
      this.prisma.stageRule.deleteMany({
        where: { stage: { competitionId: comp.id } },
      }),
      this.prisma.competitionStage.deleteMany({
        where: { competitionId: comp.id },
      }),
      this.prisma.question.deleteMany({ where: { competitionId: comp.id } }),
      this.prisma.exam.deleteMany({ where: { competitionId: comp.id } }),
      this.prisma.prize.deleteMany({ where: { competitionId: comp.id } }),
      this.prisma.sponsorEvent.deleteMany({
        where: { competitionId: comp.id },
      }),
      this.prisma.notification.deleteMany({
        where: { competitionId: comp.id },
      }),
      this.prisma.registration.deleteMany({
        where: { competitionId: comp.id },
      }),
      this.prisma.competition.delete({ where: { id: comp.id } }),
    ]);
    return { ok: true };
  }

  // ---- question mix (which categories a student is served, and how many) ----

  /** The competition's current mix plus everything the admin screen needs to
   * edit it sensibly: live availability per category (non-demo questions
   * tagged to this competition), the active categories to choose from, and
   * whether changing it now touches a running exam. */
  async getQuestionMix(code: string) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');

    const [rules, pool, categories, liveExams, attempts] = await Promise.all([
      this.prisma.competitionQuestionRule.findMany({
        where: { competitionId: comp.id },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      }),
      // Ordinary questions only: a Question Group's sub-questions are counted
      // separately below, because they are served only through an active group.
      this.prisma.question.groupBy({
        by: ['category'],
        where: { competitionId: comp.id, isDemo: false, assessmentId: null, groupId: null },
        _count: { _all: true },
      }),
      this.prisma.questionCategory.findMany({
        where: { active: true },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: { name: true },
      }),
      this.prisma.exam.count({ where: { competitionId: comp.id, status: 'Live' } }),
      this.prisma.attempt.count({ where: { registration: { competitionId: comp.id } } }),
    ]);

    // Question Groups: the questions of an ACTIVE group (2+ questions) are
    // served, together; those in an inactive or under-filled group are withheld.
    const groups = await this.prisma.questionGroup.findMany({
      where: { competitionId: comp.id },
      select: { category: true, active: true, _count: { select: { questions: true } } },
    });
    const inGroups = new Map<string, number>();
    const withheld = new Map<string, number>();
    for (const g of groups) {
      const served = g.active && g._count.questions >= 2;
      const into = served ? inGroups : withheld;
      into.set(g.category, (into.get(g.category) ?? 0) + g._count.questions);
    }
    const categoryNames = [...new Set([...pool.map((p) => p.category), ...inGroups.keys(), ...withheld.keys()])];
    const singles = new Map(pool.map((p) => [p.category, p._count._all]));
    const poolRows = categoryNames.map((category) => ({
      category,
      // What the draw can serve for this category: ordinary questions plus active groups' questions.
      available: (singles.get(category) ?? 0) + (inGroups.get(category) ?? 0),
      inGroups: inGroups.get(category) ?? 0,
      withheld: withheld.get(category) ?? 0,
    }));
    const available = new Map(poolRows.map((p) => [p.category, p.available]));
    return {
      competitionCode: comp.code,
      rules: rules.map((r) => ({
        category: r.category,
        count: r.count,
        available: available.get(r.category) ?? 0,
        inGroups: inGroups.get(r.category) ?? 0,
      })),
      // Every category with tagged questions, so the screen can show what the
      // pool actually holds (and flag categories that exist but have no rule).
      pool: poolRows,
      categories: categories.map((c) => c.name),
      totalPerStudent: rules.reduce((sum, r) => sum + r.count, 0),
      examLive: liveExams > 0,
      attempts,
    };
  }

  /** Replaces the competition's whole mix in one transaction. An empty list
   * clears it. Only affects attempts started afterwards — attempts freeze
   * their served question ids (Attempt.questionIds). */
  async putQuestionMix(code: string, rules: QuestionMixRuleDto[]) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');

    const cleaned = rules.map((r) => ({ category: r.category.trim(), count: r.count }));
    const seen = new Set<string>();
    for (const r of cleaned) {
      if (!r.category) throw new BadRequestException('Every row needs a category.');
      if (seen.has(r.category)) {
        throw new BadRequestException(`"${r.category}" is listed more than once — combine the rows.`);
      }
      seen.add(r.category);
    }
    if (cleaned.length) {
      const known = new Set(
        (await this.prisma.questionCategory.findMany({ where: { active: true }, select: { name: true } })).map((c) => c.name),
      );
      const unknown = cleaned.filter((r) => !known.has(r.category)).map((r) => r.category);
      if (unknown.length) {
        throw new BadRequestException(
          `Not an active question category: ${unknown.join(', ')}. Add it under Question Categories first.`,
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.competitionQuestionRule.deleteMany({ where: { competitionId: comp.id } }),
      this.prisma.competitionQuestionRule.createMany({
        data: cleaned.map((r, i) => ({ competitionId: comp.id, category: r.category, count: r.count, position: i + 1 })),
      }),
    ]);
    return this.getQuestionMix(code);
  }

  async stages(code: string) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    return this.prisma.competitionStage.findMany({
      where: { competitionId: comp.id },
      include: { rules: { orderBy: { position: 'asc' } } },
      orderBy: { position: 'asc' },
    });
  }

  async addStage(code: string, dto: CreateStageDto) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    const stage = await this.prisma.competitionStage.create({
      data: { competitionId: comp.id, ...this.stageData(dto) },
    });
    // Existing registrants shouldn't have to wait for their next dashboard
    // load to pick up a stage added after they registered.
    const regs = await this.prisma.registration.findMany({
      where: { competitionId: comp.id },
      select: { id: true },
    });
    await Promise.all(
      regs.map((r) => ensureRegistrationStages(this.prisma, r.id, comp.id)),
    );
    return stage;
  }

  async updateStage(code: string, stageId: number, dto: PatchStageDto) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    const stage = await this.prisma.competitionStage.findFirst({
      where: { id: stageId, competitionId: comp.id },
    });
    if (!stage) throw new NotFoundException('Stage not found');
    const data: Prisma.CompetitionStageUpdateInput = { ...dto };
    if (dto.passMark !== undefined)
      data.passMark = new Prisma.Decimal(dto.passMark);
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    return this.prisma.competitionStage.update({
      where: { id: stageId },
      data,
    });
  }

  async removeStage(code: string, stageId: number) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    const stage = await this.prisma.competitionStage.findFirst({
      where: { id: stageId, competitionId: comp.id },
    });
    if (!stage) throw new NotFoundException('Stage not found');
    await this.prisma.$transaction([
      this.prisma.registrationStage.deleteMany({ where: { stageId } }),
      this.prisma.attemptAnswer.deleteMany({ where: { attempt: { stageId } } }),
      this.prisma.attempt.deleteMany({ where: { stageId } }),
      this.prisma.payment.deleteMany({ where: { stageId } }),
      this.prisma.stageRule.deleteMany({ where: { stageId } }),
      this.prisma.competitionStage.delete({ where: { id: stageId } }),
    ]);
    return { ok: true };
  }

  async qualifiers(code: string, q: { stage?: number; status?: string }) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    const where: Prisma.RegistrationStageWhereInput = {
      stage: { competitionId: comp.id },
    };
    const stagePos = q.stage != null ? Number(q.stage) : undefined;
    if (Number.isInteger(stagePos) && stagePos! > 0)
      where.stage = { competitionId: comp.id, position: stagePos };
    if (q.status) where.status = q.status;
    return this.prisma.registrationStage.findMany({
      where,
      include: {
        registration: { include: { student: { include: { school: true } } } },
        stage: true,
      },
      orderBy: [{ stage: { position: 'asc' } }, { score: 'desc' }],
    });
  }

  // ---- Next Stage Selection: rank by speed among pass-mark-eligible
  // attempts, tie-broken by fewer answer changes, then faster average
  // per-question response, then earliest attempt start, then (as an
  // absolute last resort that can never itself produce a tie) attempt
  // record order — capped at the stage's maxQualifiers.
  //
  // Until 2026-09-14 the cascade stopped after three criteria and handed
  // any still-tied seats to an admin to pick by hand (a "Manual
  // selection" step in the wizard). Legal flagged this as a real
  // favoritism risk — a human choosing which of two tied real
  // participants advances, however well-intentioned, is exactly the kind
  // of decision that shouldn't rest on individual judgment. The cascade
  // now always fully resolves on its own: the last criterion
  // (`attemptId`) is a database primary key, which by definition is
  // never equal between two different attempts, so `stillContesting` is
  // now structurally guaranteed to end up empty — there is no longer a
  // tie the system can't break itself, and no admin-suppliable list of
  // who qualifies exists anywhere in this flow (see commitSelection()
  // below, which takes no input at all and recomputes this exact ranking
  // itself rather than trusting a client-submitted list). Preview still
  // computes and returns the ranking without writing anything; commit
  // applies exactly what preview would show, atomically, once. ----

  private async loadStageForSelection(code: string, stageId: number) {
    const comp = await this.prisma.competition.findUnique({ where: { code } });
    if (!comp) throw new NotFoundException('Competition not found');
    const stage = await this.prisma.competitionStage.findFirst({
      where: { id: stageId, competitionId: comp.id },
    });
    if (!stage) throw new NotFoundException('Stage not found');
    return stage;
  }

  async selectionPreview(code: string, stageId: number) {
    const stage = await this.loadStageForSelection(code, stageId);
    if (await this.panelSelection.isPanelStage(stageId)) return this.panelSelection.preview(stage);

    const attempts = await this.prisma.attempt.findMany({
      where: { stageId, finishedAt: { not: null } },
      include: {
        registration: { include: { student: { select: { code: true, name: true } } } },
        answers: { select: { takenSecs: true, changeCount: true } },
      },
      orderBy: { finishedAt: 'asc' },
    });

    // One attempt per registration — if more than one finished attempt
    // exists for the same registration at this stage, only the latest
    // counts.
    const latestByRegistration = new Map<number, (typeof attempts)[number]>();
    for (const a of attempts) {
      const prev = latestByRegistration.get(a.registrationId);
      if (!prev || (a.finishedAt as Date) > (prev.finishedAt as Date)) {
        latestByRegistration.set(a.registrationId, a);
      }
    }

    const passMark = Number(stage.passMark);
    const rows = [...latestByRegistration.values()].map((a) => {
      const total = Number(a.total);
      const score = Number(a.score);
      const percent = total > 0 ? Math.round((score / total) * 100) : 0;
      const durationSecs =
        a.clientElapsedSecs ??
        (a.finishedAt ? Math.round((a.finishedAt.getTime() - a.startedAt.getTime()) / 1000) : null);
      const totalChanges = a.answers.reduce((sum, x) => sum + (x.changeCount ?? 0), 0);
      const answeredCount = a.answers.filter((x) => x.takenSecs != null).length;
      const avgTakenSecs = answeredCount
        ? a.answers.reduce((sum, x) => sum + (x.takenSecs ?? 0), 0) / answeredCount
        : null;
      return {
        registrationId: a.registrationId,
        registrationCode: a.registration.code,
        studentCode: a.registration.student.code,
        studentName: a.registration.student.name,
        attemptCode: a.code,
        score,
        total,
        percent,
        eligible: percent >= passMark,
        durationSecs,
        totalChanges,
        avgTakenSecs,
        // Final two tie-breaks — see the comment above this method.
        // startedAtMs is a real (if vanishingly unlikely) tie-break;
        // attemptId is the guaranteed-unique fallback that ends the
        // cascade for good.
        startedAtMs: a.startedAt.getTime(),
        attemptId: a.id,
        currentStatus: null as string | null,
      };
    });

    const regStages = await this.prisma.registrationStage.findMany({
      where: { stageId, registrationId: { in: rows.map((r) => r.registrationId) } },
      select: { registrationId: true, status: true },
    });
    const statusByReg = new Map(regStages.map((rs) => [rs.registrationId, rs.status]));
    for (const r of rows) r.currentStatus = statusByReg.get(r.registrationId) ?? null;

    const eligible = rows.filter((r) => r.eligible);
    const ineligible = rows.filter((r) => !r.eligible);

    const cap = stage.maxQualifiers;

    // No cap on this stage — every eligible attempt qualifies, exactly
    // like a threshold-only stage. Nothing to cascade through.
    if (cap == null) {
      return {
        stage: { id: stage.id, name: stage.name, position: stage.position, passMark, maxQualifiers: null },
        eligibleCount: eligible.length,
        ineligible,
        cap: null,
        criteriaStages: [],
        autoPicked: eligible,
        stillContesting: [],
        seatsLeftForManual: 0,
      };
    }

    // Cascading cutoff: apply one criterion at a time, in order. Whoever
    // clears the current criterion's cutoff strictly is auto-picked and
    // drops out of contention; whoever sits EXACTLY on the cutoff value
    // carries forward as a tied group for the next criterion to try to
    // break; whoever falls strictly below the cutoff is out entirely —
    // matches the spec exactly: "180 clear + 50 tied for the remaining
    // 20 seats" → apply the next criterion only to that 50 → "18 more
    // clear, 5 still tied" for whatever seats are left → hand the last
    // few seats to a human.
    type Row = (typeof eligible)[number];
    const CRITERIA: { key: 'durationSecs' | 'totalChanges' | 'avgTakenSecs' | 'startedAtMs' | 'attemptId'; label: string }[] = [
      { key: 'durationSecs', label: 'Fastest completion time' },
      { key: 'totalChanges', label: 'Fewest answer changes' },
      { key: 'avgTakenSecs', label: 'Fastest average time per question' },
      { key: 'startedAtMs', label: 'Earliest attempt start time' },
      // attemptId is a database primary key — never equal between two
      // different attempts — so this criterion always fully resolves the
      // cascade. In practice it should almost never be the one that
      // actually decides a seat (getting this far means two attempts
      // tied exactly on every real performance signal above), but its
      // presence is what makes "the system always decides" a guarantee
      // rather than a best-effort — see the comment above this method.
      { key: 'attemptId', label: 'Attempt record order (final tie-break)' },
    ];

    let pool: Row[] = [...eligible];
    let seatsLeft = cap;
    const autoPicked: Row[] = [];
    const criteriaStages: {
      criterion: string;
      label: string;
      seatsBefore: number;
      clearCount: number;
      tiedCount: number;
      seatsAfter: number;
      tiedGroup: Row[];
    }[] = [];

    for (const c of CRITERIA) {
      if (!pool.length || seatsLeft <= 0) break;
      if (pool.length <= seatsLeft) {
        // Everyone left fits in the remaining seats without a fight.
        autoPicked.push(...pool);
        seatsLeft -= pool.length;
        pool = [];
        break;
      }
      const valueOf = (r: Row) => (r[c.key] ?? Number.MAX_SAFE_INTEGER) as number;
      const sorted = [...pool].sort((a, b) => valueOf(a) - valueOf(b));
      const cutoffValue = valueOf(sorted[seatsLeft - 1]);
      const clear = sorted.filter((r) => valueOf(r) < cutoffValue);
      const tied = sorted.filter((r) => valueOf(r) === cutoffValue);
      const seatsBefore = seatsLeft;
      autoPicked.push(...clear);
      seatsLeft -= clear.length;
      criteriaStages.push({
        criterion: c.key,
        label: c.label,
        seatsBefore,
        clearCount: clear.length,
        tiedCount: tied.length,
        seatsAfter: seatsLeft,
        tiedGroup: tied,
      });
      // Rows strictly worse than the cutoff value are dropped for good —
      // a later criterion never resurrects them, same as a normal
      // lexicographic sort would rank them below anyway.
      pool = tied;
    }
    // The in-loop shortcut above only checks "does everyone left fit in
    // what's open" BEFORE running each criterion — so the tied group
    // left behind by the very LAST criterion never gets that same check
    // after it runs. That's exactly the case attemptId (a unique key)
    // always produces: a "tied" group of precisely one person occupying
    // precisely the one seat still open, who was never actually picked
    // by the loop above because they were never strictly BETTER than
    // the cutoff — they simply WERE the cutoff. Sweep once more here so
    // that person (or, for any other unique-enough criterion, group)
    // gets auto-picked instead of surfacing as still-contested.
    if (pool.length && pool.length <= seatsLeft) {
      autoPicked.push(...pool);
      seatsLeft -= pool.length;
      pool = [];
    }

    return {
      stage: { id: stage.id, name: stage.name, position: stage.position, passMark, maxQualifiers: cap },
      eligibleCount: eligible.length,
      ineligible,
      cap,
      criteriaStages,
      autoPicked,
      // Always empty now that attemptId (a guaranteed-unique primary key)
      // is the cascade's final criterion — kept in the response shape for
      // stability, not because anything can still land here. See the
      // comment above this method.
      stillContesting: pool,
      seatsLeftForManual: seatsLeft,
    };
  }

  /** Commits the exact ranking selectionPreview() would show right now —
   * deliberately takes NO input beyond which stage to decide. There is no
   * admin-suppliable "who qualifies" list anywhere in this flow: the
   * server always computes its own answer and applies exactly that, so
   * there's nothing here a request body could tamper with even if
   * someone tried. Also a one-time action — refuses outright if this
   * stage has already been decided, so a result once committed can never
   * be silently changed by running it again. */
  async commitSelection(code: string, stageId: number, admin: { id: number | null } | null = null) {
    const stage = await this.loadStageForSelection(code, stageId);
    if (await this.panelSelection.isPanelStage(stageId)) return this.panelSelection.commit(stage, admin);

    const attempted = await this.prisma.registrationStage.findMany({
      where: { stageId, status: { in: ['Attempted', 'Qualified', 'Eliminated'] } },
      select: { registrationId: true, status: true },
    });
    if (attempted.some((r) => r.status === 'Qualified' || r.status === 'Eliminated')) {
      throw new BadRequestException('This stage has already been decided — selection can only be run once.');
    }
    const attemptedIds = new Set(attempted.map((r) => r.registrationId));

    const preview = await this.selectionPreview(code, stageId);
    const qualifySet = new Set(
      [...preview.autoPicked, ...preview.stillContesting].map((r) => r.registrationId),
    );

    const stages = await this.prisma.competitionStage.findMany({
      where: { competitionId: stage.competitionId },
      orderBy: { position: 'asc' },
    });
    const idx = stages.findIndex((s) => s.id === stageId);
    const next = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const registrationId of attemptedIds) {
      const qualifies = qualifySet.has(registrationId);
      ops.push(
        this.prisma.registrationStage.updateMany({
          where: { registrationId, stageId },
          data: { status: qualifies ? 'Qualified' : 'Eliminated', qualified: qualifies },
        }),
      );
      ops.push(
        this.prisma.registration.update({
          where: { id: registrationId },
          data: { status: qualifies ? 'Qualified' : 'Eliminated' },
        }),
      );
    }
    await this.prisma.$transaction(ops);

    // Now that the real decision exists, tell everyone who attempted —
    // this is the deferred counterpart to the QUALIFIED_STAGE2 /
    // NOT_QUALIFIED_STAGE2 emails StudentService.submitExam() skips for a
    // capacity-limited stage precisely so this moment is the first time
    // any student hears a verdict.
    const students = await this.prisma.registration.findMany({
      where: { id: { in: [...attemptedIds] } },
      select: { id: true, student: { select: { name: true, email: true, phone: true } } },
    });
    for (const r of students) {
      const qualifies = qualifySet.has(r.id);
      void this.messaging.dispatch(
        qualifies ? 'QUALIFIED_STAGE2' : 'NOT_QUALIFIED_STAGE2',
        { email: r.student.email, phone: r.student.phone },
        { Name: r.student.name, StudentName: r.student.name },
      );
    }

    // Unlock the next stage for everyone selected — same shape as the
    // immediate (non-capacity) path in StudentService.submitExam().
    if (next && next.isFree && qualifySet.size) {
      const existing = await this.prisma.registrationStage.findMany({
        where: { stageId: next.id, registrationId: { in: [...qualifySet] } },
        select: { registrationId: true },
      });
      const already = new Set(existing.map((r) => r.registrationId));
      // a row that already exists but is still Locked (a stage added to a running competition) is opened too
      await this.prisma.registrationStage.updateMany({
        where: { stageId: next.id, registrationId: { in: [...qualifySet] }, status: 'Locked' },
        data: { status: 'Unlocked', unlockedAt: new Date() },
      });
      const toCreate = [...qualifySet].filter((id) => !already.has(id));
      if (toCreate.length) {
        await this.prisma.registrationStage.createMany({
          data: toCreate.map((registrationId) => ({
            registrationId,
            stageId: next.id,
            status: 'Unlocked',
            unlockedAt: new Date(),
          })),
          skipDuplicates: true,
        });
      }
    }

    return { qualified: qualifySet.size, eliminated: attemptedIds.size - qualifySet.size };
  }

  // ---- prizes ----

  private flattenPrize<T extends { competition?: { code: string; title: string } | null }>(
    p: T,
  ) {
    const { competition, ...rest } = p;
    return { ...rest, competition: competition?.title ?? null, competitionCode: competition?.code ?? null };
  }

  async listPrizes(q: { comp?: string }) {
    const where: Prisma.PrizeWhereInput = {};
    if (q.comp) where.competition = { code: q.comp };
    const rows = await this.prisma.prize.findMany({
      where,
      include: { competition: { select: { code: true, title: true } } },
      orderBy: { id: 'asc' },
    });
    return rows.map((p) => this.flattenPrize(p));
  }

  async getPrize(code: string) {
    const prize = await this.prisma.prize.findUnique({
      where: { code },
      include: { competition: { select: { code: true, title: true } } },
    });
    if (!prize) throw new NotFoundException('Prize not found');
    return this.flattenPrize(prize);
  }

  async createPrize(dto: CreatePrizeDto) {
    const comp = await this.prisma.competition.findUnique({
      where: { code: dto.competitionCode },
    });
    if (!comp) throw new NotFoundException('Competition not found');
    const codes = (
      await this.prisma.prize.findMany({ select: { code: true } })
    ).map((p) => p.code);
    const prize = await this.prisma.prize.create({
      data: {
        code: nextCode(codes, 'PR'),
        competitionId: comp.id,
        rankLabel: dto.rankLabel,
        money: dto.money !== undefined ? new Prisma.Decimal(dto.money) : null,
        award: dto.award ?? null,
        note: dto.note ?? null,
      },
      include: { competition: { select: { code: true, title: true } } },
    });
    return this.flattenPrize(prize);
  }

  async updatePrize(code: string, dto: PatchPrizeDto) {
    const existing = await this.prisma.prize.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Prize not found');
    const data: Prisma.PrizeUpdateInput = { ...dto };
    if (dto.money !== undefined) data.money = new Prisma.Decimal(dto.money);
    const prize = await this.prisma.prize.update({
      where: { code },
      data,
      include: { competition: { select: { code: true, title: true } } },
    });
    return this.flattenPrize(prize);
  }

  async removePrize(code: string) {
    const existing = await this.prisma.prize.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Prize not found');
    await this.prisma.prize.delete({ where: { code } });
    return { ok: true };
  }
}
