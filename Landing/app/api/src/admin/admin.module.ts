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
import { GradeController } from './grades/grades.controller';
import { GradeService } from './grades/grades.service';
import { QuestionCategoryController } from './question-categories/question-categories.controller';
import { QuestionCategoryService } from './question-categories/question-categories.service';
import { FaqController } from './faqs/faqs.controller';
import { FaqService } from './faqs/faqs.service';
import { SettingsController } from './settings/settings.controller';
import { SettingsModule } from '../settings/settings.module';
import { UploadsController } from './uploads/uploads.controller';
import { StorageModule } from '../storage/storage.module';
import { AdminMessagingController } from './messaging/messaging.controller';
import { AdminMessagingService } from './messaging/messaging.service';
import { MessagingModule } from '../messaging/messaging.module';
import { AdminCertificatesController } from './certificates/certificates.controller';
import { AdminCertificatesService } from './certificates/certificates.service';
import { CertificatesModule } from '../certificates/certificates.module';
import { BroadcastsModule } from './broadcasts/broadcasts.module';
import { QuestionGroupsController } from './question-groups/question-groups.controller';
import { QuestionGroupsService } from './question-groups/question-groups.service';
import { ScorecardController } from './scorecard/scorecard.controller';
import { ScorecardService } from './scorecard/scorecard.service';
import { StageReportService } from './scorecard/stage-report.service';
import { ScorecardContentController } from './scorecard/content.controller';
import { ScorecardContentService } from './scorecard/content.service';
import { ScorecardReportController } from './scorecard/report.controller';
import { ScorecardReportService } from './scorecard/report.service';
import { GovernanceService } from './scorecard/governance.service';
import { ScorecardReportQueueService } from './scorecard/report-queue.service';
import { TemplateService } from './scorecard/template.service';
import { ReportReleaseService } from './scorecard/report-release.service';
import { FinalProfileService } from './scorecard/final-profile.service';
import { PanelModule } from '../panel/panel.module';
import { AssessmentsAdminController } from './assessments/assessments-admin.controller';
import { AssessmentsAdminService } from './assessments/assessments-admin.service';

@Module({
  imports: [SettingsModule, StorageModule, MessagingModule, CertificatesModule, BroadcastsModule, PanelModule],
  controllers: [
    DashboardController,
    RegistrationController,
    CompetitionController,
    ContentController,
    FinanceController,
    ResultController,
    SponsorshipController,
    AdminsController,
    GradeController,
    QuestionCategoryController,
    FaqController,
    SettingsController,
    UploadsController,
    AdminMessagingController,
    AdminCertificatesController,
    AssessmentsAdminController,
    QuestionGroupsController,
    ScorecardController,
    ScorecardContentController,
    ScorecardReportController,
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
    GradeService,
    QuestionCategoryService,
    FaqService,
    AdminMessagingService,
    AdminCertificatesService,
    AssessmentsAdminService,
    QuestionGroupsService,
    ScorecardService,
    StageReportService,
    ScorecardContentService,
    ScorecardReportService,
    GovernanceService,
    ScorecardReportQueueService,
    TemplateService,
    ReportReleaseService,
    FinalProfileService,
  ],
})
export class AdminModule {}
