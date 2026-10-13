import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { SiteSettingsService } from '@core/services/site-settings.service';
import { ApiService } from '@core/services/api.service';

@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="bg-aurora"></div>
    <div class="bg-grid"></div>

    <header class="nav">
      <div class="container">
        <a routerLink="/" class="brand"><img class="nav-logo nav-logo-brand" [src]="settings().logoDarkUrl" alt="India Mind League" /></a>
        <button class="nav-toggle" [class.open]="open()" (click)="toggle()" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
        <nav class="nav-links" [class.open]="open()">
          <a routerLink="/" [fragment]="'about'" (click)="goToSection('about', $event)">The League</a>
          <a routerLink="/" [fragment]="'how'" (click)="goToSection('how', $event)">Stages</a>
          <a routerLink="/rewards" routerLinkActive="active" (click)="close()">Rewards</a>
          <a routerLink="/faq" routerLinkActive="active" (click)="close()">FAQ</a>
          <a href="javascript:void(0)" (click)="openContact($event)">Contact</a>
          @if (auth.isAuthenticated) {
            <div class="user-menu nav-user" [class.open]="menuOpen()" (click)="$event.stopPropagation()">
              <button type="button" class="user-btn" (click)="menuOpen.set(!menuOpen())" aria-haspopup="true" [attr.aria-expanded]="menuOpen()">
                <span class="user-av">{{ initials() }}</span>
                <span class="user-name">{{ name() }}</span>
                <span class="user-caret">&#9662;</span>
              </button>
              <div class="user-drop" role="menu" (click)="menuOpen.set(false)">
                <div class="ud-head">
                  <span class="ud-av">{{ initials() }}</span>
                  <div>
                    <b>{{ name() }}</b>
                    <small>{{ email() }}</small>
                  </div>
                </div>
                <a role="menuitem" [routerLink]="homeLink()" (click)="close()">&#128202; {{ auth.isAdmin ? 'Admin Panel' : 'My Dashboard' }}</a>
                <button role="menuitem" class="ud-logout" (click)="logout()">&#8617; Log out</button>
              </div>
            </div>
          } @else {
            <a routerLink="/login" class="btn btn-outline btn-sm" (click)="close()">Login</a>
            <a routerLink="/register" class="btn btn-gold-solid btn-sm" (click)="close()">Register Now</a>
          }
        </nav>
      </div>
    </header>

    <router-outlet />

    @if (contactOpen()) {
      <div class="contact-backdrop" (click)="closeContact()"></div>
      <aside class="contact-sidebar open" role="dialog" aria-label="Contact us">
        <div class="cs-head">
          <h3>Contact Us</h3>
          <button class="cs-x" (click)="closeContact()" aria-label="Close">✕</button>
        </div>
        <div class="cs-body">
          @if (settings().officeAddress) {
            <div class="cs-block">
              <span class="cs-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>Office Address</span>
              <p class="cs-text">{{ settings().officeAddress }}</p>
              @if (settings().googleMapsUrl) {
                <a class="cs-text cs-link" [href]="settings().googleMapsUrl" target="_blank" rel="noopener">View on Google Maps →</a>
              }
            </div>
          }
          <div class="cs-block">
            <span class="cs-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Email</span>
            <a class="cs-text cs-link" [href]="'mailto:' + settings().contactEmail">{{ settings().contactEmail }}</a>
          </div>
          @if (settings().contactPhone) {
            <div class="cs-block">
              <span class="cs-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Phone</span>
              <a class="cs-text cs-link" [href]="'tel:' + settings().contactPhone">{{ settings().contactPhone }}</a>
            </div>
          }
          <div class="cs-block">
            <span class="cs-label">Social Media</span>
            <div class="cs-social">
              <a href="https://www.youtube.com/@IndiaMindLeague" target="_blank" rel="noopener" aria-label="YouTube" class="fs yt">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C19.3 5 12 5 12 5s-7.3 0-8.8.5A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.8 1.8C4.7 19 12 19 12 19s7.3 0 8.8-.5a2.5 2.5 0 0 0 1.8-1.8C23 15.2 23 12 23 12zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>
              </a>
              <a href="https://www.instagram.com/indiamindleague/" target="_blank" rel="noopener" aria-label="Instagram" class="fs ig">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg>
              </a>
              <a href="https://www.facebook.com/profile.php?id=61592481944258" target="_blank" rel="noopener" aria-label="Facebook" class="fs fb">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></svg>
              </a>
              <a href="https://www.linkedin.com/company/indiamindleague/" target="_blank" rel="noopener" aria-label="LinkedIn" class="fs li">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </aside>
    }

    <footer class="footer" id="contact">
      <div class="container foot-grid">
        <div class="foot-brand">
          <img class="foot-logo" [src]="settings().logoDarkUrl" alt="India Mind League" />
          <p>India Mind League is a pioneering initiative to discover, nurture and empower young minds to become future leaders and changemakers.</p>
        </div>
        <div class="foot-col">
          <h4>Quick Links</h4>
          <div class="foot-links">
            <a routerLink="/">Home</a>
            <a routerLink="/" [fragment]="'visionary'" (click)="goToSection('visionary', $event)">About</a>
            <a routerLink="/" [fragment]="'about'" (click)="goToSection('about', $event)">The League</a>
            <a routerLink="/" [fragment]="'how'" (click)="goToSection('how', $event)">Stages</a>
            <a routerLink="/rewards">Rewards</a>
            <a routerLink="/faq">FAQ</a>
            <a routerLink="/system-requirements">System Requirements</a>
          </div>
        </div>
        <div class="foot-col">
          <h4>Follow Us</h4>
          <div class="foot-social">
            <!-- TODO(client): confirm exact YouTube channel URL — using a best-effort handle link for now -->
            <a href="https://www.youtube.com/@IndiaMindLeague" target="_blank" rel="noopener" aria-label="YouTube" class="fs yt">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C19.3 5 12 5 12 5s-7.3 0-8.8.5A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.8 1.8C4.7 19 12 19 12 19s7.3 0 8.8-.5a2.5 2.5 0 0 0 1.8-1.8C23 15.2 23 12 23 12zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>
            </a>
            <a href="https://www.instagram.com/indiamindleague/" target="_blank" rel="noopener" aria-label="Instagram" class="fs ig">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg>
            </a>
            <a href="https://www.facebook.com/profile.php?id=61592481944258" target="_blank" rel="noopener" aria-label="Facebook" class="fs fb">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></svg>
            </a>
            <a href="https://www.linkedin.com/company/indiamindleague/" target="_blank" rel="noopener" aria-label="LinkedIn" class="fs li">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4z"/></svg>
            </a>
          </div>
        </div>
        <div class="foot-col">
          <h4>Contact Us</h4>
          @if (settings().contactEmail) {
            <a class="foot-contact" [href]="'mailto:' + settings().contactEmail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>{{ settings().contactEmail }}
            </a>
          }
          @if (settings().contactPhone) {
            <a class="foot-contact" [href]="'tel:' + settings().contactPhone">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>{{ settings().contactPhone }}
            </a>
          }
          <span class="foot-org">An initiative by <b>Amity Group of Schools</b></span>
        </div>
      </div>
      <div class="container foot-bar">
        <span>© {{ year }} India Mind League. All Rights Reserved.</span>
        <span class="foot-legal">
          <a routerLink="/privacy-policy">Privacy Policy</a> ·
          <a routerLink="/terms">Terms &amp; Conditions</a> ·
          <a routerLink="/refund-policy">Refund Policy</a> ·
          <a routerLink="/faq">FAQ</a>
        </span>
      </div>
    </footer>

    <a class="sticky-cta" routerLink="/register">Register Now →</a>
  `,
  styles: [
    `
      .contact-backdrop {
        position: fixed; inset: 0; z-index: 90; background: rgba(0, 3, 28, 0.6); backdrop-filter: blur(2px);
      }
      .contact-sidebar {
        position: fixed; top: 0; right: 0; bottom: 0; z-index: 91; width: min(380px, 92vw);
        background: var(--bg-2, #0c0a1f); border-left: 1px solid var(--glass-border-strong, rgba(255, 255, 255, 0.18));
        box-shadow: -24px 0 48px -16px rgba(0, 0, 0, 0.6); display: flex; flex-direction: column;
        animation: csSlideIn 0.28s cubic-bezier(0.2, 0.7, 0.2, 1) both;
      }
      @keyframes csSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      .cs-head {
        display: flex; align-items: center; justify-content: space-between; padding: 1.2rem 1.4rem;
        border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.14));
      }
      .cs-head h3 { margin: 0; font-family: var(--display, inherit); font-size: 1.1rem; }
      .cs-x {
        width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.14));
        background: rgba(255, 255, 255, 0.05); color: inherit; cursor: pointer; font-size: 0.9rem;
      }
      .cs-x:hover { background: rgba(255, 255, 255, 0.1); }
      .cs-body { padding: 1.4rem; display: flex; flex-direction: column; gap: 1.5rem; overflow-y: auto; }
      .cs-block { display: flex; flex-direction: column; gap: 0.5rem; }
      .cs-label {
        display: flex; align-items: center; gap: 0.5rem; font-family: var(--display, inherit); font-weight: 700;
        font-size: 0.8rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--gold, #e8b64a);
      }
      .cs-label svg { width: 18px; height: 18px; flex: 0 0 auto; }
      .cs-text { margin: 0; color: var(--muted, #a7a6c8); line-height: 1.6; font-size: 0.95rem; }
      .cs-link { color: var(--text, #f4f3ff); text-decoration: none; }
      .cs-link:hover { color: var(--gold, #e8b64a); }
      .cs-social { display: flex; gap: 0.7rem; }
      @media (max-width: 520px) { .contact-sidebar { width: 100vw; } }

      .nav-user { display: flex; align-items: center; }
      .user-menu { position: relative; }
      .user-btn {
        display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.6rem 0.35rem 0.35rem;
        border-radius: 999px; border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.14));
        background: rgba(255, 255, 255, 0.05); cursor: pointer; color: inherit; font: inherit;
      }
      .user-btn:hover { background: rgba(255, 255, 255, 0.1); }
      .user-av {
        width: 32px; height: 32px; border-radius: 50%;
        background: var(--grad-brand, linear-gradient(120deg, #a78bfa 0%, #22d3ee 100%));
        display: grid; place-items: center; font-family: var(--display, inherit); font-weight: 700;
        font-size: 0.8rem; color: #0a0820; flex: 0 0 auto;
      }
      .user-name { font-family: var(--display, inherit); font-weight: 600; font-size: 0.9rem; max-width: 9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .user-caret { color: var(--muted, #a7a6c8); transition: transform 0.25s; font-size: 0.7rem; }
      .user-menu.open .user-caret { transform: rotate(180deg); }
      .user-drop {
        position: absolute; top: calc(100% + 0.5rem); right: 0; min-width: 15rem; z-index: 60;
        background: var(--bg-2, #0c0a1f); border: 1px solid var(--glass-border-strong, rgba(255, 255, 255, 0.18));
        border-radius: 14px; padding: 0.5rem; box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.6);
        opacity: 0; transform: translateY(-6px); pointer-events: none; transition: 0.2s;
      }
      .user-menu.open .user-drop { opacity: 1; transform: none; pointer-events: auto; }
      .ud-head { display: flex; align-items: center; gap: 0.7rem; padding: 0.6rem 0.7rem 0.8rem; border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.14)); margin-bottom: 0.4rem; }
      .ud-av {
        width: 38px; height: 38px; border-radius: 50%; flex: 0 0 auto;
        background: var(--grad-brand, linear-gradient(120deg, #a78bfa 0%, #22d3ee 100%));
        display: grid; place-items: center; font-family: var(--display, inherit); font-weight: 700; color: #0a0820;
      }
      .ud-head b { display: block; font-family: var(--display, inherit); font-weight: 700; font-size: 0.94rem; color: #fff; }
      .ud-head small { color: var(--faint, #6f6e93); font-size: 0.78rem; display: block; max-width: 12rem; overflow: hidden; text-overflow: ellipsis; }
      .user-drop a, .user-drop button {
        display: block; width: 100%; text-align: left; padding: 0.55rem 0.7rem; border-radius: 9px;
        font-size: 0.88rem; font-weight: 600; color: var(--text, #f4f3ff); background: none; border: 0; cursor: pointer; font-family: inherit;
      }
      .user-drop a:hover, .user-drop button:hover { background: rgba(139, 92, 246, 0.16); color: #fff; }
      .user-drop .ud-logout { color: #fda4af; margin-top: 0.2rem; border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.14)); }
      .user-drop .ud-logout:hover { background: rgba(251, 113, 133, 0.14); color: #fff; }
      @media (max-width: 900px) {
        .nav-user { width: 100%; }
        .user-menu { width: 100%; }
        .user-btn { width: 100%; justify-content: space-between; }
        .user-drop { position: static; opacity: 1; transform: none; pointer-events: auto; box-shadow: none; margin-top: 0.5rem; }
      }
    `,
  ],
})
export class PublicShell {
  protected readonly auth = inject(AuthService);
  protected readonly settings = inject(SiteSettingsService).settings;
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  readonly open = signal(false);
  readonly menuOpen = signal(false);
  readonly contactOpen = signal(false);
  readonly year = new Date().getFullYear();
  // Nothing scored yet -> no point linking to an empty leaderboard.
  readonly hasLeaderboard = signal(false);

  protected openContact(event: Event): void {
    event.preventDefault();
    this.close();
    this.contactOpen.set(true);
  }

  protected closeContact(): void {
    this.contactOpen.set(false);
  }

  protected readonly name = computed(() => this.auth.user()?.name ?? 'Student');
  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly homeLink = computed(() => (this.auth.isAdmin ? '/admin' : '/account'));

  protected readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? 'S';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1];
    return (first + (last ?? '')).toUpperCase();
  });

  constructor() {
    // Cross-route → home+fragment (e.g. clicking "Stages" from /faq) is a
    // real navigation, so this covers that case.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      const fragment = (e as NavigationEnd).urlAfterRedirects.split('#')[1];
      if (!fragment) return;
      setTimeout(() => this.scrollToId(fragment), 0);
    });

    this.api.get<{ hasEntries: boolean }>('/public/leaderboard/exists').subscribe({
      next: (res) => this.hasLeaderboard.set(!!res?.hasEntries),
      error: () => this.hasLeaderboard.set(false),
    });
  }

  /**
   * Same-route fragment nav (e.g. clicking "Stages" while already on "/",
   * just scrolled elsewhere) doesn't reliably fire a router NavigationEnd
   * event at all — routerLink appears to treat a fragment-only change on
   * the current URL as native same-page hash navigation rather than an
   * Angular navigation, so neither withInMemoryScrolling's anchorScrolling
   * nor a NavigationEnd subscriber ever runs. Scrolling directly here,
   * bypassing the router entirely, is the one thing that reliably works.
   */
  protected goToSection(id: string, event: Event): void {
    event.preventDefault();
    this.close();
    if (this.router.url.split(/[?#]/)[0] === '/') {
      this.scrollToId(id);
    } else {
      this.router.navigate(['/'], { fragment: id });
    }
  }

  private scrollToId(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
    const top = el.getBoundingClientRect().top + window.scrollY - navH - 12;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  @HostListener('document:click')
  closeUserMenu(): void {
    this.menuOpen.set(false);
  }

  toggle() {
    this.open.update((v) => !v);
  }

  close() {
    this.open.set(false);
  }

  logout() {
    this.menuOpen.set(false);
    this.close();
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
