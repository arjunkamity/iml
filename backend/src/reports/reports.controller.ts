import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import type { JwtPayload } from '../auth/auth.types';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Roles('ADMIN')
  @Get('overview')
  overview() {
    return this.reports.overview();
  }

  @Roles('ADMIN')
  @Get('schools')
  schools() {
    return this.reports.schoolParticipation();
  }

  @Roles('ADMIN', 'COORDINATOR')
  @Get('quizzes/:id/results')
  results(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reports.quizResults(user, id);
  }

  @Roles('ADMIN')
  @Get('quizzes/:id/shortlist')
  shortlist(
    @Param('id', ParseIntPipe) id: number,
    @Query('top', new DefaultValuePipe(50), ParseIntPipe) top: number,
  ) {
    return this.reports.shortlist(id, top);
  }
}

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly reports: ReportsService) {}

  /** Public live leaderboard for the landing page. */
  @Public()
  @Get(':quizId')
  board(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Query('top', new DefaultValuePipe(10), ParseIntPipe) top: number,
  ) {
    return this.reports.leaderboard(quizId, top);
  }
}
