import { Routes } from '@angular/router';
import { roleGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/public/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },

  // Admin
  {
    path: 'admin',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () =>
      import('./features/admin/admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'schools',
        loadComponent: () =>
          import('./features/admin/admin-schools.component').then((m) => m.AdminSchoolsComponent),
      },
      {
        path: 'quizzes',
        loadComponent: () =>
          import('./features/admin/admin-quizzes.component').then((m) => m.AdminQuizzesComponent),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/admin/admin-reports.component').then((m) => m.AdminReportsComponent),
      },
    ],
  },

  // Coordinator
  {
    path: 'coordinator',
    canActivate: [roleGuard('COORDINATOR')],
    loadComponent: () =>
      import('./features/coordinator/coordinator-shell.component').then((m) => m.CoordinatorShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/coordinator/coordinator-dashboard.component').then((m) => m.CoordinatorDashboardComponent),
      },
      {
        path: 'students',
        loadComponent: () =>
          import('./features/coordinator/coordinator-students.component').then((m) => m.CoordinatorStudentsComponent),
      },
      {
        path: 'results',
        loadComponent: () =>
          import('./features/coordinator/coordinator-results.component').then((m) => m.CoordinatorResultsComponent),
      },
    ],
  },

  // Student
  {
    path: 'student',
    canActivate: [roleGuard('STUDENT')],
    loadComponent: () =>
      import('./features/student/student-shell.component').then((m) => m.StudentShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/student/student-dashboard.component').then((m) => m.StudentDashboardComponent),
      },
      {
        path: 'quiz/:id',
        loadComponent: () =>
          import('./features/student/quiz-take.component').then((m) => m.QuizTakeComponent),
      },
      {
        path: 'result/:attemptId',
        loadComponent: () =>
          import('./features/student/quiz-result.component').then((m) => m.QuizResultComponent),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
