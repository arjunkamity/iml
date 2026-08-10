import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AttemptQuestion, AttemptState } from '../../core/models';

@Component({
  selector: 'app-quiz-take',
  imports: [RouterLink],
  template: `
    @if (error()) {
      <div class="card">
        <div class="alert error">{{ error() }}</div>
        <a class="btn" routerLink="/student/dashboard">Back to dashboard</a>
      </div>
    } @else if (questions().length) {
      <div class="quiz-head card">
        <div class="spread">
          <div><h2 style="margin:0;">Quiz in progress</h2><p class="muted">Answers save automatically.</p></div>
          <div class="timer" [class.danger]="secondsLeft() <= 30">⏱ {{ mmss(secondsLeft()) }}</div>
        </div>
        <div class="progress"><span [style.width.%]="answeredPct()"></span></div>
        <p class="muted" style="margin-top:.4rem;">{{ answeredCount() }} / {{ questions().length }} answered</p>
      </div>

      @for (q of questions(); track q.questionId) {
        <div class="card" style="margin-top:1rem;">
          <div class="spread">
            <span class="badge violet">{{ q.category }}</span>
            <span class="muted">Q{{ q.order }}</span>
          </div>
          <h3 style="margin:.6rem 0 1rem;">{{ q.text }}</h3>
          <div class="grid">
            @for (o of q.options; track o.optionId) {
              <button class="opt" [class.sel]="answers()[q.questionId] === o.optionId" (click)="select(q, o.optionId)">
                {{ o.text }}
              </button>
            }
          </div>
        </div>
      }

      <div class="card" style="margin-top:1rem;">
        <button class="btn btn-primary btn-block" [disabled]="submitting()" (click)="submit()">
          {{ submitting() ? 'Submitting…' : 'Submit Quiz' }}
        </button>
      </div>
    } @else {
      <div class="loading">Loading quiz…</div>
    }
  `,
  styles: [`
    .timer { font-size:1.5rem; font-weight:800; color:var(--cyan); }
    .timer.danger { color:var(--red); }
    .progress { height:8px; background:rgba(0,0,0,.3); border-radius:999px; overflow:hidden; margin-top:.75rem; }
    .progress span { display:block; height:100%; background:var(--grad-brand); transition:width .3s; }
    .opt { text-align:left; background:rgba(0,0,0,.25); border:1px solid var(--glass-border); color:var(--text);
      padding:.9rem 1.1rem; border-radius:12px; cursor:pointer; font-size:.98rem; transition:all .15s; }
    .opt:hover { border-color:var(--violet-2); transform:translateX(2px); }
    .opt.sel { background:rgba(139,92,246,.22); border-color:var(--violet-2); font-weight:600; }
  `],
})
export class QuizTakeComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  questions = signal<AttemptQuestion[]>([]);
  answers = signal<Record<string, string>>({});
  secondsLeft = signal(0);
  attemptId = 0;
  submitting = signal(false);
  error = signal<string | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.api.post<AttemptState>(`/quizzes/${id}/start`).subscribe({
      next: (s) => this.setup(s),
      error: (e) => this.error.set(e?.error?.message ?? 'Could not start quiz'),
    });
  }

  private setup(s: AttemptState) {
    if (s.status !== 'InProgress' || !s.questions) {
      if (s.result) {
        void this.router.navigate(['/student/result', s.result.AttemptId]);
      } else {
        this.error.set('This quiz is not available.');
      }
      return;
    }
    this.attemptId = s.attemptId!;
    this.questions.set(s.questions);
    const map: Record<string, string> = {};
    for (const q of s.questions) if (q.selectedOptionId) map[q.questionId] = q.selectedOptionId;
    this.answers.set(map);
    this.secondsLeft.set(s.secondsRemaining ?? 0);
    this.startTimer();
  }

  private startTimer() {
    this.timer = setInterval(() => {
      const left = this.secondsLeft() - 1;
      this.secondsLeft.set(left);
      if (left <= 0) {
        this.stopTimer();
        this.submit();
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  select(q: AttemptQuestion, optionId: string) {
    this.answers.update((a) => ({ ...a, [q.questionId]: optionId }));
    this.api
      .post(`/attempts/${this.attemptId}/answer`, {
        questionId: Number(q.questionId),
        optionId: Number(optionId),
      })
      .subscribe({ error: () => {} });
  }

  answeredCount() { return Object.keys(this.answers()).length; }
  answeredPct() {
    const total = this.questions().length || 1;
    return Math.round((this.answeredCount() / total) * 100);
  }

  submit() {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.stopTimer();
    this.api.post<{ result: { AttemptId: number } }>(`/attempts/${this.attemptId}/submit`).subscribe({
      next: (r) => this.router.navigate(['/student/result', r.result.AttemptId]),
      error: (e) => { this.error.set(e?.error?.message ?? 'Submit failed'); this.submitting.set(false); },
    });
  }

  mmss(s: number) {
    const m = Math.floor(Math.max(0, s) / 60);
    const sec = Math.max(0, s) % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  ngOnDestroy() { this.stopTimer(); }
}
