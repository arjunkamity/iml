import { Component, HostListener, computed, inject } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { SiteSettingsService } from '@core/services/site-settings.service';
import { ACCOUNT_UI_CSS } from './account-ui';

@Component({
  selector: 'app-account-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="acc-top">
      <a routerLink="/account" class="brand" aria-label="Dashboard">
        <img class="logo" [src]="settings().logoDarkUrl" alt="India Mind League" />
      </a>

      <nav class="acc-nav" aria-label="Account">
        <a routerLink="/account" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
        <a routerLink="/account/profile" routerLinkActive="active">My Profile</a>
        <a routerLink="/account/schedules" routerLinkActive="active">Schedules</a>
        <a routerLink="/account/results" routerLinkActive="active">Results</a>
        <a routerLink="/account/assessments" routerLinkActive="active">Assessments</a>
        <a routerLink="/account/reports" routerLinkActive="active">My Reports</a>
        <a routerLink="/account/payments" routerLinkActive="active">Payment History</a>
        <a routerLink="/account/help-desk" routerLinkActive="active">Help Desk</a>
      </nav>

      <div class="acc-actions">
        <div class="user-menu" [class.open]="menuOpen" (click)="$event.stopPropagation()">
          <button type="button" class="user-btn" (click)="menuOpen = !menuOpen" aria-haspopup="true" [attr.aria-expanded]="menuOpen">
            <span class="user-av">{{ initials() }}</span>
            <span class="user-name">{{ name() }}</span>
            <span class="user-caret">&#9662;</span>
          </button>
          <div class="user-drop" role="menu" (click)="menuOpen = false">
            <div class="ud-head">
              <span class="ud-av">{{ initials() }}</span>
              <div>
                <b>{{ name() }}</b>
                <small>{{ email() }}</small>
              </div>
            </div>
            <a role="menuitem" routerLink="/account/profile">&#128100; My Profile</a>
            <button role="menuitem" class="ud-logout" (click)="logout()">&#8617; Log out</button>
          </div>
        </div>
      </div>
    </header>

    <main class="acc-main">
      <router-outlet />
    </main>

    <footer class="acc-foot">
      <span class="df-org"><b>India Mind League</b> &middot; Student Portal</span>
      <span>&copy; {{ year }} Amity &middot; All rights reserved</span>
    </footer>
  `,
  styles: [ACCOUNT_UI_CSS],
})
export class AccountShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly settings = inject(SiteSettingsService).settings;
  protected readonly year = new Date().getFullYear();
  protected menuOpen = false;

  protected readonly name = computed(() => this.auth.user()?.name ?? 'Student');
  protected readonly email = computed(() => this.auth.user()?.email ?? 'student@iml.in');

  protected readonly initials = computed(() => {
    const name = this.name();
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? 'S';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1];
    return (first + (last ?? '')).toUpperCase();
  });

  @HostListener('document:click')
  closeMenu(): void {
    this.menuOpen = false;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
