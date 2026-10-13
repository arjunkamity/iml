import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { SchoolDataService, SchoolMe } from './school-data.service';
import { ADMIN_UI_CSS } from '@admin/admin-ui';

function errText(e: HttpErrorResponse): string {
  const m = (e.error as { message?: string | string[] })?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
  return m ?? 'Something went wrong.';
}

@Component({
  selector: 'app-school-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else {
      <div class="grid g2">
        <div class="card">
          <h3 style="margin:0 0 0.9rem;">School Information</h3>
          <div class="f">
            <label>School code</label>
            <input [value]="me()?.code" disabled />
          </div>
          <div class="f">
            <label>School name</label>
            <input [(ngModel)]="form.name" />
          </div>
          <div class="f-row">
            <div class="f">
              <label>City</label>
              <input [(ngModel)]="form.city" />
            </div>
            <div class="f">
              <label>Contact number</label>
              <input [(ngModel)]="form.contact" />
            </div>
          </div>
          <div class="f">
            <label>Coordinator</label>
            <input [(ngModel)]="form.coordinator" />
          </div>
          <div class="f">
            <label>Portal login email</label>
            <input [value]="me()?.email ?? '—'" disabled />
            <div class="hint">Set by India Mind League admin — contact support to change it.</div>
          </div>
          <div class="f">
            <label>Portal login phone</label>
            <input [value]="me()?.phone ?? '—'" disabled />
          </div>
          @if (profileMsg()) {
            <div class="alert" [class.ok]="profileOk()" [class.err]="!profileOk()">{{ profileMsg() }}</div>
          }
          <div class="form-actions">
            <button type="button" class="btn btn-gold" [disabled]="savingProfile()" (click)="saveProfile()">
              {{ savingProfile() ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.9rem;">Change Password</h3>
          @if (me()?.hasPassword) {
            <div class="f">
              <label>Current password</label>
              <input type="password" [(ngModel)]="pw.current" />
            </div>
            <div class="f">
              <label>New password</label>
              <input type="password" [(ngModel)]="pw.newPassword" />
              <div class="hint">At least 6 characters.</div>
            </div>
          } @else {
            <p class="hint" style="margin:-0.2rem 0 0.9rem;">
              You signed in with OTP and haven't set a password yet. Set one now so you can sign in with your email/phone and password next time.
            </p>
            <div class="f">
              <label>New password</label>
              <input type="password" [(ngModel)]="pw.newPassword" />
              <div class="hint">At least 6 characters.</div>
            </div>
          }
          @if (pwMsg()) {
            <div class="alert" [class.ok]="pwOk()" [class.err]="!pwOk()">{{ pwMsg() }}</div>
          }
          <div class="form-actions">
            <button type="button" class="btn btn-gold" [disabled]="savingPw()" (click)="savePassword()">
              {{ savingPw() ? 'Saving…' : me()?.hasPassword ? 'Update password' : 'Set password' }}
            </button>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 0.6rem;">Students</h3>
          <div class="stat"><b>{{ me()?.studentCount ?? 0 }}</b><small>Registered so far</small></div>
        </div>
      </div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .f-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
      @media (max-width: 600px) { .f-row { grid-template-columns: minmax(0, 1fr); gap: 0; } }
      .form-actions { margin-top: 1rem; }
      .alert { margin-top: 0.8rem; padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 0.85rem; }
      .alert.ok { background: rgba(52, 211, 153, 0.12); border: 1px solid rgba(52, 211, 153, 0.35); color: #6ee7b7; }
      .alert.err { background: rgba(251, 113, 133, 0.12); border: 1px solid rgba(251, 113, 133, 0.35); color: #fda4af; }
      input:disabled { opacity: 0.6; cursor: not-allowed; }
    `,
  ],
})
export class SchoolProfilePage implements OnInit {
  private readonly data = inject(SchoolDataService);

  protected readonly loading = signal(true);
  protected readonly me = signal<SchoolMe | null>(null);

  protected readonly savingProfile = signal(false);
  protected readonly profileMsg = signal('');
  protected readonly profileOk = signal(false);

  protected readonly savingPw = signal(false);
  protected readonly pwMsg = signal('');
  protected readonly pwOk = signal(false);

  protected form = { name: '', city: '', contact: '', coordinator: '' };
  protected pw = { current: '', newPassword: '' };

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.data.me().subscribe({
      next: (m) => {
        this.me.set(m);
        this.form = {
          name: m.name ?? '',
          city: m.city ?? '',
          contact: m.contact ?? '',
          coordinator: m.coordinator ?? '',
        };
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected saveProfile(): void {
    if (this.savingProfile()) return;
    this.savingProfile.set(true);
    this.profileMsg.set('');
    this.data.updateProfile(this.form).subscribe({
      next: (m) => {
        this.savingProfile.set(false);
        this.me.set(m);
        this.profileOk.set(true);
        this.profileMsg.set('Saved.');
        setTimeout(() => this.profileMsg.set(''), 3000);
      },
      error: (e) => {
        this.savingProfile.set(false);
        this.profileOk.set(false);
        this.profileMsg.set(errText(e));
      },
    });
  }

  protected savePassword(): void {
    if (this.savingPw()) return;
    if (!this.pw.newPassword || this.pw.newPassword.length < 6) {
      this.pwOk.set(false);
      this.pwMsg.set('New password must be at least 6 characters.');
      return;
    }
    this.savingPw.set(true);
    this.pwMsg.set('');
    this.data.setPassword({ currentPassword: this.pw.current || undefined, newPassword: this.pw.newPassword }).subscribe({
      next: () => {
        this.savingPw.set(false);
        this.pwOk.set(true);
        this.pwMsg.set('Password updated.');
        this.pw = { current: '', newPassword: '' };
        this.me.update((m) => (m ? { ...m, hasPassword: true } : m));
        setTimeout(() => this.pwMsg.set(''), 3000);
      },
      error: (e) => {
        this.savingPw.set(false);
        this.pwOk.set(false);
        this.pwMsg.set(errText(e));
      },
    });
  }
}
