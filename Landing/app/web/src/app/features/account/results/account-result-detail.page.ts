import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StudentDataService } from '../student-data.service';
import type { ResultDetail, ResultQuestion } from '../student-data.service';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { formatDateTime } from '../format';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const LEVEL_LABEL: Record<string, string> = { IQ: 'IQ', EQ: 'EQ', Values: 'LQ' };
const LEVEL_ICON: Record<string, string> = { IQ: '&#129504;', EQ: '&#128156;', Values: '&#127793;' };

function levelFor(percent: number, total: number): string {
  if (!total) return '—';
  if (percent >= 85) return 'Expert';
  if (percent >= 70) return 'Advanced';
  if (percent >= 50) return 'Proficient';
  if (percent >= 30) return 'Developing';
  return 'Novice';
}

@Component({
  selector: 'app-account-result-detail',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="acc-head">
      <div>
        <div class="acc-eyebrow"><a routerLink="/account/results" class="rd-back">&#8592; Results</a></div>
        <h1 class="acc-title">{{ detail()?.stage ?? 'Qualifier' }}</h1>
        <p class="acc-sub">{{ detail()?.competition }} &middot; Attempt <span class="mono">{{ detail()?.code }}</span> &middot; {{ detail()?.finishedAt ? formatDateTime(detail()!.finishedAt) : '' }}</p>
      </div>
      @if (detail()?.certificateNumber) {
        <a class="btn btn-gold" [href]="certificateUrl()" target="_blank" rel="noopener">Download Certificate (PDF)</a>
      } @else if (detail()?.finishedAt && detail()?.certificateMode === 'MANUAL') {
        <div class="rd-cert-pending">
          <small class="rd-cert-err">Certificates for this competition are issued by the administration team once your result has been finalised.</small>
        </div>
      } @else if (detail()?.finishedAt) {
        <!-- Certificates are normally issued automatically a few seconds
             after submitting — this manual fallback covers the case where
             that queue is still catching up (e.g. paused while another
             exam window is open) so a student isn't stuck waiting. -->
        <div class="rd-cert-pending">
          <button type="button" class="btn btn-gold" [disabled]="generating()" (click)="generateCertificate()">
            {{ generating() ? 'Generating…' : 'Generate Certificate' }}
          </button>
          @if (certError()) {
            <small class="rd-cert-err">{{ certError() }}</small>
          }
        </div>
      }
    </div>

    @if (loading()) {
      <div class="loading">Loading result…</div>
    } @else if (detail()) {
      <div class="rd-summary">
        <div class="rd-ring" [style.--p]="detail()?.percent">
          <div class="rd-ring-in"><b>{{ detail()?.scoreDisplay }}</b><small>Result</small></div>
        </div>
        <div class="rd-meta">
          @if (detail()?.scoringMode === 'FRACTION') {
            <div class="rd-stat"><b>{{ detail()?.score }} / {{ detail()?.total }}</b><small>Correct answers</small></div>
          }
          <div class="rd-stat"><b>{{ detail()?.passMark }}%</b><small>Pass mark</small></div>
          <div class="rd-stat"><b>{{ attempted() }} / {{ detail()?.total }}</b><small>Attempted</small></div>
          <div class="rd-stat">
            @if (detail()?.qualified === true) {
              <span class="tag tag-green" style="margin-top:0.35rem">Qualified</span>
            } @else if (detail()?.qualified === false) {
              <span class="tag tag-red" style="margin-top:0.35rem">Not qualified</span>
            } @else {
              <span class="tag" style="margin-top:0.35rem">Pending</span>
            }
          </div>
        </div>
      </div>

      <h2 class="rd-sec">Your Profile</h2>
      <div class="rd-levels">
        @for (cat of levels(); track cat.name) {
          <div class="rd-level" [class]="cat.css">
            <div class="rl-top">
              <span class="rl-ic" [innerHTML]="cat.icon"></span>
              <div class="rl-name">
                <b>{{ cat.label }}</b>
                <small>{{ cat.correct }}/{{ cat.total }} correct</small>
              </div>
              <span class="rl-tag">{{ cat.level }}</span>
            </div>
            <div class="rl-bar"><span [style.width.%]="cat.percent"></span></div>
            <div class="rl-bottom"><b>{{ cat.percent }}%</b><small>in {{ cat.name }}</small></div>
          </div>
        }
      </div>

      @if (detail()?.showQuestionHistory) {
        <h2 class="rd-sec">Question History</h2>
        <div class="rd-list">
          @for (q of questions(); track $index; let i = $index) {
            @if (q.groupTitle && (i === 0 || questions()[i - 1].groupCode !== q.groupCode)) {
              <div class="rd-group">&#9638; Question group: <b>{{ q.groupTitle }}</b></div>
            }
            <div class="rd-q" [class.q-wrong]="!q.isCorrect" [class.in-group]="!!q.groupTitle">
              <div class="rdq-top">
                <span class="q-cat" [class]="catClass(q.category)">{{ q.category }}</span>
                <span class="rdq-num">Q{{ i + 1 }}</span>
                <span class="rdq-verdict" [class.v-ok]="q.isCorrect" [class.v-no]="!q.isCorrect">{{ q.isCorrect ? 'Correct' : q.given.length ? 'Incorrect' : 'Not answered' }}</span>
                @if (q.takenSecs != null) {
                  <span class="rdq-secs">&#9201; {{ q.takenSecs }}s</span>
                }
              </div>
              <p class="rdq-text">{{ q.prompt }}</p>
              <div class="rdq-opts">
                @for (opt of q.options; track $index; let oi = $index) {
                  <div class="rdq-opt"
                    [class.good]="q.correct.includes(oi)"
                    [class.bad]="q.given.includes(oi) && !q.correct.includes(oi)"
                    [class.given]="q.given.includes(oi)">
                    <span class="key">{{ KEYS[oi] }}</span>
                    <span class="ot">{{ opt }}</span>
                    @if (q.correct.includes(oi)) {
                      <span class="mark m-ok">&#10003;</span>
                    } @else if (q.given.includes(oi)) {
                      <span class="mark m-no">&#10005;</span>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <p class="hint" style="margin-top:0.5rem">Question-by-question review isn't available for this result.</p>
      }
    } @else {
      <div class="empty">
        <div class="big">&#128221;</div>
        <h3>Result not found</h3>
        <p>We could not find that attempt.</p>
      </div>
    }
  `,
  styles: [
    ACCOUNT_UI_CSS,
    `
    .rd-back { color: var(--violet-2); text-decoration: none; font-weight: 600; }
    .rd-back:hover { text-decoration: underline; }
    .rd-cert-pending { display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem; }
    .rd-cert-err { color: #fda4af; max-width: 220px; text-align: right; }
    .rd-summary {
      display: flex; align-items: center; gap: 1.6rem; padding: 1.4rem 1.6rem; margin-bottom: 1.4rem;
      background: var(--surface); border: 1px solid var(--line); border-radius: 18px; flex-wrap: wrap;
    }
    .rd-ring { position: relative; width: 128px; height: 128px; border-radius: 50%; display: grid; place-items: center; flex: 0 0 auto;
      background: conic-gradient(var(--violet) calc(var(--p, 0) * 1%), rgba(255, 255, 255, 0.08) 0); }
    .rd-ring::before { content: ""; position: absolute; width: 102px; height: 102px; border-radius: 50%; background: #0c0a20; }
    .rd-ring-in { position: relative; z-index: 1; text-align: center; }
    .rd-ring-in b { display: block; font-family: var(--display); font-weight: 800; font-size: 1.9rem; line-height: 1; }
    .rd-ring-in small { color: var(--muted); font-size: 0.74rem; }
    .rd-meta { flex: 1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.8rem; min-width: 280px; }
    .rd-stat { text-align: center; background: rgba(0, 0, 0, 0.22); border: 1px solid var(--line); border-radius: 12px; padding: 0.8rem 0.5rem; }
    .rd-stat b { display: block; font-family: var(--display); font-weight: 800; font-size: 1.15rem; }
    .rd-stat small { color: var(--muted); font-size: 0.72rem; }
    .rd-sec { font-family: var(--display); font-weight: 700; font-size: 1.05rem; margin: 1.6rem 0 0.8rem; }

    .rd-levels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem; }
    .rd-level { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 1rem; }
    .rd-level.iq { border-color: rgba(59, 130, 246, 0.35); }
    .rd-level.eq { border-color: rgba(236, 72, 153, 0.35); }
    .rd-level.val { border-color: rgba(139, 92, 246, 0.35); }
    .rl-top { display: flex; align-items: center; gap: 0.6rem; }
    .rl-ic { font-size: 1.5rem; flex: 0 0 auto; }
    .rl-name { flex: 1; min-width: 0; }
    .rl-name b { font-family: var(--display); font-weight: 800; font-size: 1.05rem; display: block; }
    .rl-name small { color: var(--muted); font-size: 0.72rem; }
    .rl-tag { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 0.2rem 0.55rem; border-radius: 999px;
      background: rgba(124, 58, 237, 0.16); border: 1px solid rgba(139, 92, 246, 0.4); color: var(--violet-2); white-space: nowrap; }
    .rd-level.iq .rl-tag { background: rgba(59, 130, 246, 0.16); border-color: rgba(59, 130, 246, 0.4); color: #93c5fd; }
    .rd-level.eq .rl-tag { background: rgba(236, 72, 153, 0.16); border-color: rgba(236, 72, 153, 0.4); color: #f9a8d4; }
    .rl-bar { height: 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); margin: 0.8rem 0 0.5rem; overflow: hidden; }
    .rl-bar span { display: block; height: 100%; border-radius: 999px; background: var(--grad); }
    .rd-level.iq .rl-bar span { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
    .rd-level.eq .rl-bar span { background: linear-gradient(90deg, #ec4899, #f472b6); }
    .rl-bottom { display: flex; justify-content: space-between; align-items: baseline; }
    .rl-bottom b { font-family: var(--display); font-weight: 800; }
    .rl-bottom small { color: var(--muted); font-size: 0.72rem; }

    .rd-list { display: grid; gap: 0.9rem; }
    .rd-q { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 1.1rem 1.2rem; }
    .rd-q.q-wrong { border-color: rgba(251, 113, 133, 0.3); }
    .rd-q.in-group { border-left: 3px solid var(--gold); }
    .rd-group { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--gold); margin: 0.5rem 0 -0.3rem; }
    .rdq-top { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .q-cat { font-family: var(--display); font-weight: 700; font-size: 0.64rem; letter-spacing: 0.1em; text-transform: uppercase;
      padding: 0.24rem 0.55rem; border-radius: 999px; background: rgba(124, 58, 237, 0.2); border: 1px solid rgba(139, 92, 246, 0.45); color: var(--violet-2); }
    .q-cat.iq { background: rgba(59, 130, 246, 0.18); border-color: rgba(59, 130, 246, 0.45); color: #93c5fd; }
    .q-cat.eq { background: rgba(236, 72, 153, 0.18); border-color: rgba(236, 72, 153, 0.45); color: #f9a8d4; }
    .rdq-num { color: var(--muted); font-weight: 600; font-size: 0.8rem; }
    .rdq-verdict { margin-left: auto; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 0.2rem 0.55rem; border-radius: 999px; }
    .rdq-verdict.v-ok { background: rgba(52, 211, 153, 0.14); border: 1px solid rgba(52, 211, 153, 0.4); color: #6ee7b7; }
    .rdq-verdict.v-no { background: rgba(251, 113, 133, 0.14); border: 1px solid rgba(251, 113, 133, 0.4); color: #fda4af; }
    .rdq-secs { color: var(--muted); font-size: 0.74rem; font-variant-numeric: tabular-nums; }
    .rdq-text { font-family: var(--display); font-weight: 600; font-size: 1.02rem; line-height: 1.4; margin: 0.7rem 0; }
    .rdq-opts { display: grid; gap: 0.5rem; }
    .rdq-opt { display: flex; align-items: center; gap: 0.7rem; padding: 0.55rem 0.8rem; border-radius: 11px;
      border: 1px solid var(--line); background: rgba(0, 0, 0, 0.22); }
    .rdq-opt .key { width: 26px; height: 26px; flex: 0 0 auto; border-radius: 7px; display: grid; place-items: center;
      font-family: var(--display); font-weight: 800; font-size: 0.82rem; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--line-2); color: var(--muted); }
    .rdq-opt .ot { flex: 1; font-size: 0.92rem; }
    .rdq-opt.good { border-color: rgba(52, 211, 153, 0.5); background: rgba(52, 211, 153, 0.1); }
    .rdq-opt.good .key { background: var(--green); border-color: transparent; color: #04211a; }
    .rdq-opt.bad { border-color: rgba(251, 113, 133, 0.5); background: rgba(251, 113, 133, 0.1); }
    .rdq-opt.bad .key { background: var(--red); border-color: transparent; color: #2a0710; }
    .mark { font-weight: 800; flex: 0 0 auto; }
    .m-ok { color: #34d399; }
    .m-no { color: #fb7185; }
    @media (max-width: 760px) {
      .rd-levels { grid-template-columns: 1fr; }
      .rd-meta { grid-template-columns: repeat(2, 1fr); }
    }
    `,
  ],
})
export class AccountResultDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(StudentDataService);

  protected readonly loading = signal(true);
  protected readonly detail = signal<ResultDetail | null>(null);
  protected readonly generating = signal(false);
  protected readonly certError = signal('');

  protected readonly questions = computed<ResultQuestion[]>(
    () => this.detail()?.questions ?? [],
  );
  protected readonly attempted = computed(() => this.detail()?.attemptedCount ?? 0);
  protected readonly levels = computed(() =>
    (this.detail()?.categories ?? []).map((c) => {
      const percent = c.total ? Math.round((c.correct / c.total) * 100) : 0;
      return {
        name: c.name,
        label: LEVEL_LABEL[c.name] ?? c.name,
        icon: LEVEL_ICON[c.name] ?? '&#127793;',
        css: c.name === 'IQ' ? 'iq' : c.name === 'EQ' ? 'eq' : 'val',
        correct: c.correct,
        total: c.total,
        percent,
        level: levelFor(percent, c.total),
      };
    }),
  );

  protected formatDateTime = formatDateTime;

  protected readonly KEYS = KEYS;

  ngOnInit(): void {
    const code = String(this.route.snapshot.paramMap.get('code') ?? '');
    this.data.resultDetail(code).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.detail.set(null);
        this.loading.set(false);
      },
    });
  }

  protected catClass(name: string): string {
    return name === 'IQ' ? 'iq' : name === 'EQ' ? 'eq' : 'values';
  }

  /** Public, unauthenticated endpoint (see PublicController) — a plain
   * link is enough, no need to fetch/blob it like the admin side does. */
  protected certificateUrl(): string {
    return `/api/v1/public/certificates/${this.detail()?.certificateNumber}/download`;
  }

  /** Manual fallback when the automatic queue hasn't issued one yet — see
   * the button's comment in the template. Opens the download in a new tab
   * immediately on success, same as the normal Download Certificate link. */
  protected generateCertificate(): void {
    const code = this.detail()?.code;
    if (!code || this.generating()) return;
    this.generating.set(true);
    this.certError.set('');
    this.data.generateCertificate(code).subscribe({
      next: ({ certificateNumber }) => {
        this.generating.set(false);
        this.detail.update((d) => (d ? { ...d, certificateNumber } : d));
        window.open(`/api/v1/public/certificates/${certificateNumber}/download`, '_blank', 'noopener');
      },
      error: (err) => {
        this.generating.set(false);
        this.certError.set(err?.error?.message ?? 'Could not generate the certificate right now. Please try again shortly.');
      },
    });
  }
}
