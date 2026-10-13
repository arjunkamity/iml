import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaymentsService } from '../../core/payments.service';
import { PaymentPurpose, PaymentRecord } from '../../core/models';

interface PayableItem {
  purpose: PaymentPurpose;
  title: string;
  amount: number;
  description: string;
}

type PurposeState = 'unpaid' | 'pending' | 'paid';

// Display copy only — the amount actually charged always comes from the
// backend's /payments/initiate response, which looks it up server-side.
const PAYABLE_ITEMS: PayableItem[] = [
  {
    purpose: 'STAGE1_REGISTRATION',
    title: 'Stage 1 — Online Registration',
    amount: 500,
    description: 'Unlocks the Stage 1 online qualifier and your digital Participation Certificate.',
  },
  {
    purpose: 'STAGE3_BOOTCAMP',
    title: 'Stage 3 — Amity Leadership Bootcamp',
    amount: 3500,
    description: 'Certified expert training in IQ, EQ, SQ & LQ, plus your personalised Future Readiness Report.',
  },
];

@Component({
  selector: 'app-pay',
  imports: [RouterLink],
  template: `
    <h1>Payments</h1>
    <p>Complete your registration or bootcamp fee securely via Paytm.</p>
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    <div class="grid cols-2">
      @for (item of items; track item.purpose) {
        <div class="card">
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
          <div class="stat" style="margin: .9rem 0;">
            <span class="num">₹{{ item.amount }}</span>
          </div>
          @switch (stateFor(item.purpose)) {
            @case ('paid') {
              <span class="badge green" style="padding: .55rem 1rem; font-size: .9rem;">✓ Paid</span>
            }
            @case ('pending') {
              <span class="badge amber" style="padding: .55rem 1rem; font-size: .9rem; margin-bottom: .6rem; display: inline-flex;">
                ⏳ Payment pending
              </span>
              <a class="btn btn-block" [routerLink]="['/payment/result']" [queryParams]="{ orderId: latestOrderId(item.purpose) }">
                Check status
              </a>
            }
            @default {
              <button
                class="btn btn-primary btn-block"
                [disabled]="loading() === item.purpose || checking()"
                (click)="pay(item.purpose)"
              >
                {{ loading() === item.purpose ? 'Redirecting to Paytm…' : 'Pay Now' }}
              </button>
            }
          }
        </div>
      }
    </div>
  `,
})
export class PayComponent implements OnInit {
  private payments = inject(PaymentsService);

  items = PAYABLE_ITEMS;
  loading = signal<PaymentPurpose | null>(null);
  checking = signal(true);
  error = signal<string | null>(null);
  private mine = signal<PaymentRecord[]>([]);

  ngOnInit() {
    this.payments.listMine().subscribe({
      next: (rows) => {
        this.mine.set(rows);
        this.checking.set(false);
      },
      error: () => {
        // Non-fatal — just fall back to letting the student attempt to pay.
        this.checking.set(false);
      },
    });
  }

  /** Rows are already most-recent-first from the API. */
  private latestFor(purpose: PaymentPurpose): PaymentRecord | undefined {
    return this.mine().find((p) => p.Purpose === purpose);
  }

  stateFor(purpose: PaymentPurpose): PurposeState {
    const latest = this.latestFor(purpose);
    if (!latest) return 'unpaid';
    if (latest.Status === 'SUCCESS') return 'paid';
    if (latest.Status === 'CREATED' || latest.Status === 'PENDING') return 'pending';
    return 'unpaid'; // FAILED / CANCELLED — let them retry
  }

  latestOrderId(purpose: PaymentPurpose): string | undefined {
    return this.latestFor(purpose)?.OrderId;
  }

  pay(purpose: PaymentPurpose) {
    this.error.set(null);
    this.loading.set(purpose);
    this.payments.initiate(purpose).subscribe({
      next: (init) => this.payments.redirectToCheckout(init),
      error: (e) => {
        this.loading.set(null);
        this.error.set(e?.error?.message ?? 'Could not start payment. Please try again.');
      },
    });
  }
}
