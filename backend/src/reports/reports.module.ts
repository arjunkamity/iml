import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController, LeaderboardController } from './reports.controller';

@Module({
  providers: [ReportsService],
  controllers: [ReportsController, LeaderboardController],
  exports: [ReportsService],
})
export class ReportsModule {}
