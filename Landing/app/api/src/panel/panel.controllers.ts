import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PanelGuard } from '../auth/guards/panel.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireModule } from '../auth/decorators/require-module.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PanelFormsService } from './panel-forms.service';
import { PanelStageService } from './panel-stage.service';
import { PanelAdminService } from './panel-admin.service';
import { PanelAuthService } from './panel-auth.service';
import { PanelPortalService } from './panel-portal.service';
import {
  AdjudicateDto,
  CloseDto,
  CompetencyDto,
  ConflictsDto,
  CreatePanelFormDto,
  CreatePanelistDto,
  EnrolDto,
  FinalizeDto,
  NarrativeDto,
  OverrideDto,
  PanelForgotDto,
  PanelLoginDto,
  PanelSetPasswordDto,
  PanelVerifyDto,
  PatchPanelFormDto,
  PatchPanelistDto,
  ReopenRatingDto,
  SaveRatingDto,
  StageSetupDto,
} from './panel.dto';

// ---- panel evaluation forms (Assessments admin: Module Access "asm")
@Controller('panel-forms')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Roles('admin')
@RequireModule('asm')
export class PanelFormsController {
  constructor(private readonly forms: PanelFormsService) {}

  @Get()
  list() {
    return this.forms.list();
  }
  @Post()
  create(@Body() dto: CreatePanelFormDto) {
    return this.forms.create(dto);
  }
  @Get(':code')
  get(@Param('code') code: string) {
    return this.forms.get(code);
  }
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: PatchPanelFormDto) {
    return this.forms.update(code, dto);
  }
  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.forms.remove(code);
  }
  @Post(':code/publish')
  publish(@Param('code') code: string) {
    return this.forms.publish(code);
  }
  @Post(':code/archive')
  archive(@Param('code') code: string) {
    return this.forms.archive(code);
  }
  @Post(':code/unarchive')
  unarchive(@Param('code') code: string) {
    return this.forms.unarchive(code);
  }
  @Get(':code/progress')
  progress(@Param('code') code: string) {
    return this.forms.progress(code);
  }
  @Post(':code/competencies')
  addCompetency(@Param('code') code: string, @Body() dto: CompetencyDto) {
    return this.forms.addCompetency(code, dto);
  }
  @Patch(':code/competencies/:qcode')
  updateCompetency(@Param('code') code: string, @Param('qcode') qcode: string, @Body() dto: CompetencyDto) {
    return this.forms.updateCompetency(code, qcode, dto);
  }
  @Delete(':code/competencies/:qcode')
  deleteCompetency(@Param('code') code: string, @Param('qcode') qcode: string) {
    return this.forms.deleteCompetency(code, qcode);
  }
}

// ---- panelists, panel setup, stage lifecycle and control (Module Access "pn")
@Controller('panel')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Roles('admin')
@RequireModule('pn')
export class PanelAdminController {
  constructor(
    private readonly stages: PanelStageService,
    private readonly admin: PanelAdminService,
  ) {}

  // panelists
  @Get('panelists')
  panelists(@Query('search') search?: string) {
    return this.admin.list({ search });
  }
  @Post('panelists')
  createPanelist(@Body() dto: CreatePanelistDto, @CurrentUser() u: JwtPayload) {
    return this.admin.create(dto, u.sub);
  }
  @Patch('panelists/:id')
  updatePanelist(@Param('id', ParseIntPipe) id: number, @Body() dto: PatchPanelistDto, @CurrentUser() u: JwtPayload) {
    return this.admin.update(id, dto, u.sub);
  }
  @Post('panelists/:id/resend')
  resend(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtPayload) {
    return this.admin.resendInvite(id, u.sub);
  }
  @Post('panelists/:id/disable')
  disable(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtPayload) {
    return this.admin.setStatus(id, true, u.sub);
  }
  @Post('panelists/:id/enable')
  enable(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtPayload) {
    return this.admin.setStatus(id, false, u.sub);
  }
  @Delete('panelists/:id')
  removePanelist(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtPayload) {
    return this.admin.remove(id, u.sub);
  }

