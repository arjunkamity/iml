import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface ExamOption {
  code: string;
  title: string;
  grade: string | null;
  status: string;
}

interface BatchRow {
  id: number;
  label: string;
  startAt: string;
  durationMin: number;
  capacity: number;
  assigned: number;
  remaining: number;
}

interface BatchSummary {
  exam: { code: string; title: string; grade: string | null; durationMin: number | null };
  batches: BatchRow[];
  totalEligible: number;
  totalAssigned: number;
  totalUnassigned: number;
}

interface BatchDraft {
  label: string;
  startAt: string; // datetime-local value
  durationMin: number;
  capacity: number;
}

interface StudentSearchResult {
  registrationCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  grade: string;
  currentBatch: string | null;
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string | string[] }; message?: string };
  const m = e?.error?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong';
  return m ?? e?.message ?? 'Something went wrong';
}

const EMPTY_DRAFT: BatchDraft = { label: '', startAt: '', durationMin: 60, capacity: 500 };

@Component({
  selector: 'app-admin-exam-batches',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    <div class="bar">
      <select class="filter" style="max-width:420px" [(ngModel)]="selectedExamCode" (ngModelChange)="onSelectExam()">
        <option value="">Select an exam…</option>
        @for (e of exams(); track e.code) {
          <option [value]="e.code">{{ e.title }} ({{ e.code }}) — {{ e.grade || 'All grades' }}</option>
        }
      </select>
      <div class="grow"></div>
    </div>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    @if (!selectedExamCode) {
      <div class="empty">Pick an exam above to split it into batches and assign students. An exam with no batches behaves exactly as before — one shared window for every registered student.</div>
    } @else if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (summary(); as s) {
      <div class="grid g4" style="margin-bottom:1.1rem">
        <div class="card stat"><b>{{ s.totalEligible }}</b><small>Eligible students</small></div>
        <div class="card stat"><b>{{ s.totalAssigned }}</b><small>Assigned to a batch</small></div>
        <div class="card stat"><b>{{ s.totalUnassigned }}</b><small>Not yet assigned</small></div>
        <div class="card stat"><b>{{ s.batches.length }}</b><small>Batches created</small></div>
      </div>

      <div class="card" style="margin-bottom:1.1rem">
        <h3>Auto-assign</h3>
        <p class="hint">Spreads every currently-unassigned, grade-eligible student evenly across all batches below, respecting each batch's remaining capacity. Safe to re-run — already-assigned students are left alone.</p>
        <button class="btn btn-gold" [disabled]="autoAssigning() || !s.batches.length" (click)="autoAssign()">
          {{ autoAssigning() ? 'Assigning…' : 'Auto-assign unassigned students' }}
        </button>
        @if (autoAssignResult()) {
          <div class="hint" style="margin-top:0.6rem">{{ autoAssignResult() }}</div>
        }
      </div>

      <div class="card">
        <div class="bar" style="margin-bottom:0.9rem">
          <h3 style="margin:0">Batches</h3>
          <div class="grow"></div>
          <button class="btn btn-sm" [disabled]="!s.batches.length" (click)="openMoveModal()">Move a student</button>
          <button class="btn btn-gold btn-sm" (click)="openAddModal()">+ Add batch</button>
        </div>
        @if (!s.batches.length) {
          <div class="empty">No batches yet — click "+ Add batch" above.</div>
        } @else {
          <div class="log-table-wrap">
            <table class="log-table">
              <thead>
                <tr><th>Label</th><th>Starts</th><th>Duration</th><th>Assigned / Capacity</th><th></th></tr>
              </thead>
              <tbody>
                @for (b of s.batches; track b.id) {
                  <tr>
                    <td>{{ b.label }}</td>
                    <td>{{ b.startAt | date: 'medium' }}</td>
                    <td>{{ b.durationMin }} min</td>
                    <td>{{ b.assigned }} / {{ b.capacity }} <span class="hint">({{ b.remaining }} left)</span></td>
                    <td>
                      <a class="btn btn-sm" [routerLink]="['/admin/exam-batches', b.id]">View</a>
                      <button class="btn btn-sm" (click)="editBatch(b)">Edit</button>
                      <button class="btn btn-sm btn-danger" (click)="deleteBatch(b)">Delete</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    }

    @if (modalOpen()) {
      <div class="modal-root" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>{{ editingId() ? 'Edit batch' : 'Add a batch' }}</h3>
            <button class="m-x" (click)="closeModal()">✕</button>
          </div>
          <div style="padding:1.2rem 1.3rem">
            @if (error()) {
              <div class="err">{{ error() }}</div>
            }
            <div class="grid g2">
              <div class="f"><label>Label</label><input [(ngModel)]="draft.label" placeholder="Batch 1 — 10:00 AM" /></div>
              <div class="f"><label>Start time</label><input type="datetime-local" [(ngModel)]="draft.startAt" /></div>
              <div class="f"><label>Duration (min)</label><input type="number" min="1" [(ngModel)]="draft.durationMin" /></div>
              <div class="f"><label>Capacity</label><input type="number" min="1" [(ngModel)]="draft.capacity" /></div>
            </div>
            <div class="bar" style="margin-top:1.1rem; margin-bottom:0">
              <button class="btn btn-gold" [disabled]="saving()" (click)="saveBatch()">
                {{ saving() ? 'Saving…' : editingId() ? 'Save changes' : '+ Add batch' }}
              </button>
              <button class="btn" (click)="closeModal()">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    }

    @if (moveModalOpen()) {
      <div class="modal-root" (click)="closeMoveModal()">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>Move a student</h3>
            <button class="m-x" (click)="closeMoveModal()">✕</button>
          </div>
          <div style="padding:1.2rem 1.3rem">
            @if (error()) {
              <div class="err">{{ error() }}</div>
            }
            <div class="bar" style="margin-bottom:0">
              <input class="search" style="max-width:none; flex:1" [(ngModel)]="studentQuery" placeholder="Search by name, email or phone…" (keyup.enter)="searchStudents()" />
              <button class="btn btn-gold btn-sm" [disabled]="searching() || studentQuery.trim().length < 2" (click)="searchStudents()">
                {{ searching() ? 'Searching…' : 'Search' }}
              </button>
            </div>

            @if (searched() && !studentResults().length) {
              <div class="empty">No matching students found.</div>
            } @else if (studentResults().length) {
              <div class="log-table-wrap" style="margin-top:0.9rem">
                <table class="log-table">
                  <thead>
                    <tr><th>Name</th><th>Contact</th><th>Grade</th><th>Current batch</th><th></th></tr>
                  </thead>
                  <tbody>
                    @for (r of studentResults(); track r.registrationCode) {
                      <tr [class.selected-row]="selectedStudent()?.registrationCode === r.registrationCode">
                        <td>{{ r.name }} <span class="hint">({{ r.registrationCode }})</span></td>
                        <td>{{ r.email || r.phone || '—' }}</td>
                        <td>{{ r.grade }}</td>
                        <td>{{ r.currentBatch || '—' }}</td>
                        <td><button class="btn btn-sm" (click)="selectStudent(r)">Select</button></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            @if (selectedStudent(); as sel) {
              <div class="card" style="margin-top:1.1rem">
                <p class="hint" style="margin:0 0 0.7rem">Moving <b>{{ sel.name }}</b> ({{ sel.registrationCode }}) — currently: {{ sel.currentBatch || 'unassigned' }}</p>
                <div class="bar" style="margin-bottom:0">
                  <select class="filter" [(ngModel)]="moveBatchId">
                    <option [ngValue]="null">— choose target batch —</option>
                    @for (b of summary()?.batches ?? []; track b.id) {
                      <option [ngValue]="b.id">{{ b.label }}</option>
                    }
                  </select>
                  <button class="btn btn-gold btn-sm" [disabled]="moving() || !moveBatchId" (click)="moveStudent()">
                    {{ moving() ? 'Moving…' : 'Assign to batch' }}
                  </button>
                  <button class="btn btn-sm" [disabled]="moving() || !sel.currentBatch" (click)="clearAssignment()">Clear assignment</button>
                </div>
              </div>
            }
            @if (moveResult()) {
              <div class="hint" style="margin-top:0.8rem">{{ moveResult() }}</div>
            }
          </div>
        </div>
      </div>
    }

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .f { display: flex; flex-direction: column; gap: 0.3rem; }
      .f label { font-size: 0.78rem; font-weight: 600; color: var(--muted, #9fb0d0); }
      .f input, .f select { padding: 0.5rem 0.7rem; border-radius: 8px; border: 1px solid var(--line, rgba(255,255,255,0.09)); background: rgba(0,0,0,0.3); color: inherit; }
      .hint { font-size: 0.82rem; color: var(--muted, #9fb0d0); }
      .err { padding: 0.7rem 1rem; border-radius: 10px; background: rgba(251, 113, 133, 0.12); color: #fecdd3; border: 1px solid rgba(251, 113, 133, 0.3); margin-bottom: 1rem; }
      .empty { padding: 2rem; text-align: center; color: var(--muted, #9fb0d0); }
      .log-table-wrap { overflow-x: auto; }
      .log-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
      .log-table th { text-align: left; padding: 0.6rem 0.8rem; color: var(--faint, #6e7f9e); font-weight: 500; border-bottom: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .log-table td { padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.06)); }
      .toast { position: fixed; bottom: 1.2rem; right: 1.2rem; background: var(--panel-2, #10254a); border: 1px solid var(--line-2, rgba(255,255,255,0.16)); padding: 0.7rem 1.1rem; border-radius: 10px; font-weight: 600; z-index: 50; }
      .selected-row { background: rgba(232, 182, 74, 0.1); }
    `,
  ],
})
export class AdminExamBatchesPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly exams = signal<ExamOption[]>([]);
  protected readonly summary = signal<BatchSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly autoAssigning = signal(false);
  protected readonly moving = signal(false);
  protected readonly error = signal('');
  protected readonly toast = signal('');
  protected readonly autoAssignResult = signal('');
  protected readonly moveResult = signal('');
  protected readonly editingId = signal<number | null>(null);
  protected readonly modalOpen = signal(false);
  protected readonly moveModalOpen = signal(false);
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly studentResults = signal<StudentSearchResult[]>([]);
  protected readonly selectedStudent = signal<StudentSearchResult | null>(null);

  protected selectedExamCode = '';
  protected draft: BatchDraft = { ...EMPTY_DRAFT };
  protected studentQuery = '';
  protected moveBatchId: number | null = null;

  ngOnInit(): void {
    this.api.get<{ data: ExamOption[] }>('/exams', { limit: 200 }).subscribe({
      next: (res) => this.exams.set(res.data ?? []),
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected onSelectExam(): void {
    this.error.set('');
    this.autoAssignResult.set('');
    this.moveResult.set('');
    this.closeModal();
    this.closeMoveModal();
    if (!this.selectedExamCode) {
      this.summary.set(null);
      return;
    }
    this.loadBatches();
  }

  private loadBatches(): void {
    this.loading.set(true);
    this.api.get<BatchSummary>(`/exams/${this.selectedExamCode}/batches`).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
        if (!this.editingId()) {
          this.draft = { ...EMPTY_DRAFT, durationMin: s.exam.durationMin ?? 60 };
        }
      },
      error: (e) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
  }

  protected openAddModal(): void {
    this.editingId.set(null);
    this.draft = { ...EMPTY_DRAFT, durationMin: this.summary()?.exam.durationMin ?? 60 };
    this.error.set('');
    this.modalOpen.set(true);
  }

  protected editBatch(b: BatchRow): void {
    this.editingId.set(b.id);
    this.draft = {
      label: b.label,
      startAt: b.startAt.slice(0, 16),
      durationMin: b.durationMin,
      capacity: b.capacity,
    };
    this.error.set('');
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.editingId.set(null);
    this.error.set('');
  }

  protected saveBatch(): void {
    if (!this.draft.label.trim() || !this.draft.startAt) {
      this.error.set('Label and start time are required.');
      return;
    }
    this.error.set('');
    this.saving.set(true);
    const body = {
      label: this.draft.label.trim(),
      startAt: new Date(this.draft.startAt).toISOString(),
      durationMin: Number(this.draft.durationMin),
      capacity: Number(this.draft.capacity),
    };
    const id = this.editingId();
    const req = id
      ? this.api.patch(`/exam-batches/${id}`, body)
      : this.api.post(`/exams/${this.selectedExamCode}/batches`, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showToast(id ? 'Batch updated' : 'Batch added');
        this.closeModal();
        this.loadBatches();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected deleteBatch(b: BatchRow): void {
    this.error.set('');
    this.api.delete(`/exam-batches/${b.id}`).subscribe({
      next: () => {
        this.showToast('Batch deleted');
        if (this.editingId() === b.id) this.closeModal();
        this.loadBatches();
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected autoAssign(): void {
    this.autoAssigning.set(true);
    this.autoAssignResult.set('');
    this.error.set('');
    this.api.post<{ assigned: number; stillUnassigned: number }>(`/exams/${this.selectedExamCode}/batches/auto-assign`, {}).subscribe({
      next: (res) => {
        this.autoAssigning.set(false);
        this.autoAssignResult.set(
          `Assigned ${res.assigned} student${res.assigned === 1 ? '' : 's'}.` +
            (res.stillUnassigned > 0 ? ` ${res.stillUnassigned} still unassigned — batches are full.` : ''),
        );
        this.loadBatches();
      },
      error: (e) => {
        this.autoAssigning.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected openMoveModal(): void {
    this.studentQuery = '';
    this.studentResults.set([]);
    this.selectedStudent.set(null);
    this.searched.set(false);
    this.moveBatchId = null;
    this.moveResult.set('');
    this.error.set('');
    this.moveModalOpen.set(true);
  }

  protected closeMoveModal(): void {
    this.moveModalOpen.set(false);
    this.selectedStudent.set(null);
    this.error.set('');
  }

  protected searchStudents(): void {
    const q = this.studentQuery.trim();
    if (q.length < 2) return;
    this.searching.set(true);
    this.error.set('');
    this.api.get<StudentSearchResult[]>(`/exams/${this.selectedExamCode}/students`, { q }).subscribe({
      next: (results) => {
        this.searching.set(false);
        this.searched.set(true);
        this.studentResults.set(results);
      },
      error: (e) => {
        this.searching.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected selectStudent(s: StudentSearchResult): void {
    this.selectedStudent.set(s);
    this.moveBatchId = null;
    this.moveResult.set('');
  }

  protected moveStudent(): void {
    const sel = this.selectedStudent();
    if (!sel || !this.moveBatchId) return;
    this.moving.set(true);
    this.moveResult.set('');
    this.error.set('');
    this.api.post(`/exam-batches/${this.moveBatchId}/assign`, { registrationCode: sel.registrationCode }).subscribe({
      next: () => {
        this.moving.set(false);
        this.moveResult.set(`${sel.name} assigned.`);
        this.selectedStudent.set(null);
        this.moveBatchId = null;
        this.searchStudents();
        this.loadBatches();
      },
      error: (e) => {
        this.moving.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected clearAssignment(): void {
    const sel = this.selectedStudent();
    if (!sel) return;
    this.moving.set(true);
    this.moveResult.set('');
    this.error.set('');
    this.api.post(`/exams/${this.selectedExamCode}/batches/unassign`, { registrationCode: sel.registrationCode }).subscribe({
      next: () => {
        this.moving.set(false);
        this.moveResult.set(`${sel.name} unassigned.`);
        this.selectedStudent.set(null);
        this.searchStudents();
        this.loadBatches();
      },
      error: (e) => {
        this.moving.set(false);
        this.error.set(errText(e));
      },
    });
  }

  private showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => {
      if (this.toast() === msg) this.toast.set('');
    }, 2200);
  }
}
