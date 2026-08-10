import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { AdminLoginPage } from '@admin/admin-login.page';

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
    path: 'account',
    loadChildren: () => import('@account/account.routes').then((m) => m.ACCOUNT_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadChildren: () => import('@admin/admin.routes').then((m) => m.ADMIN_ROUTES),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
