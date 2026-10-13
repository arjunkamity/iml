import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { roleGuard } from '@core/guards/role.guard';
import { AdminLoginPage } from '@admin/admin-login.page';
import { SchoolLoginPage } from '@school/school-login.page';
import { SchoolRegisterPage } from '@school/school-register.page';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('@public/public.routes').then((m) => m.PUBLIC_ROUTES),
  },
  {
    path: 'admin/login',
    component: AdminLoginPage,
  },
  {
    path: 't/:token',
    loadComponent: () =>
      import('@public/magic-link/magic-link.page').then((m) => m.MagicLinkPage),
  },
  {
    path: 'panel',
    loadChildren: () => import('./features/panel/panel.routes').then((m) => m.PANEL_ROUTES),
  },
  {
    path: 'report/:token',
    loadComponent: () =>
      import('@public/report-link/report-link.page').then((m) => m.ReportLinkPage),
  },
  {
    path: 'verify/:code',
    loadComponent: () =>
      import('@public/verify/verify.page').then((m) => m.VerifyPage),
  },
  {
    path: 'account',
    loadChildren: () => import('@account/account.routes').then((m) => m.ACCOUNT_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'exam/:code',
    loadComponent: () =>
      import('@account/exam/account-exam.page').then((m) => m.AccountExamPage),
    canActivate: [authGuard, roleGuard('student')],
  },
  {
    // Public, no auth — "always available for all to see how the test
    // works" — same full-page immersive layout as the real exam page.
    path: 'demo-exam',
    loadComponent: () =>
      import('@public/demo-exam/demo-exam.page').then((m) => m.DemoExamPage),
  },
  {
    path: 'admin',
    loadChildren: () => import('@admin/admin.routes').then((m) => m.ADMIN_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'schools/login',
    component: SchoolLoginPage,
  },
  {
    path: 'schools/link/:token',
    loadComponent: () => import('@school/school-link.page').then((m) => m.SchoolLinkPage),
  },
  {
    path: 'schools/register',
    component: SchoolRegisterPage,
  },
  {
    path: 'schools',
    loadChildren: () => import('@school/school.routes').then((m) => m.SCHOOL_ROUTES),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
