import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ADMIN_UI_CSS } from './admin-ui';

/**
 * Landed on by moduleGuard (see core/guards/module.guard.ts) whenever an
 * admin navigates straight to a URL for a section their account's Module
 * Access doesn't include — typing it in, an old bookmark, a link shared
 * by a colleague with broader access, etc. Not a 404: the route is real,
 * this admin just isn't allowed on it.
 */
@Component({
  selector: 'app-admin-forbidden',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="empty">
      <div class="big">🔒</div>
      <h3>Permission Not Allowed</h3>
      <p>Your admin account doesn't have access to that section. Ask a Super Admin to grant it under Admin Users → Module access.</p>
      <a routerLink="/admin" class="btn btn-sm">← Back to Dashboard</a>
    </div>
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .empty { text-align: center; padding: 4rem 1rem; }
      .empty .big { font-size: 2.6rem; margin-bottom: 0.6rem; }
      .empty h3 { margin: 0 0 0.4rem; color: var(--text, #eef2fb); }
      .empty p { max-width: 44ch; margin: 0 auto 1.2rem; }
    `,
  ],
})
export class AdminForbiddenPage {}
