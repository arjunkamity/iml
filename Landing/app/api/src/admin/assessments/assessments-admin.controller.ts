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
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { ListQueryDto } from '../../common/list-query.dto';
import { AssessmentsAdminService } from './assessments-admin.service';
import {
  AssessmentQuestionDto,
  CreateAssessmentCategoryDto,
  CreateAssessmentDto,
  PatchAssessmentCategoryDto,
  PatchAssessmentDto,
  PatchAssessmentQuestionDto,
  PreviewScoreDto,
} from './assessments-admin.dto';

// Admin screens for Assessments (Module Access code "asm"). The module check
// is enforced here on the server, not just by hiding the sidebar entry.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Roles('admin')
@RequireModule('asm')
export class AssessmentsAdminController {
  constructor(private readonly service: AssessmentsAdminService) {}

  // ---- categories
  @Get('assessment-categories')
  categories() {
    return this.service.listCategories();
  }
  @Post('assessment-categories')
  createCategory(@Body() dto: CreateAssessmentCategoryDto) {
    return this.service.createCategory(dto);
  }
  @Patch('assessment-categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: PatchAssessmentCategoryDto) {
    return this.service.updateCategory(id, dto);
  }
  @Delete('assessment-categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteCategory(id);
  }

  // ---- dashboard + list (static paths before :code)
  @Get('assessments/overview')
  overview() {
    return this.service.overview();
  }
  @Get('assessments')
  list(@Query('status') status?: string, @Query('category') category?: string, @Query('search') search?: string) {
    return this.service.list({ status, category, search });
  }
  @Post('assessments')
  create(@Body() dto: CreateAssessmentDto) {
    return this.service.create(dto);
  }
  @Get('assessments/questions-sample')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="assessment-questions-sample.csv"')
  sampleCsv() {
    return this.service.sampleQuestionsCsv();
  }

  // ---- one assessment
  @Get('assessments/:code')
  get(@Param('code') code: string) {
    return this.service.get(code);
  }
  @Patch('assessments/:code')
  update(@Param('code') code: string, @Body() dto: PatchAssessmentDto) {
    return this.service.update(code, dto);
  }
  @Delete('assessments/:code')
  remove(@Param('code') code: string) {
    return this.service.remove(code);
  }
  @Post('assessments/:code/publish')
  publish(@Param('code') code: string) {
    return this.service.publish(code);
  }
  @Post('assessments/:code/archive')
  archive(@Param('code') code: string) {
    return this.service.archive(code);
  }
  @Post('assessments/:code/unarchive')
  unarchive(@Param('code') code: string) {
    return this.service.unarchive(code);
  }

  // ---- questions
  @Get('assessments/:code/questions')
  questions(@Param('code') code: string) {
    return this.service.listQuestions(code);
  }
  @Post('assessments/:code/questions')
  createQuestion(@Param('code') code: string, @Body() dto: AssessmentQuestionDto) {
    return this.service.createQuestion(code, dto);
  }
  @Post('assessments/:code/questions/bulk-upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  bulkUpload(
    @Param('code') code: string,
    @Query('dryRun') dryRun?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded');
    return this.service.bulkUploadQuestions(code, file.buffer, dryRun === 'true');
  }
  @Patch('assessments/:code/questions/:qcode')
  updateQuestion(@Param('code') code: string, @Param('qcode') qcode: string, @Body() dto: PatchAssessmentQuestionDto) {
    return this.service.updateQuestion(code, qcode, dto);
  }
  @Delete('assessments/:code/questions/:qcode')
  deleteQuestion(@Param('code') code: string, @Param('qcode') qcode: string) {
    return this.service.deleteQuestion(code, qcode);
  }

  // ---- try it (score without saving)
  @Post('assessments/:code/preview')
  preview(@Param('code') code: string, @Body() dto: PreviewScoreDto) {
    return this.service.previewScore(code, dto);
  }

  // ---- results
  @Get('assessments/:code/submissions')
  submissions(@Param('code') code: string, @Query() q: ListQueryDto) {
    return this.service.listSubmissions(code, q);
  }
  @Get('assessments/:code/submissions/:id')
  submission(@Param('code') code: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.submissionDetail(code, id);
  }
  @Delete('assessments/:code/submissions/:id')
  deleteSubmission(@Param('code') code: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteSubmission(code, id);
  }
  @Get('assessments/:code/analytics')
  analytics(@Param('code') code: string, @Query() q: ListQueryDto) {
    return this.service.analytics(code, q);
  }
  // StreamableFile, not a bare Buffer: Nest would JSON-encode a Buffer.
  @Get('assessments/:code/export')
  async export(@Param('code') code: string, @Query() q: ListQueryDto) {
    const buf = await this.service.exportSubmissions(code, q);
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${code}-results.xlsx"`,
    });
  }
}
