import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { RegisterStudentDto } from './dto/register-student.dto';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import type { JwtPayload } from '../auth/auth.types';

@ApiTags('Students')
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterStudentDto) {
    return this.students.register(dto);
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.students.listForUser(
      user,
      schoolId ? parseInt(schoolId, 10) : undefined,
    );
  }

  @Roles('STUDENT')
  @Get('me')
  me(@CurrentUser('sub', ParseIntPipe) userId: number) {
    return this.students.getProfile(userId);
  }
}
