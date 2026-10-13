import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface BroadcastRow {
  code: string;
  subject: string;
  audience: string;
  status: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  sentAt: string | null;
}

interface BroadcastRecipientRow {
  email: string;
  vars: Record<string, string>;
  status: string;
  attempts: number;
  lastError: string | null;
  processedAt: string | null;
}

interface BroadcastDetail extends BroadcastRow {
  body: string;
  customEmails: string | null;
  recipients: BroadcastRecipientRow[];
}

interface AudiencePreview {
  count: number;
  sample: { email: string; [key: string]: string }[];
}

type Audience = 'all' | 'students' | 'schools' | 'schools-all' | 'schools-pending' | 'unpaid';

// Custom email addresses are always additive — appended on top of
// whichever group is selected below, never a separate mode (see
// BroadcastService.resolveAudience on the backend).
//
// "All Schools" addresses the institution's own address (School.schoolEmail
// — front office, info@…) and "All Coordinators" addresses the named
// person who actually signs in (School.email) — two genuinely different
// addresses, not two framings of the same one. A school with no
// schoolEmail set just isn't included in "All Schools".
const AUDIENCES: { value: Audience; label: string; mergeFields: string[]; note?: string }[] = [
  { value: 'all', label: 'All Users', mergeFields: ['SchoolName', 'SchoolCode', 'CoordinatorName', 'City', 'StudentName', 'StudentCode', 'Grade'] },
  { value: 'students', label: 'All Students', mergeFields: ['StudentName', 'StudentCode', 'Grade', 'SchoolName'] },
  {
    value: 'schools-all',
    label: 'All Schools',
    mergeFields: ['SchoolName', 'SchoolCode', 'City'],
    note: 'Sends to each school’s own institutional address (its "School’s email" in Admin › Schools) — not the coordinator’s personal login email, and no login credentials are included.',
  },
  { value: 'schools', label: 'All Coordinators', mergeFields: ['SchoolName', 'SchoolCode', 'CoordinatorName', 'City', 'LoginId', 'LoginPassword'] },
  {
    value: 'schools-pending',
    label: 'Coordinators — Pending Setup',
    mergeFields: ['SchoolName', 'SchoolCode', 'CoordinatorName', 'City', 'LoginId', 'LoginPassword'],
    note: 'Only coordinators who haven’t completed their first login yet — every recipient gets a real, currently-working {LoginPassword}. (A coordinator who already set their own password isn’t included here, since nobody — including this app — knows what they changed it to.)',
  },
  {
    value: 'unpaid',
    label: 'Unpaid Registrations',
    mergeFields: ['StudentName', 'StudentCode', 'RegID', 'SchoolName', 'Amount', 'CompetitionName'],
    note: 'Students who registered but have no successful payment on file yet, and whose first stage actually has a fee — one email per student even if they have more than one such registration.',
  },
];

function errText(err: unknown): string {
  const e = err as { error?: { message?: string | string[] }; message?: string };
  const m = e?.error?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong';
  return m ?? e?.message ?? 'Something went wrong';
}

