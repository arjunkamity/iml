import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-account-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav>
      <a routerLink="/account" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
      <a routerLink="/account/qualifier" routerLinkActive="active">Qualifier</a>
      <a routerLink="/account/results" routerLinkActive="active">Results</a>
      <a routerLink="/account/profile" routerLinkActive="active">Profile</a>
      <button (click)="logout()">Log out</button>
    </nav>
    <p>Signed in as <b>{{ name() }}</b></p>
    <router-outlet />
  `,
  styles: [
    `
      nav {
        display: flex;
        gap: 1rem;
        padding: 1rem 2rem;
        border-bottom: 1px solid var(--line, #ddd);
      }
      a.active {
        font-weight: 700;
      }
    `,
  ],
})
export class AccountShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly name = computed(() => this.auth.user()?.name ?? 'Student');

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
