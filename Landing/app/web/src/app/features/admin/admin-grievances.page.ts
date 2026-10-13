import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface GrievanceRow {
  id: number;
  code: string;
  gtype: string;
  studentCode: string | null;
  studentName: string | null;
  name: string | null;
  subject: string | null;
  message: string;
  status: string;
  createdAt: string;
}

interface GrievanceMessage {
  id: number;
  authorType: 'student' | 'admin' | 'system';
  authorName: string;
  body: string;
  createdAt: string;
}

interface GrievanceDetail extends GrievanceRow {
  contact: string | null;
  student: { code: string; name: string; email: string | null; phone: string | null } | null;
  resolver: { name: string } | null;
  messages: GrievanceMessage[];
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? 'Something went wrong';
}

const STATUS_OPTIONS = ['New', 'In Progress', 'Resolved'];
const TYPE_OPTIONS = ['Complaint', 'Feedback', 'Suggestion'];

@Component({
  selector: 'app-admin-grievances',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="bar">
      <input class="test-input" style="width:220px" placeholder="Search ticket, subject, student…" [(ngModel)]="search" (ngModelChange)="onFilterChange()" />
      <select class="test-input" style="width:150px" [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()">
        <option value="">All statuses</option>
        @for (s of statusOptions; track s) { <option [value]="s">{{ s }}</option> }
      </select>
      <select class="test-input" style="width:150px" [(ngModel)]="typeFilter" (ngModelChange)="onFilterChange()">
        <option value="">All types</option>
        @for (t of typeOptions; track t) { <option [value]="t">{{ t }}</option> }
      </select>
      <div class="grow"></div>
    </div>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <div class="gri-layout">
      <div class="card gri-list-card">
        @if (loading()) {
          <div class="empty">Loading…</div>
        } @else if (!rows().length) {
          <div class="empty">No tickets match these filters.</div>
        } @else {
          <div class="gri-list">
            @for (g of rows(); track g.code) {
              <div class="gri-row" [class.active]="selected()?.code === g.code" (click)="select(g.code)">
                <div class="gri-row-top">
                  <b class="mono">{{ g.code }}</b>
                  <span class="badge" [class.badge-off]="g.status !== 'Resolved'">{{ g.status }}</span>
                </div>
                <div class="gri-row-mid">{{ g.subject || g.gtype }}</div>
                <div class="gri-row-bottom">{{ g.studentName || g.name || '—' }} · {{ g.gtype }} · {{ g.createdAt | date: 'short' }}</div>
              </div>
            }
          </div>
        }
      </div>

      <div class="card gri-detail-card">
        @if (!selected()) {
          <div class="empty">Select a ticket to view its conversation.</div>
        } @else {
          @let t = selected()!;
          <div class="gri-detail-head">
            <div>
              <b class="mono">{{ t.code }}</b>
              <span class="badge" [class.badge-off]="t.status !== 'Resolved'" style="margin-left:0.5rem">{{ t.status }}</span>
              <div class="gri-subject">{{ t.subject || t.gtype }}</div>
              <div class="hint">
                {{ t.studentName || t.name || '—' }}
                @if (t.student?.email) { · {{ t.student?.email }} }
                @if (t.student?.phone) { · {{ t.student?.phone }} }
              </div>
            </div>
          </div>

          <div class="gri-thread">
            <div class="gri-msg gri-msg-student">
              <div class="gri-msg-meta"><b>{{ t.studentName || t.name || 'Student' }}</b><small>{{ t.createdAt | date: 'medium' }}</small></div>
              <p>{{ t.message }}</p>
            </div>
            @for (m of t.messages; track m.id) {
              @if (m.authorType === 'system') {
                <div class="gri-msg-system">{{ m.body }} <small>· {{ m.createdAt | date: 'medium' }}</small></div>
              } @else {
                <div class="gri-msg" [class.gri-msg-admin]="m.authorType === 'admin'" [class.gri-msg-student]="m.authorType === 'student'">
                  <div class="gri-msg-meta"><b>{{ m.authorType === 'admin' ? m.authorName + ' (Support)' : m.authorName }}</b><small>{{ m.createdAt | date: 'medium' }}</small></div>
                  <p>{{ m.body }}</p>
                </div>
              }
            }
          </div>

          <form class="gri-reply-form" (ngSubmit)="sendReply(t.code)">
            <textarea [(ngModel)]="replyText" name="reply" rows="3" placeholder="Write a reply to the student…"></textarea>
            <div class="gri-reply-actions">
              <select [(ngModel)]="replyStatus" name="replyStatus">
                <option value="">Keep status: {{ t.status }}</option>
                @for (s of statusOptions; track s) {
                  @if (s !== t.status) { <option [value]="s">Change to {{ s }}</option> }
                }
              </select>
              <span class="grow"></span>
              <button type="submit" class="btn btn-gold" [disabled]="sending() || (!replyText.trim() && !replyStatus)">
                {{ sending() ? 'Sending…' : 'Send' }}
              </button>
            </div>
            @if (replyError()) {
              <div class="hint" style="color:#f87171">{{ replyError() }}</div>
            }
          </form>
        }
      </div>
    </div>

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .test-input { padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid var(--line, rgba(255,255,255,0.09));
        background: rgba(255, 255, 255, 0.04); color: inherit; font: inherit; }
      .badge { font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 999px;
        background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); }
      .badge-off { background: rgba(232, 182, 74, 0.14); color: #e8b64a; border-color: rgba(232, 182, 74, 0.3); }
      .gri-layout { display: grid; grid-template-columns: 340px 1fr; gap: 1rem; align-items: start; }
      .gri-list-card, .gri-detail-card { padding: 0; overflow: hidden; }
      .gri-list { max-height: 72vh; overflow-y: auto; }
      .gri-row { padding: 0.8rem 1rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.06)); cursor: pointer; }
      .gri-row:hover { background: rgba(255, 255, 255, 0.03); }
      .gri-row.active { background: rgba(232, 182, 74, 0.08); border-left: 3px solid var(--gold, #e8b64a); }
      .gri-row-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
      .gri-row-mid { font-size: 0.88rem; margin-top: 0.25rem; color: var(--text, #e6ecf7); }
      .gri-row-bottom { font-size: 0.76rem; color: var(--faint, #6e7f9e); margin-top: 0.2rem; }
      .gri-detail-card { padding: 1.1rem; display: flex; flex-direction: column; min-height: 300px; }
      .gri-detail-head { margin-bottom: 0.9rem; }
      .gri-subject { font-weight: 700; margin-top: 0.3rem; }
      .gri-thread { flex: 1; overflow-y: auto; max-height: 48vh; display: flex; flex-direction: column; gap: 0.7rem; margin-bottom: 0.9rem; padding-right: 0.2rem; }
      .gri-msg { border-radius: 12px; padding: 0.7rem 0.9rem; max-width: 88%; border: 1px solid var(--line, rgba(255,255,255,0.09)); background: rgba(255, 255, 255, 0.03); }
      .gri-msg-student { align-self: flex-start; }
      .gri-msg-admin { align-self: flex-end; background: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.3); }
      .gri-msg-meta { display: flex; justify-content: space-between; gap: 0.6rem; font-size: 0.76rem; color: var(--faint, #6e7f9e); margin-bottom: 0.3rem; }
      .gri-msg p { font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; }
      .gri-msg-system { align-self: center; font-size: 0.76rem; color: var(--faint, #6e7f9e); text-align: center; }
      .gri-reply-form textarea { width: 100%; resize: vertical; border-radius: 8px; border: 1px solid var(--line, rgba(255,255,255,0.09));
        background: rgba(255, 255, 255, 0.04); color: inherit; font: inherit; padding: 0.6rem; }
      .gri-reply-actions { display: flex; align-items: center; gap: 0.6rem; margin-top: 0.6rem; }
      .gri-reply-actions select { padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid var(--line, rgba(255,255,255,0.09));
        background: rgba(255, 255, 255, 0.04); color: inherit; font: inherit; }
      @media (max-width: 900px) {
        .gri-layout { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class AdminGrievancesPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly toast = signal('');
  protected readonly rows = signal<GrievanceRow[]>([]);
  protected readonly selected = signal<GrievanceDetail | null>(null);
  protected readonly sending = signal(false);
  protected readonly replyError = signal('');

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly typeOptions = TYPE_OPTIONS;
  protected search = '';
  protected statusFilter = '';
  protected typeFilter = '';
  protected replyText = '';
  protected replyStatus = '';

  private filterDebounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.load();
  }

  protected onFilterChange(): void {
    if (this.filterDebounce) clearTimeout(this.filterDebounce);
    this.filterDebounce = setTimeout(() => this.load(), 250);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = { limit: '200' };
    if (this.search.trim()) params['search'] = this.search.trim();
    if (this.statusFilter) params['status'] = this.statusFilter;
    if (this.typeFilter) params['gtype'] = this.typeFilter;
    this.api.get<{ data: GrievanceRow[] }>('/grievances', params).subscribe({
      next: (res) => {
        this.rows.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
  }

  protected select(code: string): void {
    this.replyText = '';
    this.replyStatus = '';
    this.replyError.set('');
    this.api.get<GrievanceDetail>(`/grievances/${code}`).subscribe({
      next: (detail) => this.selected.set(detail),
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected sendReply(code: string): void {
    const message = this.replyText.trim() || undefined;
    const status = this.replyStatus || undefined;
    if (!message && !status) return;
    this.sending.set(true);
    this.replyError.set('');
    this.api.post<GrievanceDetail>(`/grievances/${code}/reply`, { message, status }).subscribe({
      next: (detail) => {
        this.sending.set(false);
        this.selected.set(detail);
        this.replyText = '';
        this.replyStatus = '';
        this.rows.update((list) => list.map((g) => (g.code === code ? { ...g, status: detail.status } : g)));
        this.showToast('Reply sent');
      },
      error: (e) => {
        this.sending.set(false);
        this.replyError.set(errText(e));
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
