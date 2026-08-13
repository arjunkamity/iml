import { Routes } from '@angular/router';
import { AdminShell } from './admin-shell';
import { roleGuard } from '@core/guards/role.guard';
import { AdminDashboardPage } from './admin-dashboard.page';
import { AdminCompetitionsPage } from './admin-competitions.page';
import { AdminLeaderboardPage } from './admin-leaderboard.page';
import { AdminResultsPage } from './admin-results.page';
import { AdminCrudPage } from './admin-crud.page';

function mod(title: string, mod: string) {
  return { data: { title, mod } };
}

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminShell,
    canActivate: [roleGuard('admin')],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard', ...mod('', '') },
      { path: 'dashboard', component: AdminDashboardPage, ...mod('Dashboard', 'dash') },
      { path: 'competitions', component: AdminCompetitionsPage, ...mod('Competitions', 'comp') },
      { path: 'prizes', component: AdminCrudPage, ...mod('Prizes & Awards', 'prize') },
      { path: 'leaderboard', component: AdminLeaderboardPage, ...mod('Leaderboard', 'lb') },
      { path: 'results', component: AdminResultsPage, ...mod('Results', 'res') },
      { path: 'registrations', component: AdminCrudPage, ...mod('Registrations', 'reg') },
      { path: 'payments', component: AdminCrudPage, ...mod('Payment History', 'pay') },
      { path: 'schools', component: AdminCrudPage, ...mod('Schools', 'sch') },
      { path: 'grades', component: AdminCrudPage, ...mod('Classes & Grades', 'gr') },
      { path: 'questions', component: AdminCrudPage, ...mod('Question Bank', 'q') },
      { path: 'exams', component: AdminCrudPage, ...mod('Exam Dates', 'ex') },
      { path: 'grievances', component: AdminCrudPage, ...mod('Grievances', 'gri') },
      { path: 'notifications', component: AdminCrudPage, ...mod('Notifications', 'nt') },
      { path: 'announcements', component: AdminCrudPage, ...mod('Announcements', 'ann') },
      { path: 'news', component: AdminCrudPage, ...mod('News', 'news') },
      { path: 'gallery', component: AdminCrudPage, ...mod('Gallery', 'gal') },
      { path: 'sponsors', component: AdminCrudPage, ...mod('Sponsors', 'spon') },
      { path: 'plans', component: AdminCrudPage, ...mod('Sponsorship Plans', 'plan') },
      { path: 'admins', component: AdminCrudPage, ...mod('Admin Users', 'ad') },
    ],
  },
];
