import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { SiteSettingsService } from '@core/services/site-settings.service';

/** Same "email or phone" identifier field the school portal's whole login
 * flow uses (password AND OTP) — a school signs in with whichever the
 * admin set for it, not a fixed channel like a student's password login. */
function splitIdentifier(raw: string): { email?: string; phone?: string } {
  const value = raw.trim();
  return value.includes('@') ? { email: value.toLowerCase() } : { phone: value.replace(/\D/g, '') };
}

@Component({
  selector: 'app-school-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="bg-aurora"></div>
    <div class="bg-grid"></div>

    <a routerLink="/" class="auth-back">← Back to site</a>

    <main class="auth">
      <div class="auth-card">
        <aside class="auth-aside">
          <div class="aa-sprites" aria-hidden="true">
            <img class="aspr a1" src="img/sprites/globe.png" alt="" />
            <img class="aspr a2" src="img/sprites/book.png" alt="" />
            <img class="aspr a3" src="img/sprites/pointed arrow.png" alt="" />
            <img class="aspr a4" src="img/sprites/triangle-set-sqare.png" alt="" />
            <img class="aspr a5" src="img/sprites/dots.png" alt="" />
          </div>

          <h2 class="aa-title">School<br /><span class="gradient">Portal</span></h2>
          <p class="aa-sub">Manage your school's profile and track every student you've registered for India Mind League.</p>

          <ul class="aa-feats">
            <li><span class="aa-ic c-iq">🏫</span><div><b>School Information</b><small>Keep your contact details up to date</small></div></li>
            <li><span class="aa-ic c-eq">🎓</span><div><b>Your Students</b><small>See everyone you've registered, at a glance</small></div></li>
            <li><span class="aa-ic c-val">➕</span><div><b>Register More</b><small>Add new students any time</small></div></li>
          </ul>

          <div class="aa-notice">
            <b>First time signing in?</b>
            <p>
              If your school was registered directly by India Mind League (not self-registered), your account already
              has a default login waiting: your <b>Login ID</b> is your registered email or phone, and your
              <b>default password is your registered phone number</b>. Sign in with these to activate your account —
              we'll verify it's really you with a one-time code, then ask you to set your own password.
            </p>
            <p class="aa-notice-alt">New school, never registered before? <a routerLink="/schools/register">Register here →</a></p>
          </div>
        </aside>

        <section class="auth-form">
          <img class="af-logo" [src]="settings().logoDarkUrl" alt="India Mind League" />
          <h1 class="af-title">School Login</h1>
          <p class="af-lead">
            Sign in with your registered email or phone and password.
            New school? <a routerLink="/schools/register">Register here →</a>
          </p>

          @if (mode() === 'password') {
            <form (ngSubmit)="loginWithPassword()" novalidate>
              <div class="field">
                <label for="identifier">Registered email or phone</label>
                <input id="identifier" name="identifier" [(ngModel)]="identifier" autocomplete="username" placeholder="you@school.edu or 10-digit mobile" />
              </div>
              <div class="field">
                <label for="password">Password</label>
                <input id="password" name="password" type="password" [(ngModel)]="password" autocomplete="current-password" placeholder="••••••••" />
              </div>
              @if (message()) {
                <div class="form-msg alert error" [class.ok]="!messageIsError()">{{ message() }}</div>
              }
              <button class="btn btn-gold-solid btn-block btn-lg" type="submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Login →' }}</button>
              <p class="otp-resend">Forgot your password? <button type="button" class="linkbtn" (click)="switchToOtp()">Login with OTP</button>.</p>
            </form>
          }

          @if (mode() === 'otp' && step() === 1) {
            <form (ngSubmit)="sendOtp()" novalidate>
              <div class="field">
                <label for="otpIdentifier">Registered email or phone</label>
                <input id="otpIdentifier" name="otpIdentifier" [(ngModel)]="identifier" autocomplete="username" placeholder="you@school.edu or 10-digit mobile" />
              </div>
              @if (message()) {
                <div class="form-msg alert error" [class.ok]="!messageIsError()">{{ message() }}</div>
              }
              <button class="btn btn-gold-solid btn-block btn-lg" type="submit" [disabled]="busy()">{{ busy() ? 'Sending…' : 'Send OTP →' }}</button>
              <p class="otp-resend"><button type="button" class="linkbtn" (click)="switchToPassword()">← Back to password login</button></p>
            </form>
          }

          @if (mode() === 'force-reset') {
            <form (ngSubmit)="completeForceReset()" novalidate>
              <p class="otp-sent">
                This account is still using its default password. We've sent a verification code to your
                <b>registered email and phone</b> — enter it below along with a new password to finish setting up
                your account.
              </p>
              <div class="otp-boxes" id="frOtpBoxes">
                @for (i of [0, 1, 2, 3, 4, 5]; track i) {
                  <input
                    inputmode="numeric"
                    maxlength="1"
                    [attr.aria-label]="'Verification code digit ' + (i + 1)"
                    [id]="'fr-otp' + i"
                    [(ngModel)]="digits[i]"
                    [ngModelOptions]="{ standalone: true }"
                    (input)="onOtpInput(i, $event)"
                    (keydown.backspace)="onOtpBack(i, $event)"
                    (paste)="onOtpPaste($event)"
                  />
                }
              </div>
              <div class="field">
                <label for="newPassword">New password</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  [(ngModel)]="newPassword"
                  autocomplete="new-password"
                  placeholder="At least 6 characters"
                />
              </div>
              <div class="field">
                <label for="confirmPassword">Confirm new password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  [(ngModel)]="confirmPassword"
                  autocomplete="new-password"
                  placeholder="Re-enter new password"
                />
              </div>
              @if (message()) {
                <div class="form-msg alert error" [class.ok]="!messageIsError()">{{ message() }}</div>
              }
              <button class="btn btn-gold-solid btn-block btn-lg" type="submit" [disabled]="busy()">
                {{ busy() ? 'Saving…' : 'Verify & set password' }}
              </button>
              <p class="otp-resend">
                Didn't get it?
                <button type="button" class="linkbtn" (click)="resendForceResetOtp()" [disabled]="resendIn() > 0">
                  Resend in {{ resendIn() }}s
                </button>
              </p>
            </form>
          }

          @if (mode() === 'otp' && step() === 2) {
            <form (ngSubmit)="verifyOtp()" novalidate>
              <p class="otp-sent">We sent a 6-digit code to <b>{{ sentTo }}</b>. <button type="button" class="linkbtn" (click)="backToContact()">Change</button></p>
              <div class="otp-boxes" id="otpBoxes">
                @for (i of [0, 1, 2, 3, 4, 5]; track i) {
                  <input
                    #otpInput
                    inputmode="numeric"
                    maxlength="1"
                    [attr.aria-label]="'OTP digit ' + (i + 1)"
                    [id]="'otp' + i"
                    [(ngModel)]="digits[i]"
                    [ngModelOptions]="{ standalone: true }"
                    (input)="onOtpInput(i, $event)"
                    (keydown.backspace)="onOtpBack(i, $event)"
                    (paste)="onOtpPaste($event)"
                  />
                }
              </div>
              @if (message()) {
                <div class="form-msg alert error" [class.ok]="!messageIsError()">{{ message() }}</div>
              }
              <button class="btn btn-gold-solid btn-block btn-lg" type="submit" [disabled]="busy()">{{ busy() ? 'Verifying…' : 'Verify & Login' }}</button>
              <p class="otp-resend">Didn't get it? <button type="button" class="linkbtn" (click)="resendOtp()" [disabled]="resendIn() > 0">Resend in {{ resendIn() }}s</button></p>
            </form>
          }
        </section>
      </div>
    </main>
  `,
})
export class SchoolLoginPage implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly settings = inject(SiteSettingsService).settings;

  readonly mode = signal<'password' | 'otp' | 'force-reset'>('password');
  readonly step = signal<1 | 2>(1);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly messageIsError = signal(true);
  readonly resendIn = signal(0);

  identifier = '';
  password = '';
  sentTo = '';
  digits: string[] = ['', '', '', '', '', ''];
  newPassword = '';
  confirmPassword = '';
  private resendTimer: ReturnType<typeof setInterval> | null = null;
  private lastRequested: { email?: string; phone?: string } = {};
  private forceResetSchoolId: number | null = null;

  ngOnDestroy() {
    this.clearTimer();
  }

  private navigateAfterLogin(): void {
    const next = this.route.snapshot.queryParamMap.get('next');
    this.router.navigate([next && next.startsWith('/schools') ? next : '/schools']);
  }

  switchToOtp() {
    this.mode.set('otp');
    this.step.set(1);
    this.message.set('');
  }

  switchToPassword() {
    this.mode.set('password');
    this.message.set('');
    this.clearTimer();
  }

  loginWithPassword() {
    if (!this.identifier.trim()) {
      this.message.set('Enter your registered email or phone.');
      this.messageIsError.set(true);
      return;
    }
    if (!this.password) {
      this.message.set('Enter your password.');
      this.messageIsError.set(true);
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.auth.schoolLogin(splitIdentifier(this.identifier), this.password).subscribe({
      next: (res) => {
        this.busy.set(false);
        if ('mustChangePassword' in res) {
          this.enterForceReset(res.schoolId);
          return;
        }
        this.navigateAfterLogin();
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(this.errText(err));
        this.messageIsError.set(true);
      },
    });
  }

  private enterForceReset(schoolId: number) {
    this.forceResetSchoolId = schoolId;
    this.mode.set('force-reset');
    this.digits = ['', '', '', '', '', ''];
    this.newPassword = '';
    this.confirmPassword = '';
    this.message.set('');
    this.startResend();
    setTimeout(() => document.getElementById('fr-otp0')?.focus(), 0);
  }

  completeForceReset() {
    if (this.busy()) return;
    const code = this.digits.join('');
    if (code.length !== 6) {
      this.message.set('Enter all 6 digits of the code we sent.');
      this.messageIsError.set(true);
      return;
    }
    if (!this.newPassword || this.newPassword.length < 6) {
      this.message.set('Choose a password with at least 6 characters.');
      this.messageIsError.set(true);
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.message.set('Passwords do not match.');
      this.messageIsError.set(true);
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.auth.completeSchoolFirstLogin(this.forceResetSchoolId!, code, this.newPassword).subscribe({
      next: () => {
        this.busy.set(false);
        this.navigateAfterLogin();
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(this.errText(err));
        this.messageIsError.set(true);
      },
    });
  }

  resendForceResetOtp() {
    if (this.resendIn() > 0 || !this.forceResetSchoolId) return;
    this.busy.set(true);
    this.auth.resendSchoolFirstLoginOtp(this.forceResetSchoolId).subscribe({
      next: () => {
        this.busy.set(false);
        this.digits = ['', '', '', '', '', ''];
        this.message.set('');
        this.startResend();
        setTimeout(() => document.getElementById('fr-otp0')?.focus(), 0);
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(this.errText(err));
        this.messageIsError.set(true);
      },
    });
  }

  sendOtp() {
    if (!this.identifier.trim()) {
      this.message.set('Enter your registered email or phone.');
      this.messageIsError.set(true);
      return;
    }
    this.lastRequested = splitIdentifier(this.identifier);
    this.busy.set(true);
    this.message.set('');
    this.auth.requestSchoolOtp(this.lastRequested).subscribe({
      next: () => {
        this.busy.set(false);
        this.sentTo = this.lastRequested.phone ?? this.lastRequested.email ?? '';
        this.digits = ['', '', '', '', '', ''];
        this.step.set(2);
        this.startResend();
        setTimeout(() => document.getElementById('otp0')?.focus(), 0);
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(this.errText(err));
        this.messageIsError.set(true);
      },
    });
  }

  verifyOtp() {
    if (this.busy()) return;
    const code = this.digits.join('');
    if (code.length !== 6) {
      this.message.set('Enter all 6 digits of your OTP.');
      this.messageIsError.set(true);
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.auth.verifySchoolOtp(this.lastRequested, code).subscribe({
      next: () => {
        this.busy.set(false);
        this.navigateAfterLogin();
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(this.errText(err));
        this.messageIsError.set(true);
        this.digits = ['', '', '', '', '', ''];
        setTimeout(() => document.getElementById('otp0')?.focus(), 0);
      },
    });
  }

  resendOtp() {
    if (this.resendIn() > 0) return;
    this.busy.set(true);
    this.auth.requestSchoolOtp(this.lastRequested).subscribe({
      next: () => {
        this.busy.set(false);
        this.digits = ['', '', '', '', '', ''];
        this.message.set('');
        this.startResend();
        setTimeout(() => document.getElementById('otp0')?.focus(), 0);
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(this.errText(err));
        this.messageIsError.set(true);
      },
    });
  }

  backToContact() {
    this.clearTimer();
    this.step.set(1);
    this.message.set('');
  }

  /** 'otp' mode's boxes are id="otp0".."otp5", 'force-reset' mode's are
   * id="fr-otp0".."fr-otp5" (it also needs the password fields filled in,
   * so it never auto-submits on the 6th digit like plain OTP login does). */
  private otpPrefix(): string {
    return this.mode() === 'force-reset' ? 'fr-otp' : 'otp';
  }

  onOtpInput(i: number, e: Event) {
    const target = e.target as HTMLInputElement;
    const val = target.value.replace(/\D/g, '');
    this.digits[i] = val;
    const prefix = this.otpPrefix();
    if (val && i < 5) document.getElementById(`${prefix}${i + 1}`)?.focus();
    if (val && i === 5 && this.digits.every((d) => d) && this.mode() === 'otp') this.verifyOtp();
  }

  onOtpBack(i: number, e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.value && i > 0) document.getElementById(`${this.otpPrefix()}${i - 1}`)?.focus();
  }

  onOtpPaste(e: Event) {
    const clip = (e as ClipboardEvent).clipboardData?.getData('text') ?? '';
    const nums = clip.replace(/\D/g, '').slice(0, 6).split('');
    for (let i = 0; i < 6; i++) this.digits[i] = nums[i] ?? '';
    const focusIdx = Math.min(nums.length, 5);
    document.getElementById(`${this.otpPrefix()}${focusIdx}`)?.focus();
    e.preventDefault();
    if (this.digits.every((d) => d) && this.mode() === 'otp') this.verifyOtp();
  }

  private startResend() {
    this.clearTimer();
    this.resendIn.set(30);
    this.resendTimer = setInterval(() => {
      const v = this.resendIn() - 1;
      this.resendIn.set(v);
      if (v <= 0) this.clearTimer();
    }, 1000);
  }

  private clearTimer() {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }

  private errText(err: unknown): string {
    const body = (err as { error?: { message?: string | string[] } })?.error;
    const m = body?.message;
    if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
    return m ?? 'Something went wrong. Please try again.';
  }
}
