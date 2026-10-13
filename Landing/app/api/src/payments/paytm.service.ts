import { Injectable, Logger } from '@nestjs/common';
import PaytmChecksum from 'paytmchecksum';

/** Fields for the classic Web Checkout (redirect) flow — POSTed by the
 *  frontend, as an auto-submitting form, to PAYTM_REQUEST_URL. */
export interface PaytmInitParams {
  MID: string;
  ORDER_ID: string;
  CUST_ID: string;
  INDUSTRY_TYPE_ID: string;
  CHANNEL_ID: string;
  TXN_AMOUNT: string;
  WEBSITE: string;
  CALLBACK_URL: string;
  EMAIL?: string;
  MOBILE_NO?: string;
}

export interface PaytmOrderStatus {
  resultStatus: 'TXN_SUCCESS' | 'TXN_FAILURE' | 'PENDING' | string;
  resultCode?: string;
  resultMsg?: string;
  txnId?: string;
  paymentMode?: string;
  raw: unknown;
}

@Injectable()
export class PaytmService {
  private readonly logger = new Logger(PaytmService.name);

  private get merchantKey(): string {
    return process.env.PAYTM_MERCHANT_KEY ?? '';
  }

  /** Build the auto-submit form params + checksum for the Web Checkout redirect flow. */
  async buildInitParams(
    params: PaytmInitParams,
  ): Promise<PaytmInitParams & { CHECKSUMHASH: string }> {
    const checksum = await PaytmChecksum.generateSignature({ ...params }, this.merchantKey);
    return { ...params, CHECKSUMHASH: checksum };
  }

  /**
   * Verify the checksum on Paytm's callback POST. This confirms the payload came
   * from Paytm and wasn't tampered with in transit — it is NOT, by itself, proof
   * that the payment succeeded. Always follow up with fetchOrderStatus().
   */
  async verifyCallback(body: Record<string, string>): Promise<boolean> {
    const checksum = body['CHECKSUMHASH'];
    if (!checksum) return false;
    try {
      return await PaytmChecksum.verifySignature({ ...body }, this.merchantKey, checksum);
    } catch (err) {
      this.logger.error(`Checksum verification failed: ${String(err)}`);
      return false;
    }
  }

  /**
   * Authoritative status check (Paytm v3 Order Status API). Call this to decide
   * what actually happened — never trust the callback body's STATUS field alone.
   */
  async fetchOrderStatus(orderId: string): Promise<PaytmOrderStatus> {
    const mid = process.env.PAYTM_MERCHANT_ID ?? '';
    const statusUrl = process.env.PAYTM_STATUS_URL ?? '';
    const body = { mid, orderId };
    const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), this.merchantKey);

    const res = await fetch(statusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, head: { signature } }),
    });
    if (!res.ok) {
      throw new Error(`Paytm order status check failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as { body?: Record<string, unknown> };
    const b = json.body ?? {};
    const resultInfo = (b['resultInfo'] as Record<string, unknown>) ?? {};

    return {
      resultStatus: String(resultInfo['resultStatus'] ?? 'PENDING'),
      resultCode: resultInfo['resultCode'] as string | undefined,
      resultMsg: resultInfo['resultMsg'] as string | undefined,
      txnId: b['txnId'] as string | undefined,
      paymentMode: b['paymentMode'] as string | undefined,
      raw: json,
    };
  }
}