  // rating changes that are not about one stage
  @Post('ratings/:id/reopen')
  reopen(@Param('id', ParseIntPipe) id: number, @Body() dto: ReopenRatingDto, @CurrentUser() u: JwtPayload) {
    return this.admin.reopenRating(id, dto.reason, u.sub);
  }

  // one stage of a competition
  @Get('competitions/:comp/stages/:stage')
  status(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number) {
    return this.stages.status(comp, stage);
  }
  @Put('competitions/:comp/stages/:stage/setup')
  setup(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @Body() dto: StageSetupDto, @CurrentUser() u: JwtPayload) {
    return this.stages.setup(comp, stage, dto, { id: u.sub });
  }
  @Post('competitions/:comp/stages/:stage/panelists')
  enrol(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @Body() dto: EnrolDto, @CurrentUser() u: JwtPayload) {
    return this.admin.enrol(comp, stage, dto.panelistId, dto.conflictSchools ?? [], u.sub);
  }
  @Delete('competitions/:comp/stages/:stage/panelists/:panelistId')
  unenrol(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @Param('panelistId', ParseIntPipe) panelistId: number, @CurrentUser() u: JwtPayload) {
    return this.admin.unenrol(comp, stage, panelistId, u.sub);
  }
  @Put('competitions/:comp/stages/:stage/panelists/:panelistId/conflicts')
  conflicts(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @Param('panelistId', ParseIntPipe) panelistId: number, @Body() dto: ConflictsDto, @CurrentUser() u: JwtPayload) {
    return this.admin.setConflicts(comp, stage, panelistId, dto.conflictSchools, u.sub);
  }
  @Post('competitions/:comp/stages/:stage/ready')
  ready(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @CurrentUser() u: JwtPayload) {
    return this.stages.markReady(comp, stage, { id: u.sub });
  }
  @Post('competitions/:comp/stages/:stage/open')
  open(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @CurrentUser() u: JwtPayload) {
    return this.stages.open(comp, stage, { id: u.sub });
  }
  @Post('competitions/:comp/stages/:stage/close')
  close(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @Body() dto: CloseDto, @CurrentUser() u: JwtPayload) {
    return this.stages.close(comp, stage, !!dto.confirm, { id: u.sub });
  }
  @Post('competitions/:comp/stages/:stage/finalize')
  finalize(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @Body() dto: FinalizeDto, @CurrentUser() u: JwtPayload) {
    return this.stages.finalize(comp, stage, !!dto.force, { id: u.sub });
  }
  @Post('competitions/:comp/stages/:stage/override')
  override(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @Body() dto: OverrideDto, @CurrentUser() u: JwtPayload) {
    return this.stages.override(comp, stage, dto.reason, { id: u.sub });
  }
  @Post('competitions/:comp/stages/:stage/release')
  release(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @CurrentUser() u: JwtPayload) {
    return this.stages.release(comp, stage, { id: u.sub });
  }
  @Get('competitions/:comp/stages/:stage/control')
  control(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number) {
    return this.admin.control(comp, stage);
  }
  @Get('competitions/:comp/stages/:stage/export')
  async export(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number) {
    const buf = await this.admin.exportXlsx(comp, stage);
    return new StreamableFile(buf, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', disposition: `attachment; filename="${comp}-stage-${stage}-panel.xlsx"` });
  }
  @Post('competitions/:comp/stages/:stage/remind')
  remind(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @Body('panelistId') panelistId: number | undefined, @CurrentUser() u: JwtPayload) {
    return this.admin.remind(comp, stage, panelistId ? Number(panelistId) : undefined, u.sub);
  }
  @Get('competitions/:comp/stages/:stage/students/:reg')
  studentDetail(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @Param('reg', ParseIntPipe) reg: number) {
    return this.admin.studentDetail(comp, stage, reg);
  }
  @Post('competitions/:comp/stages/:stage/students/:reg/adjudicate')
  adjudicate(@Param('comp') comp: string, @Param('stage', ParseIntPipe) stage: number, @Param('reg', ParseIntPipe) reg: number, @Body() dto: AdjudicateDto, @CurrentUser() u: JwtPayload) {
    return this.admin.adjudicate(comp, stage, reg, dto.overrides, dto.reason, u.sub);
  }
}

// ---- panel sign-in (no session yet)
@Controller('panel/auth')
export class PanelAuthController {
  constructor(private readonly auth: PanelAuthService) {}

