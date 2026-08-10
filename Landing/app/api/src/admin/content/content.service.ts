import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, ListResult } from '../../common/list-result';
import { nextCode, toDate, toTime } from '../../common/util';
import {
  CreateAnnouncementDto,
  CreateExamDto,
  CreateGalleryDto,
  CreateNewsDto,
  CreateNotificationDto,
  CreateQuestionDto,
  PatchAnnouncementDto,
  PatchExamDto,
  PatchGalleryDto,
  PatchGrievanceDto,
  PatchNewsDto,
  PatchQuestionDto,
} from './content.dto';

type ListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  comp?: string;
  category?: string;
  grade?: string;
  gtype?: string;
};

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- questions ----

  async listQuestions(
    q: ListQuery,
  ): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.QuestionWhereInput = {};
    if (q.status) where.competition = { status: q.status };
    if (q.comp) where.competition = { code: q.comp };
    if (q.category) where.category = q.category;
    if (q.grade) where.grade = q.grade;
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { prompt: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        include: { competition: { select: { code: true, title: true } } },
        orderBy: { code: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.question.count({ where }),
    ]);
    return paginate(
      rows.map((x) => ({
        code: x.code,
        prompt: x.prompt,
        grade: x.grade,
        category: x.category,
        qtype: x.qtype,
        mode: x.mode,
        competition: x.competition?.title ?? null,
        competitionCode: x.competition?.code ?? null,
        options: x.options,
        correct: x.correct,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async getQuestion(code: string) {
    const row = await this.prisma.question.findUnique({ where: { code } });
    if (!row) throw new NotFoundException('Question not found');
    return row;
  }

  async createQuestion(dto: CreateQuestionDto) {
    const { competitionCode, options, correct, ...rest } = dto;
    const codes = (
      await this.prisma.question.findMany({ select: { code: true } })
    ).map((x) => x.code);
    const competitionId = competitionCode
      ? ((
          await this.prisma.competition.findUnique({
            where: { code: competitionCode },
          })
        )?.id ?? null)
      : null;
    return this.prisma.question.create({
      data: {
        code: nextCode(codes, 'Q'),
        competitionId,
        ...rest,
        qtype: rest.qtype ?? 'text',
        mode: rest.mode ?? 'single',
        options: (options ?? []) as Prisma.InputJsonValue,
        correct: (correct ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  async updateQuestion(code: string, dto: PatchQuestionDto) {
    const existing = await this.prisma.question.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Question not found');
    const { competitionCode, options, correct, ...rest } = dto;
    const data: Prisma.QuestionUpdateInput = { ...rest };
    if (competitionCode !== undefined) {
      const competitionId = competitionCode
        ? ((
            await this.prisma.competition.findUnique({
              where: { code: competitionCode },
            })
          )?.id ?? null)
        : null;
      data.competition = competitionId
        ? { connect: { id: competitionId } }
        : { disconnect: true };
    }
    if (options !== undefined) data.options = options as Prisma.InputJsonValue;
    if (correct !== undefined) data.correct = correct as Prisma.InputJsonValue;
    return this.prisma.question.update({ where: { code }, data });
  }

  async deleteQuestion(code: string) {
    const existing = await this.prisma.question.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Question not found');
    await this.prisma.question.delete({ where: { code } });
    return { ok: true };
  }

  // ---- exams ----

  async listExams(q: ListQuery): Promise<ListResult<Record<string, unknown>>> {
    const where: Prisma.ExamWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.comp) where.competition = { code: q.comp };
    if (q.search) where.title = { contains: q.search, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.exam.findMany({
        where,
        include: { competition: { select: { code: true, title: true } } },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.exam.count({ where }),
    ]);
    return paginate(
      rows.map((x) => ({
        code: x.code,
        title: x.title,
        grade: x.grade,
        date: x.date,
        time: x.time,
        durationMin: x.durationMin,
        status: x.status,
        competition: x.competition?.title ?? null,
        competitionCode: x.competition?.code ?? null,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async createExam(dto: CreateExamDto) {
    const { competitionCode, date, time, timing, ...rest } = dto;
    const codes = (
      await this.prisma.exam.findMany({ select: { code: true } })
    ).map((x) => x.code);
    const competitionId = competitionCode
      ? ((
          await this.prisma.competition.findUnique({
            where: { code: competitionCode },
          })
        )?.id ?? null)
      : null;
    return this.prisma.exam.create({
      data: {
        code: nextCode(codes, 'E'),
        competitionId,
        ...rest,
        date: toDate(date) ?? null,
        time: toTime(time) ?? null,
        timing: timing ?? {},
        status: rest.status ?? 'Scheduled',
      },
    });
  }

  async updateExam(code: string, dto: PatchExamDto) {
    const existing = await this.prisma.exam.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Exam not found');
    const { competitionCode, date, time, timing, ...rest } = dto;
    const data: Prisma.ExamUpdateInput = { ...rest };
    if (date !== undefined) data.date = toDate(date) ?? null;
    if (time !== undefined) data.time = toTime(time) ?? null;
    if (timing !== undefined) data.timing = timing as Prisma.InputJsonValue;
    if (competitionCode !== undefined) {
      const competitionId = competitionCode
        ? ((
            await this.prisma.competition.findUnique({
              where: { code: competitionCode },
            })
          )?.id ?? null)
        : null;
      data.competition = competitionId
        ? { connect: { id: competitionId } }
        : { disconnect: true };
    }
    return this.prisma.exam.update({ where: { code }, data });
  }

  async deleteExam(code: string) {
    const existing = await this.prisma.exam.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Exam not found');
    await this.prisma.exam.delete({ where: { code } });
    return { ok: true };
  }

  // ---- announcements ----

  async listAnnouncements(q: ListQuery) {
    const where: Prisma.AnnouncementWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) where.title = { contains: q.search, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return paginate(rows, total, q.page, q.limit);
  }

  async createAnnouncement(dto: CreateAnnouncementDto) {
    const codes = (
      await this.prisma.announcement.findMany({ select: { code: true } })
    ).map((x) => x.code);
    return this.prisma.announcement.create({
      data: {
        code: nextCode(codes, 'AN'),
        ...dto,
        publishOn: toDate(dto.publishOn) ?? null,
        status: dto.status ?? 'Draft',
      },
    });
  }

  async updateAnnouncement(code: string, dto: PatchAnnouncementDto) {
    const existing = await this.prisma.announcement.findUnique({
      where: { code },
    });
    if (!existing) throw new NotFoundException('Announcement not found');
    return this.prisma.announcement.update({
      where: { code },
      data: {
        ...dto,
        publishOn:
          dto.publishOn !== undefined
            ? (toDate(dto.publishOn) ?? null)
            : undefined,
      },
    });
  }

  async deleteAnnouncement(code: string) {
    const existing = await this.prisma.announcement.findUnique({
      where: { code },
    });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { code } });
    return { ok: true };
  }

  // ---- news ----

  async listNews(q: ListQuery) {
    const where: Prisma.NewsWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) where.title = { contains: q.search, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.news.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.news.count({ where }),
    ]);
    return paginate(rows, total, q.page, q.limit);
  }

  async createNews(dto: CreateNewsDto) {
    const codes = (
      await this.prisma.news.findMany({ select: { code: true } })
    ).map((x) => x.code);
    return this.prisma.news.create({
      data: {
        code: nextCode(codes, 'NW'),
        ...dto,
        publishOn: toDate(dto.publishOn) ?? null,
        status: dto.status ?? 'Draft',
      },
    });
  }

  async updateNews(code: string, dto: PatchNewsDto) {
    const existing = await this.prisma.news.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('News item not found');
    return this.prisma.news.update({
      where: { code },
      data: {
        ...dto,
        publishOn:
          dto.publishOn !== undefined
            ? (toDate(dto.publishOn) ?? null)
            : undefined,
      },
    });
  }

  async deleteNews(code: string) {
    const existing = await this.prisma.news.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('News item not found');
    await this.prisma.news.delete({ where: { code } });
    return { ok: true };
  }

  // ---- gallery ----

  async listGallery(q: ListQuery) {
    const where: Prisma.GalleryWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.gallery.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.gallery.count({ where }),
    ]);
    return paginate(rows, total, q.page, q.limit);
  }

  async createGallery(dto: CreateGalleryDto) {
    const codes = (
      await this.prisma.gallery.findMany({ select: { code: true } })
    ).map((x) => x.code);
    return this.prisma.gallery.create({
      data: {
        code: nextCode(codes, 'GA'),
        ...dto,
        date: toDate(dto.date) ?? null,
        photos: (dto.photos ?? []) as Prisma.InputJsonValue,
        status: dto.status ?? 'Active',
      },
    });
  }

  async updateGallery(code: string, dto: PatchGalleryDto) {
    const existing = await this.prisma.gallery.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Gallery album not found');
    const data: Prisma.GalleryUpdateInput = {
      name: dto.name,
      visibility: dto.visibility,
      cover: dto.cover,
      description: dto.description,
      status: dto.status,
    };
    if (dto.date !== undefined) data.date = toDate(dto.date) ?? null;
    if (dto.photos !== undefined)
      data.photos = dto.photos as Prisma.InputJsonValue;
    return this.prisma.gallery.update({ where: { code }, data });
  }

  async deleteGallery(code: string) {
    const existing = await this.prisma.gallery.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Gallery album not found');
    await this.prisma.gallery.delete({ where: { code } });
    return { ok: true };
  }

  // ---- grievances ----

  async listGrievances(q: ListQuery) {
    const where: Prisma.GrievanceWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.gtype) where.gtype = q.gtype;
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { subject: { contains: q.search, mode: 'insensitive' } },
        { message: { contains: q.search, mode: 'insensitive' } },
        { name: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.grievance.findMany({
        where,
        include: { student: { select: { code: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.grievance.count({ where }),
    ]);
    return paginate(rows, total, q.page, q.limit);
  }

  async updateGrievance(code: string, dto: PatchGrievanceDto, adminId: number) {
    const existing = await this.prisma.grievance.findUnique({
      where: { code },
    });
    if (!existing) throw new NotFoundException('Grievance not found');
    const data: Prisma.GrievanceUpdateInput = { status: dto.status };
    if (dto.status === 'Resolved') {
      data.resolver = { connect: { id: adminId } };
      data.resolvedAt = new Date();
    } else {
      data.resolver = existing.resolvedBy ? { disconnect: true } : undefined;
      data.resolvedAt = null;
    }
    return this.prisma.grievance.update({ where: { code }, data });
  }

  // ---- notifications ----

  async listNotifications(q: ListQuery) {
    const where: Prisma.NotificationWhereInput = {};
    if (q.status) where.status = q.status;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        include: {
          competition: { select: { code: true, title: true } },
          creator: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(rows, total, q.page, q.limit);
  }

  async sendNotification(dto: CreateNotificationDto, adminId: number) {
    const { competitionCode, ...rest } = dto;
    const competitionId = competitionCode
      ? ((
          await this.prisma.competition.findUnique({
            where: { code: competitionCode },
          })
        )?.id ?? null)
      : null;
    return this.prisma.notification.create({
      data: {
        ...rest,
        competitionId,
        createdBy: adminId,
        status: 'Sent',
        sentAt: new Date(),
      },
      include: { competition: { select: { code: true, title: true } } },
    });
  }
}
