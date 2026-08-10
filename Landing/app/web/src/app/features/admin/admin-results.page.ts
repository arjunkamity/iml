import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface ResultRow {
  code: string;
  student: string;
  studentCode: string;
  grade: string;
  competition: string;
  competitionCode: string;
  stage: string | null;
  stagePosition: number | null;
  score: number;
  total: number;
  startedAt: string;
  finishedAt: string;
}

interface AnswerDetail {
  id: number;
  answer: unknown;
  isCorrect: boolean | null;
  takenSecs: number | null;
  timeUp: boolean;
  question: { code?: string; prompt: string; options: unknown[]; correct: number[] } | null;
}

interface AttemptDetail {
  code: string;
  score: number;
  total: number;
  startedAt: string;
  finishedAt: string;
  registration: {
    student: { name: string; code: string; grade: string };
    competition: { title: string };
  };
  stage: { name: string; position: number } | null;
  answers: AnswerDetail[];
}

interface ListResult {
  data: ResultRow[];
  total: number;
  page: number;
  limit: number;
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? 'Something went wrong';
}

@Component({
  selector: 'app-admin-results',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bar">
      <select class="filter" [(ngModel)]="comp" (ngModelChange)="go(1)">
        <option value="">All competitions</option>
        @for (c of comps(); track c) {
          <option [value]="c">{{ c }}</option>
        }
      </select>
      <input class="search" placeholder="Search student…" [(ngModel)]="search" (keyup.enter)="go(1)" />
      <div class="grow"></div>
    </div>

    @if (error) {
      <div class="err">{{ error }}</div>
    }

    <div class="tbl-wrap">
      <table>
        <thead>
          <tr><th>Attempt</th><th>Student</th><th>Competition</th><th>Stage</th><th>Score</th><th>Finished</th><th></th></tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.code) {
            <tr>
              <td>{{ r.code }}</td>
              <td><span class="b">{{ r.student }}</span><small>{{ r.studentCode }}</small></td>
              <td>{{ r.competition }}</td>
              <td>{{ r.stage ?? '—' }}</td>
              <td><span class="b">{{ r.score }}</span>/{{ r.total }}</td>
              <td>{{ when(r.finishedAt) }}</td>
              <td>
                <div class="acts">
                  <button class="btn btn-sm" (click)="view(r)">View responses</button>
                </div>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="empty">No results yet.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (total() > 0) {
      <div class="pager">
        <span>{{ ((page() - 1) * 15 + 1) }}–{{ min(page() * 15, total()) }} of {{ total() }}</span>
        <button class="btn btn-sm" [disabled]="page() <= 1" (click)="go(page() - 1)">← Prev</button>
        <button class="btn btn-sm" [disabled]="page() * 15 >= total()" (click)="go(page() + 1)">Next →</button>
      </div>
    }

    @if (detail()) {
      <div class="modal-root" (click)="detail.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>{{ detail()!.registration.student.name }} — {{ detail()!.registration.competition.title }}</h3>
            <button class="m-x" (click)="detail.set(null)">✕</button>
          </div>
          <div class="m-body">
            <div class="dl">
              <dt>Attempt</dt><dd>{{ detail()!.code }}</dd>
              <dt>Score</dt><dd>{{ detail()!.score }} / {{ detail()!.total }}</dd>
              <dt>Stage</dt><dd>{{ detail()!.stage?.name ?? '—' }}</dd>
              <dt>Started</dt><dd>{{ when(detail()!.startedAt) }}</dd>
              <dt>Finished</dt><dd>{{ when(detail()!.finishedAt) }}</dd>
            </div>
            <div style="height:1rem"></div>
            @for (a of detail()!.answers; track a.id) {
              <div class="resp">
                <div class="q">{{ a.question?.prompt ?? '—' }}</div>
                @for (opt of a.question?.options ?? []; track $index) {
                  <div class="a" [style.color]="optColor(a, $index)">
                    {{ ['A', 'B', 'C', 'D'][$index] ?? $index + 1 }}. {{ opt }}
                    @if ((a.question?.correct ?? []).includes($index)) { <span class="ok">✓ correct</span> }
                    @if (selected(a, $index)) { <span class="bdg gold">your pick</span> }
                  </div>
                }
                <div class="a" style="margin-top:0.35rem">
                  @if (a.isCorrect === true) {
                    <span class="ok">Correct</span>
                  } @else if (a.isCorrect === false) {
                    <span class="bad">Incorrect</span>
                  } @else {
                    <span>Not answered / skipped</span>
                  }
                  @if (a.takenSecs != null) { · {{ a.takenSecs }}s }
                  @if (a.timeUp) { · <span class="bad">time up</span> }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [ADMIN_UI_CSS],
})
export class AdminResultsPage {
  private readonly api = inject(ApiService);
  readonly rows = signal<ResultRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly comps = signal<string[]>([]);
  readonly detail = signal<AttemptDetail | null>(null);
  search = '';
  comp = '';
  error = '';

  constructor() {
    this.api.get<{ data: Array<{ code: string }> }>('/competitions', { limit: 100 }).subscribe({
      next: (r) => this.comps.set(r.data.map((c) => c.code)),
      error: () => undefined,
    });
    this.load();
  }

  min(a: number, b: number) {
    return Math.min(a, b);
  }

  load() {
    this.api.get<ListResult>('/results', this.params()).subscribe({
      next: (r) => {
        this.rows.set(r.data ?? []);
        this.total.set(r.total ?? 0);
      },
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  go(p: number) {
    this.page.set(p);
    this.load();
  }

  private params(): Record<string, unknown> {
    const p: Record<string, unknown> = { page: this.page(), limit: 15 };
    if (this.comp) p['comp'] = this.comp;
    if (this.search.trim()) p['search'] = this.search.trim();
    return p;
  }

  view(r: ResultRow) {
    this.api.get<AttemptDetail>(`/results/${r.code}`).subscribe({
      next: (d) => this.detail.set(d),
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  when(v: string) {
    return typeof v === 'string' ? `${v.slice(0, 10)} ${v.slice(11, 16)}` : '—';
  }

  selected(a: AnswerDetail, i: number) {
    const ans = Array.isArray(a.answer) ? a.answer : [];
    return ans.includes(i);
  }

  optColor(a: AnswerDetail, i: number) {
    const correct = (a.question?.correct ?? []) as number[];
    if (correct.includes(i)) return '#86efac';
    if (this.selected(a, i)) return '#fecdd3';
    return undefined;
  }
}
