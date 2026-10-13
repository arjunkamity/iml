import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { SiteSettingsService } from '@core/services/site-settings.service';
import { ACCOUNT_UI_CSS } from '../../account/account-ui';
import { EXAM_UI_CSS } from '../../account/exam/exam-ui';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const DEFAULT_Q_SECS = 60;
const PROGRESS_KEY = 'iml-demo-exam-progress';

interface StoredDemoProgress {
  startedAt: number;
  title: string;
  durationMin: number;
  questions: DemoQuestion[];
  current: number;
  answers: Record<number, number[]>;
  qLeft: Record<number, number>;
  lapsed: number[];
}

interface DemoQuestion {
  id: number;
  code: string;
  category: string;
  qtype: string;
  media: string | null;
  mode: string;
  label: string | null;
  prompt: string;
  options: unknown[];
  timeLimitSecs: number | null;
}

interface DemoExamConfig {
  active: boolean;
  title?: string;
  durationMin?: number;
  questions?: DemoQuestion[];
}

interface DemoResult {
  score: number;
  total: number;
  percent: number;
  review: Array<{
    questionId: number;
    code: string;
    prompt: string;
    options: unknown[];
    correct: number[];
    given: number[];
    isCorrect: boolean;
  }>;
}

/**
 * The public Default Demo Exam — "see how the test works" before you ever
 * register. Deliberately mirrors the REAL exam page's mechanics (random
 * order, per-question timer, tab/window-switch guard) closely, since the
 * whole point is to practice the actual rules, not a simplified stand-in.
 * Unlike a real exam this is entirely stateless: no attempt row, unlimited
 * retakes — see PublicService.getDemoExam()/submitDemoExam().
 */
