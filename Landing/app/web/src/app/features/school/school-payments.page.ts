import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '@core/services/api.service';
import { SchoolDataService, SchoolPaymentRow } from './school-data.service';
import { ADMIN_UI_CSS } from '@admin/admin-ui';

interface GradeOption {
  name: string;
}

function errText(e: HttpErrorResponse): string {
  const m = (e.error as { message?: string | string[] })?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
  return m ?? 'Something went wrong.';
}

const STATUS_BADGE: Record<string, string> = { Paid: 'green', Pending: 'gold', Failed: 'red' };

@Component({
  selector: 'app-school-payments',
  standalone: true,
  imports: [FormsModule, NgClass],
  template: `
    <div class="bar">
      <select class="filter" [(ngModel)]="comp" (ngModelChange)="go(1)">
        <option value="">All competitions</option>
        @for (c of competitions(); track c.code) {
          <option [value]="c.code">{{ c.title }}</option>
        }
      </select>
      <select class="filter" [(ngModel)]="status" (ngModelChange)="go(1)">
        <option value="">All statuses</option>
        <option value="Paid">Paid</option>
        <option value="Pending">Pending</option>
        <option value="Failed">Failed</option>
      </select>
      <select class="filter" [(ngModel)]="grade" (ngModelChange)="go(1)">
        <option value="">All Class</option>
        @for (g of grades(); track g) {
          <option [value]="g">{{ g }}</option>
        }
      </select>
      <div class="grow"></div>
      <button class="btn" [disabled]="exportBusy()" (click)="exportXlsx()">{{ exportBusy() ? 'Preparing…' : '⇩ Export Excel' }}</button>
      <span style="font-size:0.82rem;color:var(--muted,#9fb0d0)">{{ total() }} payment{{ total() === 1 ? '' : 's' }}</span>
    </div>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    <div class="tbl-wrap">
      <table>
        <thead>
          <tr><th>Student</th><th>Competition</th><th>Stage</th><th>Amount</th><th>Mode</th><th>Status</th><th>Paid</th></tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.code) {
            <tr>
              <td data-label="Student">
                <span class="b">{{ r.student }}</span><br />
                <small style="color:var(--faint,#6e7f9e)">{{ r.studentCode }}</small>
              </td>
              <td data-label="Competition">
                <small>{{ r.competitionCode }}</small><br />
                {{ r.competition }}
              </td>
              <td data-label="Stage">{{ r.stage ?? '—' }}</td>
              <td data-label="Amount"><span class="b">₹{{ r.amount }}</span></td>
              <td data-label="Mode">{{ r.mode }}</td>
              <td data-label="Status"><span class="bdg" [ngClass]="badge(r.status)">{{ r.status }}</span></td>
              <td data-label="Paid">{{ r.paidAt ? when(r.paidAt) : '—' }}</td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="empty">No payments yet.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (total() > 0) {
      <div class="pager">
        <span>{{ (page() - 1) * limit + 1 }}–{{ min(page() * limit, total()) }} of {{ total() }}</span>
        <button class="btn btn-sm" [disabled]="page() <= 1" (click)="go(page() - 1)">← Prev</button>
        <button class="btn btn-sm" [disabled]="page() * limit >= total()" (click)="go(page() + 1)">Next →</button>
      </div>
    }
  `,
  styles: [ADMIN_UI_CSS],
})
export class SchoolPaymentsPage implements OnInit {
  private readonly data = inject(SchoolDataService);
  private readonly api = inject(ApiService);

  protected readonly rows = signal<SchoolPaymentRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly limit = 15;
  protected readonly error = signal('');
  protected readonly exportBusy = signal(false);
  protected readonly competitions = signal<{ code: string; title: string }[]>([]);
  protected readonly grades = signal<string[]>([]);
  protected comp = '';
  protected status = '';
  protected grade = '';

  ngOnInit(): void {
    this.load();
    this.data.competitions().subscribe({
      next: (rows) => this.competitions.set(rows),
      error: () => this.competitions.set([]),
    });
    this.api.get<GradeOption[]>('/public/grades').subscribe({
      next: (rows) => this.grades.set((rows ?? []).map((g) => g.name)),
      error: () => this.grades.set([]),
    });
  }

  private load(): void {
    this.error.set('');
    this.data.payments(this.page(), this.limit, this.comp || undefined, this.status || undefined, this.grade || undefined).subscribe({
      next: (r) => {
        this.rows.set(r.data);
        this.total.set(r.total);
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  protected exportXlsx(): void {
    if (this.exportBusy()) return;
    const params: Record<string, unknown> = {};
    if (this.comp) params['comp'] = this.comp;
    if (this.status) params['status'] = this.status;
    if (this.grade) params['grade'] = this.grade;
    this.exportBusy.set(true);
    this.api.downloadBlob('/school/payments/export', params).subscribe({
      next: (blob) => {
        this.exportBusy.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'payments-export.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (e) => {
        this.exportBusy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected go(p: number): void {
    this.page.set(p);
    this.load();
  }

  protected min(a: number, b: number): number {
    return Math.min(a, b);
  }

  protected badge(status: string): string {
    return STATUS_BADGE[status] ?? 'grey';
  }

  protected when(iso: string): string {
    return iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : '—';
  }
}
