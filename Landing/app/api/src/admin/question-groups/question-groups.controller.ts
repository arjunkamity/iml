import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { ListQueryDto } from '../../common/list-query.dto';
import { QuestionGroupsService } from './question-groups.service';
import { CreateQuestionGroupDto, PatchQuestionGroupDto } from './question-groups.dto';

// Question groups are managed alongside the Question Bank, so they use its
// Module Access code ("q"), enforced here on the server.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Roles('admin')
@RequireModule('q')
export class QuestionGroupsController {
  constructor(private readonly service: QuestionGroupsService) {}

  @Get('question-groups')
  list(@Query() q: ListQueryDto) {
    return this.service.list(q);
  }

  // Static path before :code.
  @Get('question-groups/candidates')
  candidates(
    @Query('comp') comp?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('group') group?: string,
  ) {
    return this.service.candidates({ comp, category, search, group });
  }

  @Get('question-groups/:code')
  get(@Param('code') code: string) {
    return this.service.get(code);
  }

  @Post('question-groups')
  create(@Body() dto: CreateQuestionGroupDto) {
    return this.service.create(dto);
  }

  @Patch('question-groups/:code')
  update(@Param('code') code: string, @Body() dto: PatchQuestionGroupDto) {
    return this.service.update(code, dto);
  }

  @Delete('question-groups/:code')
  remove(@Param('code') code: string) {
    return this.service.remove(code);
  }
}
