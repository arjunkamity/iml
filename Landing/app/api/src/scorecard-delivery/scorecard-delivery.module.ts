import { Module } from '@nestjs/common';
import { ScorecardAccessService } from './scorecard-access.service';
import { PublicReportLinksController, SchoolReportsController, StudentReportsController } from './scorecard-delivery.controllers';

// Where students, schools and parents open released scorecard reports (#74).
@Module({
  controllers: [StudentReportsController, SchoolReportsController, PublicReportLinksController],
  providers: [ScorecardAccessService],
})
export class ScorecardDeliveryModule {}
