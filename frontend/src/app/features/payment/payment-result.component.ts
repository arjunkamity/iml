import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PaymentsService } from '../../core/payments.service';
import { AuthService } from '../../core/auth.service';
import { PaymentRecord } from '../../core/models';

/**
 * Where Paytm's callback lands after our backend re-verifies the transaction
 * against Paytm's Order Status API (see PAYTM_CALLBACK_URL / FRONTEND_PAYMENT_RESULT_URL
 * on the backend) and redirects the browser here with ?orderId=&status=.
 *
 * We don't trust the `status` query param for display — it's a convenience
 * hint. We re-fetch the authoritative record from the backend, which itself
 * only reflects what Paytm's status API confirmed, not what this URL says.
 */
@Component({
  selector: 'app-payment-result',
  imports: [RouterLink],
  template: `
    <div class="aurora">
      <main class="container page" style="max-width: 560px;">
        <div class="card center">
          @if (loading()) {
            <p class="loading">Checking your payment…</p>
          } @else if (payment()?.Status === 'SUCCESS') {
            <span class="badge green" style="font-size: 1rem; padding: .5rem 1rem;">✓ Payment Successful</span>
            <h2 style="margin-top: 1rem;">Thank you!</h2>
            <p>
              Order <b>{{ payment()?.OrderId }}</b> — ₹{{ payment()?.Amount }} received.
            </p>
          } @else if (payment()?.Status === 'PENDING' || payment()?.Status === 'CREATED') {
            <span class="badge amber" style="font-size: 1rem; padding: .5rem 1rem;">⏳ Payment Pending</span>
            <h2 style="margin-top: 1rem;">We're confirming your payment</h2>
            <p>This can take a few minutes. Refresh this page shortly, or check back from your dashboard.</p>
          } @else if (payment()) {
            <span class="badge red" style="font-size: 1rem; padding: .5rem 1rem;">✕ Payment Failed</span>
            <h2 style="margin-top: 1rem;">Payment didn't go through</h2>
            <p>{{ payment()?.ResponseMsg ?? 'Please try again.' }}</p>
          } @else {
            <span class="badge red" style="font-size: 1rem; padding: .5rem 1rem;">✕ Something went wrong</span>
            <p>{{ error() }}</p>
          }
          <a class="btn btn-primary" style="margin-top: 1.5rem;" [routerLink]="homeLink">Back to Dashboard</a>
        </div>
      </main>
    </div>
  `,
})
export class PaymentResultComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private payments = inject(PaymentsService);
  private auth = inject(AuthService);

  loading = signal(true);
  payment = signal<PaymentRecord | null>(null);
  error = signal<string | null>(null);
  homeLink = '/';

  ngOnInit() {
    this.homeLink = this.auth.homeForRole(this.auth.role());

    const orderId = this.route.snapshot.queryParamMap.get('orderId');
    if (!orderId) {
      this.loading.set(false);
      this.error.set('No order reference was returned by the payment gateway.');
      return;
    }

    this.payments.getStatus(orderId).subscribe({
      next: (p) => {
        this.payment.set(p);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(
          e?.status === 401
            ? 'Please log in to view this payment.'
            : (e?.error?.message ?? 'Could not load payment status.'),
        );
      },
    });
  }
}
