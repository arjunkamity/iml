import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface CompRow {
  code: string;
  title: string;
}

interface Stage {
  id: number;
  position: number;
  name: string;
  maxQualifiers: number | null;
}

interface SelectionRow {
  registrationId: number;
  registrationCode: string;
  studentCode: string;
  studentName: string;
  attemptCode: string;
  score: number;
  total: number;
  percent: number;
  durationSecs: number | null;
  totalChanges: number;
  avgTakenSecs: number | null;
  currentStatus: string | null;
}

interface CriteriaStage {
  criterion: string;
  label: string;
  seatsBefore: number;
  clearCount: number;
  tiedCount: number;
  seatsAfter: number;
  tiedGroup: SelectionRow[];
}

interface SelectionPreview {
  stage: { id: number; name: string; position: number; passMark: number; maxQualifiers: number | null };
  eligibleCount: number;
  ineligible: SelectionRow[];
  cap: number | null;
  criteriaStages: CriteriaStage[];
  autoPicked: SelectionRow[];
  stillContesting: SelectionRow[];
  seatsLeftForManual: number;
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string | string[] }; message?: string };
  const m = e?.error?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong';
  return m ?? e?.message ?? 'Something went wrong';
}

@Component({
  selector: 'app-admin-selection-wizard',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe],
  template: `
    <div class="bar">
      <a class="btn btn-sm" routerLink="/admin/results">&#8592; Back to results</a>
      <div class="grow"></div>
      <span style="font-size:0.82rem;color:var(--muted,#9fb0d0)">Next Stage Selection</span>
    </div>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <div class="card" style="max-width:760px;margin-bottom:1rem">
      <div class="grid g2" style="margin-bottom:0.8rem">
        <div class="f">
          <label>1. Choose competition</label>
          <select [(ngModel)]="compCode" (ngModelChange)="onCompChange()">
            <option value="">Select…</option>
            @for (c of competitions(); track c.code) {
              <option [value]="c.code">{{ c.title }}</option>
            }
          </select>
        </div>
        <div class="f">
          <label>Choose stage</label>
          <select [(ngModel)]="stageId" (ngModelChange)="onStageChange()" [disabled]="!compCode">
            <option [ngValue]="null">Select…</option>
            @for (s of stages(); track s.id) {
              <option [ngValue]="s.id">Stage {{ s.position }} — {{ s.name }} @if (s.maxQualifiers) { ({{ s.maxQualifiers }} seats) } @else { (no cap) }</option>
            }
          </select>
        </div>
      </div>
      @if (stageId && !currentStage()?.maxQualifiers && preview()) {
        <div class="err">
          This stage has no "Max qualifiers" set — every eligible attempt qualifies immediately at submit time already, there's
          nothing to run a selection for. Set a cap from Admin &gt; Competitions &gt; Stages first.
        </div>
      }
    </div>

    @if (preview() && currentStage()?.maxQualifiers) {
      <div class="card" style="max-width:760px;margin-bottom:1rem;background:rgba(232,182,74,0.06);border-color:rgba(232,182,74,0.3)">
        <div class="grid g4">
          <div class="stat"><b>{{ preview()!.eligibleCount }}</b><small>Initial qualifiers</small></div>
          <div class="stat"><b>{{ preview()!.cap }}</b><small>Seats available</small></div>
          <div class="stat"><b>{{ runningPicked() }}</b><small>Picked so far</small></div>
          <div class="stat"><b>{{ runningSeatsLeft() }}</b><small>Seats left</small></div>
        </div>
      </div>

      <!-- Step: initial qualifiers -->
      <div class="card" style="max-width:760px;margin-bottom:1rem">
        <div style="font-weight:800;margin-bottom:0.4rem">2. Initial qualifiers</div>
        <p style="color:var(--muted,#9fb0d0);font-size:0.9rem;margin:0 0 0.8rem;">
          <b>{{ preview()!.eligibleCount }}</b> attempt(s) cleared the pass mark ({{ preview()!.stage.passMark }}%) and are in the
          running for <b>{{ preview()!.cap }}</b> seat(s). {{ preview()!.ineligible.length }} attempt(s) did not clear the pass mark and
          are not eligible regardless of speed.
        </p>
        @if (step() === 'qualifiers') {
          <button class="btn btn-gold btn-sm" (click)="advanceCriteria()">
            {{ preview()!.criteriaStages.length ? 'Apply Criteria 1: ' + preview()!.criteriaStages[0].label : 'Continue' }}
          </button>
        }
      </div>

      <!-- Step: criteria cascade, revealed one at a time -->
      @for (cs of preview()!.criteriaStages; track cs.criterion; let i = $index) {
        @if (i < criteriaShown()) {
          <div class="card" style="max-width:760px;margin-bottom:1rem">
            <div style="font-weight:800;margin-bottom:0.4rem">{{ 3 + i }}. Criteria {{ i + 1 }}: {{ cs.label }}</div>
            <p style="color:var(--muted,#9fb0d0);font-size:0.9rem;margin:0 0 0.6rem;">
              {{ cs.seatsBefore }} seat(s) were open before this criterion.
              <b>{{ cs.clearCount }}</b> student(s) clearly beat the cutoff on {{ cs.label.toLowerCase() }} and are picked.
              @if (cs.tiedCount) {
                <b>{{ cs.tiedCount }}</b> student(s) are exactly tied at the cutoff, competing for the
                <b>{{ cs.seatsAfter }}</b> remaining seat(s).
              } @else {
                No ties — every seat for this criterion is resolved.
              }
            </p>
            @if (cs.tiedCount > 0) {
              <details style="margin-bottom:0.6rem">
                <summary style="cursor:pointer;color:var(--muted,#9fb0d0);font-size:0.85rem;">View the {{ cs.tiedCount }} tied student(s)</summary>
                <div class="tbl-wrap" style="margin-top:0.5rem">
                  <table>
                    <thead><tr><th>Student</th><th>Time</th><th>Changes</th><th>Avg/Q</th></tr></thead>
                    <tbody>
                      @for (r of cs.tiedGroup; track r.registrationId) {
                        <tr>
                          <td>{{ r.studentName }}</td>
                          <td>{{ fmtSecs(r.durationSecs) }}</td>
                          <td>{{ r.totalChanges }}</td>
                          <td>{{ r.avgTakenSecs != null ? (r.avgTakenSecs | number: '1.0-1') + 's' : '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </details>
            }
            @if (step() === 'criteria' && i === criteriaShown() - 1) {
              @if (i + 1 < preview()!.criteriaStages.length) {
                <button class="btn btn-gold btn-sm" (click)="advanceCriteria()">
                  Apply Criteria {{ i + 2 }}: {{ preview()!.criteriaStages[i + 1].label }}
                </button>
              } @else {
                <button class="btn btn-gold btn-sm" (click)="goToConfirm()">Continue</button>
              }
            }
          </div>
        }
      }

      <!-- Every seat is always fully resolved by the criteria above — see
           CompetitionService.commitSelection()'s doc comment. There is no
           manual-pick step: the last criterion is a database primary key,
           which can never itself be tied, so the system always finishes
           the job on its own. -->
      @if (step() === 'confirm') {
        <div class="card" style="max-width:760px;border-color:rgba(251,113,133,0.35)">
          <div style="font-weight:700;margin-bottom:0.5rem">Confirm selection</div>
          <p style="font-size:0.85rem;color:var(--muted,#9fb0d0);margin:0 0 0.8rem;">
            <b>{{ preview()!.autoPicked.length }}</b> of {{ preview()!.cap }} seat(s) were decided entirely by the criteria above — no
            admin judgment involved in who qualifies. Committing advances them to the next stage and marks everyone else who
            attempted as Eliminated. This runs once and cannot be changed afterward.
          </p>
          @if (formErr()) {
            <div class="err">{{ formErr() }}</div>
          }
          <button class="btn btn-gold" (click)="commit()" [disabled]="committing()">
            {{ committing() ? 'Committing…' : 'Commit Selection' }}
          </button>
        </div>
      }
    }
  `,
  styles: [ADMIN_UI_CSS],
})
export class AdminSelectionWizardPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly competitions = signal<CompRow[]>([]);
  protected readonly stages = signal<Stage[]>([]);
  protected readonly preview = signal<SelectionPreview | null>(null);
  protected readonly error = signal('');
  protected readonly formErr = signal('');
  protected readonly step = signal<'qualifiers' | 'criteria' | 'confirm'>('qualifiers');
  protected readonly criteriaShown = signal(0);
  protected readonly committing = signal(false);

  compCode = '';
  stageId: number | null = null;

  ngOnInit(): void {
    this.api.get<{ data: CompRow[] }>('/competitions', { limit: 200 }).subscribe({
      next: (r) => this.competitions.set(r.data ?? []),
      error: (e) => this.error.set(errText(e)),
    });
  }

  currentStage(): Stage | undefined {
    return this.stages().find((s) => s.id === this.stageId);
  }

  onCompChange(): void {
    this.stageId = null;
    this.stages.set([]);
    this.preview.set(null);
    if (!this.compCode) return;
    this.api.get<Stage[]>(`/competitions/${this.compCode}/stages`).subscribe({
      next: (s) => this.stages.set(s ?? []),
      error: (e) => this.error.set(errText(e)),
    });
  }

  onStageChange(): void {
    this.preview.set(null);
    this.criteriaShown.set(0);
    this.step.set('qualifiers');
    this.formErr.set('');
    if (!this.compCode || !this.stageId) return;
    this.error.set('');
    this.api.get<SelectionPreview>(`/competitions/${this.compCode}/stages/${this.stageId}/selection-preview`).subscribe({
      next: (p) => this.preview.set(p),
      error: (e) => this.error.set(errText(e)),
    });
  }

  advanceCriteria(): void {
    const p = this.preview();
    if (!p) return;
    this.step.set('criteria');
    if (this.criteriaShown() < p.criteriaStages.length) {
      this.criteriaShown.set(this.criteriaShown() + 1);
    }
  }

  goToConfirm(): void {
    if (!this.preview()) return;
    this.step.set('confirm');
  }

  /** Reflects only what's been revealed so far, not the fully-resolved
   * backend answer — the whole point of stepping through "Apply
   * Criteria N" is watching the seats-left number actually narrow, not
   * seeing the final total on the very first screen. Each revealed
   * stage credits its own clearCount; once every stage has been shown,
   * credit the true final autoPicked total (covers the "the whole tied
   * group fits in what's left, no more criteria needed" shortcut, which
   * never gets its own displayed stage). */
  runningPicked(): number {
    const p = this.preview();
    if (!p) return 0;
    const shown = this.criteriaShown();
    if (shown >= p.criteriaStages.length) {
      return p.autoPicked.length;
    }
    let picked = 0;
    for (let i = 0; i < shown; i++) picked += p.criteriaStages[i].clearCount;
    return picked;
  }

  runningSeatsLeft(): number {
    const p = this.preview();
    if (!p) return 0;
    return Math.max(0, p.cap! - this.runningPicked());
  }

  fmtSecs(secs: number | null): string {
    if (secs == null) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  }

  commit(): void {
    const p = this.preview();
    if (!p || !this.compCode || !this.stageId) return;
    this.formErr.set('');
    // No payload — the server recomputes and applies this exact same
    // ranking itself; see CompetitionService.commitSelection().
    if (!confirm(`Advance ${p.autoPicked.length} student(s) from this stage? Everyone else who attempted will be marked Eliminated. This cannot be undone.`)) {
      return;
    }
    this.committing.set(true);
    this.api
      .post(`/competitions/${this.compCode}/stages/${this.stageId}/selection-commit`, {})
      .subscribe({
        next: () => {
          this.committing.set(false);
          this.onStageChange();
        },
        error: (e) => {
          this.committing.set(false);
          this.formErr.set(errText(e));
        },
      });
  }
}
