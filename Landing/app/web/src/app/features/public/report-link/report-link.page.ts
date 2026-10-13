import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '@core/services/api.service';

interface LinkInfo {
  state: 'ok' | 'expired' | 'revoked' | 'locked' | 'withdrawn';
  studentFirstName?: string;
  stage?: string;
  edition?: string;
  triesLeft: number;
}

/**
 * The page a parent reaches from the SMS link (api: public/scorecard-links). The long random
 * link plus the 6-digit code from the same message open the report; nothing about the
 * student is shown until the code is right except a first name and the stage.
 */
@Component({
  selector: 'app-report-link',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="bg-aurora"></div>
    <div class="bg-grid"></div>
    <main class="auth" style="grid-template-columns: 1fr; place-items: center;">
      <div class="auth-card" style="grid-template-columns: 1fr; max-width: 480px; text-align: center; padding: 2.5rem 2rem;">
        @if (loading()) {
          <h1 class="af-title">Opening…</h1>
        } @else if (!info()) {
          <p style="font-size:2rem;margin:0 0 0.6rem">🚫</p>
          <h1 class="af-title">This link is not valid</h1>
          <p class="af-lead">Check that you opened the whole link from the message, or ask the school or India Mind League to send it again.</p>
        } @else if (info()!.state === 'ok') {
          <p style="font-size:2rem;margin:0 0 0.6rem">📄</p>
          <h1 class="af-title">{{ info()!.studentFirstName }}'s Future Readiness report</h1>
          <p class="af-lead" style="margin-bottom:1.2rem">{{ info()!.stage }} · {{ info()!.edition }}</p>
          <p class="af-lead">Type the 6-digit code from the message to open the report.</p>
          <form (ngSubmit)="open()" style="display:grid;gap:0.8rem;justify-items:center;margin-top:1rem">
            <input
              name="code"
              [(ngModel)]="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              placeholder="000000"
              aria-label="6-digit code"
              style="font-size:1.6rem;letter-spacing:0.4em;text-align:center;width:11rem;padding:0.6rem 0.4rem;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.25);color:inherit"
            />
            @if (error()) { <p style="color:#dc2626;margin:0">{{ error() }}</p> }
            <button class="btn btn-gold-solid" type="submit" [disabled]="busy() || code.trim().length !== 6">{{ busy() ? 'Opening…' : 'Open report' }}</button>
          </form>
          <p class="af-lead" style="font-size:0.8rem;margin-top:1.2rem">The report is for you and your child. Please do not share this link or code.</p>
        } @else {
          <p style="font-size:2rem;margin:0 0 0.6rem">⚠️</p>
          <h1 class="af-title">{{ title() }}</h1>
          <p class="af-lead">{{ message() }}</p>
        }
        <a class="btn btn-gold-solid" routerLink="/" style="margin-top:1.4rem;display:inline-block">Visit India Mind League →</a>
      </div>
    </main>
  `,
})
export class ReportLinkPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly info = signal<LinkInfo | null>(null);
  protected code = '';
  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.refresh();
  }

  private refresh(): void {
    this.api.get<LinkInfo>(`/public/scorecard-links/${encodeURIComponent(this.token)}`).subscribe({
      next: (i) => {
        this.info.set(i);
        this.loading.set(false);
      },
      error: () => {
        this.info.set(null);
        this.loading.set(false);
      },
    });
  }

  protected title(): string {
    const titles: Record<string, string> = { expired: 'This link has expired', revoked: 'This link is no longer active', locked: 'This link is locked', withdrawn: 'This report is not available' };
    return titles[this.info()?.state ?? 'revoked'] ?? 'This link is not available';
  }

  protected message(): string {
    const s = this.info()?.state;
    if (s === 'locked') return 'Too many wrong codes were typed. Ask the school or India Mind League to send a new link.';
    if (s === 'expired') return 'Ask the school or India Mind League to send a new link.';
    if (s === 'withdrawn') return 'The report has been withdrawn for now. You will be told if it is released again.';
    return 'A newer link may have been sent. Use the latest message, or ask the school or India Mind League to send it again.';
  }

  protected open(): void {
    this.busy.set(true);
    this.error.set('');
    this.api.postBlob(`/public/scorecard-links/${encodeURIComponent(this.token)}/open`, { code: this.code.trim() }).subscribe({
      next: (blob) => {
        this.busy.set(false);
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'IML-Future-Readiness-Report.pdf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        this.refresh();
      },
      error: async (e: HttpErrorResponse) => {
        this.busy.set(false);
        // a failed blob request still carries the server's JSON message as a Blob
        let text = 'Could not open the report. Please try again.';
        try {
          const body = e.error instanceof Blob ? JSON.parse(await e.error.text()) : e.error;
          if (body?.message) text = Array.isArray(body.message) ? body.message[0] : body.message;
        } catch {
          /* keep the default */
        }
        this.error.set(text);
        this.refresh();
      },
    });
  }
}
