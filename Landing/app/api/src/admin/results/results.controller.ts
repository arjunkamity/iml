import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ListQueryDto } from '../../common/list-query.dto';
import { ResultService } from './results.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ResultController {
  constructor(private readonly service: ResultService) {}

  @Get('results')
  list(@Query() q: ListQueryDto) {
    return this.service.listResults(q);
  }

  @Get('results/:code')
  get(@Param('code') code: string) {
    return this.service.getResult(code);
  }

  @Post('results/:code/certificate/generate')
  generateCertificate(@Param('code') code: string) {
    return this.service.generateCertificate(code);
  }

  @Get('leaderboard')
  leaderboard(@Query() q: { comp?: string }) {
    return this.service.leaderboard(q.comp);
  }
}
