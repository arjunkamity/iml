import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

/**
 * The first admin section the given account actually has access to, in
 * sidebar order — the safe redirect target after login instead of always
 * assuming /admin/dashboard, which most admins DO have but isn't
 * guaranteed (an account without the 'dash' module would otherwise land
 * straight on /admin/forbidden immediately after signing in, having done
 * nothing wrong). Falls back to /admin/forbidden only for the genuine
 * edge case of an account with zero modules granted at all.
 */
export function firstAccessibleAdminPath(auth: AuthService): string {
  for (const g of NAV) {
    for (const item of g.items) {
      if (auth.hasModule(item.mod)) return `/admin/${item.link}`;
    }
  }
  return '/admin/forbidden';
}

// Exported so AdminUsersPage's Module Access field can build its checkbox
// list straight from this same structure instead of a separately
// maintained set of codes — this IS the definitive list of what a module
// code actually grants, so there's no way for the two to drift apart.
export const NAV = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', link: 'dashboard', mod: 'dash' },
    ],
  },
  {
    section: 'Competitions',
    items: [
      { label: 'Competitions', link: 'competitions', mod: 'comp' },
      { label: 'Prizes & Awards', link: 'prizes', mod: 'prize' },
      { label: 'Scorecard Setup', link: 'scorecard', mod: 'sc' },
      { label: 'Panels', link: 'panel', mod: 'pn' },
      { label: 'Report Release', link: 'scorecard/reports', mod: 'rl' },
      { label: 'Wording Approvals', link: 'scorecard/content', mod: 'scap' },
      { label: 'Leaderboard', link: 'leaderboard', mod: 'lb' },
      { label: 'Results', link: 'results', mod: 'res' },
    ],
  },
  {
    section: 'Participants',
    items: [
      { label: 'Registrations', link: 'registrations', mod: 'reg' },
      { label: 'Payment History', link: 'payments', mod: 'pay' },
      { label: 'Schools', link: 'schools', mod: 'sch' },
      { label: 'Mass Email', link: 'broadcasts', mod: 'bcast' },
      { label: 'Classes & Grades', link: 'grades', mod: 'gr' },
    ],
  },
  {
    section: 'Content',
    items: [
      { label: 'Question Bank', link: 'questions', mod: 'q' },
      { label: 'Question Groups', link: 'question-groups', mod: 'q' },
      { label: 'Question Categories', link: 'question-categories', mod: 'qc' },
      { label: 'Assessments', link: 'assessments', mod: 'asm' },
      { label: 'Exam Dates', link: 'exams', mod: 'ex' },
      { label: 'Exam Batches', link: 'exam-batches', mod: 'exb' },
      { label: 'Grievances', link: 'grievances', mod: 'gri' },
      { label: 'Notifications', link: 'notifications', mod: 'nt' },
    ],
  },
  {
    section: 'Management',
    items: [
      { label: 'FAQs', link: 'faqs', mod: 'faq' },
      { label: 'Announcements', link: 'announcements', mod: 'ann' },
      { label: 'News', link: 'news', mod: 'news' },
      { label: 'Gallery', link: 'gallery', mod: 'gal' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { label: 'Sponsors', link: 'sponsors', mod: 'spon' },
      { label: 'Sponsorship Plans', link: 'plans', mod: 'plan' },
      { label: 'Admin Users', link: 'admins', mod: 'ad' },
      { label: 'Site Settings', link: 'settings', mod: 'set' },
      { label: 'Message Templates', link: 'messaging', mod: 'msg' },
      { label: 'Certificate Queue', link: 'certificate-queue', mod: 'certq' },
    ],
  },
];

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (mobileNavOpen()) {
      <div class="sb-backdrop" (click)="closeMobileNav()"></div>
    }
    <aside class="sb" [class.open]="mobileNavOpen()">
      <a class="sb-brand" routerLink="/admin" (click)="closeMobileNav()">India Mind League <span class="sb-tag">Admin</span></a>
      <nav class="sb-nav">
        @for (group of groups(); track group.section) {
          <div class="sb-sec">{{ group.section }}</div>
          @for (item of group.items; track item.link) {
            <a [routerLink]="['/admin', item.link]" routerLinkActive="active" (click)="closeMobileNav()">{{ item.label }}</a>
          }
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
          <span class="tb-role">{{ roleLabel() }}</span>
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
      .sb-sec {
        margin: 1.05rem 0.75rem 0.3rem;
        font-size: 0.68rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--faint);
        font-weight: 700;
      }
      .sb-sec:first-child { margin-top: 0.15rem; }
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
      .menu-btn {
        display: none;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        border: 1px solid var(--line-2);
        background: rgba(255, 255, 255, 0.05);
        cursor: pointer;
        flex-shrink: 0;
      }
      .menu-btn span { display: block; width: 16px; height: 2px; margin: 0 auto; background: var(--text); border-radius: 2px; }
      .sb-backdrop { display: none; }
      .tb-role {
        font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--gold-2); background: rgba(232, 182, 74, 0.12); border: 1px solid rgba(232, 182, 74, 0.35);
        padding: 0.2rem 0.55rem; border-radius: 999px;
      }
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
      @media (max-width: 900px) {
        :host { grid-template-columns: 1fr; }
        .menu-btn { display: flex; }
        .sb {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 60;
          width: min(78vw, 280px);
          transform: translateX(-100%);
          transition: transform 0.22s ease;
          box-shadow: 8px 0 24px rgba(0, 0, 0, 0.4);
        }
        .sb.open { transform: translateX(0); }
        .sb-backdrop {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 50;
          background: rgba(4, 9, 20, 0.6);
          backdrop-filter: blur(2px);
        }
        .topbar { padding: 0.7rem 1rem; gap: 0.6rem; }
        .tb-title { font-size: 1rem; }
        .tb-name { display: none; }
        .tb-right { gap: 0.55rem; }
        .content { padding: 1rem; }
      }
      @media (max-width: 420px) {
        .tb-role { display: none; }
      }
    `,
  ],
})
export class AdminShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  // A real computed(), not a plain field initializer — this must stay in
  // sync with the signed-in admin's modules for the lifetime of the app,
  // not just whatever hasModule() happened to return the one time
  // AdminShell was first constructed (it's mounted once and reused across
  // every /admin/* child navigation, never destroyed in between).
  protected readonly groups = computed(() =>
    NAV.map((g) => ({
      section: g.section,
      items: g.items.filter((i) => this.auth.hasModule(i.mod)),
    })).filter((g) => g.items.length > 0),
  );

  protected name() {
    return this.auth.user()?.name ?? 'Admin';
  }

  protected initial() {
    return this.name().charAt(0).toUpperCase();
  }

  protected roleLabel() {
    const role = this.auth.user()?.role;
    return role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'EDITOR' ? 'Editor' : role === 'VIEWER' ? 'Viewer' : 'Admin';
  }

  protected currentLabel() {
    // The section is the segment after /admin/ — not the last one, which is an id on detail pages.
    const seg = this.router.url.split('?')[0].split('/')[2] ?? 'dashboard';
    if (seg === 'forbidden') return 'Access Denied';
    for (const g of NAV) {
      const found = g.items.find((i) => i.link === seg);
      if (found) return found.label;
    }
    return 'Dashboard';
  }

  protected logout() {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }

  protected hasAccess(mod: string) {
    return this.auth.hasModule(mod);
  }

  // Off-canvas below 900px (see the .sb media-query rules) — a plain field
  // toggle is enough since the drawer only ever reflects user taps, never
  // route state.
  protected readonly mobileNavOpen = signal(false);

  protected closeMobileNav() {
    this.mobileNavOpen.set(false);
  }
}
