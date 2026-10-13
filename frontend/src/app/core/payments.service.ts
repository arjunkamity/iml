import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { InitiatePaymentResponse, PaymentPurpose, PaymentRecord } from './models';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private api = inject(ApiService);

  initiate(purpose: PaymentPurpose) {
    return this.api.post<InitiatePaymentResponse>('/payments/initiate', { purpose });
  }

  getStatus(orderId: string) {
    return this.api.get<PaymentRecord>(`/payments/${orderId}/status`);
  }

  /** All of the current student's payments, most recent first. */
  listMine() {
    return this.api.get<PaymentRecord[]>('/payments/mine');
  }

  /**
   * Paytm's classic Web Checkout flow expects a real browser form POST (not an
   * XHR/fetch) so it can redirect through to its hosted payment page. Build a
   * hidden auto-submitting form with the params the backend returned and
   * submit it — this navigates the browser away.
   */
  redirectToCheckout(init: InitiatePaymentResponse): void {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = init.action;
    form.style.display = 'none';
    for (const [key, value] of Object.entries(init.params)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }
}
