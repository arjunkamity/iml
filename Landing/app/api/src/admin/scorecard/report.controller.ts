import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ListQueryDto } from '../../common/list-query.dto';
import { ScorecardReportService } from './report.service';
import { TemplateService } from './template.service';
import { ReportReleaseService } from './report-release.service';
import { FinalProfileService } from './final-profile.service';
import { CreateTemplateDto, GenerateReportsDto, PatchTemplateDto, ReleaseDto, SendToParentsDto, WithdrawDto } from './template.dto';

// Report templates and generated report PDFs (#73). Module Access "sc".
@Controller('scorecard')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Roles('admin')
@RequireModule('sc,rl')
export class ScorecardReportController {
  constructor(
    private readonly templates: TemplateService,
    private readonly reports: ScorecardReportService,
    private readonly releases: ReportReleaseService,
    private readonly profiles: FinalProfileService,
  ) {}

  // ---- templates
  @RequireModule('sc')
  @Get('templates/meta')
  templateMeta() {
    return this.templates.meta();
  }
  @RequireModule('sc')
  @Get('templates')
  listTemplates() {
    return this.templates.list();
  }
  @RequireModule('sc')
  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() u: JwtPayload) {
    return this.templates.create(dto, u.sub);
  }
  @RequireModule('sc')
  @Get('templates/:code')
  template(@Param('code') code: string) {
    return this.templates.get(code);
  }
  @RequireModule('sc')
  @Patch('templates/:code')
  updateTemplate(@Param('code') code: string, @Body() dto: PatchTemplateDto, @CurrentUser() u: JwtPayload) {
    return this.templates.update(code, dto, u.sub);
  }
  @RequireModule('sc')
  @Delete('templates/:code')
  deleteTemplate(@Param('code') code: string, @CurrentUser() u: JwtPayload) {
    return this.templates.remove(code, u.sub);
  }
  @RequireModule('sc')
  @Post('templates/:code/publish')
  publishTemplate(@Param('code') code: string, @CurrentUser() u: JwtPayload) {
    return this.templates.publish(code, u.sub);
  }
  @RequireModule('sc')
  @Post('templates/:code/archive')
  archiveTemplate(@Param('code') code: string, @CurrentUser() u: JwtPayload) {
    return this.templates.archive(code, u.sub);
  }
  @RequireModule('sc')
  @Post('templates/:code/unarchive')
  unarchiveTemplate(@Param('code') code: string, @CurrentUser() u: JwtPayload) {
    return this.templates.unarchive(code, u.sub);
  }

  // ---- the final profile of one student (all stages rolled up by the framework's rules)
  @Get('profile')
  async profile(@Query('comp') comp: string, @Query('student') student: string, @Query('framework') framework?: string) {
    const ctx = await this.profiles.context(comp, framework || undefined);
    const r = await this.profiles.forStudent(ctx, student);
    return { framework: ctx.framework, scale: ctx.scale.key, profile: r.profile, stages: r.stages.map((s) => ({ position: s.position, name: s.name, status: s.status })) };
  }

  // ---- reports (routes with fixed words first)
  @Get('reports')
  list(@Query() q: ListQueryDto, @Query('stage') stage: string) {
    return this.reports.list(q.comp as string, Number(stage), q);
  }
  @RequireModule('sc')
  @Post('reports/generate')
  generate(@Query('comp') comp: string, @Query('stage') stage: string, @Body() dto: GenerateReportsDto, @CurrentUser() u: JwtPayload) {
    return this.reports.generate(comp, Number(stage), dto, u.sub);
  }
  @RequireModule('rl')
  @Post('reports/release')
  release(@Query('comp') comp: string, @Body() dto: ReleaseDto, @CurrentUser() u: JwtPayload) {
    return this.releases.release(comp, dto, u.sub);
  }
  @RequireModule('rl')
  @Post('reports/withdraw')
  withdraw(@Query('comp') comp: string, @Body() dto: WithdrawDto, @CurrentUser() u: JwtPayload) {
    return this.releases.withdraw(comp, dto, u.sub);
  }
  @RequireModule('rl')
  @Post('reports/send-parents')
  sendParents(@Query('comp') comp: string, @Body() dto: SendToParentsDto, @CurrentUser() u: JwtPayload) {
    return this.releases.sendToParents(comp, dto, u.sub);
  }
  @Get('reports/preview')
  preview(
    @Query('comp') comp: string,
    @Query('stage') stage: string,
    @Query('student') student: string,
    @Query('template') template?: string,
    @Query('library') library?: string,
    @Query('framework') framework?: string,
    @Query('draft') draft?: string,
  ) {
    return this.reports.preview(comp, Number(stage), student, { templateCode: template || undefined, libraryCode: library || undefined, frameworkCode: framework || undefined, draft: draft === 'true' });
  }
  @Get('reports/preview.pdf')
  async previewPdf(
    @Query('comp') comp: string,
    @Query('stage') stage: string,
    @Query('student') student: string,
    @Query('template') template?: string,
    @Query('library') library?: string,
    @Query('framework') framework?: string,
    @Query('draft') draft?: string,
  ) {
    const r = await this.reports.previewPdf(comp, Number(stage), student, { templateCode: template || undefined, libraryCode: library || undefined, frameworkCode: framework || undefined, draft: draft === 'true' });
    return new StreamableFile(r.pdf, { type: 'application/pdf', disposition: `inline; filename="${r.filename}"` });
  }
  @Get('reports/:id')
  report(@Param('id', ParseIntPipe) id: number) {
    return this.reports.get(id);
  }
  @Get('reports/:id/download')
  async download(@Param('id', ParseIntPipe) id: number) {
    const r = await this.reports.download(id);
    return new StreamableFile(r.data, { type: 'application/pdf', disposition: `attachment; filename="${r.filename}"` });
  }
  @RequireModule('sc')
  @Post('reports/:id/retry')
  retry(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtPayload) {
    return this.reports.retry(id, u.sub);
  }
}
