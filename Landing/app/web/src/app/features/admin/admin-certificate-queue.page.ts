import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface QueueRow {
  id: number;
  registrationCode: string;
  studentCode: string;
  studentName: string;
  studentEmail: string | null;
  competitionCode: string;
  competitionTitle: string;
  eventName: string;
  status: 'Pending' | 'Processing' | 'Sent' | 'Failed';
  attempts: number;
  lastError: string | null;
  createdAt: string;
  processedAt: string | null;
  certificateNumber: string | null;
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? 'Something went wrong';
}

const STATUS_OPTIONS = ['Pending', 'Processing', 'Sent', 'Failed'];

@Component({
  selector: 'app-admin-certificate-queue',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="bar">
      <p class="hint" style="margin:0">
        Certificates are queued the moment a student finishes Stage 1, and sent automatically in the
        background — only while no exam is currently live anywhere, one at a time. This page is for
        visibility, not action; a Failed row can be retried after the underlying issue is fixed.
      </p>
      <div class="grow"></div>
      <select class="test-input" style="width:160px" [(ngModel)]="statusFilter" (ngModelChange)="load()">
        <option value="">All statuses</option>
        @for (s of statusOptions; track s) { <option [value]="s">{{ s }}</option> }
      </select>
      <button class="btn btn-sm" (click)="load()">Refresh</button>
    </div>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (!rows().length) {
      <div class="empty">No certificate jobs match these filters.</div>
    } @else {
      <div class="log-table-wrap">
        <table class="log-table">
          <thead>
            <tr><th>Student</th><th>Competition</th><th>Status</th><th>Attempts</th><th>Queued</th><th>Sent</th><th>Error</th><th></th></tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr>
                <td><b>{{ r.studentName }}</b><br /><small>{{ r.studentCode }} · {{ r.studentEmail || '—' }}</small></td>
                <td>{{ r.competitionCode }} — {{ r.eventName }}</td>
                <td><span class="badge" [class.badge-off]="r.status === 'Failed'">{{ r.status }}</span></td>
                <td>{{ r.attempts }}</td>
                <td>{{ r.createdAt | date: 'short' }}</td>
                <td>{{ r.processedAt ? (r.processedAt | date: 'short') : '—' }}</td>
                <td class="log-detail" [title]="r.lastError || ''">{{ r.lastError || '—' }}</td>
                <td class="acts-cell">
                  @if (r.status === 'Failed') {
                    <button class="btn btn-sm" [disabled]="retrying() === r.id" (click)="retry(r.id)">
                      {{ retrying() === r.id ? 'Retrying…' : 'Retry' }}
                    </button>
                  }
                  @if (r.certificateNumber) {
                    <button class="btn btn-sm" [disabled]="downloading() === r.id" (click)="download(r)">
                      {{ downloading() === r.id ? 'Downloading…' : 'Download' }}
                    </button>
                    <button class="btn btn-sm" [disabled]="resending() === r.id" (click)="resend(r)">
                      {{ resending() === r.id ? 'Sending…' : 'Resend email' }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

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
      .badge-off { background: rgba(248, 113, 113, 0.12); color: #f87171; border-color: rgba(248, 113, 113, 0.3); }
      .acts-cell { display: flex; gap: 0.4rem; flex-wrap: wrap; }
      .log-table-wrap { overflow-x: auto; }
      .log-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
      .log-table th { text-align: left; padding: 0.6rem 0.8rem; color: var(--faint, #6e7f9e); font-weight: 500; border-bottom: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .log-table td { padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.06)); vertical-align: top; }
      .log-detail { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted, #9fb0d0); font-size: 0.78rem; }
    `,
  ],
})
export class AdminCertificateQueuePage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly toast = signal('');
  protected readonly rows = signal<QueueRow[]>([]);
  protected readonly retrying = signal<number | null>(null);
  protected readonly downloading = signal<number | null>(null);
  protected readonly resending = signal<number | null>(null);
  protected readonly statusOptions = STATUS_OPTIONS;
  protected statusFilter = '';

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = { limit: '200' };
    if (this.statusFilter) params['status'] = this.statusFilter;
    this.api.get<{ data: QueueRow[] }>('/certificates/queue', params).subscribe({
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

  protected retry(id: number): void {
    this.retrying.set(id);
    this.api.post(`/certificates/queue/${id}/retry`).subscribe({
      next: () => {
        this.retrying.set(null);
        this.showToast('Queued for retry');
        this.load();
      },
      error: (e) => {
        this.retrying.set(null);
        this.error.set(errText(e));
      },
    });
  }

  protected download(r: QueueRow): void {
    if (!r.certificateNumber) return;
    this.downloading.set(r.id);
    this.api.downloadBlob(`/certificates/${r.certificateNumber}/download`).subscribe({
      next: (blob) => {
        this.downloading.set(null);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${r.certificateNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: async (e: HttpErrorResponse) => {
        this.downloading.set(null);
        this.showToast(await this.blobErrorText(e));
      },
    });
  }

  protected resend(r: QueueRow): void {
    if (!r.certificateNumber) return;
    this.resending.set(r.id);
    this.api.post(`/certificates/${r.certificateNumber}/resend`).subscribe({
      next: () => {
        this.resending.set(null);
        this.showToast('Certificate email resent');
      },
      error: (e) => {
        this.resending.set(null);
        this.showToast(errText(e));
      },
    });
  }

  /** With responseType:'blob', a failed request's error body is ALSO a
   * Blob, not parsed JSON — errText() alone can't read the real message
   * out of it, so unwrap it here first. */
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
    }, 2200);
  }
}
