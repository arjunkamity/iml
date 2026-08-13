import { Routes } from '@angular/router';
import { PublicShell } from './public-shell';
import { HomePage } from './home/home.page';
import { LoginPage } from './login/login.page';
import { RegisterPage } from './register/register.page';
import { LeaderboardPage } from './leaderboard/leaderboard.page';
import { RewardsPage } from './rewards/rewards.page';
import { PrivacyPolicyPage } from './legal/privacy-policy.page';
import { TermsPage } from './legal/terms.page';
import { RefundPolicyPage } from './legal/refund-policy.page';
import { FaqPage } from './legal/faq.page';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicShell,
    children: [
      { path: '', pathMatch: 'full', component: HomePage },
      { path: 'leaderboard', component: LeaderboardPage },
      { path: 'rewards', component: RewardsPage },
      { path: 'privacy-policy', component: PrivacyPolicyPage },
      { path: 'terms', component: TermsPage },
      { path: 'refund-policy', component: RefundPolicyPage },
      { path: 'faq', component: FaqPage },
    ],
  },
  { path: 'login', component: LoginPage },
  { path: 'register', component: RegisterPage },
];
