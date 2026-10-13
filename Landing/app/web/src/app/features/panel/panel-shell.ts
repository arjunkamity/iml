import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-panel-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="top">
      <a routerLink="/panel" class="brand">India Mind League · Evaluation Panel</a>
      <div class="who">
        <span>{{ auth.user()?.name }}</span>
        <button class="out" (click)="signOut()">Sign out</button>
      </div>
    </header>
    <router-outlet />
  `,
  styles: [
    `
      :host { display: block; min-height: 100vh; background: var(--bg, #071021); color: var(--text, #fff); }
      .top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.8rem 1rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.1)); position: sticky; top: 0; background: rgba(7,16,33,0.92); backdrop-filter: blur(10px); z-index: 20; }
      .brand { font-weight: 800; letter-spacing: 0.02em; color: var(--gold, #f5cc5a); }
      .who { display: flex; align-items: center; gap: 0.8rem; font-size: 0.88rem; }
      .out { min-height: 40px; padding: 0.3rem 0.9rem; border-radius: 10px; border: 1px solid var(--line-2, rgba(255,255,255,0.2)); background: none; color: inherit; font-weight: 700; cursor: pointer; }
      @media (max-width: 560px) { .who span { display: none; } .brand { font-size: 0.85rem; } }
    `,
  ],
})
export class PanelShell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected signOut(): void {
    this.auth.logout();
    this.router.navigate(['/panel/login']);
  }
}
