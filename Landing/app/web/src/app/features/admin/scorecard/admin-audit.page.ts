import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ADMIN_UI_CSS } from '../admin-ui';
import { AuditPage, ScorecardAdminApi, errText } from './scorecard-admin.service';

const PAGE = 30;

/** Everything that was changed in the scorecard setup, who did it and when (#87). */
@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [FormsModule, DatePipe, JsonPipe, RouterLink],
  template: `
    <a class="back" routerLink="/admin/scorecard">← Scorecard setup</a>
    <h2>Change history</h2>
    <p class="intro">Every change to frameworks, templates, wording, seasons and report release is recorded here with who made it. Nothing on this page can be edited.</p>

    @if (error()) { <div class="err">{{ error() }}</div> }

    <div class="bar">
      <select class="filter" aria-label="Kind" [(ngModel)]="f.entity" (ngModelChange)="reload()">
        <option value="">All kinds</option>
        @for (e of data()?.entities ?? []; track e) { <option [value]="e">{{ e }}</option> }
      </select>
      <select class="filter" aria-label="Action" [(ngModel)]="f.action" (ngModelChange)="reload()">
        <option value="">All actions</option>
        @for (a of data()?.actions ?? []; track a) { <option [value]="a">{{ a }}</option> }
      </select>
      <input class="search" type="search" placeholder="Code, e.g. FW2" aria-label="Code" [(ngModel)]="f.code" (keyup.enter)="reload()" />
      <input class="search" type="search" placeholder="Who" aria-label="Who" [(ngModel)]="f.admin" (keyup.enter)="reload()" />
      <label class="d">From <input type="date" [(ngModel)]="f.from" (ngModelChange)="reload()" /></label>
      <label class="d">To <input type="date" [(ngModel)]="f.to" (ngModelChange)="reload()" /></label>
      <button class="btn" (click)="reload()">Search</button>
    </div>

    @if (data(); as d) {
      @if (!d.items.length) {
        <div class="card empty">Nothing matches.</div>
      } @else {
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>About</th><th>Details</th></tr></thead>
            <tbody>
              @for (a of d.items; track a.id) {
                <tr>
                  <td data-label="When">{{ a.createdAt | date: 'd MMM y, h:mm a' }}</td>
                  <td data-label="Who">{{ a.adminName || '—' }}</td>
                  <td data-label="What"><span class="bdg grey">{{ a.action }}</span></td>
                  <td data-label="About">{{ a.entity }}{{ a.entityCode ? ' · ' + a.entityCode : '' }}</td>
                  <td data-label="Details"><code>{{ a.summary | json }}</code></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="pager">
          <span>{{ offset() + 1 }}–{{ offset() + d.items.length }} of {{ d.total }}</span>
          <button class="btn btn-sm" [disabled]="offset() === 0" (click)="go(-1)">Newer</button>
          <button class="btn btn-sm" [disabled]="offset() + d.items.length >= d.total" (click)="go(1)">Older</button>
        </div>
      }
    } @else if (!error()) {
      <div class="empty">Loading…</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .back { display: inline-block; color: var(--muted, #9fb0d0); font-size: 0.85rem; font-weight: 600; margin-bottom: 0.9rem; }
      .back:hover { color: var(--gold-2, #f5cc5a); }
      h2 { margin: 0 0 0.4rem; }
      .intro { color: var(--muted, #9fb0d0); font-size: 0.9rem; max-width: 85ch; margin: 0 0 1.2rem; }
      .d { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--muted, #9fb0d0); }
      .d input { padding: 0.45rem 0.55rem; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); }
      code { background: rgba(255,255,255,0.07); padding: 0.1rem 0.4rem; border-radius: 6px; font-size: 0.76rem; overflow-wrap: anywhere; white-space: pre-wrap; }
      .pager { display: flex; align-items: center; gap: 0.6rem; justify-content: flex-end; margin-top: 0.8rem; color: var(--muted, #9fb0d0); font-size: 0.85rem; }
    `,
  ],
})
export class AdminAuditPage implements OnInit {
  private readonly api = inject(ScorecardAdminApi);

  protected readonly data = signal<AuditPage | null>(null);
  protected readonly error = signal('');
  protected readonly offset = signal(0);
  protected f = { entity: '', action: '', code: '', admin: '', from: '', to: '' };

  ngOnInit(): void {
    this.load();
  }

  protected reload(): void {
    this.offset.set(0);
    this.load();
  }

  protected go(dir: number): void {
    this.offset.set(Math.max(0, this.offset() + dir * PAGE));
    this.load();
  }

  private load(): void {
    this.error.set('');
    this.api
      .auditSearch({
        entity: this.f.entity,
        action: this.f.action,
        code: this.f.code.trim(),
        admin: this.f.admin.trim(),
        from: this.f.from ? new Date(this.f.from + 'T00:00:00').toISOString() : undefined,
        to: this.f.to ? new Date(this.f.to + 'T23:59:59').toISOString() : undefined,
        limit: PAGE,
        offset: this.offset(),
      })
      .subscribe({ next: (d) => this.data.set(d), error: (e) => this.error.set(errText(e)) });
  }
}