@Component({
  selector: 'app-demo-exam',
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
            <h3>Loading the demo…</h3>
          </div>
        </div>
      } @else if (unavailable()) {
        <div class="exam-state">
          <div class="exam-state-card">
            <div class="big">&#128736;</div>
            <h3>Demo temporarily unavailable</h3>
            <p>Check back soon — or head straight to registration.</p>
            <div class="res-actions">
              <a class="btn btn-primary btn-lg" routerLink="/competitions">Browse Competitions</a>
            </div>
          </div>
        </div>
      } @else if (error()) {
        <div class="exam-state">
          <div class="exam-state-card">
            <div class="big">&#9888;&#65039;</div>
            <h3>Something went wrong</h3>
            <p>{{ error() }}</p>
            <div class="res-actions">
              <a class="btn btn-primary btn-lg" routerLink="/">Back to Home</a>
            </div>
          </div>
        </div>
      } @else {
        <header class="exam-top">
          <a routerLink="/" class="brand" title="Back to site">
            <img class="logo et-logo-full" [src]="settings().logoDarkUrl" alt="India Mind League" />
            <img class="logo et-logo-mini" [src]="settings().logoMobileUrl" alt="India Mind League" />
          </a>
          <div class="et-mid">
            <span class="et-title">{{ title() }}</span>
            <span class="et-sub">Demo — practice only, nothing is saved</span>
          </div>
          <div class="et-right">
            <!-- mobile/tablet only (see exam-ui.ts) — opens the palette below as a bottom sheet -->
            @if (!(result() && showResult())) {
              <button type="button" class="btn-palette" (click)="paletteOpen.set(true)" aria-label="Open question list">
                <span class="bp-ic">&#9776;</span>
                <span class="bp-count">{{ answeredCount() }}/{{ total() }}</span>
              </button>
            }
            <div class="et-timer" [class.warn]="timerWarn()"><span class="tk">&#9201;</span><span>{{ timeLeft() }}</span></div>
            <a routerLink="/" class="btn-quit" title="Exit demo">Exit</a>
          </div>
        </header>

        <div class="exam-progress"><span [style.width.%]="progress()"></span></div>

        <main class="exam-wrap">
          <section class="q-col">
            <div class="q-card">
              <div class="q-top">
                <span class="q-cat" [class]="catClass()">{{ currentQuestion()?.category }}</span>
              </div>

              @if (currentQuestion()?.mode === 'multi' && !currentLapsed()) {
                <span class="q-multi-hint">Select all that apply</span>
              }

              @if (currentQuestion()?.qtype === 'image' && currentQuestion()?.media) {
                <div class="q-media"><img [src]="currentQuestion()!.media" alt="" /></div>
              }

              <h2 class="q-text" [innerHTML]="currentQuestion()?.prompt"></h2>
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
                <button type="button" class="btn btn-primary" [disabled]="submitting()" (click)="submit()">See My Score</button>
              } @else {
                <button type="button" class="btn btn-primary" [disabled]="!canAdvance()" (click)="next()">
                  @if (current() === total() - 1) {
                    Finish →
                  } @else {
                    Next →
                  }
                </button>
              }
            </div>
            <p class="q-block-note" [class.show]="blocked()">&#128221; Please answer the current question before moving on.</p>

            <!-- desktop: bottom of the left column; mobile/tablet: fixed
                 to the screen bottom — see exam-ui.ts's media query -->
            @if (!(result() && showResult())) {
              <div class="q-status">
                <span class="q-count">Question <b>{{ current() + 1 }}</b> / <span>{{ total() }}</span></span>
                @if (currentLapsed()) {
                  <span class="q-timer lapsed">&#9888;&#65039; Time up</span>
                } @else {
                  <span class="q-timer" [class.warn]="currentQLeft() <= 10">&#9201; {{ qTimeLeft() }}</span>
                }
              </div>
            }
          </section>

          <aside class="palette" [class.open]="paletteOpen()">
            <div class="pal-card">
              <div class="pal-head">
                <h3>Questions</h3>
                <span class="pal-status">{{ reviewing() ? 'Reviewing' : 'Demo' }}</span>
                <button type="button" class="pal-close" (click)="paletteOpen.set(false)" aria-label="Close">✕</button>
              </div>
              <div class="pal-grid">
                @for (q of questions(); track q.id; let i = $index) {
                  <button type="button"
                    [class.answered]="isAnswered(q.id) && !lapsed().includes(q.id)"
                    [class.current]="i === current()"
                    [class.lapsed]="lapsed().includes(q.id)"
                    (click)="goto(i); paletteOpen.set(false)">{{ i + 1 }}</button>
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
            </div>
          </aside>
        </main>
      }

      @if (result() && showResult()) {
        <div class="result">
          <div class="res-card">
            <div class="res-ring" [style.--p]="result()?.percent"><div class="res-pct"><b>{{ result()?.percent }}%</b><small>Score</small></div></div>
            <h2 class="res-title">{{ resTitle() }}</h2>
            <p class="res-sub">You scored {{ result()?.score }} out of {{ result()?.total }} — practice only, nothing was saved.</p>
            <div class="res-actions">
              <button type="button" class="btn btn-primary btn-lg" (click)="tryAgain()">Try Again</button>
              <a class="btn btn-ghost btn-lg" routerLink="/competitions">I'm Ready — Show Me Competitions →</a>
            </div>
            <button type="button" class="linkbtn" style="margin-top:0.8rem;" (click)="review()">Review my answers</button>
          </div>
        </div>
      }

      @if (tabWarningVisible()) {
        <div class="result">
          <div class="res-card">
            <div class="big">&#9888;&#65039;</div>
            <h2 class="res-title">Tab or window switch detected</h2>
            <p class="res-sub">In a real exam, this is not allowed — this is just the demo, so nothing happens here, but in the real thing, doing this once shows this same warning, and doing it again submits your exam immediately, whatever you've answered so far.</p>
            <div class="res-actions">
              <button type="button" class="btn btn-primary btn-lg" (click)="dismissTabWarning()">OK, I Understand</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [ACCOUNT_UI_CSS, EXAM_UI_CSS],
})
export class DemoExamPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  protected readonly settings = inject(SiteSettingsService).settings;

  protected readonly loading = signal(true);
  protected readonly unavailable = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly title = signal('Demo Exam');
  protected readonly durationMin = signal(10);
  protected readonly questions = signal<DemoQuestion[]>([]);

  protected readonly result = signal<DemoResult | null>(null);
  protected readonly showResult = signal(true);
  protected readonly reviewing = signal(false);
  protected readonly submitting = signal(false);
  protected readonly current = signal(0);
  protected readonly remaining = signal(0);
  protected readonly answers = signal<Record<number, number[]>>({});
  protected readonly qLeft = signal<Record<number, number>>({});
  protected readonly lapsed = signal<number[]>([]);
  protected readonly blocked = signal(false);
  protected readonly tabWarned = signal(false);
  protected readonly tabWarningVisible = signal(false);
  protected readonly paletteOpen = signal(false);

  protected readonly KEYS = KEYS;

  private timer?: ReturnType<typeof setInterval>;
  private blockedTimer?: ReturnType<typeof setTimeout>;

  // The demo has no backend session at all (anonymous, unlimited retakes —
  // see PublicService.getDemoExam()), so a refresh used to always fetch a
  // freshly re-shuffled question set and reset every timer to full. This
  // mirrors the account exam's own refresh-resume fix, but entirely
  // client-side in sessionStorage since there's no attempt row to resume
  // server-side: the frozen question set, the real wall-clock startedAt,
  // and the in-progress answers/timing all live in one blob. A deliberate
  // "Try Again" (see tryAgain()) clears it so that one genuinely reshuffles.
  private demoStartedAt = 0;
  private readonly persistProgress = effect(() => {
    const snapshot = {
      current: this.current(),
      answers: this.answers(),
      qLeft: this.qLeft(),
      lapsed: this.lapsed(),
    };
    if (!this.demoStartedAt) return;
    try {
      const stored: StoredDemoProgress = {
        startedAt: this.demoStartedAt,
        title: this.title(),
        durationMin: this.durationMin(),
        questions: this.questions(),
        ...snapshot,
      };
      sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(stored));
    } catch {
      // sessionStorage unavailable (private mode, quota) — refresh just
      // won't resume; the practice exam still works normally otherwise.
    }
  });

  private readStoredProgress(): StoredDemoProgress | null {
    try {
      const raw = sessionStorage.getItem(PROGRESS_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw) as StoredDemoProgress;
      if (!saved?.questions?.length || !saved.startedAt) return null;
      return saved;
    } catch {
      return null;
    }
  }

  private clearStoredProgress(): void {
    this.demoStartedAt = 0;
    try {
      sessionStorage.removeItem(PROGRESS_KEY);
    } catch {
      // best-effort cleanup only
    }
  }

  protected readonly total = computed(() => this.questions().length);
  protected readonly currentQuestion = computed<DemoQuestion | null>(
    () => this.questions()[this.current()] ?? null,
  );
  protected readonly currentOptions = computed<unknown[]>(() => this.currentQuestion()?.options ?? []);
  protected readonly answeredCount = computed(() => Object.keys(this.answers()).length);
  protected readonly progress = computed(() =>
    this.total() ? Math.round((this.answeredCount() / this.total()) * 100) : 0,
  );
  protected readonly timeLeft = computed(() => {
    const m = Math.floor(this.remaining() / 60);
    const s = this.remaining() % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  });
  protected readonly timerWarn = computed(() => this.remaining() <= 60);
  protected readonly currentLapsed = computed(() =>
    this.currentQuestion() ? this.lapsed().includes(this.currentQuestion()!.id) : false,
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
  protected readonly resTitle = computed(() => {
    const p = this.result()?.percent ?? 0;
    return p >= 70 ? 'Nicely done! 🎉' : p >= 40 ? 'Good practice run! 👏' : 'Good start — try again! 💪';
  });
  protected readonly catClass = computed(() => `q-cat ${(this.currentQuestion()?.category ?? '').toLowerCase()}`);

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.blockedTimer) clearTimeout(this.blockedTimer);
  }

  private load(): void {
    // Resume a still-in-progress run (refresh, accidental close/reopen of
    // the same tab) from sessionStorage instead of fetching a fresh
    // shuffle — see the comment above persistProgress. An expired one
    // (real elapsed time has used up the whole duration) is discarded so
    // the student gets a clean fresh start rather than an instantly-over
    // exam.
    const saved = this.readStoredProgress();
    if (saved) {
      const elapsedSecs = Math.floor((Date.now() - saved.startedAt) / 1000);
      const remainingSecs = saved.durationMin * 60 - elapsedSecs;
      if (remainingSecs > 0) {
        this.title.set(saved.title);
        this.durationMin.set(saved.durationMin);
        this.questions.set(saved.questions);
        this.current.set(saved.current);
        this.answers.set(saved.answers);
        this.qLeft.set(saved.qLeft);
        this.lapsed.set(saved.lapsed);
        this.remaining.set(remainingSecs);
        this.demoStartedAt = saved.startedAt;
        this.loading.set(false);
        this.timer = setInterval(() => this.tick(), 1000);
        return;
      }
      this.clearStoredProgress();
    }

    this.loading.set(true);
    this.api.get<DemoExamConfig>('/public/demo-exam').subscribe({
      next: (cfg) => {
        if (!cfg.active || !cfg.questions?.length) {
          this.unavailable.set(true);
          this.loading.set(false);
          return;
        }
        this.title.set(cfg.title ?? 'Demo Exam');
        this.durationMin.set(cfg.durationMin ?? 10);
        this.questions.set(cfg.questions);
        this.remaining.set((cfg.durationMin ?? 10) * 60);
        this.loading.set(false);
        this.demoStartedAt = Date.now();
        this.timer = setInterval(() => this.tick(), 1000);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Could not load the demo exam.');
        this.loading.set(false);
      },
    });
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
    if (secs > 0) this.qLeft.set({ ...this.qLeft(), [q.id]: secs - 1 });
    if (secs - 1 <= 0 && !this.isAnswered(q.id) && !this.currentLapsed()) this.lapse(q.id);
  }

  private lapse(id: number): void {
    this.lapsed.set([...this.lapsed(), id]);
    if (this.current() < this.total() - 1) this.current.set(this.current() + 1);
  }

  private limitFor(q: DemoQuestion): number {
    return q.timeLimitSecs ?? DEFAULT_Q_SECS;
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

  protected isSelected(q: DemoQuestion, i: number): boolean {
    return (this.answers()[q.id] ?? []).includes(i);
  }

  protected isReviewCorrect(q: DemoQuestion, i: number): boolean {
    const r = this.result()?.review.find((x) => x.questionId === q.id);
    return r ? r.correct.includes(i) : false;
  }

  protected isReviewWrong(q: DemoQuestion, i: number): boolean {
    const r = this.result()?.review.find((x) => x.questionId === q.id);
    return !!r && r.given.includes(i) && !r.correct.includes(i);
  }

  protected selectOption(i: number): void {
    if (this.currentLapsed() || this.result()) return;
    const q = this.currentQuestion();
    if (!q) return;
    const current = this.answers()[q.id] ?? [];
    if (q.mode === 'multi') {
      const next = current.includes(i) ? current.filter((x) => x !== i) : [...current, i].sort((a, b) => a - b);
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
      this.reviewing.set(true);
      this.current.set(0);
    } else {
      this.goto(this.current() + 1);
    }
  }

  private flashBlocked(): void {
    this.blocked.set(true);
    if (this.blockedTimer) clearTimeout(this.blockedTimer);
    this.blockedTimer = setTimeout(() => this.blocked.set(false), 1600);
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    const ids = new Set<number>([...Object.keys(this.answers()).map(Number), ...this.lapsed()]);
    const payload = Array.from(ids).map((qid) => ({
      questionId: qid,
      answer: this.answers()[qid] ?? [],
    }));
    this.api.post<DemoResult>('/public/demo-exam/submit', { answers: payload }).subscribe({
      next: (res) => {
        if (this.timer) clearInterval(this.timer);
        this.remaining.set(0);
        this.result.set(res);
        this.reviewing.set(false);
        this.current.set(0);
        this.submitting.set(false);
        this.showResult.set(true);
        this.clearStoredProgress();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.message ?? 'Could not score the demo. Please try again.');
      },
    });
  }

  protected review(): void {
    this.reviewing.set(true);
    this.showResult.set(false);
    this.current.set(0);
  }

  protected tryAgain(): void {
    this.result.set(null);
    this.reviewing.set(false);
    this.showResult.set(true);
    this.current.set(0);
    this.answers.set({});
    this.qLeft.set({});
    this.lapsed.set([]);
    this.tabWarned.set(false);
    this.blocked.set(false);
    // a deliberate retry should reshuffle, not resume the just-finished run
    this.clearStoredProgress();
    this.load();
  }

  // Same tab/window-switch guard as the real exam — the demo's whole point
  // is to practice this rule before it actually costs you an attempt.
  //
  // Uses a plain in-page overlay, not window.confirm() — browsers refuse
  // to paint a blocking native dialog on a tab that isn't visible, so a
  // dialog triggered right when the tab is hidden can silently never
  // appear at all (browser-dependent, and observed in practice, not just
  // theoretical). A DOM overlay has no such restriction: it's already
  // rendered by the time the student switches back, guaranteed.
  @HostListener('document:visibilitychange')
  protected onVisibilityChange(): void {
    if (!document.hidden) return;
    if (this.loading() || this.unavailable() || this.error() || this.result()) return;
    if (this.reviewing()) return;
    if (!this.tabWarned()) {
      this.tabWarned.set(true);
      this.tabWarningVisible.set(true);
    }
  }

  protected dismissTabWarning(): void {
    this.tabWarningVisible.set(false);
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
