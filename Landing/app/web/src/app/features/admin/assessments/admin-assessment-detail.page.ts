import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ADMIN_UI_CSS } from '../admin-ui';
import { AdminAssessment, AssessmentsAdminApi, errText } from './assessments-admin.service';
import { AssessmentSettingsPanel } from './assessment-settings.panel';
import { AssessmentQuestionsPanel } from './assessment-questions.panel';
import { AssessmentResultsPanel } from './assessment-results.panel';

type Tab = 'overview' | 'questions' | 'results';

@Component({
  selector: 'app-admin-assessment-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, AssessmentSettingsPanel, AssessmentQuestionsPanel, AssessmentResultsPanel],
  template: `
    <a class="back" routerLink="/admin/assessments">← All assessments</a>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    @if (a(); as x) {
      <div class="head">
        <div class="titles">
          <div class="line">
            <span class="bdg" [class.green]="x.status === 'Published'" [class.gold]="x.status === 'Draft'" [class.grey]="x.status === 'Archived'">{{ x.status }}</span>
            <span class="code">{{ x.code }}</span>
            <span class="code">{{ x.category || 'Uncategorised' }}</span>
          </div>
          <h2>{{ x.title }}</h2>
          <small class="code">
            {{ x.questionCount }} questions · {{ x.completions }} completed · grades {{ x.grades || 'all' }}
            @if (x.publishedAt) {
              · published {{ x.publishedAt | date: 'd MMM y' }}
            }
          </small>
        </div>
        <div class="actions">
          @if (x.status === 'Draft') {
            <button class="btn btn-gold" [disabled]="busy() || x.issues.length > 0" [title]="x.issues.length ? 'Fix the items below first' : ''" (click)="publish()">Publish</button>
          }
          @if (x.status === 'Published') {
            <a class="btn" [href]="x.studentPath" target="_blank" rel="noopener">Open student page ↗</a>
          }
          @if (x.status === 'Archived') {
            <button class="btn btn-gold" [disabled]="busy()" (click)="unarchive()">Restore to draft</button>
          } @else {
            <button class="btn" [disabled]="busy()" (click)="archive()">Archive</button>
          }
          <button class="btn" [disabled]="busy()" (click)="newVersion()">Make a new version</button>
          <button class="btn btn-danger" [disabled]="busy()" (click)="remove()">Delete</button>
        </div>
      </div>

      @if (x.status === 'Draft') {
        @if (x.issues.length) {
          <div class="card ready bad">
            <b>Not ready to publish yet</b>
            <ul>
              @for (i of x.issues; track $index) {
                <li>{{ i }}</li>
              }
            </ul>
          </div>
        } @else {
          <div class="card ready good"><b>Ready to publish.</b> Students in grades {{ x.grades || 'all' }} will see it on their dashboard as soon as you publish.</div>
        }
      } @else if (x.status === 'Published') {
        <div class="card ready good">
          <b>Live.</b> Students in grades {{ x.grades || 'all' }} can take it once each.
          @if (x.locked) {
            Questions and scoring are locked because results exist.
          }
        </div>
      } @else {
        <div class="card ready off">Archived — hidden from students. Results are kept and still visible here.</div>
      }

      <div class="tabs" role="tablist">
        <button class="tab" role="tab" [class.on]="tab() === 'overview'" [attr.aria-selected]="tab() === 'overview'" (click)="tab.set('overview')">Settings</button>
        <button class="tab" role="tab" [class.on]="tab() === 'questions'" [attr.aria-selected]="tab() === 'questions'" (click)="tab.set('questions')">Questions ({{ x.questionCount }})</button>
        <button class="tab" role="tab" [class.on]="tab() === 'results'" [attr.aria-selected]="tab() === 'results'" (click)="tab.set('results')">Results ({{ x.completions }})</button>
      </div>

      @switch (tab()) {
        @case ('overview') {
          <app-assessment-settings [a]="x" (changed)="a.set($event)" />
        }
        @case ('questions') {
          <app-assessment-questions [a]="x" (changed)="reload()" />
        }
        @case ('results') {
          <app-assessment-results [a]="x" />
        }
      }
    } @else if (!error()) {
      <div class="empty">Loading…</div>
    }

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .back { display: inline-block; color: var(--muted, #9fb0d0); font-size: 0.85rem; font-weight: 600; margin-bottom: 0.9rem; }
      .back:hover { color: var(--gold-2, #f5cc5a); }
      .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
      .titles { min-width: 0; flex: 1 1 320px; }
      .titles .line { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; flex-wrap: wrap; }
      .titles h2 { margin: 0 0 0.25rem; font-size: 1.5rem; line-height: 1.2; text-wrap: balance; }
      .code { color: var(--faint, #6e7f9e); font-size: 0.8rem; font-weight: 700; }
      .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .tabs { display: flex; width: 100%; }
      .tab { flex: 1 1 auto; padding: 0.45rem 0.5rem; }
      .ready { margin-bottom: 1rem; font-size: 0.9rem; }
      .ready ul { margin: 0.5rem 0 0 1.1rem; padding: 0; list-style: disc; display: grid; gap: 0.25rem; }
      .ready.bad { border-color: rgba(251, 113, 133, 0.45); background: rgba(251, 113, 133, 0.08); }
      .ready.good { border-color: rgba(52, 211, 153, 0.4); background: rgba(52, 211, 153, 0.07); }
      .ready.off { color: var(--muted, #9fb0d0); }
      @media (max-width: 700px) {
        .actions { width: 100%; }
        .actions .btn { flex: 1 1 auto; justify-content: center; }
      }
    `,
  ],
})
export class AdminAssessmentDetailPage implements OnInit {
  private readonly api = inject(AssessmentsAdminApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly a = signal<AdminAssessment | null>(null);
  protected readonly tab = signal<Tab>('overview');
  protected readonly error = signal('');
  protected readonly toast = signal('');
  protected readonly busy = signal(false);

  private code = '';

  ngOnInit(): void {
    // Re-runs when only the :code changes (e.g. "Make a new version"), because
    // Angular reuses this component between /assessments/AS1 and /assessments/AS2.
    this.route.paramMap.subscribe((p) => {
      this.code = p.get('code') ?? '';
      this.a.set(null);
      this.error.set('');
      this.tab.set('overview');
      this.reload();
    });
  }

  protected reload(): void {
    this.api.get(this.code).subscribe({
      next: (r) => this.a.set(r),
      error: (e) => this.error.set(errText(e)),
    });
  }

  private flash(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast() === msg && this.toast.set(''), 2800);
  }

