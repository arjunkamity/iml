import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StudentDataService } from '../student-data.service';
import type { ResultView } from '../student-data.service';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { formatDateTime } from '../format';
import { nextActionFor, type NextAction } from '../journey';

@Component({
  selector: 'app-account-results',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="acc-head">
      <div>
        <div class="acc-eyebrow">Results</div>
        <h1 class="acc-title">My Results</h1>
        <p class="acc-sub">Every attempt you have completed. Tap any attempt for the full breakdown.</p>
      </div>
    </div>

    @if (loading()) {
      <div class="loading">Loading results…</div>
    } @else if (results().length) {
      @if (nextAction() && nextAction()!.kind !== 'done') {
        <div class="res-banner" [class.rb-pay]="nextAction()!.kind === 'pay'">
          <!-- real Unicode characters, not HTML entity strings — see the
               same fix in account-dashboard.page.ts's next-action banner. -->
          <span class="rb-ic">{{ nextAction()!.kind === 'pay' ? '💳' : '✅' }}</span>
          <div class="rb-body">
            <b>{{ nextAction()!.title }}</b>
            <small>{{ nextAction()!.text }}</small>
          </div>
          <a class="btn btn-sm" [class.btn-gold-solid]="nextAction()!.kind === 'pay'" routerLink="{{ nextAction()!.href }}">{{ nextAction()!.cta }}</a>
        </div>
      }
      <div class="stat-grid" style="margin-bottom:1.1rem">
        <div class="stat">
          <span class="stat-ic iq">&#128221;</span>
          <div><b>{{ results().length }}</b><small>Attempts</small></div>
        </div>
        <div class="stat">
          <span class="stat-ic green">&#11088;</span>
          <div><b>{{ bestPercent() }}%</b><small>Best score</small></div>
        </div>
        <div class="stat">
          <span class="stat-ic amber">&#127919;</span>
          <div><b>{{ avgPercent() }}%</b><small>Average</small></div>
        </div>
        <div class="stat">
          <span class="stat-ic val">&#9989;</span>
          <div><b>{{ cleared() }}</b><small>Stages cleared</small></div>
        </div>
      </div>

      <div class="res-list">
        @for (result of results(); track result.code) {
          <a class="res-row" [routerLink]="['/account/results', result.code]">
            <div class="rr-percent" [class.rr-low]="result.percent < 40" [class.rr-mid]="result.percent >= 40 && result.percent < 60">
              <b>{{ result.scoreDisplay }}</b>
            </div>
            <div class="rr-main">
              <h3>{{ result.stage ?? 'Qualifier' }}</h3>
              <small>{{ result.competition }}</small>
            </div>
            @if (result.scoringMode === 'FRACTION') {
              <div class="rr-score">
                <b>{{ result.score }}</b><span>/{{ result.total }}</span>
                <small>Score</small>
              </div>
            }
            <div class="rr-cats">
              @for (cat of result.categories; track cat.name) {
                <span><i [class.iq]="cat.name === 'IQ'" [class.eq]="cat.name === 'EQ'">{{ cat.name }}</i>{{ cat.correct }}/{{ cat.total }}</span>
              }
            </div>
            <div class="rr-date"><small>{{ formatDateTime(result.finishedAt) }}</small></div>
            @if (result.certificateNumber) {
              <!-- button, not a nested <a> — the whole row is itself a
                   routerLink anchor, and anchors can't nest -->
              <button type="button" class="rr-cert" title="Download Certificate" (click)="downloadCertificate($event, result)">&#127942;</button>
            }
            <span class="rr-arrow">&#8594;</span>
          </a>
        }
      </div>
    } @else {
      <div class="empty">
        <div class="big">&#128221;</div>
        <h3>No results yet</h3>
        <p>Once you take a test, your scores and stage status will show up here.</p>
      </div>
    }
  `,
  styles: [
    ACCOUNT_UI_CSS,
    `
    .res-banner { display: flex; align-items: center; gap: 0.8rem; padding: 0.9rem 1rem; margin-bottom: 1rem;
      border-radius: 14px; background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.35); }
    .res-banner.rb-pay { background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.4); }
    .rb-ic { width: 40px; height: 40px; flex: 0 0 auto; display: grid; place-items: center; font-size: 1.1rem;
      border-radius: 11px; background: rgba(52, 211, 153, 0.16); border: 1px solid rgba(52, 211, 153, 0.45); }
    .rb-pay .rb-ic { background: rgba(251, 191, 36, 0.18); border-color: rgba(251, 191, 36, 0.5); }
    .rb-body { flex: 1; min-width: 0; }
    .rb-body b { display: block; font-family: var(--display); font-weight: 700; font-size: 0.92rem; color: #fff; }
    .rb-body small { color: var(--muted); font-size: 0.8rem; line-height: 1.45; display: block; margin-top: 0.15rem; }
    .res-banner .btn { flex: 0 0 auto; white-space: nowrap; }
    @media (max-width: 640px) {
      .res-banner { flex-wrap: wrap; }
      .res-banner .btn { width: 100%; }
    }
    .res-list { display: grid; gap: 0.7rem; }
    .res-row {
      display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1rem; text-decoration: none;
      background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
      transition: border-color 0.18s, transform 0.12s;
    }
    .res-row:hover { border-color: var(--violet-2); transform: translateY(-1px); }
    .rr-percent { width: 52px; height: 52px; flex: 0 0 auto; border-radius: 12px; display: grid; place-items: center;
      background: rgba(52, 211, 153, 0.14); border: 1px solid rgba(52, 211, 153, 0.4); }
    .rr-percent b { font-family: var(--display); font-weight: 800; font-size: 0.95rem; color: #6ee7b7; }
    .rr-percent.rr-mid { background: rgba(251, 191, 36, 0.14); border-color: rgba(251, 191, 36, 0.4); }
    .rr-percent.rr-mid b { color: #fcd34d; }
    .rr-percent.rr-low { background: rgba(251, 113, 133, 0.14); border-color: rgba(251, 113, 133, 0.4); }
    .rr-percent.rr-low b { color: #fda4af; }
    .rr-main { flex: 1; min-width: 0; }
    .rr-main h3 { font-family: var(--display); font-weight: 700; font-size: 1rem; margin: 0; color: var(--text); }
    .rr-main small { color: var(--muted); font-size: 0.78rem; }
    .rr-score { text-align: center; flex: 0 0 auto; }
    .rr-score b { font-family: var(--display); font-weight: 800; font-size: 1.15rem; color: #fff; }
    .rr-score span { color: var(--muted); font-size: 0.8rem; }
    .rr-score small { display: block; color: var(--faint); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .rr-cats { display: flex; flex-direction: column; gap: 0.2rem; flex: 0 0 auto; }
    .rr-cats span { font-size: 0.74rem; color: var(--muted); display: inline-flex; align-items: center; gap: 0.35rem; }
    .rr-cats i { font-style: normal; font-weight: 700; font-size: 0.64rem; letter-spacing: 0.05em; padding: 0.1rem 0.4rem; border-radius: 6px;
      background: rgba(124, 58, 237, 0.16); border: 1px solid rgba(139, 92, 246, 0.4); color: var(--violet-2); }
    .rr-cats i.iq { background: rgba(59, 130, 246, 0.16); border-color: rgba(59, 130, 246, 0.4); color: #93c5fd; }
    .rr-cats i.eq { background: rgba(236, 72, 153, 0.16); border-color: rgba(236, 72, 153, 0.4); color: #f9a8d4; }
    .rr-date { flex: 0 0 auto; }
    .rr-date small { color: var(--faint); font-size: 0.74rem; }
    .rr-cert { flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center; font-size: 1.05rem;
      border-radius: 10px; background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.4); cursor: pointer; }
    .rr-cert:hover { background: rgba(251, 191, 36, 0.2); }
    .rr-arrow { flex: 0 0 auto; color: var(--violet-2); font-size: 1.1rem; }
    @media (max-width: 720px) {
      .res-row { flex-wrap: wrap; gap: 0.6rem 1rem; }
      .rr-cats { flex-direction: row; order: 5; width: 100%; }
    }
    `,
  ],
})
export class AccountResultsPage implements OnInit {
  private readonly data = inject(StudentDataService);
  protected readonly loading = signal(true);
  protected readonly results = signal<ResultView[]>([]);
  protected readonly nextAction = signal<NextAction | null>(null);

  protected readonly bestPercent = signal(0);
  protected readonly avgPercent = signal(0);
  protected readonly cleared = signal(0);

  ngOnInit(): void {
    this.data.me().subscribe({
      next: (profile) => {
        const reg = profile?.registrations?.[0];
        if (reg) this.nextAction.set(nextActionFor(reg));
      },
      error: () => undefined,
    });
    this.data.results().subscribe({
      next: (results) => {
        this.results.set(results);
        const percents = results.map((r) => r.percent);
        this.bestPercent.set(percents.length ? Math.max(...percents) : 0);
        this.avgPercent.set(
          percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0,
        );
        this.cleared.set(results.filter((r) => r.percent >= 60).length);
        this.loading.set(false);
      },
      error: () => {
        this.results.set([]);
        this.loading.set(false);
      },
    });
  }

  protected formatDateTime = formatDateTime;

  /** Public, unauthenticated endpoint — opened in a new tab rather than
   * given an href, since this button lives inside a row that's itself a
   * routerLink anchor (anchors can't nest). */
  protected downloadCertificate(e: Event, result: ResultView): void {
    e.preventDefault();
    e.stopPropagation();
    if (!result.certificateNumber) return;
    window.open(`/api/v1/public/certificates/${result.certificateNumber}/download`, '_blank', 'noopener');
  }
}