  @Post('login')
  login(@Body() dto: PanelLoginDto) {
    return this.auth.login(dto.userId, dto.password);
  }
  @Post('verify')
  verify(@Body() dto: PanelVerifyDto) {
    return this.auth.verify(dto.challenge, dto.code);
  }
  @Post('set-password')
  setPassword(@Body() dto: PanelSetPasswordDto) {
    return this.auth.setPassword(dto.token, dto.password);
  }
  @Post('forgot')
  forgot(@Body() dto: PanelForgotDto) {
    return this.auth.forgot(dto.userId);
  }
}

// ---- the panel portal: only a "panel" session reaches these
@Controller('panel/me')
@UseGuards(JwtAuthGuard, PanelGuard)
export class PanelPortalController {
  constructor(private readonly portal: PanelPortalService) {}

  @Get()
  me(@CurrentUser() u: JwtPayload) {
    return this.portal.profile(Number(u.sub));
  }
  @Get('stages')
  dashboard(@CurrentUser() u: JwtPayload) {
    return this.portal.dashboard(Number(u.sub));
  }
  @Get('stages/:stageId/students')
  students(@CurrentUser() u: JwtPayload, @Param('stageId', ParseIntPipe) stageId: number, @Query('search') search?: string, @Query('school') school?: string, @Query('status') status?: string) {
    return this.portal.students(Number(u.sub), stageId, { search, school, status });
  }
  @Get('stages/:stageId/students/:reg')
  rating(@CurrentUser() u: JwtPayload, @Param('stageId', ParseIntPipe) stageId: number, @Param('reg', ParseIntPipe) reg: number) {
    return this.portal.rating(Number(u.sub), stageId, reg);
  }
  @Put('stages/:stageId/students/:reg')
  save(@CurrentUser() u: JwtPayload, @Param('stageId', ParseIntPipe) stageId: number, @Param('reg', ParseIntPipe) reg: number, @Body() dto: SaveRatingDto) {
    return this.portal.save(Number(u.sub), stageId, reg, dto);
  }
  @Get('stages/:stageId/notes')
  notes(@CurrentUser() u: JwtPayload, @Param('stageId', ParseIntPipe) stageId: number) {
    return this.portal.notes(Number(u.sub), stageId);
  }
  @Get('stages/:stageId/students/:reg/narrative')
  narrative(@CurrentUser() u: JwtPayload, @Param('stageId', ParseIntPipe) stageId: number, @Param('reg', ParseIntPipe) reg: number) {
    return this.portal.narrative(Number(u.sub), stageId, reg);
  }
  @Put('stages/:stageId/students/:reg/narrative')
  saveNarrative(@CurrentUser() u: JwtPayload, @Param('stageId', ParseIntPipe) stageId: number, @Param('reg', ParseIntPipe) reg: number, @Body() dto: NarrativeDto) {
    return this.portal.saveNarrative(Number(u.sub), stageId, reg, dto.text);
  }
  @Post('stages/:stageId/students/:reg/narrative/approve')
  approveNarrative(@CurrentUser() u: JwtPayload, @Param('stageId', ParseIntPipe) stageId: number, @Param('reg', ParseIntPipe) reg: number) {
    return this.portal.approveNarrative(Number(u.sub), stageId, reg);
  }
}
