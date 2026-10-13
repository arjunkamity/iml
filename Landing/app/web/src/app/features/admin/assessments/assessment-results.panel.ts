import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ADMIN_UI_CSS } from '../admin-ui';
import {
  AdminAssessment,
  AssessmentAnalytics,
  AssessmentsAdminApi,
  ResultFilters,
  SubmissionDetail,
  SubmissionRow,
  errText,
} from './assessments-admin.service';

@Component({
  selector: 'app-assessment-results',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <div class="bar">
      <input class="search" placeholder="Student name or code" [(ngModel)]="f.search" (keyup.enter)="apply()" />
      <input class="filter" placeholder="Grade (e.g. 10)" [(ngModel)]="f.grade" (keyup.enter)="apply()" style="min-width:110px" />
      <input class="filter" placeholder="School code (e.g. S12)" [(ngModel)]="f.school" (keyup.enter)="apply()" style="min-width:140px" />
      <label class="dt">From <input type="date" [(ngModel)]="f.dateFrom" /></label>
      <label class="dt">To <input type="date" [(ngModel)]="f.dateTo" /></label>
      <button class="btn" (click)="apply()">Apply</button>
      <button class="btn btn-sm" (click)="reset()">Clear</button>
      <div class="grow"></div>
      <button class="btn btn-gold" [disabled]="exporting() || !total()" (click)="exportXlsx()">{{ exporting() ? 'Preparing…' : 'Download Excel' }}</button>
    </div>

    @if (stats(); as s) {
      <div class="grid g4" style="margin-bottom:1.1rem">
        <div class="card stat"><b>{{ s.total }}</b><small>Results in this view</small></div>
        <div class="card stat">
          <b>{{ s.completionRate }}%</b>
          <small>Of {{ s.eligibleStudents }} eligible students have completed it (all time)</small>
        </div>
        @for (c of s.perCapacity.slice(0, 2); track c.key) {
          <div class="card stat"><b>{{ c.averagePercent }}%</b><small>Average · {{ c.label }}</small></div>
        }
      </div>

      @if (s.total) {
        <div class="grid g2" style="margin-bottom:1.1rem">
          <div class="card">
            <h3>Average by capacity and band mix</h3>
            @for (c of s.perCapacity; track c.key) {
              <div class="cap-line">
                <div class="cap-top">
                  <b>{{ c.label }}</b>
                  <span>{{ c.averageScore }} / {{ c.averageMax }} average ({{ c.averagePercent }}%)</span>
                </div>
                <div class="meter"><i [style.width.%]="c.averagePercent"></i></div>
                <div class="mix" role="img" [attr.aria-label]="'Band mix for ' + c.label">
                  @for (b of c.bands; track b.label; let k = $index) {
                    @if (b.count) {
                      <span [style.flex]="b.count" [class]="'seg s' + (k % 4)" [title]="b.label + ': ' + b.count"></span>
                    }
                  }
                </div>
                <div class="legend">
                  @for (b of c.bands; track b.label; let k = $index) {
                    <span><i [class]="'dot s' + (k % 4)"></i>{{ b.label }} {{ b.count }}</span>
                  }
                </div>
              </div>
            }
          </div>

          <div class="card">
            <h3>By grade</h3>
            <div class="tbl-scroll">
              <table class="mini">
                <thead>
                  <tr>
                    <th>Grade</th><th>Done</th>
                    @for (c of s.perCapacity; track c.key) {
                      <th>{{ c.label }} %</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (g of s.byGrade; track g.grade) {
                    <tr>
                      <td>{{ g.grade }}</td><td>{{ g.count }}</td>
                      @for (c of s.perCapacity; track c.key) {
                        <td>{{ g.percent[c.key] }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (s.bySchool.length) {
              <h3 style="margin-top:1.2rem">Top schools</h3>
              <div class="tbl-scroll">
                <table class="mini">
                  <thead>
                    <tr>
                      <th>School</th><th>Done</th>
                      @for (c of s.perCapacity; track c.key) {
                        <th>{{ c.label }} %</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of s.bySchool; track r.code) {
                      <tr>
                        <td>{{ r.school }} <small class="muted">{{ r.code }}</small></td><td>{{ r.count }}</td>
                        @for (c of s.perCapacity; track c.key) {
                          <td>{{ r.percent[c.key] }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
    }

    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (!rows().length) {
      <div class="card empty">No completed results match these filters yet.</div>
    } @else {
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr><th>Student</th><th>School</th><th>Grade</th><th>Completed</th><th>Capacities</th><th></th></tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr>
                <td data-label="Student"><span class="b">{{ r.studentName }}</span><small>{{ r.studentCode }}</small></td>
                <td data-label="School">{{ r.school || '—' }}<small>{{ r.schoolCode }}</small></td>
                <td data-label="Grade">{{ r.grade || '—' }}</td>
                <td data-label="Completed">{{ r.submittedAt | date: 'd MMM y, h:mm a' }}</td>
                <td data-label="Capacities">
                  <span class="chips">
                    @for (d of a().dimensions; track d.key) {
                      @if (r.scores[d.key]; as s) {
                        <span class="chip" [title]="d.label + ': ' + s.band"><b>{{ d.label || d.key }}</b> {{ s.score }}/{{ s.max }}</span>
                      }
                    }
                  </span>
                </td>
                <td>
                  <div class="acts">
                    <button class="btn btn-sm" (click)="view(r)">View</button>
                    <button class="btn btn-sm btn-danger" (click)="allowRetake(r)" title="Delete this result so the student can take it again">Allow retake</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="pager">
        <span>{{ (page() - 1) * limit + 1 }}–{{ Math.min(page() * limit, total()) }} of {{ total() }}</span>
        <button class="btn btn-sm" [disabled]="page() <= 1" (click)="go(page() - 1)">Previous</button>
        <button class="btn btn-sm" [disabled]="page() * limit >= total()" (click)="go(page() + 1)">Next</button>
      </div>
    }

    @if (detail(); as d) {
      <div class="modal-root" (click)="detail.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>{{ d.studentName }} · {{ d.studentCode }}</h3><button class="m-x" (click)="detail.set(null)" aria-label="Close">✕</button></div>
          <div class="m-body">
            <dl class="dl">
              <dt>School</dt><dd>{{ d.school || '—' }}</dd>
              <dt>Grade</dt><dd>{{ d.grade || '—' }}</dd>
              <dt>Completed</dt><dd>{{ d.submittedAt | date: 'd MMM y, h:mm a' }}</dd>
            </dl>
            <div class="sec">Scores</div>
            <table class="mini">
              <thead><tr><th>Capacity</th><th>Score</th><th>Band</th></tr></thead>
              <tbody>
                @for (c of a().dimensions; track c.key) {
                  @if (d.scores[c.key]; as s) {
                    <tr><td>{{ c.label || c.key }}</td><td>{{ s.score }} / {{ s.max }}</td><td>{{ s.band }}</td></tr>
                  }
                }
              </tbody>
            </table>
            <div class="sec">Answers</div>
            @for (x of d.answers; track $index; let n = $index) {
              <div class="resp">
                <div class="q">{{ n + 1 }}. <span class="bdg blue">{{ x.capacity }}</span> {{ x.prompt }}</div>
                <div class="a">Chose: <b>{{ x.chosen }}</b> <span class="bdg gold">{{ x.points }} pt</span></div>
              </div>
            }
          </div>
          <div class="m-foot"><button class="btn" (click)="detail.set(null)">Close</button></div>
        </div>
      </div>
    }

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .muted { color: var(--faint, #6e7f9e); font-size: 0.78rem; }
      .grid > * { min-width: 0; }
      .dt { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--muted, #9fb0d0); }
      .dt input { padding: 0.45rem 0.6rem; border-radius: 9px; background: rgba(0,0,0,0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); color-scheme: dark; }
      .bar input.filter { background: rgba(0,0,0,0.3); }
      .cap-line { margin-bottom: 1.1rem; }
      .cap-line:last-child { margin-bottom: 0; }
      .cap-top { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.86rem; margin-bottom: 0.35rem; flex-wrap: wrap; }
      .cap-top span { color: var(--muted, #9fb0d0); }
      .meter { height: 8px; border-radius: 5px; background: rgba(255,255,255,0.08); overflow: hidden; margin-bottom: 0.45rem; }
      .meter i { display: block; height: 100%; background: var(--gold, #e8b64a); border-radius: 5px; }
      .mix { display: flex; height: 10px; border-radius: 5px; overflow: hidden; gap: 2px; margin-bottom: 0.4rem; }
      .mix .seg { min-width: 4px; }
      .s0 { background: #64748b; } .s1 { background: #60a5fa; } .s2 { background: #34d399; } .s3 { background: #f5cc5a; }
      .legend { display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; font-size: 0.75rem; color: var(--muted, #9fb0d0); }
      .legend .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.35rem; }
      .tbl-scroll { overflow-x: auto; }
      .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; justify-content: flex-end; }
      .chip { font-size: 0.74rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: rgba(255,255,255,0.07); border: 1px solid var(--line-2, rgba(255,255,255,0.16)); white-space: nowrap; }
      .chip b { color: var(--gold-2, #f5cc5a); font-weight: 700; margin-right: 0.15rem; }
      @media (min-width: 901px) { .chips { justify-content: flex-start; } }
    `,
  ],
})
export class AssessmentResultsPanel {
  private readonly api = inject(AssessmentsAdminApi);

  readonly a = input.required<AdminAssessment>();

  protected readonly Math = Math;
  protected readonly limit = 20;
  protected f: ResultFilters = {};
  private applied: ResultFilters = {};

  protected readonly rows = signal<SubmissionRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly stats = signal<AssessmentAnalytics | null>(null);
  protected readonly detail = signal<SubmissionDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly exporting = signal(false);
  protected readonly error = signal('');
  protected readonly toast = signal('');

  constructor() {
    effect(() => {
      this.a().code;
      // Only the assessment is a dependency; paging/filters call refresh() themselves.
      untracked(() => this.refresh());
    });
  }

  protected apply(): void {
    this.applied = { ...this.f };
    this.page.set(1);
    this.refresh();
  }

  protected reset(): void {
    this.f = {};
    this.apply();
  }

  protected go(p: number): void {
    this.page.set(p);
    this.loadRows();
  }

  private refresh(): void {
    this.loadRows();
    this.api.analytics(this.a().code, this.applied).subscribe({
      next: (s) => this.stats.set(s),
      error: (e) => this.error.set(errText(e)),
    });
  }

  private loadRows(): void {
    this.loading.set(true);
    this.api.submissions(this.a().code, this.applied, this.page(), this.limit).subscribe({
      next: (r) => {
        this.rows.set(r.data);
        this.total.set(r.total);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
  }

  private flash(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast() === msg && this.toast.set(''), 2800);
  }

  protected view(r: SubmissionRow): void {
    this.api.submission(this.a().code, r.id).subscribe({
      next: (d) => this.detail.set(d),
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected allowRetake(r: SubmissionRow): void {
    if (
      !confirm(
        `Delete ${r.studentName}'s result so they can take this assessment again?\n\nTheir current result is removed permanently, and they will see the assessment as not started.`,
      )
    ) {
      return;
    }
    this.api.deleteSubmission(this.a().code, r.id).subscribe({
      next: () => {
        this.flash('Result deleted — the student can take it again');
        this.refresh();
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected exportXlsx(): void {
    this.exporting.set(true);
    this.api.exportResults(this.a().code, this.applied).subscribe({
      next: () => this.exporting.set(false),
      error: (e) => {
        this.exporting.set(false);
        this.error.set(errText(e));
      },
    });
  }
}
