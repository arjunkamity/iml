import { Routes } from '@angular/router';
import { AdminShell } from './admin-shell';
import { roleGuard } from '@core/guards/role.guard';
import { moduleGuard } from '@core/guards/module.guard';
import { AdminDashboardPage } from './admin-dashboard.page';
import { AdminForbiddenPage } from './admin-forbidden.page';
import { AdminCompetitionsPage } from './admin-competitions.page';
import { AdminLeaderboardPage } from './admin-leaderboard.page';
import { AdminResultsPage } from './admin-results.page';
import { AdminSelectionWizardPage } from './admin-selection-wizard.page';
import { AdminCrudPage } from './admin-crud.page';
import { AdminSettingsPage } from './admin-settings.page';
import { AdminMessagingPage } from './admin-messaging.page';
import { AdminBroadcastsPage } from './admin-broadcasts.page';
import { AdminGrievancesPage } from './admin-grievances.page';
import { AdminCertificateQueuePage } from './admin-certificate-queue.page';
import { AdminExamBatchesPage } from './admin-exam-batches.page';
import { AdminExamBatchRosterPage } from './admin-exam-batch-roster.page';
import { AdminAssessmentsPage } from './assessments/admin-assessments.page';
import { AdminQuestionGroupsPage } from './question-groups/admin-question-groups.page';
import { AdminScorecardPage } from './scorecard/admin-scorecard.page';
import { AdminScorecardFrameworkPage } from './scorecard/admin-scorecard-framework.page';
import { AdminStageReportPage } from './scorecard/admin-stage-report.page';
import { AdminContentLibraryPage } from './scorecard/admin-content-library.page';
import { AdminReportTemplatesPage } from './scorecard/admin-report-templates.page';
import { AdminReportsPage } from './scorecard/admin-reports.page';
import { AdminAuditPage } from './scorecard/admin-audit.page';
import { AdminAssessmentDetailPage } from './assessments/admin-assessment-detail.page';
import { AdminPanelPage } from './panel/admin-panel.page';
import { AdminPanelFormPage } from './panel/admin-panel-form.page';

function mod(title: string, mod: string) {
  return { data: { title, mod } };
}

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminShell,
    canActivate: [roleGuard('admin')],
    // Runs once per child navigation and checks that child's own data.mod
    // against the signed-in admin's Module Access — see module.guard.ts.
    canActivateChild: [moduleGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard', ...mod('', '') },
      // No `mod` of its own — reachable regardless of module access, since
      // it's what a blocked module redirects TO (see module.guard.ts).
      { path: 'forbidden', component: AdminForbiddenPage, data: { title: 'Access Denied' } },
      { path: 'dashboard', component: AdminDashboardPage, ...mod('Dashboard', 'dash') },
      { path: 'competitions', component: AdminCompetitionsPage, ...mod('Competitions', 'comp') },
      { path: 'scorecard', component: AdminScorecardPage, ...mod('Scorecard Setup', 'sc') },
      // before :code, which would otherwise take 'stage-report' for a framework code
      { path: 'scorecard/stage-report', component: AdminStageReportPage, ...mod('Scorecard Setup', 'sc') },
      { path: 'scorecard/templates', component: AdminReportTemplatesPage, ...mod('Scorecard Setup', 'sc') },
      { path: 'scorecard/templates/:code', component: AdminReportTemplatesPage, ...mod('Scorecard Setup', 'sc') },
      { path: 'scorecard/audit', component: AdminAuditPage, ...mod('Scorecard Setup', 'sc') },
      { path: 'scorecard/reports', component: AdminReportsPage, ...mod('Reports', 'sc,rl') },
      { path: 'scorecard/content', component: AdminContentLibraryPage, ...mod('Content library', 'sc,scap') },
      { path: 'scorecard/content/:code', component: AdminContentLibraryPage, ...mod('Content library', 'sc,scap') },
      { path: 'scorecard/:code', component: AdminScorecardFrameworkPage, ...mod('Scorecard Setup', 'sc') },
      { path: 'prizes', component: AdminCrudPage, ...mod('Prizes & Awards', 'prize') },
      { path: 'leaderboard', component: AdminLeaderboardPage, ...mod('Leaderboard', 'lb') },
      { path: 'results', component: AdminResultsPage, ...mod('Results', 'res') },
      { path: 'selection', component: AdminSelectionWizardPage, ...mod('Next Stage Selection', 'res') },
      { path: 'registrations', component: AdminCrudPage, ...mod('Registrations', 'reg') },
      { path: 'payments', component: AdminCrudPage, ...mod('Payment History', 'pay') },
      { path: 'schools', component: AdminCrudPage, ...mod('Schools', 'sch') },
      { path: 'broadcasts', component: AdminBroadcastsPage, ...mod('Mass Email', 'bcast') },
      { path: 'grades', component: AdminCrudPage, ...mod('Classes & Grades', 'gr') },
      { path: 'questions', component: AdminCrudPage, ...mod('Question Bank', 'q') },
      { path: 'question-groups', component: AdminQuestionGroupsPage, ...mod('Question Groups', 'q') },
      { path: 'question-categories', component: AdminCrudPage, ...mod('Question Categories', 'qc') },
      { path: 'assessments', component: AdminAssessmentsPage, ...mod('Assessments', 'asm') },
      { path: 'assessments/panel/:code', component: AdminPanelFormPage, ...mod('Assessments', 'asm') },
      { path: 'assessments/:code', component: AdminAssessmentDetailPage, ...mod('Assessments', 'asm') },
      { path: 'panel', component: AdminPanelPage, ...mod('Panels', 'pn') },
      { path: 'exams', component: AdminCrudPage, ...mod('Exam Dates', 'ex') },
      { path: 'exam-batches', component: AdminExamBatchesPage, ...mod('Exam Batches', 'exb') },
      { path: 'exam-batches/:batchId', component: AdminExamBatchRosterPage, ...mod('Exam Batches', 'exb') },
      { path: 'grievances', component: AdminGrievancesPage, ...mod('Grievances', 'gri') },
      { path: 'notifications', component: AdminCrudPage, ...mod('Notifications', 'nt') },
      { path: 'faqs', component: AdminCrudPage, ...mod('FAQs', 'faq') },
      { path: 'announcements', component: AdminCrudPage, ...mod('Announcements', 'ann') },
      { path: 'news', component: AdminCrudPage, ...mod('News', 'news') },
      { path: 'gallery', component: AdminCrudPage, ...mod('Gallery', 'gal') },
      { path: 'sponsors', component: AdminCrudPage, ...mod('Sponsors', 'spon') },
      { path: 'plans', component: AdminCrudPage, ...mod('Sponsorship Plans', 'plan') },
      { path: 'admins', component: AdminCrudPage, ...mod('Admin Users', 'ad') },
      { path: 'settings', component: AdminSettingsPage, ...mod('Site Settings', 'set') },
      { path: 'messaging', component: AdminMessagingPage, ...mod('Message Templates', 'msg') },
      { path: 'certificate-queue', component: AdminCertificateQueuePage, ...mod('Certificate Queue', 'certq') },
    ],
  },
];
