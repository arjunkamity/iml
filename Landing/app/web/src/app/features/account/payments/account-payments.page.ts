import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentDataService } from '../student-data.service';
import type { PaymentView } from '../student-data.service';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { formatDateTime, formatINR } from '../format';

interface DueItem {
  registrationCode: string;
  competition: string;
  competitionCode: string;
  stage: string;
  stageId: number;
  amount: number;
}

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

    @if (banner()) {
      <div class="form-msg alert" [class.error]="banner()!.kind === 'error'" [class.ok]="banner()!.kind === 'ok'" style="margin-bottom: 1rem;">
        {{ banner()!.text }}
      </div>
    }
    @if (payError()) {
      <div class="form-msg alert error" style="margin-bottom: 1rem;">{{ payError() }}</div>
    }

    @if (loading()) {
      <div class="loading">Loading payments…</div>
    } @else {
      @if (dues().length) {
        <div class="table-wrap" style="margin-bottom: 1.4rem; border-color: rgba(251, 191, 36, 0.35);">
          <div class="card-head" style="padding: 1rem 1.2rem 0;">
            <h3 style="margin: 0;">&#9203; Amount Due</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Registration</th>
                <th>Competition</th>
                <th>Stage</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (d of dues(); track d.registrationCode + d.stage) {
                <tr>
                  <td><b class="mono">{{ d.registrationCode }}</b></td>
                  <td>
                    <b>{{ d.competition }}</b><br />
                    <small>{{ d.competitionCode }}</small>
                  </td>
                  <td>{{ d.stage }}</td>
                  <td><b>{{ formatINR(d.amount) }}</b></td>
                  <td>
                    <button
                      class="btn btn-sm btn-gold-solid"
                      [disabled]="paying() === d.stageId"
                      (click)="pay(d)"
                    >
                      {{ paying() === d.stageId ? 'Redirecting…' : 'Pay Now' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <p class="acc-sub" style="padding: 0 1.2rem 1rem; margin: 0;">
            Pay securely via Paytm, or reach out to your school coordinator.
          </p>
        </div>
      }

      @if (payments().length) {
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
      } @else if (!dues().length) {
        <div class="empty">
          <div class="big">&#128176;</div>
          <h3>No payments yet</h3>
          <p>Payments for registration fees and stage unlocks will appear here.</p>
        </div>
      }
    }
  `,
  styles: [ACCOUNT_UI_CSS],
})
export class AccountPaymentsPage implements OnInit, OnDestroy {
  private readonly data = inject(StudentDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly payments = signal<PaymentView[]>([]);
  protected readonly dues = signal<DueItem[]>([]);
  protected readonly paying = signal<number | null>(null);
  protected readonly payError = signal<string | null>(null);
  protected readonly banner = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  protected readonly totalPaid = signal(0);
  protected readonly pendingCount = signal(0);

  // While any payment is Pending, poll for a status flip instead of making
  // the student manually reload. The backend already reconciles Pending
  // Paytm payments two ways — the checkout callback (immediate) and a
  // 5-minute cron backstop for when the callback redirect never lands
  // (see PaymentReconcileService) — this just reflects whichever wins
  // without a manual refresh. Capped at ~2 minutes of polling; if it's
  // still Pending after that, the 5-minute cron backstop will still
  // resolve it, the student just won't see it flip live on this page load.
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private pollAttempts = 0;
  private static readonly POLL_INTERVAL_MS = 15_000;
  private static readonly MAX_POLL_ATTEMPTS = 8;

  ngOnInit(): void {
    this.checkReturnFromPaytm();
    this.load();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  /** Paytm's callback redirects the browser back here with ?orderId=&status=. */
  private checkReturnFromPaytm(): void {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status');
    if (!status) return;

    if (status === 'Paid') {
      this.banner.set({ kind: 'ok', text: 'Payment received — your stage is now unlocked! 🎉' });
    } else if (status === 'ERROR') {
      this.banner.set({ kind: 'error', text: 'Something went wrong confirming your payment. Please check back shortly or contact your coordinator.' });
    } else {
      this.banner.set({ kind: 'error', text: `Payment status: ${status}. If this was a genuine payment, it may still be processing — check back shortly.` });
    }
    // Clear the query params so a refresh doesn't re-show the banner.
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  private load(): void {
    this.fetchDues();
    this.fetchPayments(true);
  }

  private fetchDues(): void {
    this.data.me().subscribe({
      next: (profile) => {
        const dues: DueItem[] = [];
        for (const reg of profile.registrations) {
          // Stages arrive ordered by position — only the earliest Locked+paid
          // stage whose predecessors are all Qualified is actually payable
          // right now (the backend enforces this too); showing a "Pay Now"
          // for a later stage would just be a dead-end 400 on click.
          let priorCleared = true;
          for (const rs of reg.stages) {
            if (rs.status === 'Locked' && !rs.stage.isFree && priorCleared) {
              dues.push({
                registrationCode: reg.code,
                competition: reg.competition.title,
                competitionCode: reg.competition.code,
                stage: rs.stage.name,
                stageId: rs.stage.id,
                amount: Number(rs.stage.price),
              });
            }
            if (rs.status !== 'Qualified') priorCleared = false;
          }
        }
        this.dues.set(dues);
      },
      error: () => this.dues.set([]),
    });
  }

  private fetchPayments(isInitialLoad: boolean): void {
    this.data.payments().subscribe({
      next: (payments) => {
        this.payments.set(payments);
        this.totalPaid.set(
          payments.filter((p) => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0),
        );
        const pending = payments.filter((p) => p.status === 'Pending').length;
        this.pendingCount.set(pending);
        if (isInitialLoad) this.loading.set(false);
        if (pending > 0) this.startPolling();
        else this.stopPolling();
      },
      error: () => {
        if (isInitialLoad) {
          this.payments.set([]);
          this.loading.set(false);
        }
      },
    });
  }

  private startPolling(): void {
    if (this.pollHandle) return; // already running
    this.pollAttempts = 0;
    this.pollHandle = setInterval(() => {
      this.pollAttempts++;
      if (this.pollAttempts > AccountPaymentsPage.MAX_POLL_ATTEMPTS) {
        this.stopPolling();
        return;
      }
      // Re-check both — a Pending payment turning Paid also clears the
      // matching "Amount Due" row (its stage moves off Locked).
      this.fetchDues();
      this.fetchPayments(false);
    }, AccountPaymentsPage.POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  protected pay(due: DueItem): void {
    this.payError.set(null);
    this.paying.set(due.stageId);
    this.data.initiatePayment(due.stageId).subscribe({
      next: (init) => this.data.redirectToCheckout(init),
      error: (e) => {
        this.paying.set(null);
        this.payError.set(e?.error?.message ?? 'Could not start payment. Please try again.');
      },
    });
  }

  protected readonly statusClass = statusClass;
  protected formatINR = formatINR;
  protected formatDateTime = formatDateTime;
}
