import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { RegistrationController } from './registrations/registrations.controller';
import { RegistrationService } from './registrations/registrations.service';
import { CompetitionController } from './competitions/competitions.controller';
import { CompetitionService } from './competitions/competitions.service';
import { ContentController } from './content/content.controller';
import { ContentService } from './content/content.service';
import { FinanceController } from './finance/finance.controller';
import { FinanceService } from './finance/finance.service';
import { ResultController } from './results/results.controller';
import { ResultService } from './results/results.service';
import { SponsorshipController } from './sponsorship/sponsorship.controller';
import { SponsorshipService } from './sponsorship/sponsorship.service';
import { AdminsController } from './admins/admins.controller';
import { AdminService } from './admins/admins.service';

@Module({
  controllers: [
    DashboardController,
    RegistrationController,
    CompetitionController,
    ContentController,
    FinanceController,
    ResultController,
    SponsorshipController,
    AdminsController,
  ],
  providers: [
    DashboardService,
    RegistrationService,
    CompetitionService,
    ContentService,
    FinanceService,
    ResultService,
    SponsorshipService,
    AdminService,
  ],
})
export class AdminModule {}
