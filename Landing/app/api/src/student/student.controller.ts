import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuard } from '../auth/guards/student.guard';
import { StudentService } from './student.service';
import {
  AddGrievanceReplyDto,
  CreateStudentGrievanceDto,
  InitiatePaymentDto,
  SaveProgressDto,
  SetStudentPasswordDto,
  SubmitAttemptDto,
  UpdateStudentProfileDto,
} from './student.dto';

@Controller('student')
@UseGuards(JwtAuthGuard, StudentGuard)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get('me')
  me(@Req() req: { user: { sub: number } }) {
    return this.studentService.me(Number(req.user.sub));
  }

  @Post('me/demo-prompt-seen')
  markDemoPromptSeen(@Req() req: { user: { sub: number } }) {
    return this.studentService.markDemoPromptSeen(Number(req.user.sub));
  }

  @Patch('me')
  updateProfile(
    @Req() req: { user: { sub: number } },
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.studentService.updateProfile(Number(req.user.sub), dto);
  }

  @Post('photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadPhoto(
    @Req() req: { user: { sub: number } },
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.studentService.uploadPhoto(Number(req.user.sub), file);
  }

  @Delete('photo')
  removePhoto(@Req() req: { user: { sub: number } }) {
    return this.studentService.removePhoto(Number(req.user.sub));
  }

  @Post('password')
  setPassword(
    @Req() req: { user: { sub: number } },
    @Body() dto: SetStudentPasswordDto,
  ) {
    return this.studentService.setPassword(Number(req.user.sub), dto);
  }

  @Post('competitions/:code/join')
  joinCompetition(
    @Req() req: { user: { sub: number } },
    @Param('code') code: string,
  ) {
    return this.studentService.joinCompetition(Number(req.user.sub), code);
  }

  @Get('schedules')
  schedules(@Req() req: { user: { sub: number } }) {
    return this.studentService.schedules(Number(req.user.sub));
  }

  @Get('exams/:code')
  examDetails(
    @Req() req: { user: { sub: number } },
    @Param('code') code: string,
  ) {
    return this.studentService.examDetails(code, Number(req.user.sub));
  }

  @Post('exams/:code/start')
  startExam(
    @Req() req: { user: { sub: number } },
    @Param('code') code: string,
  ) {
    return this.studentService.startExam(code, Number(req.user.sub));
  }

  @Post('exams/:code/progress')
  saveProgress(
    @Req() req: { user: { sub: number } },
    @Param('code') code: string,
    @Body() dto: SaveProgressDto,
  ) {
    return this.studentService.saveProgress(code, Number(req.user.sub), dto);
  }

  @Post('exams/:code/submit')
  submitExam(
    @Req() req: { user: { sub: number } },
    @Param('code') code: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.studentService.submitExam(code, Number(req.user.sub), dto);
  }

  @Get('results')
  results(@Req() req: { user: { sub: number } }) {
    return this.studentService.results(Number(req.user.sub));
  }

  @Get('results/:code')
  resultDetail(
    @Req() req: { user: { sub: number } },
    @Param('code') code: string,
  ) {
    return this.studentService.resultDetail(code, Number(req.user.sub));
  }

  @Post('results/:code/certificate/generate')
  generateCertificate(
    @Req() req: { user: { sub: number } },
    @Param('code') code: string,
  ) {
    return this.studentService.generateCertificate(code, Number(req.user.sub));
  }

  @Get('payments')
  payments(@Req() req: { user: { sub: number } }) {
    return this.studentService.payments(Number(req.user.sub));
  }

  @Post('payments/initiate')
  initiatePayment(
    @Req() req: { user: { sub: number } },
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.studentService.initiatePayment(Number(req.user.sub), dto);
  }

  @Get('grievances')
  grievances(@Req() req: { user: { sub: number } }) {
    return this.studentService.grievances(Number(req.user.sub));
  }

  @Post('grievances')
  createGrievance(
    @Req() req: { user: { sub: number } },
    @Body() dto: CreateStudentGrievanceDto,
  ) {
    return this.studentService.createGrievance(Number(req.user.sub), dto);
  }

  @Get('grievances/:code')
  grievanceDetail(
    @Req() req: { user: { sub: number } },
    @Param('code') code: string,
  ) {
    return this.studentService.grievanceDetail(Number(req.user.sub), code);
  }

  @Post('grievances/:code/reply')
  addGrievanceReply(
    @Req() req: { user: { sub: number } },
    @Param('code') code: string,
    @Body() dto: AddGrievanceReplyDto,
  ) {
    return this.studentService.addGrievanceReply(Number(req.user.sub), code, dto);
  }
}
