import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ListQueryDto } from '../../common/list-query.dto';
import { ScorecardService } from './scorecard.service';
import { StageReportService } from './stage-report.service';
import { GovernanceService } from './governance.service';
import {
  CreateFrameworkDto,
  CreateSeasonDto,
  PatchFrameworkDto,
  PatchSeasonDto,
  SeasonCompetitionsDto,
  ImportBundleDto,
  CopySeasonDto,
} from './scorecard.dto';

// Scorecard setup (Module Access code "sc"), enforced on the server.
@Controller('scorecard')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Roles('admin')
@RequireModule('sc')
export class ScorecardController {
  constructor(
    private readonly service: ScorecardService,
    private readonly stageReports: StageReportService,
    private readonly governance: GovernanceService,
  ) {}

  // ---- frameworks
  @Get('frameworks')
  frameworks() {
    return this.service.listFrameworks();
  }
  @Post('frameworks')
  createFramework(@Body() dto: CreateFrameworkDto, @CurrentUser() u: JwtPayload) {
    return this.service.createFramework(dto, u.sub);
  }
  @Get('frameworks/:code')
  framework(@Param('code') code: string) {
    return this.service.getFramework(code);
  }
  @Patch('frameworks/:code')
  updateFramework(@Param('code') code: string, @Body() dto: PatchFrameworkDto, @CurrentUser() u: JwtPayload) {
    return this.service.updateFramework(code, dto, u.sub);
  }
  @Delete('frameworks/:code')
  deleteFramework(@Param('code') code: string, @CurrentUser() u: JwtPayload) {
    return this.service.deleteFramework(code, u.sub);
  }
  @Post('frameworks/:code/publish')
  publish(@Param('code') code: string, @CurrentUser() u: JwtPayload) {
    return this.service.publishFramework(code, u.sub);
  }
  @Post('frameworks/:code/archive')
  archive(@Param('code') code: string, @CurrentUser() u: JwtPayload) {
    return this.service.archiveFramework(code, u.sub);
  }
  @Post('frameworks/:code/unarchive')
  unarchive(@Param('code') code: string, @CurrentUser() u: JwtPayload) {
    return this.service.unarchiveFramework(code, u.sub);
  }

  // ---- seasons
  @Get('seasons')
  seasons() {
    return this.service.listSeasons();
  }
  @Post('seasons')
  createSeason(@Body() dto: CreateSeasonDto, @CurrentUser() u: JwtPayload) {
    return this.service.createSeason(dto, u.sub);
  }
  @Get('seasons/:code')
  season(@Param('code') code: string) {
    return this.service.getSeason(code);
  }
  @Patch('seasons/:code')
  updateSeason(@Param('code') code: string, @Body() dto: PatchSeasonDto, @CurrentUser() u: JwtPayload) {
    return this.service.updateSeason(code, dto, u.sub);
  }
  @Delete('seasons/:code')
  deleteSeason(@Param('code') code: string, @CurrentUser() u: JwtPayload) {
    return this.service.deleteSeason(code, u.sub);
  }
  @Put('seasons/:code/competitions')
  seasonCompetitions(@Param('code') code: string, @Body() dto: SeasonCompetitionsDto, @CurrentUser() u: JwtPayload) {
    return this.service.setSeasonCompetitions(code, dto, u.sub);
  }

  // ---- stage report data (auto-scored stages, e.g. Stage 1): one student, a roster, an Excel export.
  // `comp` is the competition code; `framework` optionally previews with a framework (drafts included)
  // before the competition is in a season.
  @Get('stage-report')
  stageReport(
    @Query('comp') comp: string,
    @Query('stage') stage: string,
    @Query('student') student: string,
    @Query('framework') framework?: string,
  ) {
    return this.stageReports.studentReport(comp, Number(stage), student, framework || undefined);
  }
  @Get('stage-report/roster')
  stageRoster(@Query() q: ListQueryDto, @Query('stage') stage: string, @Query('framework') framework?: string) {
    return this.stageReports.roster(q.comp as string, Number(stage), q, framework || undefined);
  }
  @Get('stage-report/roster/export')
  async stageRosterExport(@Query() q: ListQueryDto, @Query('stage') stage: string, @Query('framework') framework?: string) {
    const buf = await this.stageReports.exportRoster(q.comp as string, Number(stage), q, framework || undefined);
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${q.comp}-stage-${stage}-report.xlsx"`,
    });
  }

  // ---- governance (#87): version differences, export / import, next season, audit search
  @Get('frameworks/:code/diff')
  frameworkDiff(@Param('code') code: string, @Query('against') against?: string) {
    return this.governance.frameworkDiff(code, against || undefined);
  }
  @Get('templates/:code/diff')
  templateDiff(@Param('code') code: string, @Query('against') against?: string) {
    return this.governance.templateDiff(code, against || undefined);
  }
  @Get('export')
  exportSeason(@Query('season') season: string, @CurrentUser() u: JwtPayload) {
    return this.governance.exportSeason(season, u.sub);
  }
  @Post('import')
  importBundle(@Body() dto: ImportBundleDto, @CurrentUser() u: JwtPayload) {
    return this.governance.importBundle(dto.bundle, dto.dryRun !== false, u.sub);
  }
  @Post('seasons/:code/copy')
  copySeason(@Param('code') code: string, @Body() dto: CopySeasonDto, @CurrentUser() u: JwtPayload) {
    return this.governance.copySeason(code, dto, u.sub);
  }
  @Get('audit/search')
  auditSearch(
    @Query('entity') entity?: string,
    @Query('code') code?: string,
    @Query('action') action?: string,
    @Query('admin') admin?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.governance.auditSearch({ entity, code, action, admin, from, to, limit: limit ? Number(limit) : undefined, offset: offset ? Number(offset) : undefined });
  }

  // ---- audit
  @Get('audit')
  audit(@Query('entity') entity?: string, @Query('code') code?: string, @Query('limit') limit?: string) {
    return this.service.auditLog({ entity, code, limit: limit ? Number(limit) : undefined });
  }
}
