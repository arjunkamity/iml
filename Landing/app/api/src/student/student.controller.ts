import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuard } from '../auth/guards/student.guard';
import { StudentService } from './student.service';
import {
  CreateStudentGrievanceDto,
  SetStudentPasswordDto,
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

  @Patch('me')
  updateProfile(
    @Req() req: { user: { sub: number } },
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.studentService.updateProfile(Number(req.user.sub), dto);
  }

  @Post('password')
  setPassword(
    @Req() req: { user: { sub: number } },
    @Body() dto: SetStudentPasswordDto,
  ) {
    return this.studentService.setPassword(Number(req.user.sub), dto);
  }

  @Get('schedules')
  schedules(@Req() req: { user: { sub: number } }) {
    return this.studentService.schedules(Number(req.user.sub));
  }

  @Get('results')
  results(@Req() req: { user: { sub: number } }) {
    return this.studentService.results(Number(req.user.sub));
  }

  @Get('payments')
  payments(@Req() req: { user: { sub: number } }) {
    return this.studentService.payments(Number(req.user.sub));
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
}
