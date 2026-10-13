import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { ADMIN_UI_CSS } from './admin-ui';

interface MessageTemplate {
  key: string;
  label: string;
  smsBody: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  active: boolean;
  updatedAt: string;
}

interface MessageLog {
  id: number;
  templateKey: string;
  channel: string;
  recipient: string;
  status: string;
  providerResponse: string | null;
  errorMessage: string | null;
  createdAt: string;
}

function errText(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? 'Something went wrong';
}

@Component({
  selector: 'app-admin-messaging',
  standalone: true,
  imports: [FormsModule, DatePipe, SlicePipe],
  template: `
    <div class="bar">
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'templates'" (click)="tab.set('templates')">Templates</button>
        <button class="tab" [class.active]="tab() === 'logs'" (click)="openLogs()">Send Log</button>
      </div>
      <div class="grow"></div>
    </div>

    @if (error()) {
      <div class="err">{{ error() }}</div>
    }

    @if (tab() === 'templates') {
      @if (loading()) {
        <div class="empty">Loading…</div>
      } @else {
        <div class="tpl-list">
          @for (t of templates(); track t.key) {
            <div class="card tpl-card">
              <div class="tpl-head" (click)="toggleOpen(t.key)">
                <div>
                  <strong>{{ t.label }}</strong>
                  <span class="tpl-key">{{ t.key }}</span>
                </div>
                <div class="tpl-head-right">
                  <span class="badge" [class.badge-off]="!t.active">{{ t.active ? 'Active' : 'Inactive' }}</span>
                  <span class="chev">{{ openKey() === t.key ? '▲' : '▼' }}</span>
                </div>
              </div>

              @if (openKey() === t.key) {
                <div class="tpl-body">
                  <label class="chk">
                    <input type="checkbox" [(ngModel)]="draft().active" />
                    Active — dispatch() no-ops silently when off
                  </label>

                  <div class="f">
                    <label>SMS body <span class="hint">({{ draft().smsBody?.length ?? 0 }} chars — leave blank to skip SMS for this trigger)</span></label>
                    <textarea rows="3" [(ngModel)]="draft().smsBody" maxlength="320"></textarea>
                  </div>

                  <div class="f">
                    <label>Email subject</label>
                    <input [(ngModel)]="draft().emailSubject" maxlength="190" />
                  </div>

                  <div class="f">
                    <label>Email body <span class="hint">(HTML — {{ '{' }}Placeholder{{ '}' }} tokens get substituted)</span></label>
                    <textarea rows="8" [(ngModel)]="draft().emailBody"></textarea>
                  </div>

                  <div class="tpl-actions">
                    <button class="btn btn-gold" [disabled]="saving()" (click)="save(t.key)">
                      {{ saving() ? 'Saving…' : 'Save' }}
                    </button>
                    <span class="grow"></span>
                    <input class="test-input" placeholder="test email" [(ngModel)]="testEmail" />
                    <input class="test-input" placeholder="test phone" [(ngModel)]="testPhone" />
                    <button class="btn btn-sm" [disabled]="testing()" (click)="sendTest(t.key)">
                      {{ testing() ? 'Sending…' : 'Send Test' }}
                    </button>
                  </div>
                  @if (testResult()) {
                    <div class="hint test-result">{{ testResult() }}</div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    }

    @if (tab() === 'logs') {
      @if (logsLoading()) {
        <div class="empty">Loading…</div>
      } @else if (!logs().length) {
        <div class="empty">No sends logged yet.</div>
      } @else {
        <div class="log-table-wrap">
          <table class="log-table">
            <thead>
              <tr><th>When</th><th>Template</th><th>Channel</th><th>Recipient</th><th>Status</th><th>Detail</th></tr>
            </thead>
            <tbody>
              @for (l of logs(); track l.id) {
                <tr>
                  <td>{{ l.createdAt | date: 'short' }}</td>
                  <td>{{ l.templateKey }}</td>
                  <td>{{ l.channel }}</td>
                  <td>{{ l.recipient }}</td>
                  <td><span class="badge" [class.badge-off]="l.status !== 'SENT'">{{ l.status }}</span></td>
                  <td class="log-detail" [title]="l.providerResponse || l.errorMessage || ''">
                    {{ (l.providerResponse || l.errorMessage || '') | slice: 0 : 80 }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .tabs { display: flex; gap: 0.5rem; }
      .tab {
        padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--line, rgba(255,255,255,0.09));
        background: transparent; color: var(--muted, #9fb0d0); cursor: pointer; font: inherit;
      }
      .tab.active { background: var(--gold, #e8b64a); color: #16110a; border-color: var(--gold, #e8b64a); font-weight: 600; }
      .tpl-list { display: flex; flex-direction: column; gap: 0.7rem; }
      .tpl-card { padding: 0; overflow: hidden; }
      .tpl-head {
        display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1.1rem; cursor: pointer;
      }
      .tpl-key { display: block; font-size: 0.75rem; color: var(--faint, #6e7f9e); margin-top: 0.15rem; }
      .tpl-head-right { display: flex; align-items: center; gap: 0.7rem; }
      .badge {
        font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 999px;
        background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3);
      }
      .badge-off { background: rgba(248, 113, 113, 0.12); color: #f87171; border-color: rgba(248, 113, 113, 0.3); }
      .tpl-body { padding: 0 1.1rem 1.1rem; border-top: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .chk { display: flex; align-items: center; gap: 0.5rem; margin: 0.9rem 0; font-size: 0.85rem; color: var(--muted, #9fb0d0); }
      .tpl-actions { display: flex; align-items: center; gap: 0.6rem; margin-top: 0.7rem; flex-wrap: wrap; }
      .test-input {
        width: 180px; padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid var(--line, rgba(255,255,255,0.09));
        background: rgba(255, 255, 255, 0.04); color: inherit; font: inherit;
      }
      .test-result { margin-top: 0.5rem; }
      .log-table-wrap { overflow-x: auto; }
      .log-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
      .log-table th { text-align: left; padding: 0.6rem 0.8rem; color: var(--faint, #6e7f9e); font-weight: 500; border-bottom: 1px solid var(--line, rgba(255,255,255,0.09)); }
      .log-table td { padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.06)); }
      .log-detail { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted, #9fb0d0); font-size: 0.78rem; }
    `,
  ],
})
export class AdminMessagingPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly tab = signal<'templates' | 'logs'>('templates');
  protected readonly loading = signal(true);
  protected readonly logsLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly testing = signal(false);
  protected readonly error = signal('');
  protected readonly toast = signal('');
  protected readonly testResult = signal('');
  protected readonly openKey = signal<string | null>(null);
  protected readonly templates = signal<MessageTemplate[]>([]);
  protected readonly logs = signal<MessageLog[]>([]);
  protected readonly draft = signal<MessageTemplate>({
    key: '', label: '', smsBody: '', emailSubject: '', emailBody: '', active: true, updatedAt: '',
  });

  protected testEmail = '';
  protected testPhone = '';
  private logsLoaded = false;

  ngOnInit(): void {
    this.loadTemplates();
  }

  private loadTemplates(): void {
    this.loading.set(true);
    this.api.get<MessageTemplate[]>('/messaging/templates').subscribe({
      next: (list) => {
        this.templates.set(list);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
  }

  protected openLogs(): void {
    this.tab.set('logs');
    if (this.logsLoaded) return;
    this.logsLoading.set(true);
    this.api.get<MessageLog[]>('/messaging/logs').subscribe({
      next: (list) => {
        this.logs.set(list);
        this.logsLoading.set(false);
        this.logsLoaded = true;
      },
      error: (e) => {
        this.error.set(errText(e));
        this.logsLoading.set(false);
      },
    });
  }

  protected toggleOpen(key: string): void {
    if (this.openKey() === key) {
      this.openKey.set(null);
      return;
    }
    const t = this.templates().find((x) => x.key === key);
    if (t) this.draft.set({ ...t });
    this.testResult.set('');
    this.openKey.set(key);
  }

  protected save(key: string): void {
    this.saving.set(true);
    this.error.set('');
    const d = this.draft();
    this.api
      .patch<MessageTemplate>(`/messaging/templates/${key}`, {
        smsBody: d.smsBody ?? '',
        emailSubject: d.emailSubject ?? '',
        emailBody: d.emailBody ?? '',
        active: d.active,
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.templates.update((list) => list.map((t) => (t.key === key ? updated : t)));
          this.showToast('Template saved');
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(errText(e));
        },
      });
  }

  protected sendTest(key: string): void {
    if (!this.testEmail.trim() && !this.testPhone.trim()) {
      this.testResult.set('Enter a test email and/or phone first.');
      return;
    }
    this.testing.set(true);
    this.testResult.set('');
    this.api
      .post(`/messaging/templates/${key}/test`, {
        email: this.testEmail.trim() || undefined,
        phone: this.testPhone.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.testing.set(false);
          this.testResult.set('Sent — check the Send Log tab for the provider response.');
        },
        error: (e) => {
          this.testing.set(false);
          this.testResult.set(errText(e));
        },
      });
  }

  private showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => {
      if (this.toast() === msg) this.toast.set('');
    }, 2200);
  }
}
