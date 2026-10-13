import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

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
  certificateNumber: string | null;
}

interface AnswerDetail {
  id: number;
  answer: unknown;
  isCorrect: boolean | null;
  takenSecs: number | null;
  timeUp: boolean;
  startedAt: string | null;
  answeredAt: string | null;
  question: {
    code?: string;
    category?: string;
    mode?: string;
    prompt: string;
    options: unknown[];
    correct: number[];
    timeLimitSecs?: number | null;
    group?: { code: string; title: string } | null;
  } | null;
}

interface AttemptDetail {
  code: string;
  score: number;
  total: number;
  startedAt: string;
  finishedAt: string;
  timing?: unknown;
  registration: {
    student: { name: string; code: string; grade: string; school?: { name?: string } | null };
    competition: { title: string; code: string };
  };
  stage: { name: string; position: number; mode?: string; passMark?: number } | null;
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

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

@Component({
  selector: 'app-admin-results',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    @if (detail()) {
      <div class="rd">
        <div class="bar">
          <button class="btn btn-sm" (click)="detail.set(null)">&#8592; Back to results</button>
          <div class="grow"></div>
          <span class="bdg grey">{{ detail()!.code }}</span>
        </div>

        <div class="grid g4" style="margin-bottom:1rem">
          <div class="card">
            <div style="font-weight:800;font-size:1.02rem">{{ detail()!.registration.student.name }}</div>
            <small style="display:block;color:var(--muted, #9fb0d0)">{{ detail()!.registration.student.school?.name ?? '—' }}</small>
            <div style="margin-top:0.6rem">
              <span class="bdg grey">{{ detail()!.registration.student.code }}</span>
              <span class="bdg gold">{{ detail()!.registration.competition.code }}</span>
              <span style="color:var(--muted, #9fb0d0);font-size:0.85rem">Grade {{ detail()!.registration.student.grade }}</span>
            </div>
          </div>
          <div class="card stat"><b>{{ when(detail()!.startedAt).slice(0, 10) }}</b><small>Attempt date</small></div>
          <div class="card stat"><b>{{ detail()!.score }} / {{ detail()!.total }}</b><small>Score</small></div>
          <div class="card stat"><b>{{ timeUps() ? timeUps() + ' ⏱' : 'None' }}</b><small>Time-up / auto-advance</small></div>
        </div>

        <div class="grid g4" style="margin-bottom:1rem">
          <div class="card stat"><b>{{ timeOnly(detail()!.startedAt) }}</b><small>Started at</small></div>
          <div class="card stat"><b>{{ timeOnly(detail()!.finishedAt) }}</b><small>Finished at</small></div>
          <div class="card stat"><b>{{ totalSecs() }}</b><small>Total time</small></div>
          <div class="card stat"><b>{{ timingLabel() }}</b><small>Question timing · avg {{ avgSecs() }}s / q</small></div>
        </div>

        <div class="tbl-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Question</th><th>Student answer</th><th>Result</th><th>Time taken</th><th>Response time</th><th>Limit</th></tr>
            </thead>
            <tbody>
              @for (a of detail()!.answers; track a.id; let i = $index) {
                <tr>
                  <td>{{ i + 1 }}</td>
                  <td class="b" style="max-width:380px">
                    @if (a.question?.group; as g) {
                      <small style="color:var(--gold-2,#f5cc5a);font-weight:700;">&#9638; {{ g.code }} · {{ g.title }}</small>
                    }
                    {{ a.question?.prompt ?? '—' }}
                  </td>
                  <td>
                    {{ answerText(a) }}
                    @if (a.isCorrect === false) {
                      <div><small style="color:#86efac">Correct: {{ correctText(a) }}</small></div>
                    }
                  </td>
                  <td>
                    @if (a.isCorrect === true) {
                      <span class="bdg green">Correct</span>
                    } @else if (a.isCorrect === false) {
                      <span class="bdg red">Wrong</span>
                    } @else {
                      <span class="bdg grey">Skipped</span>
                    }
                  </td>
                  <td>
                    @if (a.timeUp) {
                      <span style="color:#f9a8d4;font-weight:700">{{ a.takenSecs != null ? a.takenSecs + 's ⏱' : '—' }}</span>
                    } @else {
                      {{ a.takenSecs != null ? a.takenSecs + 's' : '—' }}
                    }
                  </td>
                  <td><small>{{ timeOnly(a.startedAt) }} → {{ timeOnly(a.answeredAt) }}</small></td>
                  <td>{{ limitOf(a) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="empty">No answers recorded for this attempt.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    } @else {
      <div class="bar">
        <select class="filter" [(ngModel)]="comp" (ngModelChange)="go(1)">
          <option value="">All competitions</option>
          @for (c of comps(); track c.code) {
            <option [value]="c.code">{{ c.title }}</option>
          }
        </select>
        <input class="search" placeholder="Search student…" [(ngModel)]="search" (keyup.enter)="go(1)" />
        <div class="grow"></div>
        <a class="btn btn-gold btn-sm" routerLink="/admin/selection">Next Stage Selection →</a>
      </div>

      @if (error) {
        <div class="err">{{ error }}</div>
      }

      <div class="tbl-wrap" (scroll)="closeMenu()">
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
                    <div class="kebab-wrap">
                      <button class="btn btn-sm kebab-btn" title="Certificate actions" (click)="$event.stopPropagation(); toggleMenu(r.code, $event)">&#8942;</button>
                      @if (openMenuFor() === r.code) {
                        <div class="kebab-menu" [style.position]="'fixed'" [style.top.px]="menuPos()?.top" [style.right.px]="menuPos()?.right" (click)="$event.stopPropagation()">
                          <button
                            type="button"
                            [disabled]="!r.certificateNumber || downloading() === r.code"
                            (click)="downloadCertificate(r)"
                          >
                            {{ downloading() === r.code ? 'Downloading…' : 'Download Certificate' }}
                          </button>
                          <button type="button" [disabled]="generating() === r.code" (click)="generateCertificate(r)">
                            {{ generating() === r.code ? 'Sending…' : r.certificateNumber ? 'Resend Certificate email' : 'Generate Certificate' }}
                          </button>
                          @if (!r.certificateNumber) {
                            <small>Not issued yet — this will render it now and email the student.</small>
                          }
                        </div>
                      }
                    </div>
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
    }

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
    @media (max-width: 900px) {
      .g4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    /* .kebab-* itself comes from the shared ADMIN_UI_CSS above — this used
       to redeclare an identical copy (min-width: 220px vs. the shared
       180px being the only difference), which silently overrode the
       shared block's position-related rules by source order whenever
       either one changed. Widened the shared .kebab-menu instead of
       keeping a second copy in sync by hand. */
    `,
  ],
})
export class AdminResultsPage {
  private readonly api = inject(ApiService);
  readonly rows = signal<ResultRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly comps = signal<{ code: string; title: string }[]>([]);
  readonly detail = signal<AttemptDetail | null>(null);
  readonly openMenuFor = signal<string | null>(null);
  protected readonly menuPos = signal<{ top: number; right: number } | null>(null);
  readonly downloading = signal<string | null>(null);
  readonly generating = signal<string | null>(null);
  readonly toast = signal('');
  search = '';
  comp = '';
  error = '';

  // Closes the kebab menu on any click outside it — the button and the
  // menu itself both stop propagation, so this only ever fires for a
  // genuine click elsewhere on the page.
  @HostListener('document:click')
  protected closeMenu(): void {
    this.openMenuFor.set(null);
    this.menuPos.set(null);
  }

  constructor() {
    this.api.get<{ data: Array<{ code: string; title: string }> }>('/competitions', { limit: 100 }).subscribe({
      next: (r) => this.comps.set(r.data.map((c) => ({ code: c.code, title: c.title }))),
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
    this.error = '';
    this.api.get<AttemptDetail>(`/results/${r.code}`).subscribe({
      next: (d) => this.detail.set(d),
      error: (e) => {
        this.error = errText(e);
      },
    });
  }

  toggleMenu(code: string, event: MouseEvent) {
    if (this.openMenuFor() === code) {
      this.closeMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.menuPos.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    this.openMenuFor.set(code);
  }

  downloadCertificate(r: ResultRow) {
    if (!r.certificateNumber || this.downloading()) return;
    this.openMenuFor.set(null);
    this.downloading.set(r.code);
    this.api.downloadBlob(`/certificates/${r.certificateNumber}/download`).subscribe({
      next: (blob) => {
        this.downloading.set(null);
        this.triggerDownload(blob, `${r.certificateNumber}.pdf`);
      },
      error: async (e: HttpErrorResponse) => {
        this.downloading.set(null);
        this.showToast(await this.blobErrorText(e));
      },
    });
  }

  /** "Generate Certificate" for a not-yet-issued one, "Resend" for an
   * already-issued one — same endpoint either way, see ResultService
   * .generateCertificate() (idempotent on issuance, always re-sends). */
  generateCertificate(r: ResultRow) {
    if (this.generating()) return;
    this.openMenuFor.set(null);
    this.generating.set(r.code);
    this.api.post<{ certificateNumber: string }>(`/results/${r.code}/certificate/generate`).subscribe({
      next: (res) => {
        this.generating.set(null);
        this.rows.set(this.rows().map((row) => (row.code === r.code ? { ...row, certificateNumber: res.certificateNumber } : row)));
        this.showToast(r.certificateNumber ? 'Certificate email resent' : 'Certificate generated and emailed');
      },
      error: (e) => {
        this.generating.set(null);
        this.showToast(errText(e));
      },
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** With responseType:'blob', a failed request's error body is ALSO a
   * Blob, not parsed JSON — errText() alone can't read the real message
   * out of it, so unwrap it here first (same as admin-settings.page.ts's
   * sample-certificate download). */
  private async blobErrorText(e: HttpErrorResponse): Promise<string> {
    if (e.error instanceof Blob) {
      try {
        const parsed = JSON.parse(await e.error.text());
        return parsed.message ?? 'Could not download this certificate.';
      } catch {
        return 'Could not download this certificate.';
      }
    }
    return errText(e);
  }

  private showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => {
      if (this.toast() === msg) this.toast.set('');
    }, 2600);
  }

  when(v: string) {
    return typeof v === 'string' ? `${v.slice(0, 10)} ${v.slice(11, 16)}` : '—';
  }

  timeOnly(v: string | null) {
    return typeof v === 'string' ? v.slice(11, 19) : '—';
  }

  totalSecs(): string {
    const d = this.detail();
    if (!d) return '—';
    const start = new Date(d.startedAt).getTime();
    const end = new Date(d.finishedAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return '—';
    const s = Math.max(0, Math.round((end - start) / 1000));
    const m = Math.floor(s / 60);
    return m ? `${m}m ${pad(s % 60)}s` : `${s}s`;
  }

  timeUps(): number {
    return this.detail()?.answers.filter((a) => a.timeUp).length ?? 0;
  }

  avgSecs(): number {
    const as = (this.detail()?.answers ?? []).filter((a) => a.takenSecs != null);
    if (!as.length) return 0;
    return Math.round(as.reduce((s, a) => s + (a.takenSecs ?? 0), 0) / as.length);
  }

  timingLabel(): string {
    const t = this.detail()?.timing as { mode?: string; secs?: number } | undefined;
    if (!t) return '—';
    if (t.mode === 'common' && t.secs) return `Common · ${t.secs}s`;
    if (t.mode === 'per-question' && t.secs) return `Per question · ${t.secs}s`;
    return t.mode === 'custom' ? 'Custom' : '—';
  }

  selected(a: AnswerDetail, i: number): boolean {
    const ans = Array.isArray(a.answer) ? a.answer : [];
    return ans.includes(i);
  }

  givenIndices(a: AnswerDetail): number[] {
    const ans = a.answer;
    if (Array.isArray(ans)) return ans.map(Number);
    return ans == null ? [] : [Number(ans)];
  }

  answerText(a: AnswerDetail): string {
    const opts = a.question?.options ?? [];
    const idx = this.givenIndices(a).filter((i) => i >= 0);
    if (!idx.length) return '—';
    return idx
      .map((i) => `${KEYS[i] ?? i + 1}. ${opts[i] ?? ''}`)
      .join(', ');
  }

  correctText(a: AnswerDetail): string {
    const opts = a.question?.options ?? [];
    const idx = (a.question?.correct ?? []).filter((i) => i >= 0);
    if (!idx.length) return '—';
    return idx
      .map((i) => `${KEYS[i] ?? i + 1}. ${opts[i] ?? ''}`)
      .join(', ');
  }

  limitOf(a: AnswerDetail): string {
    if (a.question?.timeLimitSecs) return `${a.question.timeLimitSecs}s`;
    const t = this.detail()?.timing as { mode?: string; secs?: number } | undefined;
    if (t?.mode === 'common' && t.secs) return `${t.secs}s`;
    return '—';
  }
}
