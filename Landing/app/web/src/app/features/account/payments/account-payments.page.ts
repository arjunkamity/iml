import { Component, OnInit, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { StudentDataService } from '../student-data.service';
import type { PaymentView } from '../student-data.service';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { formatDateTime, formatINR } from '../format';

function statusClass(status: string): string {
  const map: Record<string, string> = {
    Paid: 'tag-green',
    Pending: 'tag-amber',
    Failed: 'tag-red',
    Refunded: 'tag-violet',
  };
  return map[status] ?? 'tag-muted';
}

@Component({
  selector: 'app-account-payments',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="acc-head">
      <div>
        <div class="acc-eyebrow">Payments</div>
        <h1 class="acc-title">Payment History</h1>
        <p class="acc-sub">All payments made for your registrations and stage unlocks, with receipts.</p>
      </div>
    </div>

    @if (loading()) {
      <div class="loading">Loading payments…</div>
    } @else if (payments().length) {
      <div class="stat-grid" style="margin-bottom:1.1rem">
        <div class="stat">
          <span class="stat-ic green">&#128176;</span>
          <div><b>{{ formatINR(totalPaid()) }}</b><small>Total paid</small></div>
        </div>
        <div class="stat">
          <span class="stat-ic amber">&#9203;</span>
          <div><b>{{ pendingCount() }}</b><small>Pending</small></div>
        </div>
        <div class="stat">
          <span class="stat-ic red">{{ payments().length }}</span>
          <div><b>{{ payments().length }}</b><small>Transactions</small></div>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Competition</th>
              <th>Stage</th>
              <th>Amount</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            @for (p of payments(); track p.code) {
              <tr>
                <td><b class="mono">{{ p.code }}</b></td>
                <td>
                  <b>{{ p.competition }}</b><br />
                  <small>{{ p.competitionCode }}</small>
                </td>
                <td>{{ p.stage ?? 'Registration' }}</td>
                <td><b>{{ formatINR(p.amount) }}</b></td>
                <td>{{ p.mode }}</td>
                <td><span class="tag" [ngClass]="statusClass(p.status)">{{ p.status }}</span></td>
                <td>{{ formatDateTime(p.paidAt ?? p.createdAt) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="empty">
        <div class="big">&#128176;</div>
        <h3>No payments yet</h3>
        <p>Payments for registration fees and stage unlocks will appear here.</p>
      </div>
    }
  `,
  styles: [ACCOUNT_UI_CSS],
})
export class AccountPaymentsPage implements OnInit {
  private readonly data = inject(StudentDataService);
  protected readonly loading = signal(true);
  protected readonly payments = signal<PaymentView[]>([]);

  protected readonly totalPaid = signal(0);
  protected readonly pendingCount = signal(0);

  ngOnInit(): void {
    this.data.payments().subscribe({
      next: (payments) => {
        this.payments.set(payments);
        this.totalPaid.set(
          payments.filter((p) => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0),
        );
        this.pendingCount.set(payments.filter((p) => p.status === 'Pending').length);
        this.loading.set(false);
      },
      error: () => {
        this.payments.set([]);
        this.loading.set(false);
      },
    });
  }

  protected readonly statusClass = statusClass;
  protected formatINR = formatINR;
  protected formatDateTime = formatDateTime;
}
