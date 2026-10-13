import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { StudentDataService } from '../student-data.service';
import type { GrievanceDetailView, GrievanceView } from '../student-data.service';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { formatDate, formatDateTime } from '../format';

// Real Unicode characters, not HTML entity strings — this is bound via
// plain {{ }} interpolation (line ~79 below), which HTML-escapes its
// output, so an entity string like '&#9888;&#65039;' rendered literally
// as that text instead of decoding to the ⚠️ glyph.
const GTYPE_ICON: Record<string, string> = {
  Complaint: '⚠️',
  Feedback: '💬',
  Suggestion: '💡',
};

const GTYPE_CLASS: Record<string, string> = {
  Complaint: 'tag-red',
  Feedback: 'tag-blue',
  Suggestion: 'tag-amber',
};

const STATUS_CLASS: Record<string, string> = {
  New: 'tag-blue',
  'In Progress': 'tag-amber',
  Resolved: 'tag-green',
};

@Component({
  selector: 'app-account-help-desk',
  standalone: true,
  imports: [FormsModule, NgClass],
  template: `
    <div class="acc-head">
      <div>
        <div class="acc-eyebrow">Help Desk</div>
        <h1 class="acc-title">Raise a Request</h1>
        <p class="acc-sub">Complaints, feedback and suggestions are routed to our support desk. Track the status of every request you raise.</p>
      </div>
    </div>

    <div class="acc-grid">
      <div class="card">
        <div class="card-head"><h3>Submit a Request</h3></div>
        <form (ngSubmit)="submit()" #gf="ngForm">
          <div class="form-grid">
            <div class="field full">
              <label for="gtype">Type</label>
              <select id="gtype" name="gtype" [(ngModel)]="form.gtype" required>
                <option value="Complaint">Complaint</option>
                <option value="Feedback">Feedback</option>
                <option value="Suggestion">Suggestion</option>
              </select>
            </div>
            <div class="field full">
              <label for="subject">Subject</label>
              <input id="subject" name="subject" type="text" [(ngModel)]="form.subject" maxlength="190" placeholder="Short summary of your request" />
            </div>
            <div class="field full">
              <label for="message">Message</label>
              <textarea id="message" name="message" [(ngModel)]="form.message" required maxlength="2000" placeholder="Describe your issue or feedback in detail…"></textarea>
            </div>
          </div>

          @if (submitMsg()) {
            <div class="alert" [class.ok]="submitOk()" [class.err]="!submitOk()">{{ submitMsg() }}</div>
          }

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" [disabled]="submitting()">Submit request</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="card-head"><h3>My Requests</h3></div>
        @if (grievances().length) {
          <ul class="dlist">
            @for (g of grievances(); track g.code) {
              <li style="align-items:flex-start;cursor:pointer" (click)="openThread(g.code)">
                <span class="dl-ic" [ngClass]="gtypeClass(g.gtype)">{{ gtypeIcon(g.gtype) }}</span>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                    <b class="mono">{{ g.code }}</b>
                    <span class="tag" [ngClass]="statusClass(g.status)">{{ g.status }}</span>
                  </div>
                  <small>{{ g.subject || g.gtype }} · {{ formatDate(g.createdAt) }}</small>
                  <p style="color:var(--text);font-size:.9rem;margin-top:.3rem;white-space:pre-wrap">{{ g.message }}</p>
                </div>
                <span class="hd-view-link">View thread →</span>
              </li>
            }
          </ul>
        } @else {
          <div class="empty"><div class="big">&#128172;</div><p>No requests yet. Raise your first one from the form.</p></div>
        }
      </div>
    </div>

    @if (thread(); as t) {
      <div class="hd-backdrop" (click)="closeThread()">
        <div class="hd-modal" role="dialog" [attr.aria-label]="'Ticket ' + t.code" (click)="$event.stopPropagation()">
          <div class="hd-modal-head">
            <div>
              <b class="mono">{{ t.code }}</b>
              <span class="tag" [ngClass]="statusClass(t.status)" style="margin-left:0.5rem">{{ t.status }}</span>
              <div class="hd-modal-subject">{{ t.subject || t.gtype }}</div>
            </div>
            <button type="button" class="hd-x" (click)="closeThread()" aria-label="Close">✕</button>
          </div>

          <div class="hd-thread">
            <div class="hd-msg hd-msg-student">
              <div class="hd-msg-meta"><b>You</b><small>{{ formatDateTime(t.createdAt) }}</small></div>
              <p>{{ t.message }}</p>
            </div>
            @for (m of t.messages; track m.id) {
              @if (m.authorType === 'system') {
                <div class="hd-msg-system">{{ m.body }} <small>· {{ formatDateTime(m.createdAt) }}</small></div>
              } @else {
                <div class="hd-msg" [class.hd-msg-admin]="m.authorType === 'admin'" [class.hd-msg-student]="m.authorType === 'student'">
                  <div class="hd-msg-meta"><b>{{ m.authorType === 'admin' ? m.authorName + ' (Support)' : 'You' }}</b><small>{{ formatDateTime(m.createdAt) }}</small></div>
                  <p>{{ m.body }}</p>
                </div>
              }
            }
          </div>

          @if (t.status === 'Resolved') {
            <p class="hint" style="margin:0.6rem 0;">This ticket is marked Resolved. Sending a reply will reopen it.</p>
          }
          <form class="hd-reply-form" (ngSubmit)="sendReply(t.code)">
            <textarea [(ngModel)]="replyText" name="reply" rows="3" placeholder="Write a reply…" required></textarea>
            @if (replyError()) {
              <div class="alert err">{{ replyError() }}</div>
            }
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="replying()">{{ replying() ? 'Sending…' : 'Send Reply' }}</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [
    ACCOUNT_UI_CSS,
    `
      .hd-view-link { font-size: 0.8rem; color: var(--violet-2); white-space: nowrap; }
      .hd-backdrop { position: fixed; inset: 0; background: rgba(5, 5, 12, 0.72); backdrop-filter: blur(4px);
        display: grid; place-items: center; z-index: 200; padding: 1.2rem; }
      .hd-modal { background: linear-gradient(180deg, var(--surface-2), var(--surface)); border: 1px solid var(--line-2);
        border-radius: 20px; padding: 1.4rem; max-width: 620px; width: 100%; max-height: 88vh; display: flex; flex-direction: column;
        box-shadow: var(--shadow), var(--glow); }
      .hd-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.9rem; }
      .hd-modal-subject { font-family: var(--display); font-weight: 700; font-size: 1.05rem; margin-top: 0.3rem; }
      .hd-x { background: none; border: 1px solid var(--line); border-radius: 8px; width: 30px; height: 30px; color: var(--muted); cursor: pointer; flex: 0 0 auto; }
      .hd-x:hover { color: #fff; border-color: var(--line-2); }
      .hd-thread { overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 0.7rem; padding-right: 0.2rem; margin-bottom: 0.9rem; }
      .hd-msg { border-radius: 12px; padding: 0.7rem 0.9rem; max-width: 88%; border: 1px solid var(--line); background: rgba(255, 255, 255, 0.03); }
      .hd-msg-student { align-self: flex-end; background: rgba(124, 58, 237, 0.1); border-color: rgba(139, 92, 246, 0.3); }
      .hd-msg-admin { align-self: flex-start; background: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.3); }
      .hd-msg-meta { display: flex; justify-content: space-between; gap: 0.6rem; font-size: 0.76rem; color: var(--muted); margin-bottom: 0.3rem; }
      .hd-msg p { font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; color: var(--text); }
      .hd-msg-system { align-self: center; font-size: 0.76rem; color: var(--faint); text-align: center; }
      .hd-reply-form textarea { width: 100%; resize: vertical; }
      .hd-reply-form .form-actions { margin-top: 0.6rem; }
    `,
  ],
})
export class AccountHelpDeskPage implements OnInit {
  private readonly data = inject(StudentDataService);
  protected readonly loading = signal(true);
  protected readonly grievances = signal<GrievanceView[]>([]);
  protected readonly submitting = signal(false);
  protected readonly submitMsg = signal('');
  protected readonly submitOk = signal(false);

  protected readonly thread = signal<GrievanceDetailView | null>(null);
  protected readonly replying = signal(false);
  protected readonly replyError = signal('');
  protected replyText = '';

  protected readonly form = { gtype: 'Complaint', subject: '', message: '' };

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.data.grievances().subscribe({
      next: (list) => {
        this.grievances.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.grievances.set([]);
        this.loading.set(false);
      },
    });
  }

  protected submit(): void {
    const f = this.form;
    if (!f.message.trim()) return;
    this.submitting.set(true);
    this.submitMsg.set('');
    this.data
      .createGrievance({
        gtype: f.gtype,
        subject: f.subject.trim() || undefined,
        message: f.message.trim(),
      })
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.submitOk.set(true);
          this.submitMsg.set(`Request ${created.code} submitted. We've sent you a confirmation email — our team will get back to you.`);
          this.grievances.update((list) => [created, ...list]);
          f.gtype = 'Complaint';
          f.subject = '';
          f.message = '';
          setTimeout(() => this.submitMsg.set(''), 6000);
        },
        error: (err) => {
          this.submitting.set(false);
          this.submitOk.set(false);
          this.submitMsg.set(err?.error?.message ?? 'Could not submit your request.');
        },
      });
  }

  protected openThread(code: string): void {
    this.replyText = '';
    this.replyError.set('');
    this.data.grievanceDetail(code).subscribe({
      next: (detail) => this.thread.set(detail),
      error: (err) => this.replyError.set(err?.error?.message ?? 'Could not load this ticket.'),
    });
  }

  protected closeThread(): void {
    this.thread.set(null);
  }

  protected sendReply(code: string): void {
    const message = this.replyText.trim();
    if (!message || this.replying()) return;
    this.replying.set(true);
    this.replyError.set('');
    this.data.addGrievanceReply(code, message).subscribe({
      next: (detail) => {
        this.replying.set(false);
        this.thread.set(detail);
        this.replyText = '';
        // Keep the list's status badge in sync (a reply may have reopened
        // a Resolved ticket) without a full reload.
        this.grievances.update((list) => list.map((g) => (g.code === code ? { ...g, status: detail.status } : g)));
      },
      error: (err) => {
        this.replying.set(false);
        this.replyError.set(err?.error?.message ?? 'Could not send your reply.');
      },
    });
  }

  protected gtypeIcon(gtype: string): string {
    return GTYPE_ICON[gtype] ?? '&#128172;';
  }

  protected gtypeClass(gtype: string): string {
    return GTYPE_CLASS[gtype] ?? 'tag-muted';
  }

  protected statusClass(status: string): string {
    return STATUS_CLASS[status] ?? 'tag-muted';
  }

  protected formatDate = formatDate;
  protected formatDateTime = formatDateTime;
}
