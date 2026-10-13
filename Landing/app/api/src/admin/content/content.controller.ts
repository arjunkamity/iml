import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ListQueryDto } from '../../common/list-query.dto';
import { ContentService } from './content.service';
import {
  AssignRegistrationDto,
  AutoAssignBatchesDto,
  CreateAnnouncementDto,
  CreateExamBatchDto,
  CreateExamDto,
  CreateGalleryDto,
  CreateNewsDto,
  CreateNotificationDto,
  CreateQuestionDto,
  PatchAnnouncementDto,
  PatchExamBatchDto,
  PatchExamDto,
  PatchGalleryDto,
  PatchGrievanceDto,
  PatchNewsDto,
  PatchQuestionDto,
  ReplyGrievanceDto,
  SendBatchReminderDto,
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

  @Get('questions/bulk-upload/sample')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="questions-sample.csv"')
  questionsSampleCsv() {
    return this.service.sampleQuestionsCsv();
  }

  @Post('questions/bulk-upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  bulkUploadQuestions(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file was uploaded');
    return this.service.bulkUploadQuestions(file.buffer);
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

  // exam batches (batch-wise access)
  @Get('exams/:code/batches')
  examBatches(@Param('code') code: string) {
    return this.service.listExamBatches(code);
  }
  @Post('exams/:code/batches')
  createExamBatch(@Param('code') code: string, @Body() dto: CreateExamBatchDto) {
    return this.service.createExamBatch(code, dto);
  }
  @Patch('exam-batches/:id')
  updateExamBatch(@Param('id', ParseIntPipe) id: number, @Body() dto: PatchExamBatchDto) {
    return this.service.updateExamBatch(id, dto);
  }
  @Delete('exam-batches/:id')
  deleteExamBatch(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteExamBatch(id);
  }
  @Post('exams/:code/batches/auto-assign')
  autoAssignExamBatches(@Param('code') code: string, @Body() dto: AutoAssignBatchesDto) {
    return this.service.autoAssignExamBatches(code, dto);
  }
  @Get('exams/:code/students')
  searchExamStudents(@Param('code') code: string, @Query('q') q?: string) {
    return this.service.searchExamStudents(code, q ?? '');
  }
  @Get('exam-batches/:id/students')
  listBatchStudents(@Param('id', ParseIntPipe) id: number, @Query() q: ListQueryDto) {
    return this.service.listBatchStudents(id, q);
  }
  @Post('exam-batches/:id/remind')
  sendBatchReminder(@Param('id', ParseIntPipe) id: number, @Body() dto: SendBatchReminderDto) {
    return this.service.sendBatchReminder(id, dto.type, dto.channels);
  }
  @Post('exam-batches/:id/assign')
  assignRegistrationToBatch(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignRegistrationDto) {
    return this.service.assignRegistrationToBatch(id, dto);
  }
  @Post('exams/:code/batches/unassign')
  unassignRegistrationFromExam(@Param('code') code: string, @Body() dto: AssignRegistrationDto) {
    return this.service.unassignRegistrationFromExam(code, dto.registrationCode);
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
  @Get('grievances/:code')
  grievanceDetail(@Param('code') code: string) {
    return this.service.grievanceDetail(code);
  }
  @Patch('grievances/:code')
  updateGrievance(
    @Param('code') code: string,
    @Body() dto: PatchGrievanceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateGrievance(code, dto, user.sub);
  }
  @Post('grievances/:code/reply')
  replyToGrievance(
    @Param('code') code: string,
    @Body() dto: ReplyGrievanceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.replyToGrievance(code, dto, user.sub);
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
