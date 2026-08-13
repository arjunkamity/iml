import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StudentDataService } from '../student-data.service';
import type {
  ExamAttempt,
  ExamQuestion,
  ExamSubmitResult,
} from '../student-data.service';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { EXAM_UI_CSS } from './exam-ui';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

@Component({
  selector: 'app-account-exam',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="exam-page" [class.reviewing]="reviewing()" [class.locked]="reviewing() && !!result()">
      <div class="bg-aurora"></div>
      <div class="bg-grid"></div>

      @if (loading()) {
        <div class="exam-state">
          <div class="exam-state-card">
            <div class="big">&#9203;</div>
            <h3>Starting your test…</h3>
            <p>Setting up your questions. Do not refresh this page.</p>
          </div>
        </div>
      } @else if (error()) {
        <div class="exam-state">
          <div class="exam-state-card">
            <div class="big">&#9888;&#65039;</div>
            <h3>{{ attempt() ? 'Could not submit the test' : 'Cannot start the exam' }}</h3>
            <p>{{ error() }}</p>
            <div class="res-actions">
              <a class="btn btn-primary btn-lg" routerLink="/account/schedules">Back to Schedules</a>
            </div>
          </div>
        </div>
      } @else {
        <!-- top bar -->
        <header class="exam-top">
          <a routerLink="/account/schedules" class="brand" title="Back to dashboard">
            <img class="logo et-logo-full" src="img/new-logo-cut.png" alt="India Mind League" />
            <img class="logo et-logo-mini" src="img/new-logo-cut.png" alt="India Mind League" />
          </a>
          <div class="et-mid">
            <span class="et-title">{{ attempt()?.exam?.title }}</span>
            <span class="et-sub">{{ subtitle() }}</span>
          </div>
          <div class="et-right">
            <div class="et-timer" [class.warn]="timerWarn()"><span class="tk">&#9201;</span><span>{{ timeLeft() }}</span></div>
            <button type="button" class="btn-quit" (click)="quit()" title="Save &amp; exit">Exit</button>
          </div>
        </header>

        <!-- progress -->
        <div class="exam-progress"><span [style.width.%]="progress()"></span></div>

        <main class="exam-wrap">
          <section class="q-col">
            <div class="q-card">
              <div class="q-top">
                <span class="q-cat" [class]="catClass()">{{ currentQuestion()?.category }}</span>
                <span class="q-count">Question <b>{{ current() + 1 }}</b> / <span>{{ total() }}</span></span>
                @if (currentLapsed()) {
                  <span class="q-timer lapsed">&#9888;&#65039; Time up</span>
                } @else {
                  <span class="q-timer" [class.warn]="currentQLeft() <= 10">&#9201; {{ qTimeLeft() }}</span>
                }
              </div>

              @if (currentQuestion()?.mode === 'multi' && !currentLapsed()) {
                <span class="q-multi-hint">Select all that apply</span>
              }

              @if (currentQuestion()?.media && isYouTube(currentQuestion()?.media ?? '')) {
                <div class="q-media">
                  <iframe [src]="youtubeEmbed(currentQuestion()?.media ?? '')" frameborder="0" allowfullscreen></iframe>
                </div>
              } @else if (currentQuestion()?.qtype === 'image' && currentQuestion()?.media) {
                <div class="q-media"><img [src]="currentQuestion()!.media" alt="" /></div>
              } @else if (currentQuestion()?.qtype === 'video' && currentQuestion()?.media) {
                <div class="q-media"><video [src]="currentQuestion()!.media" controls></video></div>
              }

              <h2 class="q-text">{{ currentQuestion()?.prompt }}</h2>
              @if (currentLapsed()) {
                <div class="q-lapsed-note">&#9888;&#65039; Time is up for this question and it has been marked unanswered.</div>
              }
              <div class="q-opts" [class.disabled]="currentLapsed()">
                @for (opt of currentOptions(); track $index; let i = $index) {
                  <div class="opt" [class.sel]="isSelected(currentQuestion()!, i)" [class.correct]="reviewing() && isReviewCorrect(currentQuestion()!, i)" [class.wrong]="reviewing() && isReviewWrong(currentQuestion()!, i)" (click)="selectOption(i)">
                    <span class="key">{{ KEYS[i] }}</span>
                    <span class="otext">{{ opt }}</span>
                  </div>
                }
              </div>
            </div>

            <div class="q-foot">
              <button type="button" class="btn btn-ghost" [disabled]="current() === 0" (click)="prev()">&#8592; Previous</button>
              @if (reviewing()) {
                <button type="button" class="btn btn-primary" [disabled]="submitting()" (click)="confirmSubmit()">Confirm &amp; Submit Test</button>
              } @else {
                <button type="button" class="btn btn-primary" [disabled]="!canAdvance()" (click)="next()">
                  @if (current() === total() - 1) {
                    Review →
                  } @else {
                    Next →
                  }
                </button>
              }
            </div>
            <p class="q-block-note" [class.show]="blocked()">&#128221; Please answer the current question before moving on.</p>
          </section>

          <!-- palette (always open) -->
          <aside class="palette">
            <div class="pal-card">
              <div class="pal-head">
                <h3>Questions</h3>
                <span class="pal-status">{{ reviewing() ? 'Reviewing' : 'Test' }}</span>
              </div>
              <div class="pal-grid">
                @for (q of questions(); track q.id; let i = $index) {
                  <button type="button"
                    [class.answered]="isAnswered(q.id) && !lapsed().includes(q.id)"
                    [class.current]="i === current()"
                    [class.lapsed]="lapsed().includes(q.id)"
                    (click)="goto(i)">{{ i + 1 }}</button>
                }
              </div>
              <ul class="pal-legend">
                <li><span class="lg sw-answered"></span> Answered</li>
                <li><span class="lg sw-current"></span> Current</li>
                <li><span class="lg sw-lapsed"></span> Time up</li>
                <li><span class="lg sw-empty"></span> Not visited</li>
              </ul>
              <div class="pal-counts">
                <span>Answered <b>{{ answeredCount() }}</b></span>
                <span>Left <b>{{ total() - answeredCount() }}</b></span>
              </div>
              @if (reviewing()) {
                <button type="button" class="btn btn-primary btn-block" [disabled]="submitting()" (click)="confirmSubmit()">Confirm &amp; Submit Test</button>
              } @else {
                <button type="button" class="btn btn-primary btn-block" (click)="beginReview()">Submit Test</button>
              }
            </div>
          </aside>
        </main>
      }

      <!-- result overlay -->
      @if (result() && showResult()) {
        <div class="result">
          <div class="res-card">
            <div class="res-ring" [style.--p]="result()?.percent"><div class="res-pct"><b>{{ result()?.percent }}%</b><small>Score</small></div></div>
            <h2 class="res-title">{{ resTitle() }}</h2>
            <p class="res-sub">You scored {{ result()?.score }} out of {{ result()?.total }}.
              <span class="tag" [class.tag-green]="qualified()" [class.tag-red]="!qualified()" style="margin-left:0.4rem">{{ qualified() ? 'Qualified' : 'Not qualified' }}</span>
            </p>
            <div class="res-breakdown">
              @for (cat of result()?.categories; track cat.name) {
                <div class="rb"><b>{{ cat.correct }}/{{ cat.total }}</b><small>{{ cat.name }}</small></div>
              }
            </div>
            <div class="res-actions">
              <a class="btn btn-primary btn-lg" routerLink="/account/results">Back to Dashboard →</a>
              <button type="button" class="btn btn-ghost btn-lg" (click)="review()">Review answers</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [ACCOUNT_UI_CSS, EXAM_UI_CSS],
})
export class AccountExamPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly data = inject(StudentDataService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly attempt = signal<ExamAttempt | null>(null);
  protected readonly result = signal<ExamSubmitResult | null>(null);
  protected readonly showResult = signal(true);
  protected readonly reviewing = signal(false);
  protected readonly submitting = signal(false);
  protected readonly current = signal(0);
  protected readonly remaining = signal(0);
  protected readonly answers = signal<Record<number, number[]>>({});
  protected readonly qLeft = signal<Record<number, number>>({});
  protected readonly taken = signal<Record<number, number>>({});
  protected readonly lapsed = signal<number[]>([]);
  protected readonly blocked = signal(false);

  protected readonly KEYS = KEYS;

  private timer?: ReturnType<typeof setInterval>;
  private blockedTimer?: ReturnType<typeof setTimeout>;
  private examCode = '';

  protected readonly questions = computed(() => this.attempt()?.questions ?? []);
  protected readonly total = computed(() => this.questions().length);
  protected readonly currentQuestion = computed<ExamQuestion | null>(
    () => this.questions()[this.current()] ?? null,
  );
  protected readonly currentOptions = computed<unknown[]>(
    () => this.currentQuestion()?.options ?? [],
  );
  protected readonly subtitle = computed(() => {
    const cats = this.attempt()?.categories ?? [];
    const stage = this.attempt()?.exam?.stage;
    const bits: string[] = [];
    if (stage) bits.push(`Stage ${stage.position}`);
    if (cats.length) bits.push(cats.join(' · '));
    return bits.join(' · ');
  });
  protected readonly answeredCount = computed(
    () => Object.keys(this.answers()).length,
  );
  protected readonly progress = computed(() =>
    this.total()
      ? Math.round((this.answeredCount() / this.total()) * 100)
      : 0,
  );
  protected readonly timeLeft = computed(() => {
    const m = Math.floor(this.remaining() / 60);
    const s = this.remaining() % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  });
  protected readonly timerWarn = computed(() => this.remaining() <= 60);
  protected readonly currentLapsed = computed(() =>
    this.currentQuestion()
      ? this.lapsed().includes(this.currentQuestion()!.id)
      : false,
  );
  protected readonly currentQLeft = computed(() => {
    const q = this.currentQuestion();
    if (!q || this.currentLapsed()) return 0;
    return Math.max(0, this.qLeft()[q.id] ?? this.limitFor(q));
  });
  protected readonly qTimeLeft = computed(() => {
    const left = this.currentQLeft();
    const m = Math.floor(left / 60);
    const s = left % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  });
  protected readonly qualified = computed(() => {
    const r = this.result();
    return r ? r.percent >= r.passMark : false;
  });
  protected readonly resTitle = computed(() => {
    const p = this.result()?.percent ?? 0;
    return p >= 70 ? 'Brilliant work! 🎉' : p >= 40 ? 'Good effort! 👏' : 'Keep practising! 💪';
  });
  protected readonly catClass = computed(() =>
    `q-cat ${(this.currentQuestion()?.category ?? '').toLowerCase()}`,
  );

  ngOnInit(): void {
    this.examCode = String(this.route.snapshot.paramMap.get('code') ?? '');
    this.data.startExam(this.examCode).subscribe({
      next: (attempt) => {
        this.attempt.set(attempt);
        const secs = (attempt.durationMin ?? 15) * 60;
        this.remaining.set(secs);
        this.loading.set(false);
        this.timer = setInterval(() => this.tick(), 1000);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Something went wrong starting this exam.');
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.blockedTimer) clearTimeout(this.blockedTimer);
  }

  private tick(): void {
    const left = this.remaining() - 1;
    this.remaining.set(left);
    if (left <= 0) {
      this.submit();
      return;
    }
    if (this.reviewing() || this.result()) return;
    const q = this.currentQuestion();
    if (!q) return;
    const secs = this.currentQLeft();
    if (secs > 0) {
      this.qLeft.set({ ...this.qLeft(), [q.id]: secs - 1 });
      this.taken.set({ ...this.taken(), [q.id]: (this.taken()[q.id] ?? 0) + 1 });
    }
    if (secs - 1 <= 0 && !this.isAnswered(q.id) && !this.currentLapsed()) {
      this.lapse(q.id);
    }
  }

  private lapse(id: number): void {
    this.lapsed.set([...this.lapsed(), id]);
    if (this.current() < this.total() - 1) {
      this.current.set(this.current() + 1);
    }
  }

  private limitFor(q: ExamQuestion): number {
    if (q.timeLimitSecs) return q.timeLimitSecs;
    const t = this.attempt()?.timing as
      | { mode?: string; secs?: number }
      | undefined;
    if (t?.secs) return t.secs;
    return (this.attempt()?.durationMin ?? 15) * 60;
  }

  protected canAdvance(): boolean {
    if (this.reviewing()) return true;
    const q = this.currentQuestion();
    if (!q) return false;
    return this.isAnswered(q.id) || this.currentLapsed();
  }

  protected isAnswered(id: number): boolean {
    return !!this.answers()[id]?.length;
  }

  protected isSelected(q: ExamQuestion, i: number): boolean {
    return (this.answers()[q.id] ?? []).includes(i);
  }

  protected isReviewCorrect(q: ExamQuestion, i: number): boolean {
    const r = this.reviewFor(q.id);
    return r ? r.correct.includes(i) : false;
  }

  protected isReviewWrong(q: ExamQuestion, i: number): boolean {
    const r = this.reviewFor(q.id);
    return !!r && r.given.includes(i) && !r.correct.includes(i);
  }

  private reviewFor(id: number) {
    return this.result()?.review.find((r) => r.questionId === id);
  }

  protected selectOption(i: number): void {
    if (this.currentLapsed()) return;
    if (this.result()) return;
    const q = this.currentQuestion();
    if (!q) return;
    const current = this.answers()[q.id] ?? [];
    if (q.mode === 'multi') {
      const next = current.includes(i)
        ? current.filter((x) => x !== i)
        : [...current, i].sort((a, b) => a - b);
      this.answers.set({ ...this.answers(), [q.id]: next });
    } else {
      this.answers.set({ ...this.answers(), [q.id]: [i] });
    }
    this.qLeft.set({ ...this.qLeft(), [q.id]: this.limitFor(q) });
  }

  protected goto(i: number): void {
    const target = Math.max(0, Math.min(this.total() - 1, i));
    if (target === this.current()) return;
    if (!this.reviewing() && target > this.current() && !this.canAdvance()) {
      this.flashBlocked();
      return;
    }
    this.current.set(target);
  }

  protected prev(): void {
    this.goto(this.current() - 1);
  }

  protected next(): void {
    if (this.current() === this.total() - 1) {
      this.beginReview();
    } else {
      this.goto(this.current() + 1);
    }
  }

  private flashBlocked(): void {
    this.blocked.set(true);
    if (this.blockedTimer) clearTimeout(this.blockedTimer);
    this.blockedTimer = setTimeout(() => this.blocked.set(false), 1600);
  }

  protected beginReview(): void {
    const left = this.total() - this.answeredCount();
    const ok = left > 0
      ? window.confirm(`${left} question(s) still unanswered. Review the test anyway?`)
      : true;
    if (!ok) return;
    this.reviewing.set(true);
    this.current.set(0);
  }

  protected confirmSubmit(): void {
    if (this.submitting()) return;
    const left = this.total() - this.answeredCount();
    const ok = left > 0
      ? window.confirm(`${left} question(s) still unanswered. Submit the test anyway? You cannot change answers after this.`)
      : window.confirm('Submit your test? You cannot change answers after this.');
    if (ok) this.submit();
  }

  protected submit(): void {
    if (this.submitting()) return;
    const attempt = this.attempt();
    if (!attempt) return;
    this.submitting.set(true);

    const payload = Object.entries(this.answers()).map(([qid, ans]) => ({
      questionId: Number(qid),
      answer: ans,
      takenSecs: this.taken()[Number(qid)] ?? 0,
    }));

    this.data.submitExam(this.examCode, { attemptCode: attempt.attemptCode, answers: payload }).subscribe({
      next: (res) => {
        if (this.timer) clearInterval(this.timer);
        this.remaining.set(0);
        this.result.set(res);
        this.reviewing.set(false);
        this.current.set(0);
        this.submitting.set(false);
        this.showResult.set(true);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.message ?? 'Could not submit the test. Please try again.');
      },
    });
  }

  protected review(): void {
    this.reviewing.set(true);
    this.showResult.set(false);
    this.current.set(0);
  }

  protected quit(): void {
    if (this.reviewing() || !this.attempt()) return;
    if (window.confirm('Exit the test? Your progress on this attempt will be lost.')) {
      this.router.navigate(['/account/schedules']);
    }
  }

  protected isYouTube(url: string): boolean {
    return /youtube\.com|youtu\.be/.test(url);
  }

  protected youtubeEmbed(url: string): string {
    const m = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&]|$)/);
    return m
      ? `https://www.youtube.com/embed/${m[1]}`
      : url;
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (this.result() && this.showResult()) return;
    if (e.key === 'ArrowRight') this.goto(this.current() + 1);
    else if (e.key === 'ArrowLeft') this.goto(this.current() - 1);
    else if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(e.key) && !this.result()) {
      this.selectOption(Number(e.key) - 1);
    } else if (['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].includes(e.key.toLowerCase()) && !this.result()) {
      this.selectOption(e.key.toLowerCase().charCodeAt(0) - 97);
    }
  }
}
