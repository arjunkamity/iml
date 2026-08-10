import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ListQueryDto } from '../../common/list-query.dto';
import { ContentService } from './content.service';
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

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ContentController {
  constructor(private readonly service: ContentService) {}

  // questions
  @Get('questions')
  questions(@Query() q: ListQueryDto) {
    return this.service.listQuestions(q);
  }
  @Get('questions/:code')
  question(@Param('code') code: string) {
    return this.service.getQuestion(code);
  }
  @Post('questions')
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.service.createQuestion(dto);
  }
  @Patch('questions/:code')
  updateQuestion(@Param('code') code: string, @Body() dto: PatchQuestionDto) {
    return this.service.updateQuestion(code, dto);
  }
  @Delete('questions/:code')
  deleteQuestion(@Param('code') code: string) {
    return this.service.deleteQuestion(code);
  }

  // exams
  @Get('exams')
  exams(@Query() q: ListQueryDto) {
    return this.service.listExams(q);
  }
  @Post('exams')
  createExam(@Body() dto: CreateExamDto) {
    return this.service.createExam(dto);
  }
  @Patch('exams/:code')
  updateExam(@Param('code') code: string, @Body() dto: PatchExamDto) {
    return this.service.updateExam(code, dto);
  }
  @Delete('exams/:code')
  deleteExam(@Param('code') code: string) {
    return this.service.deleteExam(code);
  }

  // announcements
  @Get('announcements')
  announcements(@Query() q: ListQueryDto) {
    return this.service.listAnnouncements(q);
  }
  @Post('announcements')
  createAnnouncement(@Body() dto: CreateAnnouncementDto) {
    return this.service.createAnnouncement(dto);
  }
  @Patch('announcements/:code')
  updateAnnouncement(
    @Param('code') code: string,
    @Body() dto: PatchAnnouncementDto,
  ) {
    return this.service.updateAnnouncement(code, dto);
  }
  @Delete('announcements/:code')
  deleteAnnouncement(@Param('code') code: string) {
    return this.service.deleteAnnouncement(code);
  }

  // news
  @Get('news')
  news(@Query() q: ListQueryDto) {
    return this.service.listNews(q);
  }
  @Post('news')
  createNews(@Body() dto: CreateNewsDto) {
    return this.service.createNews(dto);
  }
  @Patch('news/:code')
  updateNews(@Param('code') code: string, @Body() dto: PatchNewsDto) {
    return this.service.updateNews(code, dto);
  }
  @Delete('news/:code')
  deleteNews(@Param('code') code: string) {
    return this.service.deleteNews(code);
  }

  // gallery
  @Get('gallery')
  gallery(@Query() q: ListQueryDto) {
    return this.service.listGallery(q);
  }
  @Post('gallery')
  createGallery(@Body() dto: CreateGalleryDto) {
    return this.service.createGallery(dto);
  }
  @Patch('gallery/:code')
  updateGallery(@Param('code') code: string, @Body() dto: PatchGalleryDto) {
    return this.service.updateGallery(code, dto);
  }
  @Delete('gallery/:code')
  deleteGallery(@Param('code') code: string) {
    return this.service.deleteGallery(code);
  }

  // grievances
  @Get('grievances')
  grievances(@Query() q: ListQueryDto) {
    return this.service.listGrievances(q);
  }
  @Patch('grievances/:code')
  updateGrievance(
    @Param('code') code: string,
    @Body() dto: PatchGrievanceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateGrievance(code, dto, user.sub);
  }

  // notifications
  @Get('notifications')
  notifications(@Query() q: ListQueryDto) {
    return this.service.listNotifications(q);
  }
  @Post('notifications/send')
  sendNotification(
    @Body() dto: CreateNotificationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.sendNotification(dto, user.sub);
  }
}
