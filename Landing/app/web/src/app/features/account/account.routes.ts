import { Routes } from '@angular/router';
import { AccountShell } from './account-shell';
import { roleGuard } from '@core/guards/role.guard';
import { AccountDashboardPage } from './dashboard/account-dashboard.page';
import { QualifierPage } from './qualifier/qualifier.page';
import { AccountResultsPage } from './results/account-results.page';
import { AccountProfilePage } from './profile/account-profile.page';

export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    component: AccountShell,
    canActivate: [roleGuard('student')],
    children: [
      { path: '', pathMatch: 'full', component: AccountDashboardPage },
      { path: 'qualifier', component: QualifierPage },
      { path: 'results', component: AccountResultsPage },
      { path: 'profile', component: AccountProfilePage },
    ],
  },
];
