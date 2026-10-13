import { Routes } from '@angular/router';
import { AccountShell } from './account-shell';
import { roleGuard } from '@core/guards/role.guard';
import { AccountDashboardPage } from './dashboard/account-dashboard.page';
import { AccountProfilePage } from './profile/account-profile.page';
import { AccountSchedulesPage } from './schedules/account-schedules.page';
import { AccountResultsPage } from './results/account-results.page';
import { AccountResultDetailPage } from './results/account-result-detail.page';
import { AccountPaymentsPage } from './payments/account-payments.page';
import { AccountHelpDeskPage } from './help-desk/account-help-desk.page';

export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    component: AccountShell,
    canActivate: [roleGuard('student')],
    children: [
      { path: '', pathMatch: 'full', component: AccountDashboardPage },
      { path: 'profile', component: AccountProfilePage },
      { path: 'schedules', component: AccountSchedulesPage },
      { path: 'results', component: AccountResultsPage },
      { path: 'results/:code', component: AccountResultDetailPage },
      { path: 'payments', component: AccountPaymentsPage },
      { path: 'help-desk', component: AccountHelpDeskPage },
      {
        path: 'reports',
        loadComponent: () => import('./reports/account-reports.page').then((m) => m.AccountReportsPage),
      },
      {
        path: 'assessments',
        loadComponent: () => import('./assessments/account-assessments.page').then((m) => m.AccountAssessmentsPage),
      },
      {
        path: 'assessments/:slug',
        loadComponent: () => import('./assessments/account-assessment.page').then((m) => m.AccountAssessmentPage),
      },
    ],
  },
];
