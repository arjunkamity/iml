import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { AssessmentsDataService, AssessmentSummary } from './assessments-data.service';

@Component({
  selector: 'app-account-assessments',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="acc-head">
      <div>
        <div class="acc-eyebrow">Assessments</div>
        <h1 class="acc-title">Assessments</h1>
        <p class="acc-sub">Short reflections to help you understand how you think, feel, connect and lead. They are not exams and carry no marks.</p>
      </div>
    </div>

    @if (loading()) {
      <div class="loading">Loading assessments…</div>
    } @else if (error()) {
      <div class="empty"><div class="big">&#9888;&#65039;</div><p>{{ error() }}</p></div>
    } @else if (items().length) {
      <div class="as-grid">
        @for (a of items(); track a.slug) {
          <div class="card as-card">
            <div class="card-head">
              <h3>{{ a.title }}</h3>
              <span class="tag" [class.tag-green]="a.completed" [class.tag-muted]="!a.completed">{{ a.completed ? 'Completed' : 'New' }}</span>
            </div>
            @if (a.summary) {
              <p class="as-sum">{{ a.summary }}</p>
            }
            <p class="as-meta">{{ a.questionCount }} scenarios · about 8 minutes · no timer</p>
            <div class="as-actions">
              <a class="btn btn-primary" [routerLink]="['/account/assessments', a.slug]">{{ a.completed ? 'View my result' : 'Start' }} →</a>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="empty"><div class="big">&#129504;</div><p>No assessments are available for you right now. Check back soon.</p></div>
    }
  `,
  styles: [
    ACCOUNT_UI_CSS,
    `
      .as-grid { display: grid; gap: 1.1rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); }
      .as-sum { color: var(--muted); margin: 0 0 0.6rem; }
      .as-meta { color: var(--faint); font-size: 0.85rem; margin: 0 0 1rem; }
      .as-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    `,
  ],
})
export class AccountAssessmentsPage implements OnInit {
  private readonly data = inject(AssessmentsDataService);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly items = signal<AssessmentSummary[]>([]);

  ngOnInit(): void {
    this.data.list().subscribe({
      next: (r) => {
        this.items.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load assessments. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
