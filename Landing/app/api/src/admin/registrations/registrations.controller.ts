import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ListQueryDto } from '../../common/list-query.dto';
import { RegistrationService } from './registrations.service';
import {
  AcceptStageDto,
  AdminSetPasswordDto,
  CreateRegistrationDto,
  CreateSchoolDto,
  CreateStudentDto,
  MergeDto,
  PatchRegistrationDto,
  PatchSchoolDto,
  PatchStudentDto,
  SchoolLoginLinkDto,
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

  // A plain Buffer return would get JSON.stringify()'d by Nest's default
  // response handling (Buffer is `typeof === 'object'`, so it doesn't get
  // the same pass-through a string return gets — see the CSV sample
  // downloads above) — StreamableFile is what actually bypasses that and
  // sends real binary.
  @Get('registrations/export')
  async exportRegistrations(@Query() q: ListQueryDto) {
    const buf = await this.service.exportRegistrations(q);
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="registrations-export.xlsx"',
    });
  }

  @Post('registrations')
  createRegistration(@Body() dto: CreateRegistrationDto) {
    return this.service.createRegistration(dto);
  }

  @Get('registrations/bulk-upload/sample')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="registrations-sample.csv"')
  registrationsSampleCsv() {
    return this.service.sampleRegistrationsCsv();
  }

  @Post('registrations/bulk-upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  bulkUploadRegistrations(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file was uploaded');
    return this.service.bulkUploadRegistrations(file.buffer);
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

  @Post('registrations/:code/archive')
  archiveStudent(@Param('code') code: string) {
    return this.service.archiveStudent(code);
  }

  @Post('registrations/:code/payment-reminder')
  sendPaymentReminder(@Param('code') code: string) {
    return this.service.sendPaymentReminder(code);
  }

  @Post('registrations/:code/access-token')
  generateStudentAccessToken(@Param('code') code: string) {
    return this.service.generateStudentAccessToken(code);
  }

  @Post('registrations/:code/set-student-password')
  setStudentPassword(@Param('code') code: string, @Body() dto: AdminSetPasswordDto) {
    return this.service.setStudentPasswordByAdmin(code, dto.newPassword);
  }

  @Post('registrations/:code/accept-stage')
  acceptStage(@Param('code') code: string, @Body() dto: AcceptStageDto) {
    return this.service.acceptStage(code, dto);
  }

  @Get('students/merge-preview')
  previewStudentMerge(@Query('keepCode') keepCode: string, @Query('mergeCode') mergeCode: string) {
    return this.service.previewStudentMerge(keepCode, mergeCode);
  }

  @Post('students/merge')
  mergeStudents(@Body() dto: MergeDto) {
    return this.service.mergeStudents(dto.keepCode, dto.mergeCode);
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

  @Get('schools/merge-preview')
  previewSchoolMerge(@Query('keepCode') keepCode: string, @Query('mergeCode') mergeCode: string) {
    return this.service.previewSchoolMerge(keepCode, mergeCode);
  }

  @Post('schools/merge')
  mergeSchools(@Body() dto: MergeDto) {
    return this.service.mergeSchools(dto.keepCode, dto.mergeCode);
  }

  @Get('schools/:code')
  school(@Param('code') code: string) {
    return this.service.getSchool(code);
  }

  @Post('schools')
  createSchool(@Body() dto: CreateSchoolDto) {
    return this.service.createSchool(dto);
  }

  @Get('schools/bulk-upload/sample')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="schools-sample.csv"')
  schoolsSampleCsv() {
    return this.service.sampleSchoolsCsv();
  }

  @Post('schools/bulk-upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  bulkUploadSchools(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file was uploaded');
    return this.service.bulkUploadSchools(file.buffer);
  }

  @Patch('schools/:code')
  updateSchool(@Param('code') code: string, @Body() dto: PatchSchoolDto) {
    return this.service.updateSchool(code, dto);
  }

  @Post('schools/:code/login-link')
  schoolLoginLink(@Param('code') code: string, @Body() dto: SchoolLoginLinkDto) {
    return this.service.generateSchoolLoginLink(code, dto.loginAs);
  }

  @Post('schools/:code/set-password')
  setSchoolPassword(@Param('code') code: string, @Body() dto: AdminSetPasswordDto) {
    return this.service.setSchoolPassword(code, dto.newPassword);
  }
}
