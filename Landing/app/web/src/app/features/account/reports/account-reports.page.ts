import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { ConsentCard, MyReport, ReportsDataService } from './reports-data.service';

@Component({
  selector: 'app-account-reports',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="acc-head">
      <div>
        <div class="acc-eyebrow">Future Readiness</div>
        <h1 class="acc-title">My Reports</h1>
        <p class="acc-sub">Your Future Readiness reports appear here once India Mind League has released them. They show where you are now and how to grow — they are not a label.</p>
      </div>
    </div>

    @if (loading()) {
      <div class="loading">Loading your reports…</div>
    } @else {
      @if (error()) {
        <div class="empty"><div class="big">&#9888;&#65039;</div><p>{{ error() }}</p></div>
      }
      @if (reports().length) {
        <div class="rp-grid">
          @for (r of reports(); track r.id) {
            <div class="card rp-card">
              <div class="card-head">
                <h3>Stage {{ r.stage.position }}: {{ r.stage.name }}</h3>
                <span class="tag tag-green">Ready</span>
              </div>
              <p class="rp-meta">{{ r.edition }}</p>
              <p class="rp-meta">Released {{ r.releasedAt | date: 'd MMM y' }}@if (r.pages) { · {{ r.pages }} pages }</p>
              <div class="rp-actions">
                <button class="btn btn-primary" [disabled]="busyId() === r.id" (click)="download(r)">{{ busyId() === r.id ? 'Preparing…' : 'Download PDF' }}</button>
              </div>
            </div>
          }
        </div>
      } @else if (!error()) {
        <div class="empty"><div class="big">&#128196;</div><p>No report is ready for you yet. We will tell you as soon as one is.</p></div>
      }

      @for (c of consents(); track c.season.code) {
        @if (c.required) {
          <div class="card rp-consent">
            <div class="card-head"><h3>Sharing your report</h3><span class="tag tag-muted">{{ c.season.edition }}</span></div>
            @if (c.text) {
              <p class="rp-text">{{ c.text }}</p>
              <label class="rp-check">
                <input type="checkbox" [checked]="c.accepted.parent" [disabled]="busyConsent()" (change)="toggle(c, 'parent', $any($event.target).checked)" />
                <span>My parent or guardian may receive my report</span>
              </label>
              <label class="rp-check">
                <input type="checkbox" [checked]="c.accepted.school" [disabled]="busyConsent()" (change)="toggle(c, 'school', $any($event.target).checked)" />
                <span>My school may see my report</span>
              </label>
              <p class="rp-note">You can change your mind at any time. Taking your agreement back stops sharing straight away.</p>
            } @else {
              <p class="rp-text">Sharing with your parent or school is not set up yet, so your report is visible only to you.</p>
            }
          </div>
        }
      }
    }
  `,
  styles: [
    ACCOUNT_UI_CSS,
    `
      .rp-grid { display: grid; gap: 1.1rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); margin-bottom: 1.4rem; }
      .rp-meta { color: var(--muted); margin: 0 0 0.35rem; font-size: 0.9rem; }
      .rp-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.9rem; }
      .rp-consent { max-width: 760px; }
      .rp-text { color: var(--text); line-height: 1.55; margin: 0 0 1rem; }
      .rp-check { display: flex; gap: 0.7rem; align-items: flex-start; margin: 0.6rem 0; cursor: pointer; }
      .rp-check input { width: 1.15rem; height: 1.15rem; margin-top: 0.15rem; accent-color: var(--gold); flex: none; }
      .rp-note { color: var(--faint); font-size: 0.82rem; margin: 0.9rem 0 0; }
    `,
  ],
})
export class AccountReportsPage implements OnInit {
  private readonly data = inject(ReportsDataService);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly reports = signal<MyReport[]>([]);
  protected readonly consents = signal<ConsentCard[]>([]);
  protected readonly busyId = signal(0);
  protected readonly busyConsent = signal(false);

  ngOnInit(): void {
    this.data.list().subscribe({
      next: (r) => {
        this.reports.set(r);
        this.data.consent().subscribe({ next: (c) => this.consents.set(c), error: () => undefined });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load your reports. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected download(r: MyReport): void {
    this.busyId.set(r.id);
    this.data.download(r).subscribe({
      next: () => this.busyId.set(0),
      error: () => {
        this.busyId.set(0);
        this.error.set('Could not download the report. Please try again.');
      },
    });
  }

  protected toggle(c: ConsentCard, audience: 'parent' | 'school', accept: boolean): void {
    this.busyConsent.set(true);
    this.error.set('');
    this.data.setConsent(audience, c.season.code, accept).subscribe({
      next: (list) => {
        this.consents.set(list);
        this.busyConsent.set(false);
      },
      error: () => {
        this.busyConsent.set(false);
        this.error.set('Could not save your choice. Please try again.');
        this.data.consent().subscribe({ next: (l) => this.consents.set(l) });
      },
    });
  }
}
