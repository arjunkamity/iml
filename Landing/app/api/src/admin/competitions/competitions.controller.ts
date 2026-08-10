import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ListQueryDto } from '../../common/list-query.dto';
import { CompetitionService } from './competitions.service';
import {
  CreateCompetitionDto,
  CreatePrizeDto,
  CreateStageDto,
  PatchCompetitionDto,
  PatchPrizeDto,
  PatchStageDto,
} from './competitions.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class CompetitionController {
  constructor(private readonly service: CompetitionService) {}

  @Get('competitions')
  list(@Query() q: ListQueryDto) {
    return this.service.list(q);
  }

  @Post('competitions')
  create(@Body() dto: CreateCompetitionDto) {
    return this.service.create(dto);
  }

  @Get('competitions/:code')
  get(@Param('code') code: string) {
    return this.service.get(code);
  }

  @Patch('competitions/:code')
  update(@Param('code') code: string, @Body() dto: PatchCompetitionDto) {
    return this.service.update(code, dto);
  }

  @Delete('competitions/:code')
  remove(@Param('code') code: string) {
    return this.service.remove(code);
  }

  @Get('competitions/:code/stages')
  stages(@Param('code') code: string) {
    return this.service.stages(code);
  }

  @Post('competitions/:code/stages')
  addStage(@Param('code') code: string, @Body() dto: CreateStageDto) {
    return this.service.addStage(code, dto);
  }

  @Patch('competitions/:code/stages/:stageId')
  updateStage(
    @Param('code') code: string,
    @Param('stageId', ParseIntPipe) stageId: number,
    @Body() dto: PatchStageDto,
  ) {
    return this.service.updateStage(code, stageId, dto);
  }

  @Delete('competitions/:code/stages/:stageId')
  removeStage(
    @Param('code') code: string,
    @Param('stageId', ParseIntPipe) stageId: number,
  ) {
    return this.service.removeStage(code, stageId);
  }

  @Get('competitions/:code/qualifiers')
  qualifiers(
    @Param('code') code: string,
    @Query() q: { stage?: number; status?: string },
  ) {
    return this.service.qualifiers(code, q);
  }

  @Get('prizes')
  prizes(@Query() q: { comp?: string }) {
    return this.service.listPrizes(q);
  }

  @Post('prizes')
  createPrize(@Body() dto: CreatePrizeDto) {
    return this.service.createPrize(dto);
  }

  @Patch('prizes/:code')
  updatePrize(@Param('code') code: string, @Body() dto: PatchPrizeDto) {
    return this.service.updatePrize(code, dto);
  }

  @Delete('prizes/:code')
  removePrize(@Param('code') code: string) {
    return this.service.removePrize(code);
  }
}
