import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { gradeMatches, shuffle } from '../common/util';
import {
  AssessmentAnswerError,
  AssessmentConfig,
  ScorableQuestion,
  ScoreResult,
  bandFor,
  scoreAssessment,
} from '../common/assessment-scoring';

type Config = AssessmentConfig;

// An option is identified to the browser by an opaque token, never by its
// index: the source assessment lists options least to most developed, so an
// index (or the stored order) would hand over the answer key. The token is a
// keyed hash of (question, index), so it is stable between "load" and
// "submit" without storing anything, and not guessable.
function optionToken(questionId: number, index: number): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
  return createHmac('sha256', secret).update(`assessment-option:${questionId}:${index}`).digest('base64url').slice(0, 12);
}

/** Saving can be switched off without a deploy (e.g. while consent wording is
 * being finalised): results are still scored and shown, just not stored. */
function savingEnabled(): boolean {
  return process.env.ASSESSMENTS_SAVE_RESULTS !== 'false';
}

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async requireStudent(studentId: number) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, grade: true, schoolId: true, archived: true },
    });
    if (!student || student.archived) throw new NotFoundException('Student not found');
    return student;
  }

  private async requirePublished(slug: string, student: { grade: string }) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { slug, status: 'Published', kind: 'self' },
    });
    if (!assessment) throw new NotFoundException('This assessment is not available.');
    if (assessment.grades && !gradeMatches(assessment.grades, student.grade)) {
      throw new ForbiddenException('This assessment is not available for your grade.');
    }
    return assessment;
  }

  private questionsOf(assessmentId: number) {
    return this.prisma.question.findMany({
      where: { assessmentId },
      orderBy: { id: 'asc' },
    });
  }

  /** What the student sees on their dashboard: published assessments for their grade. */
  async list(studentId: number) {
    const student = await this.requireStudent(studentId);
    const assessments = await this.prisma.assessment.findMany({
      where: { status: 'Published', kind: 'self' },
      orderBy: { id: 'asc' },
      include: { _count: { select: { questions: true } } },
    });
    const eligible = assessments.filter((a) => !a.grades || gradeMatches(a.grades, student.grade));
    const last = await this.prisma.assessmentSubmission.groupBy({
      by: ['assessmentId'],
      where: { studentId, assessmentId: { in: eligible.map((a) => a.id) } },
      _max: { submittedAt: true },
      _count: { _all: true },
    });
    const byId = new Map(last.map((l) => [l.assessmentId, l]));
    return eligible.map((a) => ({
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      questionCount: a._count.questions,
      completed: byId.has(a.id),
      lastSubmittedAt: byId.get(a.id)?._max.submittedAt ?? null,
    }));
  }

  /** Everything the player needs. Options are shuffled per request and carry
   * opaque tokens; points and capacities are never sent. */
  async get(studentId: number, slug: string) {
    const student = await this.requireStudent(studentId);
    const assessment = await this.requirePublished(slug, student);
    const config = assessment.config as unknown as Config;
    const questions = await this.questionsOf(assessment.id);
    return {
      slug: assessment.slug,
      title: assessment.title,
      summary: assessment.summary,
      consent: config.consent,
      disclaimer: config.disclaimer,
      capacities: config.dimensions.map((d) => ({ label: d.label, intro: d.intro })),
      saveResults: savingEnabled(),
      items: questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: shuffle(
          (q.options as unknown[]).map((text, index) => ({ token: optionToken(q.id, index), text: String(text) })),
        ),
      })),
    };
  }

  private toResult(
    config: Config,
    scores: ScoreResult['scores'],
    saved: boolean,
    submittedAt: Date | null,
    strongest?: string[],
    practiceFor?: string[],
  ) {
    const dims = config.dimensions.map((d) => {
      const s = scores[d.key] ?? { score: 0, max: 0, band: '' };
      const band = bandFor(d, s.score);
      return {
        key: d.key,
        label: d.label,
        score: s.score,
        max: s.max,
        percent: s.max ? Math.round((s.score / s.max) * 100) : 0,
        band: s.band,
        summary: band?.summary ?? '',
      };
    });
    const live = dims.filter((d) => d.max > 0);
    const hi = Math.max(...live.map((d) => d.score));
    const lo = Math.min(...live.map((d) => d.score));
    const strong = strongest ?? live.filter((d) => d.score === hi).map((d) => d.key);
    const practice = practiceFor ?? live.filter((d) => d.score === lo).map((d) => d.key);
    return {
      saved,
      submittedAt,
      dimensions: dims,
      strongest: dims.filter((d) => strong.includes(d.key)).map((d) => d.label),
      practice: config.dimensions
        .filter((d) => practice.includes(d.key))
        .map((d) => ({ label: d.label, text: d.practice })),
      howScored: config.howScored,
      disclaimer: config.disclaimer,
    };
  }

  async submit(studentId: number, slug: string, answers: { questionId: number; option: string }[]) {
    const student = await this.requireStudent(studentId);
    const assessment = await this.requirePublished(slug, student);
    const config = assessment.config as unknown as Config;
    const questions = await this.questionsOf(assessment.id);

    // Map each opaque token back to its option index; reject anything that
    // does not match a real option of that question.
    const tokenIndex = new Map<number, Map<string, number>>();
    for (const q of questions) {
      const m = new Map<string, number>();
      (q.options as unknown[]).forEach((_, i) => m.set(optionToken(q.id, i), i));
      tokenIndex.set(q.id, m);
    }
    const resolved = answers.map((a) => {
      const idx = tokenIndex.get(a.questionId)?.get(a.option);
      return { questionId: a.questionId, optionIndex: idx ?? -1 };
    });

    let result: ScoreResult;
    try {
      result = scoreAssessment(
        config,
        questions as unknown as ScorableQuestion[],
        resolved,
      );
    } catch (e) {
      if (e instanceof AssessmentAnswerError) throw new BadRequestException(e.message);
      throw e;
    }

    if (!savingEnabled()) {
      this.logger.warn(`Assessment ${slug}: result NOT saved (ASSESSMENTS_SAVE_RESULTS=false)`);
      return this.toResult(config, result.scores, false, null, result.strongest, result.practiceFor);
    }

    // Once per student. Checked up front for a clear message, and enforced by
    // the unique (studentId, assessmentId) key so two taps or two tabs racing
    // each other can still never store two results. An admin can delete a
    // submission to let a student retake.
    const already = await this.prisma.assessmentSubmission.findUnique({
      where: { studentId_assessmentId: { studentId, assessmentId: assessment.id } },
      select: { id: true },
    });
    if (already) throw new ConflictException('You have already completed this assessment.');

    let row;
    try {
      row = await this.prisma.assessmentSubmission.create({
        data: {
          assessmentId: assessment.id,
          studentId,
          schoolId: student.schoolId,
          grade: student.grade,
          answers: result.answers as unknown as object,
          scores: result.scores as unknown as object,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('You have already completed this assessment.');
      }
      throw e;
    }
    return this.toResult(config, row.scores as unknown as ScoreResult['scores'], true, row.submittedAt, result.strongest, result.practiceFor);
  }

  /** The student's own most recent saved result, if any. */
  async latestResult(studentId: number, slug: string) {
    const student = await this.requireStudent(studentId);
    const assessment = await this.requirePublished(slug, student);
    const row = await this.prisma.assessmentSubmission.findFirst({
      where: { studentId, assessmentId: assessment.id },
      orderBy: { submittedAt: 'desc' },
    });
    if (!row) throw new NotFoundException('You have not completed this assessment yet.');
    return this.toResult(
      assessment.config as unknown as Config,
      row.scores as unknown as ScoreResult['scores'],
      true,
      row.submittedAt,
    );
  }
}