  private run(req: ReturnType<AssessmentsAdminApi['publish']>, done: string): void {
    this.busy.set(true);
    this.error.set('');
    req.subscribe({
      next: (r) => {
        this.busy.set(false);
        this.a.set(r);
        this.flash(done);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
  }

  protected publish(): void {
    const x = this.a();
    if (!x) return;
    if (!confirm(`Publish "${x.title}"? Students in grades ${x.grades || 'all'} will see it on their dashboard and can take it once each. Questions and scoring lock as soon as the first student completes it.`)) return;
    this.run(this.api.publish(this.code), 'Published — students can see it now');
  }

  protected archive(): void {
    const x = this.a();
    if (!x) return;
    if (!confirm(`Archive "${x.title}"? It disappears from student dashboards. Existing results are kept.`)) return;
    this.run(this.api.archive(this.code), 'Archived');
  }

  protected unarchive(): void {
    this.run(this.api.unarchive(this.code), 'Restored to draft — publish it again when ready');
  }

  protected newVersion(): void {
    const x = this.a();
    if (!x) return;
    const title = prompt('Title for the new version (it starts as a draft copy with all capacities, bands and questions):', `${x.title} (v2)`);
    if (!title || title.trim().length < 3) return;
    this.busy.set(true);
    this.api.create({ title: title.trim(), cloneFrom: x.code }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.router.navigate(['/admin/assessments', r.code]).then(() => this.flash('New draft version created'));
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected remove(): void {
    const x = this.a();
    if (!x) return;
    if (x.completions > 0) {
      this.error.set('This assessment has completed results, so it cannot be deleted. Archive it instead.');
      return;
    }
    if (!confirm(`Delete "${x.title}" and its ${x.questionCount} question(s)? This cannot be undone.`)) return;
    this.busy.set(true);
    this.api.remove(this.code).subscribe({
      next: () => this.router.navigate(['/admin/assessments']),
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
      },
    });
  }
}
