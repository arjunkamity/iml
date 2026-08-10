import { Routes } from '@angular/router';
import { PublicShell } from './public-shell';
import { HomePage } from './home/home.page';
import { LoginPage } from './login/login.page';
import { RegisterPage } from './register/register.page';
import { LeaderboardPage } from './leaderboard/leaderboard.page';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicShell,
    children: [
      { path: '', pathMatch: 'full', component: HomePage },
      { path: 'leaderboard', component: LeaderboardPage },
    ],
  },
  { path: 'login', component: LoginPage },
  { path: 'register', component: RegisterPage },
];
