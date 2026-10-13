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
import { SponsorshipService } from './sponsorship.service';
import {
  CreatePlanDto,
  CreateSponsorDto,
  PatchPlanDto,
  PatchSponsorDto,
} from './sponsorship.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SponsorshipController {
  constructor(private readonly service: SponsorshipService) {}

  @Get('sponsors')
  sponsors(@Query() q: ListQueryDto) {
    return this.service.listSponsors(q);
  }

  @Get('sponsors/:code')
  getSponsor(@Param('code') code: string) {
    return this.service.getSponsor(code);
  }

  @Post('sponsors')
  createSponsor(@Body() dto: CreateSponsorDto) {
    return this.service.createSponsor(dto);
  }

  @Patch('sponsors/:code')
  updateSponsor(@Param('code') code: string, @Body() dto: PatchSponsorDto) {
    return this.service.updateSponsor(code, dto);
  }

  @Delete('sponsors/:code')
  deleteSponsor(@Param('code') code: string) {
    return this.service.deleteSponsor(code);
  }

  @Get('plans')
  plans(@Query() q: ListQueryDto) {
    return this.service.listPlans(q);
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.service.createPlan(dto);
  }

  @Patch('plans/:code')
  updatePlan(@Param('code') code: string, @Body() dto: PatchPlanDto) {
    return this.service.updatePlan(code, dto);
  }

  @Delete('plans/:code')
  deletePlan(@Param('code') code: string) {
    return this.service.deletePlan(code);
  }
}
