import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { SiteSettingsService } from '@core/services/site-settings.service';

interface VerifyResult {
  found: boolean;
  certificateNumber?: string;
  certificateType?: string;
  status?: string;
  studentName?: string;
  schoolName?: string | null;
  eventName?: string;
  issuedAt?: string;
}

interface ReportVerifyResult {
  found: boolean;
  code?: string;
  studentName?: string;
  schoolName?: string | null;
  edition?: string;
  stageName?: string;
  version?: number;
  current?: boolean;
  state?: 'current' | 'superseded' | 'withdrawn';
  issuedAt?: string;
  checksum?: string;
}

const CERTIFICATE_TYPE_LABELS: Record<string, string> = {
  PARTICIPATION: 'Participation',
};

/**
 * Landing page for the QR code printed on every IML_PARTICIPATION
 * certificate (see api/src/certificates/certificate-renderer.ts —
 * generateVerifyQrCode()). Looks the scanned certificate number up
 * against GET /public/certificates/verify/:code, which is backed by a
 * real Certificate table — not a fabricated "Verified ✓". A certificate
 * that genuinely isn't in the system (wrong code, or one issued before
 * this table existed) shows a clear "not found" state instead of a
 * false positive.
 */
@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="bg-aurora"></div>
    <div class="bg-grid"></div>
    <main class="auth" style="grid-template-columns: 1fr; place-items: center;">
      <div class="auth-card" style="grid-template-columns: 1fr; max-width: 480px; text-align: center; padding: 2.5rem 2rem;">
        @if (loading()) {
          <p style="font-size:2rem;margin:0 0 0.6rem">🎓</p>
          <h1 class="af-title">Verifying…</h1>
        } @else if (error()) {
          <p style="font-size:2rem;margin:0 0 0.6rem">⚠️</p>
          <h1 class="af-title">Something went wrong</h1>
          <p class="af-lead">{{ error() }}</p>
        } @else if (report()?.found) {
          <p style="font-size:2.2rem;margin:0 0 0.4rem">{{ report()?.state === 'current' ? '✅' : '⚠️' }}</p>
          <h1 class="af-title" [style.color]="report()?.state === 'current' ? '#1c7a3f' : '#b7791f'">{{ report()?.state === 'current' ? 'Report Verified' : report()?.state === 'withdrawn' ? 'Report Withdrawn' : 'Report Found — Not the Current Version' }}</h1>
          <p class="af-lead" style="margin-bottom:1.2rem">
            @if (report()?.state === 'current') { This Future Readiness report is genuine and on record. }
            @else if (report()?.state === 'withdrawn') { This report was issued but has been withdrawn, so it should not be relied on. }
            @else { This report is genuine, but a newer version has been issued since. Ask the holder for the latest one. }
          </p>
          <div style="text-align:left;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:1.2rem 1.4rem;margin:0 0 1.2rem">
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span class="af-lead" style="margin:0">Issued to</span>
              <strong>{{ report()?.studentName }}</strong>
            </div>
            @if (report()?.schoolName) {
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span class="af-lead" style="margin:0">School</span>
              <strong>{{ report()?.schoolName }}</strong>
            </div>
            }
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span class="af-lead" style="margin:0">Edition</span>
              <strong>{{ report()?.edition }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span class="af-lead" style="margin:0">Stage</span>
              <strong>{{ report()?.stageName }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span class="af-lead" style="margin:0">Version</span>
              <strong>{{ report()?.version }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span class="af-lead" style="margin:0">Issued</span>
              <strong>{{ reportDate() }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span class="af-lead" style="margin:0">Report code</span>
              <strong style="font-family:monospace">{{ report()?.code }}</strong>
            </div>
            <div style="padding:0.5rem 0 0">
              <span class="af-lead" style="margin:0">File checksum (SHA-256)</span>
              <div style="font-family:monospace;font-size:0.7rem;word-break:break-all;margin-top:0.2rem">{{ report()?.checksum }}</div>
            </div>
          </div>
          <p class="af-lead" style="font-size:0.8rem">Scores are not shown here. To check a PDF has not been altered, compare its SHA-256 checksum with the one above.</p>
        } @else if (result()?.found) {
          <p style="font-size:2.2rem;margin:0 0 0.4rem">✅</p>
          <h1 class="af-title" style="color:#1c7a3f">Certificate Verified</h1>
          <p class="af-lead" style="margin-bottom:1.2rem">This certificate is genuine and on record.</p>

          <div style="text-align:left;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:1.2rem 1.4rem;margin:0 0 1.2rem">
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span class="af-lead" style="margin:0">Awarded to</span>
              <strong>{{ result()?.studentName }}</strong>
            </div>
            @if (result()?.schoolName) {
              <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
                <span class="af-lead" style="margin:0">School</span>
                <strong>{{ result()?.schoolName }}</strong>
              </div>
            }
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span class="af-lead" style="margin:0">Event</span>
              <strong>{{ result()?.eventName }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span class="af-lead" style="margin:0">Certificate type</span>
              <strong>{{ typeLabel() }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span class="af-lead" style="margin:0">Issued</span>
              <strong>{{ issuedDate() }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:0.4rem 0">
              <span class="af-lead" style="margin:0">Certificate No.</span>
              <strong style="font-family:monospace">{{ result()?.certificateNumber }}</strong>
            </div>
          </div>
        } @else {
          <p style="font-size:2rem;margin:0 0 0.6rem">🚫</p>
          <h1 class="af-title" style="color:#dc2626">Invalid QR Code</h1>
          <p class="af-lead" style="margin-bottom:0.3rem">
            This QR code isn't linked to a valid India Mind League certificate or report.
            @if (certificateNumber()) {
              The code scanned was
              <span style="font-family:monospace;font-weight:700">{{ certificateNumber() }}</span>.
            }
          </p>
          <p class="af-lead">
            If you believe this certificate is genuine, contact us at
            <a [href]="'mailto:' + contactEmail()">{{ contactEmail() }}</a> with the code above.
          </p>
        }
        <a class="btn btn-gold-solid" routerLink="/" style="margin-top:1.4rem;display:inline-block">
          Visit India Mind League →
        </a>
      </div>
    </main>
  `,
})
export class VerifyPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  protected readonly siteSettings = inject(SiteSettingsService);

  protected readonly certificateNumber = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly result = signal<VerifyResult | null>(null);
  protected readonly report = signal<ReportVerifyResult | null>(null);

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code') ?? '';
    this.certificateNumber.set(code);

    if (!code) {
      this.loading.set(false);
      this.result.set({ found: false });
      return;
    }

    // Scorecard report codes start with IMLR-; everything else is a certificate number.
    if (/^IMLR-/i.test(code)) {
      this.api.get<ReportVerifyResult>(`/public/scorecard-reports/verify/${encodeURIComponent(code)}`).subscribe({
        next: (res) => {
          this.report.set(res);
          this.result.set({ found: false });
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not reach the verification service. Please try again shortly.');
          this.loading.set(false);
        },
      });
      return;
    }

    this.api.get<VerifyResult>(`/public/certificates/verify/${encodeURIComponent(code)}`).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not reach the verification service. Please try again shortly.');
        this.loading.set(false);
      },
    });
  }

  protected contactEmail(): string {
    return this.siteSettings.settings().contactEmail;
  }

  protected typeLabel(): string {
    const t = this.result()?.certificateType ?? '';
    return CERTIFICATE_TYPE_LABELS[t] ?? t;
  }

  protected reportDate(): string {
    const iso = this.report()?.issuedAt;
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' });
  }

  protected issuedDate(): string {
    const iso = this.result()?.issuedAt;
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' });
  }
}
