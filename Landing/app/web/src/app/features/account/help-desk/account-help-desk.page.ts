import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { StudentDataService } from '../student-data.service';
import type { GrievanceView } from '../student-data.service';
import { ACCOUNT_UI_CSS } from '../account-ui';
import { formatDate } from '../format';

const GTYPE_ICON: Record<string, string> = {
  Complaint: '&#9888;&#65039;',
  Feedback: '&#128172;',
  Suggestion: '&#128161;',
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
              <li style="align-items:flex-start">
                <span class="dl-ic" [ngClass]="gtypeClass(g.gtype)">{{ gtypeIcon(g.gtype) }}</span>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                    <b class="mono">{{ g.code }}</b>
                    <span class="tag" [ngClass]="statusClass(g.status)">{{ g.status }}</span>
                  </div>
                  <small>{{ g.subject || g.gtype }} · {{ formatDate(g.createdAt) }}</small>
                  <p style="color:var(--text);font-size:.9rem;margin-top:.3rem;white-space:pre-wrap">{{ g.message }}</p>
                </div>
              </li>
            }
          </ul>
        } @else {
          <div class="empty"><div class="big">&#128172;</div><p>No requests yet. Raise your first one from the form.</p></div>
        }
      </div>
    </div>
  `,
  styles: [ACCOUNT_UI_CSS],
})
export class AccountHelpDeskPage implements OnInit {
  private readonly data = inject(StudentDataService);
  protected readonly loading = signal(true);
  protected readonly grievances = signal<GrievanceView[]>([]);
  protected readonly submitting = signal(false);
  protected readonly submitMsg = signal('');
  protected readonly submitOk = signal(false);

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
          this.submitMsg.set(`Request ${created.code} submitted. Our team will get back to you.`);
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
}
