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
import { ListQueryDto } from '../../common/list-query.dto';
import { RegistrationService } from './registrations.service';
import {
  AcceptStageDto,
  CreateRegistrationDto,
  CreateSchoolDto,
  CreateStudentDto,
  PatchRegistrationDto,
  PatchSchoolDto,
  PatchStudentDto,
} from './registrations.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class RegistrationController {
  constructor(private readonly service: RegistrationService) {}

  @Get('registrations')
  registrations(@Query() q: ListQueryDto) {
    return this.service.listRegistrations(q);
  }

  @Post('registrations')
  createRegistration(@Body() dto: CreateRegistrationDto) {
    return this.service.createRegistration(dto);
  }

  @Get('registrations/:code')
  registration(@Param('code') code: string) {
    return this.service.getRegistration(code);
  }

  @Patch('registrations/:code')
  updateRegistration(
    @Param('code') code: string,
    @Body() dto: PatchRegistrationDto,
  ) {
    return this.service.updateRegistration(code, dto);
  }

  @Delete('registrations/:code')
  deleteRegistration(@Param('code') code: string) {
    return this.service.deleteRegistration(code);
  }

  @Post('registrations/:code/accept-stage')
  acceptStage(@Param('code') code: string, @Body() dto: AcceptStageDto) {
    return this.service.acceptStage(code, dto);
  }

  @Get('students/:code')
  student(@Param('code') code: string) {
    return this.service.getStudent(code);
  }

  @Patch('students/:code')
  updateStudent(@Param('code') code: string, @Body() dto: PatchStudentDto) {
    return this.service.updateStudent(code, dto);
  }

  @Post('students')
  createStudent(@Body() dto: CreateStudentDto) {
    return this.service.createStudent(dto);
  }

  @Get('schools')
  schools(@Query() q: ListQueryDto) {
    return this.service.listSchools(q);
  }

  @Get('schools/:code')
  school(@Param('code') code: string) {
    return this.service.getSchool(code);
  }

  @Post('schools')
  createSchool(@Body() dto: CreateSchoolDto) {
    return this.service.createSchool(dto);
  }

  @Patch('schools/:code')
  updateSchool(@Param('code') code: string, @Body() dto: PatchSchoolDto) {
    return this.service.updateSchool(code, dto);
  }
}
