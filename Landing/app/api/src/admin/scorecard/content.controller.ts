import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ScorecardContentService } from './content.service';
import { ApproveDto, BulkApproveDto, CreateLibraryDto, ImportTextsDto, PatchLibraryDto, PreviewTemplateDto, PreviewTextDto, SaveTextDto } from './content.dto';

// The scorecard content library (#72): the wording reports use. Module Access "sc".
@Controller('scorecard/content')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Roles('admin')
@RequireModule('sc,scap')
export class ScorecardContentController {
  constructor(private readonly service: ScorecardContentService) {}

  @Get('meta')
  meta() {
    return this.service.meta();
  }
  @RequireModule('sc')
  @Post('preview-template')
  previewTemplate(@Body() dto: PreviewTemplateDto) {
    return this.service.previewTemplate(dto);
  }

  // ---- libraries
  @Get('libraries')
  libraries() {
    return this.service.listLibraries();
  }
  @RequireModule('sc')
  @Post('libraries')
  createLibrary(@Body() dto: CreateLibraryDto, @CurrentUser() u: JwtPayload) {
    return this.service.createLibrary(dto, u.sub);
  }
  @Get('libraries/:code')
  library(@Param('code') code: string) {
    return this.service.getLibrary(code);
  }
  @RequireModule('sc')
  @Patch('libraries/:code')
  updateLibrary(@Param('code') code: string, @Body() dto: PatchLibraryDto, @CurrentUser() u: JwtPayload) {
    return this.service.updateLibrary(code, dto, u.sub);
  }
  @RequireModule('sc')
  @Delete('libraries/:code')
  deleteLibrary(@Param('code') code: string, @CurrentUser() u: JwtPayload) {
    return this.service.deleteLibrary(code, u.sub);
  }

  // ---- texts (routes with fixed words come before the :id ones)
  @Get('libraries/:code/texts')
  texts(@Param('code') code: string, @Query() q: { kind?: string; language?: string; key?: string; state?: string; search?: string }) {
    return this.service.listTexts(code, q);
  }
  @RequireModule('sc')
  @Put('libraries/:code/texts')
  saveText(@Param('code') code: string, @Body() dto: SaveTextDto, @CurrentUser() u: JwtPayload) {
    return this.service.saveText(code, dto, u.sub);
  }
  @RequireModule('scap')
  @Post('libraries/:code/texts/approve-all')
  approveAll(@Param('code') code: string, @Body() dto: BulkApproveDto, @CurrentUser() u: JwtPayload) {
    return this.service.approveAll(code, dto, u.sub);
  }
  @Get('libraries/:code/export')
  async exportCsv(@Param('code') code: string, @Query('language') language?: string) {
    const csv = await this.service.exportCsv(code, language || undefined);
    return new StreamableFile(Buffer.from('\ufeff' + csv, 'utf8'), { type: 'text/csv; charset=utf-8', disposition: `attachment; filename="${code}-wording.csv"` });
  }
  @RequireModule('sc')
  @Post('libraries/:code/import')
  importCsv(@Param('code') code: string, @Body() dto: ImportTextsDto, @CurrentUser() u: JwtPayload) {
    return this.service.importCsv(code, dto, u.sub);
  }
  @Get('libraries/:code/coverage')
  coverage(@Param('code') code: string, @Query('framework') framework: string, @Query('language') language?: string) {
    return this.service.coverage(code, framework, language || undefined);
  }
  @Post('libraries/:code/preview')
  preview(@Param('code') code: string, @Body() dto: PreviewTextDto) {
    return this.service.preview(code, dto);
  }
  @Get('libraries/:code/texts/:id')
  text(@Param('code') code: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.getText(code, id);
  }
  @RequireModule('sc')
  @Delete('libraries/:code/texts/:id')
  deleteText(@Param('code') code: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtPayload) {
    return this.service.deleteText(code, id, u.sub);
  }
  @Get('libraries/:code/texts/:id/versions')
  versions(@Param('code') code: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.versions(code, id);
  }
  @RequireModule('scap')
  @Post('libraries/:code/texts/:id/approve')
  approve(@Param('code') code: string, @Param('id', ParseIntPipe) id: number, @Body() dto: ApproveDto, @CurrentUser() u: JwtPayload) {
    return this.service.approve(code, id, dto.note, u.sub);
  }
  @RequireModule('scap')
  @Post('libraries/:code/texts/:id/revert')
  revert(@Param('code') code: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtPayload) {
    return this.service.revert(code, id, u.sub);
  }
  @RequireModule('scap')
  @Post('libraries/:code/texts/:id/withdraw')
  withdraw(@Param('code') code: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtPayload) {
    return this.service.withdraw(code, id, u.sub);
  }
}
