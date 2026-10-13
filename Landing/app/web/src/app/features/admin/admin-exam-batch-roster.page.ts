import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface RosterRow {
  registrationCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  grade: string;
  school: string | null;
}

interface BatchInfo {
  id: number;
  label: string;
  startAt: string;
  capacity: number;
  examCode: string;
  examTitle: string;
}

interface RosterResponse {
  data: RosterRow[];
  total: number;
  page: number;
  limit: number;
  batch: BatchInfo;
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string | string[] }; message?: string };
  const m = e?.error?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong';
  return m ?? e?.message ?? 'Something went wrong';
}

const LIMIT = 50;

@Component({
  selector: 'app-admin-exam-batch-roster',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    @if (batch(); as b) {
      <a class="back" [routerLink]="['/admin/exam-batches']">← Back to batches</a>
      <div class="bar" style="margin-top:0.6rem">
        <div>
          <h2 style="margin:0 0 0.2rem">{{ b.label }}</h2>
          <p class="hint" style="margin:0">{{ b.examTitle }} ({{ b.examCode }}) — starts {{ b.startAt | date: 'medium' }} — capacity {{ b.capacity }}</p>
        </div>
        <div class="grow"></div>
        <button class="btn btn-gold btn-sm" (click)="openReminderModal()">✉ Send Reminder</button>
      </div>
    }

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <div class="bar" style="margin-top:1rem">
      <input class="search" [(ngModel)]="query" placeholder="Search by name, email or phone…" (keyup.enter)="applySearch()" />
      <button class="btn btn-gold btn-sm" (click)="applySearch()">Search</button>
      @if (activeSearch) {
        <button class="btn btn-sm" (click)="clearSearch()">Clear</button>
      }
      <div class="grow"></div>
      <span class="hint">{{ total() }} student{{ total() === 1 ? '' : 's' }}</span>
    </div>

    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (!rows().length) {
      <div class="empty">{{ activeSearch ? 'No matching students in this batch.' : 'No students assigned to this batch yet.' }}</div>
    } @else {
      <div class="card">
        <div class="log-table-wrap">
          <table class="log-table">
            <thead>
              <tr><th>Reg. code</th><th>Name</th><th>Email</th><th>Phone</th><th>Grade</th><th>School</th></tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.registrationCode) {
                <tr>
                  <td>{{ r.registrationCode }}</td>
                  <td>{{ r.name }}</td>
                  <td>{{ r.email || '—' }}</td>
                  <td>{{ r.phone || '—' }}</td>
                  <td>{{ r.grade }}</td>
                  <td>{{ r.school || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      @if (totalPages() > 1) {
        <div class="bar" style="margin-top:0.9rem">
          <button class="btn btn-sm" [disabled]="page() <= 1" (click)="goPage(page() - 1)">← Prev</button>
          <span class="hint">Page {{ page() }} of {{ totalPages() }}</span>
          <button class="btn btn-sm" [disabled]="page() >= totalPages()" (click)="goPage(page() + 1)">Next →</button>
        </div>
      }
    }

    @if (reminderModalOpen()) {
      <div class="modal-root" (click)="closeReminderModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>Send Reminder</h3>
            <button class="m-x" (click)="closeReminderModal()">✕</button>
          </div>
          <div style="padding:1.2rem 1.3rem">
            @if (reminderError()) {
              <div class="err">{{ reminderError() }}</div>
            }
            @if (reminderResult()) {
              <div class="hint" style="margin-bottom:0.9rem">{{ reminderResult() }}</div>
            }
            <div class="f" style="margin-bottom:1rem">
              <label>Reminder</label>
              <select [(ngModel)]="reminderType">
                <option value="GET_READY">Get Ready — "your test will start at {{ '{' }}time{{ '}' }}, login 5 min early"</option>
                <option value="GO_FOR_IT">Go For It — "the window is open, take the test now" (includes a direct login link)</option>
              </select>
            </div>
            <div class="f" style="margin-bottom:1rem">
              <label>Mode</label>
              <div style="display:flex;gap:1.2rem;margin-top:0.3rem">
                <label style="display:flex;align-items:center;gap:0.4rem;font-weight:600;cursor:pointer">
                  <input type="checkbox" [(ngModel)]="reminderEmail" /> Email
                </label>
                <label style="display:flex;align-items:center;gap:0.4rem;font-weight:600;cursor:pointer">
                  <input type="checkbox" [(ngModel)]="reminderSms" /> SMS
                </label>
              </div>
            </div>
            <p class="hint" style="margin:0 0 1rem">This will be sent to all {{ batchTotal() }} student{{ batchTotal() === 1 ? '' : 's' }} assigned to this batch.</p>
            <div class="bar" style="margin-bottom:0">
              <button class="btn btn-gold" [disabled]="sendingReminder() || (!reminderEmail && !reminderSms)" (click)="sendReminder()">
                {{ sendingReminder() ? 'Sending…' : 'Send Reminder' }}
              </button>
              <button class="btn" (click)="closeReminderModal()">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .back { color: var(--muted, #9fb0d0); font-size: 0.85rem; font-weight: 600; }
      .back:hover { color: #fff; }
      .hint { font-size: 0.82rem; color: var(--muted, #9fb0d0); }
      .err { padding: 0.7rem 1rem; border-radius: 10px; background: rgba(251, 113, 133, 0.12); color: #fecdd3; border: 1px solid rgba(251, 113, 133, 0.3); margin-bottom: 1rem; }
      .empty { padding: 2rem; text-align: center; color: var(--muted, #9fb0d0); }
      .log-table-wrap { overflow-x: auto; }
      .log-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
      .log-table th { text-align: left; padding: 0.6rem 0.8rem; color: var(--faint, #6e7f9e); font-weight: 500; border-bottom: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .log-table td { padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.06)); }
    `,
  ],
})
export class AdminExamBatchRosterPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private batchId!: number;

  protected readonly batch = signal<BatchInfo | null>(null);
  protected readonly rows = signal<RosterRow[]>([]);
  protected readonly total = signal(0);
  protected readonly batchTotal = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly reminderModalOpen = signal(false);
  protected readonly sendingReminder = signal(false);
  protected readonly reminderError = signal('');
  protected readonly reminderResult = signal('');
  protected reminderType: 'GET_READY' | 'GO_FOR_IT' = 'GET_READY';
  protected reminderEmail = true;
  protected reminderSms = true;

  protected query = '';
  protected activeSearch = '';

  protected readonly totalPages = () => Math.max(1, Math.ceil(this.total() / LIMIT));

  ngOnInit(): void {
    this.batchId = Number(this.route.snapshot.paramMap.get('batchId'));
    this.load();
  }

  protected applySearch(): void {
    this.activeSearch = this.query.trim();
    this.page.set(1);
    this.load();
  }

  protected clearSearch(): void {
    this.query = '';
    this.activeSearch = '';
    this.page.set(1);
    this.load();
  }

  protected goPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .get<RosterResponse>(`/exam-batches/${this.batchId}/students`, {
        page: this.page(),
        limit: LIMIT,
        ...(this.activeSearch ? { search: this.activeSearch } : {}),
      })
      .subscribe({
        next: (res) => {
          this.batch.set(res.batch);
          this.rows.set(res.data);
          this.total.set(res.total);
          if (!this.activeSearch) this.batchTotal.set(res.total);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(errText(e));
          this.loading.set(false);
        },
      });
  }

  protected openReminderModal(): void {
    this.reminderError.set('');
    this.reminderResult.set('');
    this.reminderModalOpen.set(true);
  }

  protected closeReminderModal(): void {
    this.reminderModalOpen.set(false);
  }

  protected sendReminder(): void {
    const channels: Array<'email' | 'sms'> = [
      ...(this.reminderEmail ? (['email'] as const) : []),
      ...(this.reminderSms ? (['sms'] as const) : []),
    ];
    if (!channels.length) return;
    this.sendingReminder.set(true);
    this.reminderError.set('');
    this.reminderResult.set('');
    this.api
      .post<{ recipients: number; queued: number }>(`/exam-batches/${this.batchId}/remind`, {
        type: this.reminderType,
        channels,
      })
      .subscribe({
        next: (res) => {
          this.sendingReminder.set(false);
          this.reminderResult.set(`Queued for ${res.queued} of ${res.recipients} students in this batch.`);
        },
        error: (e) => {
          this.sendingReminder.set(false);
          this.reminderError.set(errText(e));
        },
      });
  }
}
