import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="bg-aurora"></div>
    <div class="bg-grid"></div>

    <header class="nav">
      <div class="container">
        <a routerLink="/" class="brand"><img class="nav-logo nav-logo-brand" src="img/new-logo-cut.png" alt="India Mind League" /></a>
        <button class="nav-toggle" [class.open]="open()" (click)="toggle()" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
        <nav class="nav-links" [class.open]="open()">
          <a routerLink="/" [fragment]="'pillars'" (click)="close()">The League</a>
          <a routerLink="/" [fragment]="'how'" (click)="close()">Stages</a>
          <a routerLink="/" [fragment]="'rewards'" (click)="close()">Rewards</a>
          <a routerLink="/leaderboard" routerLinkActive="active" (click)="close()">Leaderboard</a>
          <a routerLink="/" [fragment]="'contact'" (click)="close()">Contact</a>
          <a routerLink="/login" class="btn btn-outline btn-sm" (click)="close()">Login</a>
          <a routerLink="/register" class="btn btn-gold-solid btn-sm" (click)="close()">Register Now</a>
        </nav>
      </div>
    </header>

    <router-outlet />

    <footer class="footer" id="contact">
      <div class="container foot-grid">
        <div class="foot-brand">
          <img class="foot-logo" src="img/new-logo-cut.png" alt="India Mind League" />
          <p>India Mind League is a pioneering initiative to discover, nurture and empower young minds to become future leaders and changemakers.</p>
        </div>
        <div class="foot-col">
          <h4>Quick Links</h4>
          <div class="foot-links">
            <a routerLink="/">Home</a>
            <a routerLink="/" [fragment]="'visionary'">About</a>
            <a routerLink="/" [fragment]="'pillars'">The League</a>
            <a routerLink="/" [fragment]="'how'">Stages</a>
            <a routerLink="/leaderboard">Leaderboard</a>
            <a routerLink="/" [fragment]="'rewards'">Rewards</a>
          </div>
        </div>
        <div class="foot-col">
          <h4>Follow Us</h4>
          <div class="foot-social">
            <a href="https://youtube.com" target="_blank" rel="noopener" aria-label="YouTube" class="fs yt">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C19.3 5 12 5 12 5s-7.3 0-8.8.5A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.8 1.8C4.7 19 12 19 12 19s7.3 0 8.8-.5a2.5 2.5 0 0 0 1.8-1.8C23 15.2 23 12 23 12zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener" aria-label="Instagram" class="fs ig">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg>
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener" aria-label="Facebook" class="fs fb">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></svg>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener" aria-label="LinkedIn" class="fs li">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4z"/></svg>
            </a>
          </div>
        </div>
        <div class="foot-col">
          <h4>Contact Us</h4>
          <a class="foot-contact" href="mailto:iml@amity.edu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>iml@amity.edu
          </a>
          <a class="foot-contact" href="tel:+911234567890">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/></svg>+91 12345 67890
          </a>
          <span class="foot-org">An initiative by <b>Amity Group of Schools</b></span>
        </div>
      </div>
      <div class="container foot-bar">
        <span>© {{ year }} India Mind League. All Rights Reserved.</span>
        <span class="foot-legal"><a href="#">Privacy Policy</a> · <a href="#">Terms &amp; Conditions</a></span>
      </div>
    </footer>
  `,
})
export class PublicShell {
  readonly open = signal(false);
  readonly year = new Date().getFullYear();

  toggle() {
    this.open.update((v) => !v);
  }

  close() {
    this.open.set(false);
  }
}
