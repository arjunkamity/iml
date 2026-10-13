import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolGuard } from '../auth/guards/school.guard';
import { SchoolService } from './school.service';
import {
  AddSchoolStudentDto,
  SetSchoolPasswordDto,
  UpdateSchoolProfileDto,
  UpdateSchoolStudentDto,
} from './school.dto';
import { ListQueryDto } from '../common/list-query.dto';

@Controller('school')
@UseGuards(JwtAuthGuard, SchoolGuard)
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Get('me')
  me(@Req() req: { user: { sub: number } }) {
    return this.schoolService.me(Number(req.user.sub));
  }

  @Patch('me')
  updateProfile(@Req() req: { user: { sub: number } }, @Body() dto: UpdateSchoolProfileDto) {
    return this.schoolService.updateProfile(Number(req.user.sub), dto);
  }

  @Post('password')
  setPassword(@Req() req: { user: { sub: number } }, @Body() dto: SetSchoolPasswordDto) {
    return this.schoolService.setPassword(Number(req.user.sub), dto);
  }

  @Get('students')
  students(@Req() req: { user: { sub: number } }, @Query() q: ListQueryDto) {
    return this.schoolService.listStudents(Number(req.user.sub), q);
  }

  // See RegistrationController.exportRegistrations — StreamableFile is
  // what actually sends real binary; a plain Buffer return gets
  // JSON.stringify()'d by Nest's default response handling.
  @Get('students/export')
  async exportStudents(@Req() req: { user: { sub: number } }, @Query() q: ListQueryDto) {
    const buf = await this.schoolService.exportStudents(Number(req.user.sub), q);
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="registrations-export.xlsx"',
    });
  }

  @Patch('students/:code')
  updateStudent(
    @Req() req: { user: { sub: number } },
    @Param('code') code: string,
    @Body() dto: UpdateSchoolStudentDto,
  ) {
    return this.schoolService.updateStudent(Number(req.user.sub), code, dto);
  }

  @Get('students/bulk-upload/sample')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="students-sample.csv"')
  studentsSampleCsv() {
    return this.schoolService.sampleStudentsCsv();
  }

  @Post('students/bulk-upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  bulkUploadStudents(@Req() req: { user: { sub: number } }, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file was uploaded');
    return this.schoolService.bulkUploadStudents(Number(req.user.sub), file.buffer);
  }

  @Get('competitions')
  competitions() {
    return this.schoolService.availableCompetitions();
  }

  @Post('students')
  addStudent(@Req() req: { user: { sub: number } }, @Body() dto: AddSchoolStudentDto) {
    return this.schoolService.addStudent(Number(req.user.sub), dto);
  }

  @Get('results')
  results(@Req() req: { user: { sub: number } }, @Query() q: ListQueryDto) {
    return this.schoolService.listResults(Number(req.user.sub), { page: q.page, limit: q.limit, comp: q.comp });
  }

  @Get('results/:code')
  resultDetail(@Req() req: { user: { sub: number } }, @Param('code') code: string) {
    return this.schoolService.resultDetail(Number(req.user.sub), code);
  }

  @Get('payments')
  payments(@Req() req: { user: { sub: number } }, @Query() q: ListQueryDto) {
    return this.schoolService.listPayments(Number(req.user.sub), { page: q.page, limit: q.limit, comp: q.comp, status: q.status, grade: q.grade });
  }

  @Get('payments/export')
  async exportPayments(@Req() req: { user: { sub: number } }, @Query() q: ListQueryDto) {
    const buf = await this.schoolService.exportPayments(Number(req.user.sub), { comp: q.comp, status: q.status, grade: q.grade });
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="payments-export.xlsx"',
    });
  }
}
