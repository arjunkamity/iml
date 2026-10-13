import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { CertificateIssuanceService } from '../../certificates/certificate-issuance.service';
import { CERTIFICATE_DOWNLOAD_BASE_URL } from '../../certificates/certificate-queue.service';
import { MessagingService } from '../../messaging/messaging.service';

type ListQuery = {
  page: number;
  limit: number;
  search?: string;
  comp?: string;
};

@Injectable()
export class ResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issuance: CertificateIssuanceService,
    private readonly messaging: MessagingService,
  ) {}

  async listResults(
    q: ListQuery,
  ): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.AttemptWhereInput = {};
    if (q.comp) where.registration = { competition: { code: q.comp } };
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        {
          registration: {
            student: { name: { contains: q.search, mode: 'insensitive' } },
          },
        },
        {
          registration: {
            student: { code: { contains: q.search, mode: 'insensitive' } },
          },
        },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.attempt.findMany({
        where,
        include: {
          registration: {
            include: {
              student: { select: { code: true, name: true, grade: true } },
              competition: true,
            },
          },
          stage: { select: { name: true, position: true } },
        },
        orderBy: { finishedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.attempt.count({ where }),
    ]);

    // Batched, same pattern as AdminCertificatesService.listQueue() and
    // StudentService.results() — looked up by registrationId directly
    // rather than inferred from any job/attempt status.
    const certs = rows.length
      ? await this.prisma.certificate.findMany({
          where: { registrationId: { in: rows.map((a) => a.registrationId) } },
          select: { registrationId: true, certificateNumber: true },
        })
      : [];
    const certByReg = new Map(certs.map((c) => [c.registrationId, c.certificateNumber]));

    return paginate(
      rows.map((a) => ({
        code: a.code,
        student: a.registration.student.name,
        studentCode: a.registration.student.code,
        grade: a.registration.student.grade,
        competition: a.registration.competition.title,
        competitionCode: a.registration.competition.code,
        stage: a.stage?.name ?? null,
        stagePosition: a.stage?.position ?? null,
        score: a.score,
        total: a.total,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
        certificateNumber: certByReg.get(a.registrationId) ?? null,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  /**
   * "Generate Certificate" admin action — issues the certificate now if it
   * doesn't exist yet (bypassing the background queue's wait-for-no-live-
   * exam gate, for a one-off on-demand case) and always sends a fresh
   * CERTIFICATE_AVAILABLE email, whether newly issued or already existed.
   * Sends the same download-LINK email as the automatic pipeline, not a
   * raw PDF attachment — Falconide's email API has a payload-size limit
   * that made attaching the PDF directly unreliable (see the public
   * certificate-download endpoint this link points to).
   */
  async generateCertificate(code: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { code },
      include: { registration: { include: { student: true, competition: true } } },
    });
    if (!attempt) throw new NotFoundException('Result not found');

    // Same eventName convention as the automatic enqueue in
    // StudentService.submitExam() (just the competition title) — matters
    // only if a certificate doesn't exist yet, since issueForRegistration()
    // is a no-op (returns the existing row unchanged) otherwise.
    const eventName = attempt.registration.competition.title;
    const cert = await this.issuance.issueForRegistration(attempt.registrationId, eventName);
    if (!cert) {
      throw new BadGatewayException(
        'Certificate could not be rendered with the current template settings — check Site Settings.',
      );
    }

    const student = attempt.registration.student;
    await this.messaging.dispatch(
      'CERTIFICATE_AVAILABLE',
      { email: student.email, phone: student.phone },
      {
        StudentName: student.name,
        CertificateType: 'Participation',
        CertificateLink: `${CERTIFICATE_DOWNLOAD_BASE_URL}/${cert.certificateNumber}/download`,
      },
    );
    return { certificateNumber: cert.certificateNumber };
  }

  async getResult(code: string) {
    return this.prisma.attempt.findUnique({
      where: { code },
      include: {
        registration: {
          include: {
            student: { include: { school: true } },
            competition: true,
          },
        },
        stage: true,
        answers: { include: { question: { include: { group: { select: { code: true, title: true } } } } }, orderBy: { id: 'asc' } },
      },
    });
  }

  async leaderboard(comp?: string) {
    const rows = await this.prisma.attempt.findMany({
      where: {
        finishedAt: { not: null },
        ...(comp ? { registration: { competition: { code: comp } } } : {}),
      },
      include: {
        registration: { include: { student: { include: { school: true } } } },
        stage: { select: { name: true, position: true } },
      },
      orderBy: [{ score: 'desc' }, { finishedAt: 'asc' }],
    });
    return rows.map((a, i) => ({
      rank: i + 1,
      attemptCode: a.code,
      student: a.registration.student.name,
      studentCode: a.registration.student.code,
      grade: a.registration.student.grade,
      school: a.registration.student.school?.name ?? null,
      score: a.score,
      total: a.total,
      stage: a.stage?.name ?? null,
      finishedAt: a.finishedAt,
    }));
  }
}
