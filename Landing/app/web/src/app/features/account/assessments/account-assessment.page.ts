import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { AssessmentPlayer, AssessmentResult, AssessmentsDataService } from './assessments-data.service';

type Stage = 'loading' | 'intro' | 'question' | 'submitting' | 'result' | 'error';

function errText(e: unknown): string {
  const m = (e as { error?: { message?: string | string[] } })?.error?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
  return m ?? 'Something went wrong. Please try again.';
}

@Component({
  selector: 'app-account-assessment',
  standalone: true,
  imports: [RouterLink],
  template: `
    @switch (stage()) {
      @case ('loading') {
        <div class="loading">Loading…</div>
      }
      @case ('error') {
        <div class="empty">
          <div class="big">&#9888;&#65039;</div>
          <p>{{ error() }}</p>
          <a class="btn btn-primary" routerLink="/account/assessments">Back to assessments</a>
        </div>
      }

      @case ('intro') {
        @if (player(); as p) {
          <div class="acc-head">
            <div>
              <div class="acc-eyebrow">Free reflection</div>
              <h1 class="acc-title">{{ p.title }}</h1>
              @if (p.summary) {
                <p class="acc-sub">{{ p.summary }}</p>
              }
            </div>
          </div>

          <div class="as-caps">
            @for (c of p.capacities; track c.label) {
              <div class="card">
                <b class="as-cap-name">{{ c.label }}</b>
                <p class="as-cap-intro">{{ c.intro }}</p>
              </div>
            }
          </div>

          <div class="card as-note">
            <p><b>{{ p.items.length }} scenarios · about 8 minutes · no timer.</b> Choose what you would most likely do, not what sounds ideal. You can go back and change earlier answers.</p>
            @if (p.consent) {
              <p class="as-consent">{{ p.consent }}</p>
            }
            <p class="as-disclaimer">{{ p.disclaimer }}</p>
            <div class="as-actions">
              <button class="btn btn-primary" (click)="begin()">Start my assessment →</button>
              <a class="btn btn-ghost" routerLink="/account/assessments">Back</a>
            </div>
          </div>
        }
      }

      @case ('question') {
        @if (current(); as q) {
          <div class="as-wrap">
            <div class="acc-eyebrow">Your mind in action</div>
            <p class="as-count">Scenario {{ index() + 1 }} of {{ total() }}</p>
            <div class="as-progress" role="progressbar" [attr.aria-valuenow]="index()" aria-valuemin="0" [attr.aria-valuemax]="total()">
              <i [style.width.%]="(index() / total()) * 100"></i>
            </div>

            <section class="card as-q">
              <h2 class="as-prompt">{{ q.prompt }}</h2>
              <small class="as-hint">Choose the response closest to what you would actually do.</small>
              <div role="radiogroup" [attr.aria-label]="'Scenario ' + (index() + 1)">
                @for (o of q.options; track o.token) {
                  <label class="as-option" [class.on]="chosen() === o.token">
                    <input type="radio" name="answer" [value]="o.token" [checked]="chosen() === o.token" (change)="choose(o.token)" />
                    <span>{{ o.text }}</span>
                  </label>
                }
              </div>
              @if (submitError()) {
                <div class="as-err">{{ submitError() }}</div>
              }
              <div class="as-actions">
                <button class="btn btn-ghost" [disabled]="index() === 0" (click)="back()">Back</button>
                <button class="btn btn-primary" [disabled]="!chosen()" (click)="next()">
                  {{ index() === total() - 1 ? 'See my reflection' : 'Next scenario →' }}
                </button>
              </div>
            </section>
            <p class="as-foot">There is no timer. You can revisit and change earlier answers.</p>
          </div>
        }
      }

      @case ('submitting') {
        <div class="loading">Working out your reflection…</div>
      }

      @case ('result') {
        @if (result(); as r) {
          <div class="as-result">
            <div class="acc-head">
              <div>
                <div class="acc-eyebrow">Your future-ready reflection</div>
                <h1 class="acc-title">Four capacities. Room to grow in each.</h1>
                <p class="acc-sub">
                  Your most developed choices in this check: <b>{{ r.strongest.join(' & ') }}</b>.
                  This is a snapshot of your selected responses, not a permanent label.
                </p>
              </div>
            </div>

            <div class="as-dims">
              @for (d of r.dimensions; track d.key) {
                <article class="card as-dim">
                  <b class="as-cap-name">{{ d.label }}</b>
                  <div class="as-score">{{ d.score }}<small> / {{ d.max }}</small></div>
                  <div class="as-bar"><i [style.width.%]="d.percent"></i></div>
                  <span class="tag">{{ d.band }}</span>
                  <p>{{ d.summary }}</p>
                </article>
              }
            </div>

            <section class="card as-practice">
              <div class="acc-eyebrow">Your 7-day practice</div>
              <h2 class="as-prompt">Make one small behaviour a habit.</h2>
              @for (p of r.practice; track p.label) {
                <p><b>{{ p.label }}:</b> {{ p.text }}</p>
              }
              <p>Try this in one real situation each day. At the end of the week, write: What happened? What did I choose? What will I change next time?</p>
            </section>

            <details class="as-how">
              <summary>How is this reflection scored?</summary>
              <p>{{ r.howScored }}</p>
            </details>

            <div class="as-actions as-noprint">
              <button class="btn btn-primary" (click)="print()">Print / save my reflection</button>
              <a class="btn btn-ghost" routerLink="/account/assessments">Back to assessments</a>
            </div>

            <p class="as-foot">{{ r.disclaimer }}</p>
            <p class="as-foot as-noprint">
              {{ r.saved ? 'This result is saved to your IML account.' : 'This result is shown on this screen only and is not saved.' }}
            </p>
          </div>
        }
      }
    }
  `,
  styles: [
    ACCOUNT_UI_CSS,
    `
      .as-wrap { max-width: 760px; margin: 0 auto; }
      .as-caps { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); margin-bottom: 1.1rem; }
      .as-cap-name { font-family: var(--display); letter-spacing: 0.08em; color: var(--gold); }
      .as-cap-intro { color: var(--muted); font-size: 0.9rem; margin: 0.4rem 0 0; }
      .as-note p { margin: 0 0 0.8rem; }
      .as-consent { color: var(--muted); font-size: 0.88rem; border-left: 3px solid var(--gold); padding-left: 0.8rem; }
      .as-disclaimer { color: var(--faint); font-size: 0.82rem; }
      .as-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 1.1rem; }
      .as-count { color: var(--faint); margin: 0.3rem 0 0; }
      .as-progress { height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 5px; margin: 0.7rem 0 1.3rem; overflow: hidden; }
      .as-progress i { display: block; height: 100%; background: var(--gold); border-radius: 5px; transition: width 0.25s; }
      .as-q { padding: 1.6rem; }
      .as-prompt { font-family: var(--display); font-size: clamp(1.15rem, 2.6vw, 1.5rem); line-height: 1.35; margin: 0 0 0.5rem; }
      .as-hint { color: var(--faint); display: block; margin-bottom: 0.9rem; }
      .as-option {
        display: flex; gap: 0.8rem; align-items: flex-start; padding: 0.95rem 1rem; margin: 0.6rem 0;
        border: 1px solid var(--line-2); border-radius: 12px; cursor: pointer; line-height: 1.45;
      }
      .as-option:hover { border-color: rgba(232, 182, 74, 0.5); }
      .as-option.on { border-color: var(--gold); background: rgba(232, 182, 74, 0.1); }
      /* The account area styles every input as a full-width form field; a
         radio must opt out of that or it stretches across the option row. */
      .as-option input[type='radio'] {
        width: 1.15rem; height: 1.15rem; min-width: 1.15rem; display: inline-block; padding: 0;
        margin: 0.2rem 0 0; background: transparent; flex: 0 0 auto; accent-color: var(--gold);
      }
      .as-option span { flex: 1 1 auto; min-width: 0; }
      .as-option:focus-within { outline: 2px solid var(--gold); outline-offset: 2px; }
      .as-err { margin-top: 0.8rem; color: #fecdd3; background: rgba(251, 113, 133, 0.12); border: 1px solid rgba(251, 113, 133, 0.4); padding: 0.6rem 0.8rem; border-radius: 10px; font-size: 0.88rem; }
      .as-foot { color: var(--faint); font-size: 0.82rem; margin-top: 1rem; max-width: 75ch; }
      .as-dims { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); margin: 1.2rem 0; }
      .as-dim p { color: var(--muted); font-size: 0.9rem; margin: 0.7rem 0 0; }
      .as-score { font-family: var(--display); font-size: 2.2rem; line-height: 1.1; margin: 0.3rem 0; }
      .as-score small { font-size: 0.9rem; color: var(--faint); }
      .as-bar { height: 8px; background: rgba(255, 255, 255, 0.08); border-radius: 5px; margin: 0.6rem 0 0.8rem; overflow: hidden; }
      .as-bar i { display: block; height: 100%; background: var(--gold); border-radius: 5px; }
      .as-practice { margin-bottom: 1rem; }
      .as-how { margin: 1rem 0; color: var(--muted); }
      .as-how summary { cursor: pointer; font-weight: 600; }

      @media print {
        .as-noprint { display: none !important; }
        .as-result, .as-result * { color: #111 !important; background: transparent !important; border-color: #bbb !important; box-shadow: none !important; }
        .as-bar { background: #e5e5e5 !important; }
        .as-bar i { background: #8a6a2b !important; }
        .as-dim { break-inside: avoid; }
      }
    `,
  ],
})
export class AccountAssessmentPage implements OnInit, OnDestroy {
  private readonly data = inject(AssessmentsDataService);
  private readonly route = inject(ActivatedRoute);

