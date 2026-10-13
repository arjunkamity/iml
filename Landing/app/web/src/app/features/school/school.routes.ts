import { Routes } from '@angular/router';
import { SchoolShell } from './school-shell';
import { roleGuard } from '@core/guards/role.guard';

export const SCHOOL_ROUTES: Routes = [
  {
    path: '',
    component: SchoolShell,
    canActivate: [roleGuard('school')],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      { path: 'profile', loadComponent: () => import('./school-profile.page').then((m) => m.SchoolProfilePage) },
      { path: 'students', loadComponent: () => import('./school-students.page').then((m) => m.SchoolStudentsPage) },
      { path: 'results', loadComponent: () => import('./school-results.page').then((m) => m.SchoolResultsPage) },
      {
        path: 'results/:code',
        loadComponent: () => import('./school-result-detail.page').then((m) => m.SchoolResultDetailPage),
      },
      { path: 'reports', loadComponent: () => import('./school-reports.page').then((m) => m.SchoolReportsPage) },
      { path: 'payments', loadComponent: () => import('./school-payments.page').then((m) => m.SchoolPaymentsPage) },
    ],
  },
];
