import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '@core/services/auth.service';
import { StudentDataService } from '../student-data.service';
import type {
  ExamView,
  MeProfile,
  RegistrationView,
} from '../student-data.service';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { AssessmentsDataService, type AssessmentSummary } from '../assessments/assessments-data.service';
import {
  countdownParts,
  formatDate,
  formatScore,
  formatTime,
  initialsOf,
  startsInMs,
} from '../format';
import {
  journeyProgressFor,
  journeyStepsFor,
  nextActionFor,
  type NextAction,
} from '../journey';

@Component({
  selector: 'app-account-dashboard',
  standalone: true,
  imports: [RouterLink, NgClass],
  template: `
    <div class="acc-main-wrap">
      @if (loading()) {
        <div class="loading">Loading your dashboard…</div>
      } @else {
        <!-- welcome -->
        <section class="welcome">
          <div>
            <div class="wel-eyebrow">PARTICIPANT DASHBOARD</div>
            <h2 class="wel-title">Welcome back, {{ firstName() }} &#128075;</h2>
            <p class="wel-sub">
              You are registered as <b style="color:#fff">{{ code() }}</b>
              @if (primaryCompetition()) {
                for <b style="color:#fff">{{ primaryCompetition()!.title }}</b>.
              }
              Track your schedule, results and payments from here.
            </p>
            <div class="wel-cta">
              <a routerLink="/account/schedules" class="btn btn-primary">View Schedules</a>
              <a routerLink="/demo-exam" class="btn btn-ghost">Try the Demo Exam</a>
              <a routerLink="/system-requirements" class="btn btn-ghost">System Requirements</a>
              <a routerLink="/account/help-desk" class="btn btn-ghost">Get Support</a>
            </div>
          </div>
          <div class="wel-side">
            <div class="exam-clock" [class.live]="nextExam()?.status === 'Live'">
              <span class="ec-label">
                @if (nextExam()) {
                  @if (nextExam()!.status === 'Live') {
                    <b>● LIVE</b> — {{ nextExam()!.title }}
                  } @else {
                    Next up: <b>{{ nextExam()!.title }}</b>
                  }
                } @else {
                  No upcoming exams scheduled
                }
              </span>
              @if (nextExam() && nextExam()!.status !== 'Live') {
                <span class="ec-digits">
                  <span class="ec-unit"><b>{{ cd().days }}</b><small>Days</small></span>
                  <span class="ec-sep">:</span>
                  <span class="ec-unit"><b>{{ cd().hours }}</b><small>Hrs</small></span>
                  <span class="ec-sep">:</span>
                  <span class="ec-unit"><b>{{ cd().mins }}</b><small>Min</small></span>
                  <span class="ec-sep">:</span>
                  <span class="ec-unit"><b>{{ cd().secs }}</b><small>Sec</small></span>
                </span>
              }
            </div>
          </div>
        </section>

        <!-- stats -->
        <section class="stat-grid">
          <div class="stat">
            <span class="stat-ic iq">&#128194;</span>
            <div><b>{{ stats().registrations }}</b><small>Registrations</small></div>
          </div>
          <div class="stat">
            <span class="stat-ic eq">&#128221;</span>
            <div><b>{{ stats().attempts }}</b><small>Attempts taken</small></div>
          </div>
          <div class="stat">
            <span class="stat-ic amber">&#127919;</span>
            <div><b>{{ stats().avgPercent }}%</b><small>Avg. score</small></div>
          </div>
          <div class="stat">
            <span class="stat-ic green">&#127942;</span>
            <div><b>{{ stats().unlockedStages }}</b><small>Stages unlocked</small></div>
          </div>
        </section>

        <section class="acc-grid">
          <!-- journey -->
          @if (primaryRegistration()) {
            <div class="card wide">
              <div class="card-head">
                <h3>My Journey — {{ primaryRegistration()!.competition.title }}</h3>
                <span class="tag" [ngClass]="compStatusClass(primaryRegistration()!.competition.status)">
                  {{ primaryRegistration()!.competition.status }}
                </span>
              </div>
              <div class="prog-track"><span class="prog-fill" [style.width.%]="journeyProgress()"></span></div>
              <div class="prog-steps">
                @for (step of journeySteps(); track step.name) {
                  <div class="ps" [class.done]="step.state === 'done'" [class.active]="step.state === 'active'" [class.elim]="step.sub === 'Eliminated'">
                    <span>{{ step.num }}</span>
                    {{ step.name }}
                    <small>{{ step.sub ?? stateLabel(step.state) }}</small>
                  </div>
                }
              </div>
              @if (nextAction()) {
                <div class="next-act" [class.na-pay]="nextAction()!.kind === 'pay'" [class.na-done]="nextAction()!.kind === 'done'">
                  <!-- real Unicode characters, not HTML entity strings — a
                       string literal like '&#128179;' inside a {{ }}
                       expression is set as plain text content (no entity
                       decoding), so it would show that literal text
                       instead of the 💳 glyph it's meant to be. -->
                  <span class="na-ic">{{ nextAction()!.kind === 'pay' ? '💳' : nextAction()!.kind === 'done' ? '🏆' : '✅' }}</span>
                  <div class="na-body">
                    <b>{{ nextAction()!.title }}</b>
                    <small>{{ nextAction()!.text }}</small>
                  </div>
                  @if (nextAction()!.href) {
                    <a class="btn btn-sm" [class.btn-gold-solid]="nextAction()!.kind === 'pay'" routerLink="{{ nextAction()!.href }}">{{ nextAction()!.cta }}</a>
                  }
                </div>
              }
            </div>
          }

          <!-- assessments: unscored reflections, separate from competition exams -->
          @if (assessments().length) {
            <div class="card wide">
              <div class="card-head">
                <h3>Assessments</h3>
                <a routerLink="/account/assessments" class="dl-go">View all</a>
              </div>
              <ul class="dlist">
                @for (a of assessments(); track a.slug) {
                  <li>
                    <span class="dl-ic iq">&#129504;</span>
                    <div>
                      <b>{{ a.title }}</b>
                      <small>{{ a.questionCount }} scenarios · about 8 minutes · not an exam, no marks</small>
                    </div>
                    <span class="tag" [class.tag-green]="a.completed" [class.tag-muted]="!a.completed">{{ a.completed ? 'Completed' : 'New' }}</span>
                    <a [routerLink]="['/account/assessments', a.slug]" class="btn btn-sm btn-primary">{{ a.completed ? 'View result →' : 'Start →' }}</a>
                  </li>
                }
              </ul>
            </div>
          }

          <!-- next exam -->
          <div class="card" [class.wide]="!primaryRegistration()">
            <div class="card-head">
              <h3>Upcoming Exams</h3>
              <a routerLink="/account/schedules" class="dl-go">View all</a>
            </div>
            @if (exams().length) {
              <ul class="dlist">
                @for (exam of exams().slice(0, 3); track exam.code) {
                  <li>
                    <span class="dl-ic" [class.green]="exam.status === 'Live'" [class.amber]="exam.status !== 'Live'">
                      &#128197;
                    </span>
                    <div>
                      <b>{{ exam.title }}</b>
                      <small>{{ exam.competitionTitle ?? '' }} · {{ formatDate(exam.date) }} @ {{ formatTime(exam.time) }}</small>
                    </div>
                    <span class="tag" [class.tag-green]="exam.status === 'Live'" [class.tag-muted]="exam.status !== 'Live'">
                      {{ exam.status }}
                    </span>
                    @if (exam.attemptCode) {
                      <a routerLink="/account/results/{{ exam.attemptCode }}" class="btn btn-sm btn-primary">View Result →</a>
                    } @else if (exam.status === 'Live') {
                      <a routerLink="/exam/{{ exam.code }}" class="btn btn-sm btn-primary">Start →</a>
                    }
                  </li>
                }
              </ul>
            } @else {
              <div class="empty"><div class="big">&#128197;</div><p>No exams scheduled yet. Check back soon.</p></div>
            }
          </div>

          <!-- recent attempts -->
          <div class="card" [class.wide]="!primaryRegistration()">
            <div class="card-head">
              <h3>Recent Results</h3>
              <a routerLink="/account/results" class="dl-go">View all</a>
            </div>
            @if (recentAttempts().length) {
              <ul class="dlist">
                @for (attempt of recentAttempts(); track attempt.code) {
                  <li class="dlist-li-link">
                    <a class="dlist-row" routerLink="/account/results/{{ attempt.code }}">
                      <span class="dl-ic iq">&#127891;</span>
                      <div>
                        <b>{{ attempt.stage?.name ?? 'Qualifier' }}</b>
                        <small>{{ attempt.competition.title }} · {{ formatDate(attempt.finishedAt) }}</small>
                      </div>
                      <span class="dl-go">{{ formatScore(attempt.score) }}/{{ formatScore(attempt.total) }}</span>
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <div class="empty"><div class="big">&#128221;</div><p>No attempts yet. Once you take a test, your scores will appear here.</p></div>
            }
          </div>
        </section>
      }
    </div>

    @if (showDemoModal()) {
      <div class="demo-backdrop" (click)="dismissDemoModal()">
        <div class="demo-modal" role="dialog" aria-label="Try the Demo Exam" (click)="$event.stopPropagation()">
          <div class="demo-modal-hero">🎉</div>
          <h2>Congratulations, {{ firstName() }}!</h2>
          <p class="demo-modal-lead">You're officially part of the India Mind League. Before your real exam day, try a short practice run so nothing catches you off guard.</p>

          <div class="demo-dos-donts">
            <div class="dd-col dd-do">
              <h4>&#9989; Do</h4>
              <ul>
                <li>Keep the exam tab open and full-screen the whole time</li>
                <li>Answer each question before its own timer runs out</li>
                <li>Use the question palette to jump between questions</li>
              </ul>
            </div>
            <div class="dd-col dd-dont">
              <h4>&#128683; Don't</h4>
              <ul>
                <li>Switch to another tab or window — one warning, then it auto-submits</li>
                <li>Refresh or close the page mid-exam</li>
                <li>Wait for a question's timer to lapse — it's marked unanswered</li>
              </ul>
            </div>
          </div>

          <div class="demo-modal-cta">
            <a class="btn btn-gold-solid btn-lg" routerLink="/demo-exam" (click)="dismissDemoModal()">Take the Demo Exam — See How It Works →</a>
            <button type="button" class="linkbtn" (click)="dismissDemoModal()">Maybe later</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    ACCOUNT_UI_CSS,
    `
      .acc-main-wrap { display: flex; flex-direction: column; gap: 1.4rem; }
      .welcome { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
        padding: clamp(1.4rem, 3vw, 2.2rem); border-radius: 26px; border: 1px solid var(--line-2); position: relative; overflow: hidden;
        background: radial-gradient(30rem 24rem at 90% 10%, rgba(124, 58, 237, 0.4), transparent 60%), linear-gradient(150deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)); }
      .wel-eyebrow { font-family: var(--display); font-weight: 700; font-size: 0.78rem; letter-spacing: 0.06em;
        background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
      .wel-title { font-family: var(--display); font-weight: 800; font-size: clamp(1.9rem, 4vw, 2.6rem); letter-spacing: -0.02em; margin: 0.3rem 0 0.4rem; }
      .wel-sub { color: var(--muted); font-size: 1rem; max-width: 50ch; line-height: 1.5; }
      .wel-cta { display: flex; gap: 0.7rem; margin-top: 1.3rem; flex-wrap: wrap; }
      .wel-side { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; }
      .exam-clock { display: inline-flex; flex-direction: column; gap: 0.5rem; margin-top: 1.3rem;
        padding: 0.9rem 1.2rem; border-radius: 16px; background: rgba(0, 0, 0, 0.28); border: 1px solid var(--line-2); }
      .exam-clock.live { border-color: rgba(52, 211, 153, 0.45); background: rgba(52, 211, 153, 0.1); }
      .ec-label { font-family: var(--display); font-weight: 600; font-size: 0.82rem; color: var(--muted); }
      .exam-clock.live .ec-label { color: #fff; }
      .exam-clock.live .ec-label b { color: var(--green); }
      .ec-digits { display: flex; align-items: flex-end; gap: 0.4rem; }
      .ec-unit { display: flex; flex-direction: column; align-items: center; min-width: 3rem;
        padding: 0.4rem 0.2rem; border-radius: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line); }
      .ec-unit b { font-family: var(--display); font-weight: 800; font-size: 1.6rem; line-height: 1; font-variant-numeric: tabular-nums;
        background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
      .ec-unit small { color: var(--faint); font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 0.2rem; }
      .ec-sep { font-family: var(--display); font-weight: 800; font-size: 1.4rem; color: var(--faint); padding-bottom: 0.8rem; }
      .prog-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.7rem; margin-top: 1.1rem; }
      .ps { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; text-align: center; padding: 0.8rem 0.4rem;
        border-radius: 14px; border: 1px solid var(--line); background: rgba(0, 0, 0, 0.2); font-family: var(--display); font-weight: 700; font-size: 0.86rem; color: var(--muted); }
      .ps span { font-size: 1.4rem; }
      .ps small { font-weight: 500; font-size: 0.72rem; color: var(--faint); font-family: "Archivo"; }
      .ps.done { border-color: rgba(52, 211, 153, 0.4); color: #fff; }
      .ps.done small { color: var(--green); }
      .ps.active { border-color: rgba(139, 92, 246, 0.55); background: rgba(124, 58, 237, 0.14); color: #fff; }
      .ps.active small { color: var(--violet-2); }
      .ps.elim { border-color: rgba(251, 113, 133, 0.4); }
      .ps.elim small { color: #fda4af; }
      .next-act { display: flex; align-items: center; gap: 0.8rem; margin-top: 1.1rem; padding: 0.85rem 1rem;
        border-radius: 14px; background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.35); }
      .next-act.na-pay { background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.4); }
      .next-act.na-done { background: rgba(124, 58, 237, 0.12); border-color: rgba(139, 92, 246, 0.45); }
      .na-ic { width: 40px; height: 40px; flex: 0 0 auto; display: grid; place-items: center; font-size: 1.15rem;
        border-radius: 11px; background: rgba(52, 211, 153, 0.16); border: 1px solid rgba(52, 211, 153, 0.45); }
      .na-pay .na-ic { background: rgba(251, 191, 36, 0.18); border-color: rgba(251, 191, 36, 0.5); }
      .na-done .na-ic { background: rgba(139, 92, 246, 0.2); border-color: rgba(139, 92, 246, 0.55); }
      .na-body { flex: 1; min-width: 0; }
      .na-body b { display: block; font-family: var(--display); font-weight: 700; font-size: 0.92rem; color: #fff; }
      .na-body small { color: var(--muted); font-size: 0.8rem; line-height: 1.45; display: block; margin-top: 0.15rem; }
      .next-act .btn { flex: 0 0 auto; white-space: nowrap; }
      @media (max-width: 640px) {
        .next-act { flex-wrap: wrap; }
        .next-act .btn { width: 100%; }
      }
      @media (max-width: 820px) {
        .welcome { flex-direction: column; align-items: stretch; }
        .wel-side { width: 100%; align-items: stretch; }
        .wel-side .exam-clock { width: 100%; }
        .prog-steps { grid-template-columns: repeat(2, 1fr); }
      }
      .demo-backdrop { position: fixed; inset: 0; background: rgba(5, 5, 12, 0.72); backdrop-filter: blur(4px);
        display: grid; place-items: center; z-index: 200; padding: 1.2rem; }
      .demo-modal { background: linear-gradient(180deg, var(--surface-2), var(--surface)); border: 1px solid var(--line-2);
        border-radius: 24px; padding: clamp(1.6rem, 4vw, 2.4rem); max-width: 560px; width: 100%; box-shadow: var(--shadow), var(--glow);
        text-align: center; max-height: 90vh; overflow-y: auto; }
      .demo-modal-hero { font-size: 2.8rem; line-height: 1; margin-bottom: 0.6rem; }
      .demo-modal h2 { font-family: var(--display); font-weight: 800; font-size: 1.6rem; margin-bottom: 0.6rem; }
      .demo-modal-lead { color: var(--muted); line-height: 1.6; max-width: 46ch; margin: 0 auto 1.4rem; }
      .demo-dos-donts { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: left; margin-bottom: 1.6rem; }
      .dd-col { border-radius: 14px; padding: 1rem 1.1rem; border: 1px solid var(--line); background: rgba(0, 0, 0, 0.2); }
      .dd-do { border-color: rgba(52, 211, 153, 0.35); background: rgba(52, 211, 153, 0.06); }
      .dd-dont { border-color: rgba(251, 113, 133, 0.35); background: rgba(251, 113, 133, 0.06); }
      .dd-col h4 { font-family: var(--display); font-weight: 700; font-size: 0.88rem; margin-bottom: 0.6rem; }
      .dd-col ul { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.45rem; }
      .dd-col li { font-size: 0.84rem; color: var(--muted); line-height: 1.45; }
      .demo-modal-cta { display: flex; flex-direction: column; align-items: center; gap: 0.7rem; }
      .demo-modal-cta .btn { width: 100%; }
      @media (max-width: 560px) {
        .demo-dos-donts { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class AccountDashboardPage implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly data = inject(StudentDataService);
  private readonly assessmentsData = inject(AssessmentsDataService);
  protected readonly loading = signal(true);
  protected readonly profile = signal<MeProfile | null>(null);
  protected readonly exams = signal<ExamView[]>([]);
  protected readonly assessments = signal<AssessmentSummary[]>([]);
  protected readonly cd = signal({ days: '00', hours: '00', mins: '00', secs: '00' });
  // Shown once, the very first dashboard load after registration — see
  // markDemoPromptSeen(). A permanent "Try the Demo Exam" button in the
  // welcome CTA row stays available regardless.
  protected readonly showDemoModal = signal(false);

  private tick?: ReturnType<typeof setInterval>;

  protected readonly firstName = computed(() => {
    const name = this.auth.user()?.name;
    return (name ?? '').split(/\s+/)[0] || 'Student';
  });

  protected readonly code = computed(() => this.profile()?.code ?? '—');

  protected readonly primaryRegistration = computed<RegistrationView | null>(() => {
    const regs = this.profile()?.registrations ?? [];
    return regs.length ? regs[0] : null;
  });

  protected readonly primaryCompetition = computed(() => this.primaryRegistration()?.competition ?? null);

  protected readonly stats = computed(() => {
    const profile = this.profile();
    const regs = profile?.registrations ?? [];
    let attempts = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    let unlockedStages = 0;
    for (const reg of regs) {
      attempts += reg.attempts.length;
      for (const a of reg.attempts) {
        scoreSum += formatScore(a.score);
        scoreCount += 1;
      }
      for (const rs of reg.stages) {
        if (rs.status !== 'Locked') unlockedStages += 1;
      }
    }
    const avgPercent = scoreCount
      ? Math.round(scoreSum / scoreCount)
      : 0;
    return {
      registrations: regs.length,
      attempts,
      avgPercent,
      unlockedStages,
    };
  });

  protected readonly recentAttempts = computed(() => {
    const profile = this.profile();
    const list: (RegistrationView['attempts'][number] & { competition: RegistrationView['competition'] })[] = [];
    for (const reg of profile?.registrations ?? []) {
      for (const a of reg.attempts) list.push({ ...a, competition: reg.competition });
    }
    return list
      .sort((a, b) => new Date(b.finishedAt ?? b.startedAt).getTime() - new Date(a.finishedAt ?? a.startedAt).getTime())
      .slice(0, 3);
  });

  protected readonly journeySteps = computed(() => {
    const reg = this.primaryRegistration();
    return reg ? journeyStepsFor(reg) : [];
  });

  protected readonly journeyProgress = computed(() => {
    const reg = this.primaryRegistration();
    return reg ? journeyProgressFor(reg) : 0;
  });

  protected readonly nextAction = computed<NextAction | null>(() => {
    const reg = this.primaryRegistration();
    return reg ? nextActionFor(reg) : null;
  });

  protected readonly nextExam = computed(() => {
    const upcoming = this.exams().filter((e) => e.status !== 'Closed');
    upcoming.sort((a, b) => (startsInMs(a.date, a.time) ?? Infinity) - (startsInMs(b.date, b.time) ?? Infinity));
    return upcoming[0] ?? null;
  });

  ngOnInit(): void {
    this.load();
    this.tick = setInterval(() => {
      const exam = this.nextExam();
      if (exam && exam.status !== 'Live') {
        const ms = startsInMs(exam.date, exam.time);
        if (ms !== null) this.cd.set(countdownParts(ms));
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.tick) clearInterval(this.tick);
  }

  private load(): void {
    // Assessments are optional extras: a failure here must never block the dashboard.
    this.assessmentsData.list().subscribe({ next: (r) => this.assessments.set(r), error: () => this.assessments.set([]) });
    this.data.me().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.showDemoModal.set(!profile.demoPromptSeen);
        this.data.schedules().subscribe({
          next: (exams) => {
            this.exams.set(exams);
            this.loading.set(false);
          },
          error: () => {
            this.exams.set([]);
            this.loading.set(false);
          },
        });
      },
      error: () => this.loading.set(false),
    });
  }

  /** Fires on both the CTA click and the backdrop/"Maybe later" dismiss —
   * either way this is a one-time prompt, never shown again. */
  protected dismissDemoModal(): void {
    if (!this.showDemoModal()) return;
    this.showDemoModal.set(false);
    this.data.markDemoPromptSeen().subscribe({ error: () => {} });
  }

  protected formatDate = formatDate;
  protected formatTime = formatTime;
  protected formatScore = formatScore;

  protected compStatusClass(status: string): string {
    const map: Record<string, string> = {
      Live: 'tag-green',
      Open: 'tag-blue',
      Draft: 'tag-muted',
      Closed: 'tag-muted',
    };
    return map[status] ?? 'tag-muted';
  }

  protected stateLabel(state: 'done' | 'active' | 'locked'): string {
    return state === 'done' ? 'Cleared' : state === 'active' ? 'Current' : 'Locked';
  }

  protected avatar(name?: string | null): string {
    return initialsOf(name);
  }
}
