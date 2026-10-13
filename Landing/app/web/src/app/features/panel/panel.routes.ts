import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards/role.guard';
import { PanelShell } from './panel-shell';
import { PanelLoginPage } from './panel-login.page';

export const PANEL_ROUTES: Routes = [
  { path: 'login', component: PanelLoginPage },
  { path: 'set-password/:token', component: PanelLoginPage },
  {
    path: '',
    component: PanelShell,
    canActivate: [roleGuard('panel')],
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./panel-dashboard.page').then((m) => m.PanelDashboardPage) },
      { path: 'stages/:stageId', loadComponent: () => import('./panel-students.page').then((m) => m.PanelStudentsPage) },
      { path: 'stages/:stageId/notes', loadComponent: () => import('./panel-notes.page').then((m) => m.PanelNotesPage) },
      { path: 'stages/:stageId/students/:reg', loadComponent: () => import('./panel-rating.page').then((m) => m.PanelRatingPage) },
      { path: 'stages/:stageId/students/:reg/note', loadComponent: () => import('./panel-note.page').then((m) => m.PanelNotePage) },
    ],
  },
];
