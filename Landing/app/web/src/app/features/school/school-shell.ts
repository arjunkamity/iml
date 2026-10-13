import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

// Deliberately flat, unlike the admin sidebar's per-module NAV (see
// AdminShell) — a school's portal is small enough that there's nothing
// to gate, just two sections.
const NAV = [
  { label: 'School Information', link: 'profile' },
  { label: 'My Students', link: 'students' },
  { label: 'Results', link: 'results' },
  { label: 'Future Readiness Reports', link: 'reports' },
  { label: 'Payment History', link: 'payments' },
];

@Component({
  selector: 'app-school-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (mobileNavOpen()) {
      <div class="sb-backdrop" (click)="closeMobileNav()"></div>
    }
    <aside class="sb" [class.open]="mobileNavOpen()">
      <a class="sb-brand" routerLink="/schools" (click)="closeMobileNav()">India Mind League <span class="sb-tag">School</span></a>
      <nav class="sb-nav">
        @for (item of nav; track item.link) {
          <a [routerLink]="['/schools', item.link]" routerLinkActive="active" (click)="closeMobileNav()">{{ item.label }}</a>
        }
      </nav>
      <a class="sb-site" routerLink="/" (click)="closeMobileNav()">↗ View website</a>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="menu-btn" type="button" (click)="mobileNavOpen.set(!mobileNavOpen())" [attr.aria-expanded]="mobileNavOpen()" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>
        <h1 class="tb-title">{{ currentLabel() }}</h1>
        <div class="tb-right">
          <div class="tb-admin">
            <span class="tb-av">{{ initial() }}</span>
            <span class="tb-name">{{ name() }}</span>
            <button class="tb-logout" (click)="logout()" title="Sign out">Sign out</button>
          </div>
        </div>
      </header>
      <main class="content"><router-outlet /></main>
    </div>
  `,
  // Same dark shell chrome as AdminShell (:host, .sb, .topbar, ...) —
  // copied rather than shared since the two are meant to be able to
  // drift independently (this is a much smaller portal with no module
  // gating), matching how the two areas were asked to be built: a copy
  // of the admin look, not a shared component.
  styles: [
    `
      :host {
        --bg: #081326; --panel: #0c1c38; --panel-2: #10254a;
        --line: rgba(255, 255, 255, 0.09); --line-2: rgba(255, 255, 255, 0.16);
        --text: #eef2fb; --muted: #9fb0d0; --faint: #6e7f9e;
        --gold: #e8b64a; --gold-2: #f5cc5a;
        display: grid;
        grid-template-columns: var(--sbw, 242px) 1fr;
        min-height: 100vh;
        color: var(--text);
        font-family: 'Archivo', system-ui, sans-serif;
        background:
          radial-gradient(50rem 34rem at 85% -10%, rgba(37, 99, 235, 0.16), transparent 60%),
          var(--bg);
      }
      .sb {
        border-right: 1px solid var(--line);
        padding: 1.1rem 0.9rem;
        display: flex;
        flex-direction: column;
        background: rgba(7, 15, 30, 0.94);
        position: sticky;
        top: 0;
        height: 100vh;
      }
      .sb-brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.3rem 0.5rem 1.1rem;
        font-weight: 800;
        font-size: 1.02rem;
      }
      .sb-tag {
        font-weight: 800;
        font-size: 0.66rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #241a02;
        background: linear-gradient(180deg, #f5cc5a, #e0a92e);
        border-radius: 6px;
        padding: 0.16rem 0.42rem;
      }
      .sb-nav {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        overflow-y: auto;
        flex: 1;
      }
      .sb-nav a {
        display: flex;
        align-items: center;
        padding: 0.62rem 0.75rem;
        border-radius: 10px;
        color: var(--muted);
        font-weight: 600;
        font-size: 0.92rem;
        transition: background 0.15s, color 0.15s;
      }
      .sb-nav a:hover { background: rgba(255, 255, 255, 0.05); color: #fff; }
      .sb-nav a.active { background: rgba(232, 182, 74, 0.14); color: var(--gold-2); }
      .sb-site {
        margin-top: auto;
        padding: 0.7rem 0.75rem;
        border-top: 1px solid var(--line);
        color: var(--faint);
        font-size: 0.85rem;
        font-weight: 600;
      }
      .sb-site:hover { color: #fff; }
      .main { min-height: 100vh; display: flex; flex-direction: column; min-width: 0; }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 30;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.9rem;
        padding: 0.8rem 1.4rem;
        background: rgba(8, 19, 38, 0.9);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--line);
      }
      .tb-title { font-weight: 800; font-size: 1.15rem; letter-spacing: -0.01em; margin: 0; }
      .tb-right { margin-left: auto; display: flex; align-items: center; gap: 1rem; }
      .tb-admin { display: flex; align-items: center; gap: 0.55rem; font-weight: 600; font-size: 0.9rem; color: var(--muted); }
      .tb-av {
        width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
        font-weight: 800; color: #241a02; background: linear-gradient(180deg, #f5cc5a, #e0a92e);
      }
      .tb-logout {
        border: 1px solid var(--line-2); background: rgba(255, 255, 255, 0.05); color: var(--muted);
        font-weight: 700; font-size: 0.8rem; padding: 0.35rem 0.7rem; border-radius: 8px; cursor: pointer;
      }
      .tb-logout:hover { background: rgba(251, 113, 133, 0.15); color: #fecdd3; }
      .content { padding: 1.4rem; max-width: 1180px; width: 100%; }
      .menu-btn {
        display: none; flex-direction: column; justify-content: center; gap: 4px;
        width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--line-2);
        background: rgba(255, 255, 255, 0.05); cursor: pointer; flex-shrink: 0;
      }
      .menu-btn span { display: block; width: 16px; height: 2px; margin: 0 auto; background: var(--text); border-radius: 2px; }
      .sb-backdrop { display: none; }
      @media (max-width: 900px) {
        :host { grid-template-columns: 1fr; }
        .menu-btn { display: flex; }
        .sb {
          position: fixed; left: 0; top: 0; z-index: 60; width: min(78vw, 280px);
          transform: translateX(-100%); transition: transform 0.22s ease;
          box-shadow: 8px 0 24px rgba(0, 0, 0, 0.4);
        }
        .sb.open { transform: translateX(0); }
        .sb-backdrop {
          display: block; position: fixed; inset: 0; z-index: 50;
          background: rgba(4, 9, 20, 0.6); backdrop-filter: blur(2px);
        }
        .topbar { padding: 0.7rem 1rem; gap: 0.6rem; }
        .tb-title { font-size: 1rem; }
        .tb-name { display: none; }
        .tb-right { gap: 0.55rem; }
        .content { padding: 1rem; }
      }
    `,
  ],
})
export class SchoolShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly nav = NAV;
  // Off-canvas below 900px — same drawer as AdminShell (the sidebar used to
  // just vanish on a phone with no way back to My Students/Results/Payments).
  protected readonly mobileNavOpen = signal(false);

  protected closeMobileNav() {
    this.mobileNavOpen.set(false);
  }

  protected name() {
    return this.auth.user()?.name ?? 'School';
  }

  protected initial() {
    return this.name().charAt(0).toUpperCase();
  }

  protected currentLabel() {
    const seg = this.router.url.split('/').pop() ?? 'profile';
    return NAV.find((i) => i.link === seg)?.label ?? 'School Information';
  }

  protected logout() {
    this.auth.logout();
    this.router.navigate(['/schools/login']);
  }
}
