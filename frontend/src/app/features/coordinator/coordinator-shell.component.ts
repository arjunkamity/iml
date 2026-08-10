import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-coordinator-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="aurora">
    <header class="topnav">
      <div class="brand"><span class="b1">INDIA</span><span class="b2">MIND</span><span class="b1">LEAGUE</span> <small class="faint" style="font-weight:600;">School</small></div>
      <nav>
        <a routerLink="dashboard" routerLinkActive="active">Dashboard</a>
        <a routerLink="students" routerLinkActive="active">Students</a>
        <a routerLink="results" routerLinkActive="active">Results</a>
        <span class="muted" style="margin-left:.5rem;">{{ auth.user()?.name }}</span>
        <button class="btn btn-sm" (click)="auth.logout()">Logout</button>
      </nav>
    </header>
    <main class="container page"><router-outlet /></main>
    </div>
  `,
})
export class CoordinatorShellComponent {
  auth = inject(AuthService);
}