  protected readonly stage = signal<Stage>('loading');
  protected readonly error = signal('');
  protected readonly submitError = signal('');
  protected readonly player = signal<AssessmentPlayer | null>(null);
  protected readonly result = signal<AssessmentResult | null>(null);
  protected readonly index = signal(0);
  protected readonly answers = signal<(string | null)[]>([]);

  protected readonly total = computed(() => this.player()?.items.length ?? 0);
  protected readonly current = computed(() => this.player()?.items[this.index()] ?? null);
  protected readonly chosen = computed(() => this.answers()[this.index()] ?? null);

  private slug = '';

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    // An assessment can be taken once: if there is already a saved result,
    // show it read-only instead of the questions.
    this.data.latestResult(this.slug).subscribe({
      next: (r) => this.showResult(r),
      error: () => this.loadPlayer(), // nothing saved yet (or not available) — go to the intro
    });
  }

  ngOnDestroy(): void {
    document.body.classList.remove('as-print');
  }

  private loadPlayer(done?: () => void): void {
    this.stage.set('loading');
    this.data.get(this.slug).subscribe({
      next: (p) => {
        this.player.set(p);
        this.answers.set(p.items.map(() => null));
        this.index.set(0);
        this.stage.set('intro');
        done?.();
      },
      error: (e) => {
        this.error.set(errText(e));
        this.stage.set('error');
      },
    });
  }

  private showResult(r: AssessmentResult): void {
    this.result.set(r);
    this.stage.set('result');
    document.body.classList.add('as-print');
    window.scrollTo(0, 0);
  }

  protected begin(): void {
    this.index.set(0);
    this.submitError.set('');
    this.stage.set('question');
    window.scrollTo(0, 0);
  }

  protected choose(token: string): void {
    this.answers.update((a) => a.map((v, i) => (i === this.index() ? token : v)));
  }

  protected back(): void {
    if (this.index() > 0) this.index.update((i) => i - 1);
  }

  protected next(): void {
    if (!this.chosen()) return;
    if (this.index() < this.total() - 1) {
      this.index.update((i) => i + 1);
      window.scrollTo(0, 0);
      return;
    }
    this.submit();
  }

  private submit(): void {
    const p = this.player();
    if (!p) return;
    const answers = p.items.map((item, i) => ({ questionId: item.id, option: this.answers()[i] ?? '' }));
    if (answers.some((a) => !a.option)) {
      this.submitError.set('Please answer every scenario first.');
      return;
    }
    this.submitError.set('');
    this.stage.set('submitting');
    this.data.submit(this.slug, answers).subscribe({
      next: (r) => this.showResult(r),
      error: (e) => {
        if ((e as { status?: number })?.status === 409) {
          this.data.latestResult(this.slug).subscribe({
            next: (r) => this.showResult(r),
            error: () => {
              this.error.set(errText(e));
              this.stage.set('error');
            },
          });
          return;
        }
        this.submitError.set(errText(e));
        this.stage.set('question');
      },
    });
  }

  protected print(): void {
    window.print();
  }
}
