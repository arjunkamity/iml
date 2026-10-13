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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StudentDataService } from '../student-data.service';
import type {
  ExamAnswerPayload,
  ExamAttempt,
  ExamQuestion,
  ExamSubmitResult,
} from '../student-data.service';
import { AuthService } from '@core/services/auth.service';
import { SiteSettingsService } from '@core/services/site-settings.service';
import { QuestionGroupHeaderComponent } from '../../../shared/question-group-header.component';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { EXAM_UI_CSS } from './exam-ui';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

@Component({
  selector: 'app-account-exam',
  standalone: true,
  imports: [RouterLink, QuestionGroupHeaderComponent],
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
      } @else if (resumePrompt()) {
        <div class="exam-state">
          <div class="exam-state-card">
            <div class="big">&#128260;</div>
            <h3>Welcome back!</h3>
            <p>
              We found this exam already in progress — <b>{{ resumePrompt()!.answeredCount }} of {{ total() }}</b>
              question(s) already answered. Pick up right where you left off; the timer has kept running while you were away.
            </p>
            <div class="res-actions">
              <button type="button" class="btn btn-primary btn-lg" (click)="continueResumed()">Continue Exam →</button>
            </div>
          </div>
        </div>
      } @else {
        <!-- top bar -->
        <header class="exam-top">
          <a routerLink="/account/schedules" class="brand" title="Back to dashboard">
            <img class="logo et-logo-full" [src]="settings().logoDarkUrl" alt="India Mind League" />
            <img class="logo et-logo-mini" [src]="settings().logoMobileUrl" alt="India Mind League" />
          </a>
          <div class="et-mid">
            <span class="et-title">{{ attempt()?.exam?.title }}</span>
            <span class="et-sub">{{ subtitle() }}</span>
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
            <button type="button" class="btn-quit" (click)="quit()" title="Save &amp; exit">Exit</button>
          </div>
        </header>

        <!-- progress -->
        <div class="exam-progress"><span [style.width.%]="progress()"></span></div>

        <main class="exam-wrap">
          <section class="q-col">
            <!-- Question Group header: shown above every sub-question of a group -->
            @if (currentGroup(); as g) {
              <app-question-group-header
                [group]="g"
                [part]="currentGroupPart()"
                [collapsed]="collapsedGroups().includes(g.id)"
                (toggled)="toggleGroup(g.id)"
              />
            }

            <div class="q-card">
              <div class="q-top">
                <span class="q-cat" [class]="catClass()">{{ currentQuestion()?.category }}</span>
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

          <!-- palette: always-open sidebar on desktop; a floating FAB +
               bottom sheet on mobile/tablet, see exam-ui.ts's media query -->
          <aside class="palette" [class.open]="paletteOpen()">
            <div class="pal-card">
              <div class="pal-head">
                <h3>Questions</h3>
                <span class="pal-status">{{ reviewing() ? 'Reviewing' : 'Test' }}</span>
                <button type="button" class="pal-close" (click)="paletteOpen.set(false)" aria-label="Close">✕</button>
              </div>
              <div class="pal-grid">
                @for (q of questions(); track q.id; let i = $index) {
                  <button type="button"
                    [class.answered]="isAnswered(q.id) && !lapsed().includes(q.id)"
                    [class.current]="i === current()"
                    [class.lapsed]="lapsed().includes(q.id)"
                    [class.grouped]="q.groupId != null"
                    [attr.aria-label]="'Question ' + (i + 1) + (q.groupId != null ? ' (part of a group)' : '')"
                    (click)="goto(i); paletteOpen.set(false)">{{ i + 1 }}</button>
                }
              </div>
              <ul class="pal-legend">
                <li><span class="lg sw-answered"></span> Answered</li>
                <li><span class="lg sw-current"></span> Current</li>
                <li><span class="lg sw-lapsed"></span> Time up</li>
                <li><span class="lg sw-empty"></span> Not visited</li>
                @if (attempt()?.groups?.length) {
                  <li><span class="lg sw-group"></span> Part of a group</li>
                }
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
            <div class="res-ring" [style.--p]="result()?.percent"><div class="res-pct"><b>{{ result()?.scoreDisplay }}</b><small>Result</small></div></div>
            <h2 class="res-title">{{ resTitle() }}</h2>
            <p class="res-sub">Your result: {{ result()?.scoreDisplay }}.
              @if (qualified() !== null) {
                <span class="tag" [class.tag-green]="qualified()" [class.tag-red]="!qualified()" style="margin-left:0.4rem">{{ qualified() ? 'Qualified' : 'Not qualified' }}</span>
              } @else {
                <span class="tag" style="margin-left:0.4rem">Result pending</span>
              }
            </p>
            @if (qualified() === null) {
              <p class="res-sub" style="opacity:0.8">Your result will be updated on your dashboard once it's finalised.</p>
            }
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

      <!-- tab/window-switch warning — a plain overlay, not a native dialog,
           so it's guaranteed to render even though it was triggered while
           this tab was hidden (see onVisibilityChange()) -->
      @if (tabWarningVisible()) {
        <div class="result">
          <div class="res-card">
            <div class="big">&#9888;&#65039;</div>
            <h2 class="res-title">Tab or window switch detected</h2>
            <p class="res-sub">Changing tabs or windows during this exam is not allowed.<br />Doing this again will submit your exam immediately, whatever you've answered so far.</p>
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
export class AccountExamPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly data = inject(StudentDataService);
  private readonly auth = inject(AuthService);
  protected readonly settings = inject(SiteSettingsService).settings;

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
  // qid -> how many times the student changed an already-made answer for
  // that question (the first pick never counts) — sent with the submit
  // payload purely as a ranked-stage-selection tie-break signal; never
  // shown to the student or used in scoring.
  protected readonly changes = signal<Record<number, number>>({});
  protected readonly blocked = signal(false);
  // Non-null only when the backend confirms this is a genuine resume (an
  // attempt that already existed) AND no local sessionStorage copy of
  // this exact attempt survived — i.e. a real disconnect (closed tab,
  // crashed browser, dead battery), not just an ordinary same-tab
  // refresh (which restoreProgress() below still handles seamlessly, no
  // prompt, exactly as before this feature existed). Set once in
  // ngOnInit(); continueResumed() clears it and applies the saved answers.
  protected readonly resumePrompt = signal<{ answeredCount: number } | null>(null);
  // First tab/window switch during a live exam warns; a second one submits
  // immediately — see onVisibilityChange().
  protected readonly tabWarned = signal(false);
  protected readonly tabWarningVisible = signal(false);
  // Mobile/tablet only — the palette sidebar becomes a bottom sheet
  // toggled by a floating button; see exam-ui.ts's media query.
  protected readonly paletteOpen = signal(false);

  protected readonly KEYS = KEYS;

  private timer?: ReturnType<typeof setInterval>;
  private blockedTimer?: ReturnType<typeof setTimeout>;
  private examCode = '';
  // Wall-clock ms when this exam attempt actually started, client-side —
  // used at submit() to compute a network-delay-independent elapsed time
  // (a slow connection can delay the submit REQUEST from arriving without
  // the student having taken any longer; ranked stage selection needs the
  // real "1st question to last question" duration, not receive-time).
  private examStartedAtMs = 0;

  // Two independent layers of resume, for two different failure modes:
  //  1. sessionStorage below — an ordinary same-tab refresh restores
  //     instantly with no prompt, exactly as before the server-side layer
  //     existed. sessionStorage (not localStorage) so it naturally clears
  //     when the tab closes rather than lingering on a shared computer.
  //  2. The backend (see saveProgress()/maybeSaveProgress() and
  //     startExam()'s savedAnswers) — a real disconnect (closed tab,
  //     crashed browser, dead battery, a different device) has nothing
  //     left in this browser's sessionStorage, so ngOnInit() falls back to
  //     whatever was last autosaved server-side and offers an explicit
  //     "Welcome back" resume prompt (see resumePrompt/continueResumed).
  private progressKey = '';
  // Populated by ngOnInit() when the server has real saved progress but
  // no sessionStorage copy survived on this browser — held here until
  // continueResumed() actually applies it, so the exam UI doesn't jump
  // straight into a mid-exam state before the student's had a chance to
  // see the "Welcome back" prompt.
  private pendingResume: { answers: ExamAnswerPayload[]; lastQuestionId: number | null } | null = null;
  // Rate-limits the network autosave — see saveProgressNow() and its call
  // sites (tick(), goto(), quit()). Not a correctness mechanism (a lost
  // autosave just means resume starts from an earlier point, never wrong
  // data), so a plain timestamp check is enough — no need for a proper
  // debounce/queue.
  private lastProgressSaveAt = 0;
  private static readonly PROGRESS_SAVE_INTERVAL_MS = 10_000;
  private readonly persistProgress = effect(() => {
    // Read every signal this effect should react to unconditionally,
    // before any early return — effect() only tracks reads that actually
    // happen, so a return above a read would silently stop tracking it.
    const snapshot = {
      current: this.current(),
      answers: this.answers(),
      qLeft: this.qLeft(),
      taken: this.taken(),
      lapsed: this.lapsed(),
      changes: this.changes(),
      examStartedAtMs: this.examStartedAtMs,
    };
    if (!this.progressKey) return;
    try {
      sessionStorage.setItem(this.progressKey, JSON.stringify(snapshot));
    } catch {
      // sessionStorage unavailable (private mode, quota) — resume just
      // won't have client-side answers to restore; the server-side fix
      // (same frozen questions + real remaining time) still holds.
    }
  });

  /** Restores answers/timing saved by persistProgress above, keyed to this
   * exact attempt — an ordinary same-tab refresh finds its own recent
   * mirror here and resumes instantly with no prompt, exactly as before
   * the server-side resume feature existed. Returns whether anything was
   * actually found, so ngOnInit() knows whether it still needs to fall
   * back to the server's own saved progress (see applyResumedProgress). */
  private restoreProgress(attemptCode: string): boolean {
    const key = `iml-exam-progress:${this.examCode}:${attemptCode}`;
    this.progressKey = key;
    let restored = false;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as {
          current?: number;
          answers?: Record<number, number[]>;
          qLeft?: Record<number, number>;
          taken?: Record<number, number>;
          lapsed?: number[];
          changes?: Record<number, number>;
          examStartedAtMs?: number;
        };
        if (saved.answers) this.answers.set(saved.answers);
        if (saved.qLeft) this.qLeft.set(saved.qLeft);
        if (saved.taken) this.taken.set(saved.taken);
        if (saved.lapsed) this.lapsed.set(saved.lapsed);
        if (saved.changes) this.changes.set(saved.changes);
        if (typeof saved.current === 'number') this.current.set(saved.current);
        if (saved.examStartedAtMs) this.examStartedAtMs = saved.examStartedAtMs;
        restored = true;
      }
    } catch {
      // corrupt/unavailable — nothing to restore, exam still starts fine.
    }
    return restored;
  }

  /** The server-side counterpart to restoreProgress() above — used when
   * NO local sessionStorage copy survived (a genuine disconnect: closed
   * tab, crashed browser, dead battery) but the backend confirms this
   * attempt already exists and has autosaved answers. Doesn't apply
   * anything immediately — stashes it for continueResumed() to apply
   * once the student has actually seen and dismissed the resume prompt. */
  private stagePendingResume(savedAnswers: ExamAnswerPayload[], lastQuestionId: number | null): void {
    this.pendingResume = { answers: savedAnswers, lastQuestionId };
    this.resumePrompt.set({ answeredCount: savedAnswers.filter((a) => Array.isArray(a.answer) && a.answer.length).length });
  }

  /** "Continue Exam →" on the resume prompt — applies whatever
   * stagePendingResume() stashed, exactly like a sessionStorage restore
   * would have, then lets the exam render normally. */
  protected continueResumed(): void {
    const pending = this.pendingResume;
    this.pendingResume = null;
    this.resumePrompt.set(null);
    if (!pending) return;
    const byId = new Map(this.questions().map((q) => [q.id, q]));
    const answers: Record<number, number[]> = {};
    const taken: Record<number, number> = {};
    const changes: Record<number, number> = {};
    const lapsed: number[] = [];
    const qLeft: Record<number, number> = {};
    for (const a of pending.answers) {
      const given = Array.isArray(a.answer) ? (a.answer as number[]) : [];
      if (given.length) answers[a.questionId] = given;
      if (typeof a.takenSecs === 'number') {
        taken[a.questionId] = a.takenSecs;
        // Only takenSecs (cumulative time already spent) is saved, not a
        // literal remaining-seconds figure — derive it the same way the
        // per-question timer itself is defined (limitFor() minus time
        // already spent) so it doesn't just silently reset to the full
        // limit for a question the student had already been sitting on.
        const q = byId.get(a.questionId);
        if (q) qLeft[a.questionId] = Math.max(0, this.limitFor(q) - a.takenSecs);
      }
      if (a.changeCount) changes[a.questionId] = a.changeCount;
      if (a.timeUp) lapsed.push(a.questionId);
    }
    this.answers.set(answers);
    this.taken.set(taken);
    this.changes.set(changes);
    this.lapsed.set(lapsed);
    this.qLeft.set(qLeft);
    if (pending.lastQuestionId != null) {
      const idx = this.questions().findIndex((q) => q.id === pending.lastQuestionId);
      if (idx >= 0) this.current.set(idx);
    }
  }

  /** Drops the saved progress once the attempt is actually finished
   * (submitted) — nothing left to resume, and submitExam() already
   * rejects a second submit on this attemptCode server-side regardless. */
  private clearProgress(): void {
    if (!this.progressKey) return;
    try {
      sessionStorage.removeItem(this.progressKey);
    } catch {
      // best-effort cleanup only
    }
    this.progressKey = '';
  }

  protected readonly questions = computed(() => this.attempt()?.questions ?? []);
  protected readonly total = computed(() => this.questions().length);

  // ---- Question Groups: header above each sub-question (purely visual; the
  // questions themselves, timers, answers and scoring work exactly as for singles) ----
  protected readonly collapsedGroups = signal<number[]>([]);
  protected readonly currentGroup = computed(() => {
    const gid = this.currentQuestion()?.groupId;
    return gid == null ? null : (this.attempt()?.groups ?? []).find((g) => g.id === gid) ?? null;
  });
  /** "Part n of k" among the group's sub-questions that were served. */
  protected readonly currentGroupPart = computed(() => {
    const q = this.currentQuestion();
    if (!q || q.groupId == null) return null;
    const members = this.questions().filter((x) => x.groupId === q.groupId);
    const n = members.findIndex((x) => x.id === q.id) + 1;
    return n > 0 ? { n, of: members.length } : null;
  });

  protected toggleGroup(id: number): void {
    this.collapsedGroups.update((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }
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
  // Trusts the backend's own verdict rather than recomputing percent vs.
  // passMark here — a capacity-limited stage's real outcome depends on
  // the whole cohort, not just this one score, so the backend already
  // sends null when it isn't decided yet (see StudentService.submitExam).
  protected readonly qualified = computed<boolean | null>(() => this.result()?.qualified ?? null);
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
        const secs = attempt.remainingSecs ?? (attempt.durationMin ?? 15) * 60;
        this.remaining.set(secs);
        const restoredLocally = this.restoreProgress(attempt.attemptCode);
        // Only reach for the server's saved progress when this browser
        // genuinely has nothing of its own — an ordinary same-tab refresh
        // already resumed instantly above, no prompt, exactly as before.
        // This is specifically the "real disconnect" case: closed tab,
        // crashed browser, dead battery, a different device entirely.
        if (!restoredLocally && attempt.resumed && attempt.savedAnswers?.length) {
          this.stagePendingResume(attempt.savedAnswers, attempt.lastQuestionId ?? null);
        }
        if (!this.examStartedAtMs) this.examStartedAtMs = Date.now();
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
    this.maybeSaveProgress();
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

  /** Fires the network autosave at most once every PROGRESS_SAVE_INTERVAL_MS
   * — called every second from tick() (so it's on a steady heartbeat with
   * no separate timer to manage) and once immediately from goto()/quit()
   * so navigating to a new question or exiting is always a checkpoint,
   * not just whatever the last heartbeat happened to catch. Silently
   * fire-and-forget: a lost autosave only means resume starts from an
   * earlier point, never wrong data — submitExam() is always the one
   * authoritative, fully-scored write regardless of what this saved. */
  private maybeSaveProgress(force = false): void {
    if (this.resumePrompt() || this.reviewing() || this.result() || !this.attempt()) return;
    const now = Date.now();
    if (!force && now - this.lastProgressSaveAt < AccountExamPage.PROGRESS_SAVE_INTERVAL_MS) return;
    this.lastProgressSaveAt = now;
    const attempt = this.attempt();
    if (!attempt) return;
    const ids = new Set<number>([...Object.keys(this.answers()).map(Number), ...this.lapsed()]);
    if (!ids.size && this.current() === 0) return; // nothing to save yet
    const answers: ExamAnswerPayload[] = Array.from(ids).map((qid) => ({
      questionId: qid,
      answer: this.answers()[qid] ?? [],
      takenSecs: this.taken()[qid] ?? 0,
      timeUp: this.lapsed().includes(qid),
      changeCount: this.changes()[qid] ?? 0,
    }));
    this.data
      .saveProgress(this.examCode, {
        attemptCode: attempt.attemptCode,
        answers,
        lastQuestionId: this.currentQuestion()?.id,
      })
      .subscribe({ error: () => {} });
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
    let next: number[];
    if (q.mode === 'multi') {
      next = current.includes(i) ? current.filter((x) => x !== i) : [...current, i].sort((a, b) => a - b);
    } else {
      next = [i];
    }
    // A change only counts once the question already had an answer that's
    // now different — the very first pick isn't a "reattempt".
    if (current.length && JSON.stringify(current) !== JSON.stringify(next)) {
      this.changes.set({ ...this.changes(), [q.id]: (this.changes()[q.id] ?? 0) + 1 });
    }
    this.answers.set({ ...this.answers(), [q.id]: next });
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
    this.maybeSaveProgress(true);
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

    // Union of answered + lapsed question ids — a lapsed question is never
    // in `answers()` (selectOption() refuses input once lapsed), so it must
    // be added explicitly or its timeUp flag never reaches the backend.
    const ids = new Set<number>([
      ...Object.keys(this.answers()).map(Number),
      ...this.lapsed(),
    ]);
    const payload = Array.from(ids).map((qid) => ({
      questionId: qid,
      answer: this.answers()[qid] ?? [],
      takenSecs: this.taken()[qid] ?? 0,
      timeUp: this.lapsed().includes(qid),
      changeCount: this.changes()[qid] ?? 0,
    }));
    // Measured client-side from when this attempt actually started to
    // right now, before the network request goes out — see
    // examStartedAtMs's comment for why this beats a server receive-time.
    const clientElapsedSecs = this.examStartedAtMs ? Math.round((Date.now() - this.examStartedAtMs) / 1000) : undefined;

    this.data
      .submitExam(this.examCode, { attemptCode: attempt.attemptCode, answers: payload, clientElapsedSecs })
      .subscribe({
      next: (res) => {
        if (this.timer) clearInterval(this.timer);
        this.remaining.set(0);
        this.result.set(res);
        this.reviewing.set(false);
        this.current.set(0);
        this.submitting.set(false);
        this.showResult.set(true);
        this.clearProgress();
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
    if (window.confirm('Exit the test? You can resume from where you left off, but the timer keeps running while you’re away.')) {
      this.maybeSaveProgress(true);
      this.router.navigate(['/account/schedules']);
    }
  }

  // Best-effort final save as the tab is actually closing/navigating away
  // outright (not the in-app Exit button above, which already saves and
  // gets a clean round-trip) — the one case none of tick()'s heartbeat or
  // goto()'s per-question checkpoint can catch, since the page won't be
  // around long enough for a normal request to complete. `fetch` with
  // `keepalive: true` (not sendBeacon — that can't carry a custom
  // Authorization header) is specced to keep running after the page
  // unloads, same guarantee sendBeacon makes, just with headers intact.
  @HostListener('window:beforeunload')
  protected onBeforeUnload(): void {
    if (this.resumePrompt() || this.reviewing() || this.result() || !this.attempt()) return;
    const attempt = this.attempt();
    if (!attempt) return;
    const token = this.auth.accessToken;
    if (!token) return;
    const ids = new Set<number>([...Object.keys(this.answers()).map(Number), ...this.lapsed()]);
    if (!ids.size) return;
    const answers: ExamAnswerPayload[] = Array.from(ids).map((qid) => ({
      questionId: qid,
      answer: this.answers()[qid] ?? [],
      takenSecs: this.taken()[qid] ?? 0,
      timeUp: this.lapsed().includes(qid),
      changeCount: this.changes()[qid] ?? 0,
    }));
    try {
      void fetch(`/api/v1/student/exams/${this.examCode}/progress`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ attemptCode: attempt.attemptCode, answers, lastQuestionId: this.currentQuestion()?.id }),
      });
    } catch {
      // best-effort only — the periodic heartbeat/checkpoint saves are
      // what resume actually relies on; this is just catching whatever
      // happened in the last few seconds before those.
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

  // Fires whenever the tab is hidden (switched away) or the whole browser
  // window loses OS focus — both cases flip document.hidden to true in
  // every modern browser, so a single listener covers "Tab + Window".
  //
  // Deliberately NOT using window.confirm()/alert() here: browsers refuse
  // to paint a blocking native dialog on a tab that isn't visible, so a
  // dialog triggered the moment the tab is hidden can silently never
  // appear at all (browser-dependent) — a real, observed failure, not a
  // theoretical one. A plain in-page overlay has no such restriction: it
  // renders into the DOM immediately regardless of visibility, so it's
  // simply *there*, guaranteed, the instant the student switches back.
  @HostListener('document:visibilitychange')
  protected onVisibilityChange(): void {
    if (!document.hidden) return;
    // Only police a live, in-progress exam — not the loading/error/result
    // states, and never during review (already stopped answering by then).
    if (this.loading() || this.error() || this.result() || !this.attempt()) return;
    if (this.reviewing()) return;
    if (!this.tabWarned()) {
      this.tabWarned.set(true);
      this.tabWarningVisible.set(true);
    } else {
      // No dialog needed here — submit() itself works fine on a hidden
      // tab (a plain HTTP call, not a paint), and the existing result
      // overlay already tells the student what happened the moment they
      // return, same reliability reasoning as above.
      this.submit();
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