@Component({
  selector: 'app-admin-broadcasts',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    @if (view() === 'list') {
      <div class="bar">
        <span style="font-size:0.82rem;color:var(--muted,#9fb0d0)">One-off emails to your schools, students or a custom list — every send is a permanent record below.</span>
        <div class="grow"></div>
        <button class="btn btn-gold btn-sm" (click)="openCompose()">+ New Broadcast</button>
      </div>

      @if (error()) {
        <div class="err">{{ error() }}</div>
      }

      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Code</th><th>Subject</th><th>Audience</th><th>Status</th><th>Sent / Total</th><th>Failed</th><th>Created</th><th></th></tr></thead>
          <tbody>
            @for (b of rows(); track b.code) {
              <tr>
                <td style="font-family:monospace;font-size:0.85rem;">{{ b.code }}</td>
                <td><span class="b">{{ b.subject }}</span></td>
                <td>{{ audienceLabel(b.audience) }}</td>
                <td><span class="bdg" [class]="'bdg ' + statusBadge(b.status)">{{ b.status }}</span></td>
                <td>{{ b.sentCount }} / {{ b.totalCount }}</td>
                <td>{{ b.failedCount || '—' }}</td>
                <td>{{ b.createdAt | date: 'MMM d, y, h:mm a' }}</td>
                <td class="bar" style="gap:0.4rem">
                  <button class="btn btn-sm" (click)="openDetail(b.code)">{{ b.status === 'Draft' ? 'Edit' : 'View' }}</button>
                  <button class="btn btn-sm" (click)="cloneBroadcast(b.code)" [disabled]="cloneBusy() === b.code" title="Duplicate this into a new draft you can edit and send separately">
                    {{ cloneBusy() === b.code ? 'Cloning…' : 'Clone' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="empty">No broadcasts yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (view() === 'compose') {
      <div class="bar">
        <button class="btn btn-sm" (click)="view.set('list'); load()">&#8592; Back to broadcasts</button>
      </div>
      <div class="card" style="max-width:820px">
        <div style="font-weight:800;font-size:1.05rem;margin-bottom:0.3rem">{{ editingCode() ? 'Edit draft' : 'New Broadcast' }}</div>
        @if (formErr()) {
          <div class="err">{{ formErr() }}</div>
        }

        <div class="f">
          <label>Send to</label>
          <div class="aud-picker">
            @for (a of audiences; track a.value) {
              <button
                type="button"
                class="aud-opt"
                [class.on]="audience === a.value"
                (click)="selectAudience(a.value)"
              >
                {{ a.label }}
                <small>{{ audienceCount(a.value) }}</small>
              </button>
            }
          </div>
        </div>

        <p style="color:var(--muted,#9fb0d0);font-size:0.85rem;margin:0.4rem 0 0.9rem;">
          Merge fields available in subject/body:
          @for (f of currentMergeFields(); track f) {
            <code>{{ '{' + f + '}' }}</code>
          }
        </p>
        @if (currentAudienceNote(); as note) {
          <p style="background:rgba(232,182,74,0.1);border:1px solid rgba(232,182,74,0.3);border-radius:8px;padding:0.6rem 0.8rem;font-size:0.82rem;color:var(--text,#eef2fb);margin:0 0 0.9rem;">
            {{ note }}
          </p>
        }

        <div class="f">
          <label>+ Additional email addresses (optional)</label>
          <textarea [(ngModel)]="customEmails" rows="3" placeholder="Sent alongside the group above — one@example.com, two@example.com&#10;or one per line"></textarea>
          <small style="color:var(--muted,#9fb0d0)">{{ customEmailCount() }} valid address(es) detected — these won't have merge fields filled in.</small>
        </div>

        <div class="f"><label>Subject</label><input [(ngModel)]="subject" placeholder="e.g. Invitation: India Mind League — Registrations Now Open" /></div>
        <div class="f"><label>Body (HTML)</label><textarea [(ngModel)]="body" rows="14" style="font-family:monospace;font-size:0.85rem;"></textarea></div>

        <div class="bar" style="margin:0.8rem 0">
          <button class="btn btn-sm" (click)="save()">{{ editingCode() ? 'Save draft' : 'Create draft' }}</button>
          @if (editingCode()) {
            <button class="btn btn-sm btn-danger" (click)="removeDraft()">Delete draft</button>
          }
        </div>

        @if (editingCode()) {
          <div class="card" style="margin-top:1rem;background:rgba(255,255,255,0.03)">
            <div style="font-weight:700;margin-bottom:0.6rem">Preview audience</div>
            <button class="btn btn-sm" (click)="loadAudiencePreview()">Preview who this reaches</button>
            @if (audiencePreview()) {
              <p style="margin:0.7rem 0 0.4rem;font-size:0.9rem;">
                <b>{{ audiencePreview()!.count }}</b> recipient(s) will receive this.
              </p>
              @if (audiencePreview()!.sample.length) {
                <div class="tbl-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Email</th></tr></thead>
                    <tbody>
                      @for (s of audiencePreview()!.sample; track s.email) {
                        <tr><td>{{ s['SchoolName'] || s['StudentName'] || '—' }}</td><td>{{ s.email }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
                <p style="font-size:0.78rem;color:var(--muted,#9fb0d0);margin-top:0.4rem">Showing first 10 of {{ audiencePreview()!.count }}.</p>
              }
            }
          </div>

          <div class="card" style="margin-top:1rem;background:rgba(255,255,255,0.03)">
            <div style="font-weight:700;margin-bottom:0.6rem">Send a test copy to yourself first</div>
            <div class="bar">
              <input style="flex:1" [(ngModel)]="testEmail" placeholder="you@example.com" />
              <button class="btn btn-sm" (click)="sendTest()" [disabled]="testBusy()">{{ testBusy() ? 'Sending…' : 'Send test' }}</button>
            </div>
            @if (testMsg()) {
              <p style="font-size:0.85rem;margin-top:0.5rem" [style.color]="testOk() ? '#86efac' : '#fecdd3'">{{ testMsg() }}</p>
            }
          </div>

          <div class="card" style="margin-top:1rem;border-color:rgba(251,113,133,0.35)">
            <div style="font-weight:700;margin-bottom:0.5rem">Send for real</div>
            <p style="font-size:0.85rem;color:var(--muted,#9fb0d0);margin:0 0 0.8rem;">
              This queues one real email per recipient and cannot be undone or edited afterward. Preview the audience and send yourself a
              test first.
            </p>
            <button class="btn btn-gold" (click)="sendReal()">Send to {{ audiencePreview()?.count ?? 'all' }} recipient(s)</button>
          </div>
        }
      </div>
    }

    @if (view() === 'detail' && detail()) {
      <div class="bar">
        <button class="btn btn-sm" (click)="view.set('list'); load()">&#8592; Back to broadcasts</button>
        <div class="grow"></div>
        @if (detail()!.status !== 'Draft') {
          <button class="btn btn-sm" (click)="refreshDetail()">Refresh</button>
        }
      </div>
      <div class="card" style="max-width:820px;margin-bottom:1rem">
        <div style="font-weight:800;font-size:1.05rem">{{ detail()!.subject }}</div>
        <p style="color:var(--muted,#9fb0d0);font-size:0.85rem;margin:0.4rem 0 0.8rem;">
          <span class="bdg" [class]="'bdg ' + statusBadge(detail()!.status)">{{ detail()!.status }}</span>
          &nbsp; {{ audienceLabel(detail()!.audience) }} &nbsp; {{ detail()!.sentCount }} sent, {{ detail()!.failedCount }} failed, {{ detail()!.totalCount }} total
        </p>
        <div class="mail-preview" [innerHTML]="detail()!.body"></div>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Email</th><th>Name</th><th>Status</th><th>Attempts</th><th>Error</th></tr></thead>
          <tbody>
            @for (r of detail()!.recipients; track r.email) {
              <tr>
                <td>{{ r.email }}</td>
                <td>{{ r.vars?.['SchoolName'] ?? r.vars?.['StudentName'] ?? '—' }}</td>
                <td><span class="bdg" [class]="'bdg ' + statusBadge(r.status)">{{ r.status }}</span></td>
                <td>{{ r.attempts }}</td>
                <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ r.lastError ?? '—' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty">Not sent yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `.mail-preview { background: #fff; color: #111; border-radius: 8px; padding: 1.2rem 1.4rem; font-family: Arial, sans-serif; max-height: 480px; overflow: auto; }
     .mail-preview h3 { margin-top: 1.1rem; }
     code { background: rgba(255,255,255,0.08); padding: 0.05rem 0.35rem; border-radius: 4px; margin-right: 0.3rem; }
     .aud-picker { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.3rem; }
     .aud-opt {
       display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem;
       padding: 0.5rem 0.9rem; border-radius: 10px; cursor: pointer;
       border: 1px solid var(--line-2, rgba(255,255,255,0.16)); background: rgba(255,255,255,0.03);
       color: var(--text, #eef2fb); font-weight: 600; font-size: 0.88rem;
     }
     .aud-opt small { color: var(--muted, #9fb0d0); font-weight: 500; font-size: 0.75rem; }
     .aud-opt.on { border-color: var(--gold, #e8b64a); background: rgba(232, 182, 74, 0.12); }
     .aud-opt.on small { color: var(--gold-2, #f5cc5a); }`,
  ],
})
export class AdminBroadcastsPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly audiences = AUDIENCES;
  protected readonly view = signal<'list' | 'compose' | 'detail'>('list');
  protected readonly rows = signal<BroadcastRow[]>([]);
  protected readonly error = signal('');
  protected readonly formErr = signal('');
  protected readonly editingCode = signal<string | null>(null);
  protected readonly audiencePreview = signal<AudiencePreview | null>(null);
  protected readonly detail = signal<BroadcastDetail | null>(null);
  protected readonly testBusy = signal(false);
  protected readonly testMsg = signal('');
  protected readonly testOk = signal(true);
  protected readonly counts = signal<Partial<Record<Audience, number>>>({});
  protected readonly cloneBusy = signal<string | null>(null);

  subject = '';
  body = '';
  audience: Audience = 'schools';
  customEmails = '';
  testEmail = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.error.set('');
    this.api.get<{ data: BroadcastRow[] }>('/broadcasts').subscribe({
      next: (r) => this.rows.set(r.data),
      error: (e) => this.error.set(errText(e)),
    });
  }

  statusBadge(status: string): string {
    if (status === 'Sent') return 'green';
    if (status === 'Sending') return 'gold';
    if (status === 'Failed') return 'red';
    return 'grey';
  }

  audienceLabel(value: string): string {
    return AUDIENCES.find((a) => a.value === value)?.label ?? value;
  }

  currentMergeFields(): string[] {
    return AUDIENCES.find((a) => a.value === this.audience)?.mergeFields ?? [];
  }

  currentAudienceNote(): string | null {
    return AUDIENCES.find((a) => a.value === this.audience)?.note ?? null;
  }

  audienceCount(value: Audience): string {
    const c = this.counts()[value];
    return c == null ? '…' : `(${c})`;
  }

  customEmailCount(): number {
    const seen = new Set<string>();
    for (const piece of this.customEmails.split(/[\n,;]+/)) {
      const email = piece.trim().toLowerCase();
      if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) seen.add(email);
    }
    return seen.size;
  }

  private loadCounts(): void {
    forkJoin({
      all: this.api.get<AudiencePreview>('/broadcasts/audience-preview', { audience: 'all' }),
      students: this.api.get<AudiencePreview>('/broadcasts/audience-preview', { audience: 'students' }),
      schools: this.api.get<AudiencePreview>('/broadcasts/audience-preview', { audience: 'schools' }),
      schoolsAll: this.api.get<AudiencePreview>('/broadcasts/audience-preview', { audience: 'schools-all' }),
      schoolsPending: this.api.get<AudiencePreview>('/broadcasts/audience-preview', { audience: 'schools-pending' }),
      unpaid: this.api.get<AudiencePreview>('/broadcasts/audience-preview', { audience: 'unpaid' }),
    }).subscribe({
      next: (r) =>
        this.counts.set({
          all: r.all.count,
          students: r.students.count,
          schools: r.schools.count,
          'schools-all': r.schoolsAll.count,
          'schools-pending': r.schoolsPending.count,
          unpaid: r.unpaid.count,
        }),
      error: () => this.counts.set({}),
    });
  }

  selectAudience(value: Audience): void {
    this.audience = value;
    this.audiencePreview.set(null);
  }

  openCompose(): void {
    this.editingCode.set(null);
    this.subject = '';
    this.body = '';
    this.audience = 'schools';
    this.customEmails = '';
    this.audiencePreview.set(null);
    this.testMsg.set('');
    this.formErr.set('');
    this.view.set('compose');
    this.loadCounts();
  }

  openDetail(code: string): void {
    this.error.set('');
    this.api.get<BroadcastDetail>(`/broadcasts/${code}`).subscribe({
      next: (d) => {
        if (d.status === 'Draft') {
          this.editingCode.set(d.code);
          this.subject = d.subject;
          this.body = d.body;
          this.audience = (d.audience as Audience) || 'schools';
          this.customEmails = d.customEmails ?? '';
          this.audiencePreview.set(null);
          this.testMsg.set('');
          this.formErr.set('');
          this.view.set('compose');
          this.loadCounts();
        } else {
          this.detail.set(d);
          this.view.set('detail');
        }
      },
      error: (e) => this.error.set(errText(e)),
    });
  }

  refreshDetail(): void {
    const code = this.detail()?.code;
    if (code) this.openDetail(code);
  }

  save(): void {
    this.formErr.set('');
    if (!this.subject.trim() || !this.body.trim()) {
      this.formErr.set('Subject and body are both required.');
      return;
    }
    const payload = {
      subject: this.subject,
      body: this.body,
      audience: this.audience,
      customEmails: this.customEmails || undefined,
    };
    const code = this.editingCode();
    const req = code
      ? this.api.patch<BroadcastDetail>(`/broadcasts/${code}`, payload)
      : this.api.post<BroadcastDetail>('/broadcasts', payload);
    req.subscribe({
      next: (b) => {
        this.editingCode.set(b.code);
      },
      error: (e) => this.formErr.set(errText(e)),
    });
  }

  removeDraft(): void {
    const code = this.editingCode();
    if (!code) return;
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    this.api.delete(`/broadcasts/${code}`).subscribe({
      next: () => {
        this.view.set('list');
        this.load();
      },
      error: (e) => this.formErr.set(errText(e)),
    });
  }

  /** Duplicates any broadcast (Draft, Sending or Sent) into a brand-new
   * Draft — same subject/body/audience/custom emails — and opens it for
   * editing. Lets you re-run a past send (e.g. a follow-up reminder, or
   * a resend after fixing the audience) without hand-copying the HTML
   * body or losing the original's own send record. */
  cloneBroadcast(code: string): void {
    this.error.set('');
    this.cloneBusy.set(code);
    this.api.get<BroadcastDetail>(`/broadcasts/${code}`).subscribe({
      next: (d) => {
        const payload = {
          subject: d.subject.startsWith('[Copy] ') ? d.subject : `[Copy] ${d.subject}`,
          body: d.body,
          audience: d.audience,
          customEmails: d.customEmails || undefined,
        };
        this.api.post<BroadcastDetail>('/broadcasts', payload).subscribe({
          next: (b) => {
            this.cloneBusy.set(null);
            this.editingCode.set(b.code);
            this.subject = b.subject;
            this.body = b.body;
            this.audience = (b.audience as Audience) || 'schools';
            this.customEmails = b.customEmails ?? '';
            this.audiencePreview.set(null);
            this.testMsg.set('');
            this.formErr.set('');
            this.view.set('compose');
            this.loadCounts();
          },
          error: (e) => {
            this.cloneBusy.set(null);
            this.error.set(errText(e));
          },
        });
      },
      error: (e) => {
        this.cloneBusy.set(null);
        this.error.set(errText(e));
      },
    });
  }

  loadAudiencePreview(): void {
    this.formErr.set('');
    const params: Record<string, unknown> = { audience: this.audience };
    if (this.customEmails) params['customEmails'] = this.customEmails;
    this.api.get<AudiencePreview>('/broadcasts/audience-preview', params).subscribe({
      next: (r) => this.audiencePreview.set(r),
      error: (e) => this.formErr.set(errText(e)),
    });
  }

  sendTest(): void {
    const code = this.editingCode();
    if (!code || !this.testEmail.trim()) return;
    this.testBusy.set(true);
    this.testMsg.set('');
    this.api.post<{ ok: boolean }>(`/broadcasts/${code}/test-send`, { email: this.testEmail.trim() }).subscribe({
      next: (r) => {
        this.testBusy.set(false);
        this.testOk.set(r.ok);
        this.testMsg.set(r.ok ? `Test sent to ${this.testEmail}.` : 'Send failed — check Message Templates → Send Log for the provider response.');
      },
      error: (e) => {
        this.testBusy.set(false);
        this.testOk.set(false);
        this.testMsg.set(errText(e));
      },
    });
  }

  sendReal(): void {
    const code = this.editingCode();
    if (!code) return;
    const count = this.audiencePreview()?.count;
    if (count == null) {
      this.formErr.set('Preview the audience first so you know how many recipients this will reach.');
      return;
    }
    if (!confirm(`Send this email to all ${count} recipient(s) now? This cannot be undone.`)) return;
    this.formErr.set('');
    this.api.post<{ queued: number }>(`/broadcasts/${code}/send`, {}).subscribe({
      next: () => {
        this.view.set('list');
        this.load();
      },
      error: (e) => this.formErr.set(errText(e)),
    });
  }
}
