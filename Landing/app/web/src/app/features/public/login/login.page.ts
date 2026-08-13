import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-login',
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

          <h2 class="aa-title">Welcome back,<br /><span class="gradient">Champion!</span></h2>
          <p class="aa-sub">Log in to pick up where you left off — your qualifier, your rank and your rewards.</p>

          <ul class="aa-feats">
            <li><span class="aa-ic c-iq">🧠</span><div><b>Digital Qualifier</b><small>Resume your IQ · EQ · Values test</small></div></li>
            <li><span class="aa-ic c-eq">📈</span><div><b>Live Leaderboard</b><small>See your rank update in real time</small></div></li>
            <li><span class="aa-ic c-val">🏆</span><div><b>Certificates</b><small>Collect badges &amp; recognition</small></div></li>
          </ul>

          <div class="aa-stats">
            <div><b>10k+</b><small>Students</small></div>
            <div><b>100+</b><small>Schools</small></div>
            <div><b>4</b><small>Stages</small></div>
          </div>
        </aside>

        <section class="auth-form">
          <img class="af-logo" src="img/new-logo-cut.png" alt="India Mind League" />
          <h1 class="af-title">Student Login</h1>
          <p class="af-lead">Sign in with a one-time password, or your email and password.</p>

          <div class="seg" [class.phone]="method() === 'phone'" [class.password]="method() === 'password'" role="tablist" aria-label="Login method">
            <button type="button" class="seg-btn" [class.active]="method() === 'email'" (click)="setMethod('email')">
              <svg class="seg-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Email
            </button>
            <button type="button" class="seg-btn" [class.active]="method() === 'password'" (click)="setMethod('password')">
              <svg class="seg-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11V7a7 7 0 0 1 14 0v4"/><rect x="3" y="11" width="18" height="10" rx="2"/></svg>Password
            </button>
            <button type="button" class="seg-btn" [class.active]="method() === 'phone'" (click)="setMethod('phone')">
              <svg class="seg-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>Phone
            </button>
            <span class="seg-thumb"></span>
          </div>

          @if (method() === 'password') {
            <form (ngSubmit)="loginWithPassword()" novalidate>
              <div class="field">
                <label for="pwEmail">Email address</label>
                <input id="pwEmail" name="pwEmail" type="email" [(ngModel)]="pwEmail" autocomplete="email" placeholder="you@example.com" />
              </div>
              <div class="field">
                <label for="pwPassword">Password</label>
                <input id="pwPassword" name="pwPassword" type="password" [(ngModel)]="pwPassword" autocomplete="current-password" placeholder="••••••••" />
              </div>
              @if (message()) {
                <div class="form-msg alert error" [class.ok]="!messageIsError()">{{ message() }}</div>
              }
              <button class="btn btn-gold-solid btn-block btn-lg" type="submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Login →' }}</button>
              <p class="otp-resend">Forgot your password? Use the <button type="button" class="linkbtn" (click)="setMethod('email')">OTP option</button>.</p>
            </form>
          }

          @if (step() === 1) {
            <form (ngSubmit)="sendOtp()" novalidate>
              <div class="field">
                <label for="contact">{{ method() === 'phone' ? 'Phone number' : 'Email address' }}</label>
                <input id="contact" name="contact" [(ngModel)]="contact" [type]="method() === 'phone' ? 'tel' : 'email'" autocomplete="email" placeholder="you@example.com" />
              </div>
              @if (message()) {
                <div class="form-msg alert error" [class.ok]="!messageIsError()">{{ message() }}</div>
              }
              <button class="btn btn-gold-solid btn-block btn-lg" type="submit" [disabled]="busy()">{{ busy() ? 'Sending…' : 'Send OTP →' }}</button>
            </form>
          }

          @if (step() === 2) {
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
              @if (devCode()) {
                <p class="hint">Demo: enter <b>{{ devCode() }}</b> to continue.</p>
              }
              @if (message()) {
                <div class="form-msg alert error" [class.ok]="!messageIsError()">{{ message() }}</div>
              }
              <button class="btn btn-gold-solid btn-block btn-lg" type="submit" [disabled]="busy()">{{ busy() ? 'Verifying…' : 'Verify & Login' }}</button>
              <p class="otp-resend">Didn't get it? <button type="button" class="linkbtn" (click)="resendOtp()" [disabled]="resendIn() > 0">Resend in {{ resendIn() }}s</button></p>
            </form>
          }

          <p class="af-alt">New to the League? <a routerLink="/register">Register here</a></p>
        </section>

      </div>
    </main>
  `,
})
export class LoginPage implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly method = signal<'email' | 'phone' | 'password'>('email');
  readonly step = signal<1 | 2>(1);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly messageIsError = signal(true);
  readonly devCode = signal('');
  readonly resendIn = signal(0);

  contact = '';
  sentTo = '';
  pwEmail = '';
  pwPassword = '';
  digits: string[] = ['', '', '', '', '', ''];
  private resendTimer: ReturnType<typeof setInterval> | null = null;
  private lastRequested = '';

  ngOnDestroy() {
    this.clearTimer();
  }

  setMethod(m: 'email' | 'phone' | 'password') {
    this.method.set(m);
    this.message.set('');
    if (m === 'phone') {
      this.message.set('Phone OTP is not enabled yet — please sign in with your registered email.');
      this.messageIsError.set(true);
    }
  }

  loginWithPassword() {
    const email = this.pwEmail.trim();
    const password = this.pwPassword;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      this.message.set('Enter a valid email address.');
      this.messageIsError.set(true);
      return;
    }
    if (!password) {
      this.message.set('Enter your password.');
      this.messageIsError.set(true);
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.auth.studentLogin(email, password).subscribe({
      next: () => {
        this.busy.set(false);
        this.router.navigate(['/account']);
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(this.errText(err));
        this.messageIsError.set(true);
      },
    });
  }

  sendOtp() {
    const contact = this.contact.trim();
    if (this.method() === 'phone') {
      this.message.set('Please sign in with your registered email address.');
      this.messageIsError.set(true);
      return;
    }
    if (!contact || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) {
      this.message.set('Enter a valid email address.');
      this.messageIsError.set(true);
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.lastRequested = contact.toLowerCase();
    this.auth.requestStudentOtp(this.lastRequested).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.devCode.set(res.devCode);
        this.sentTo = this.lastRequested;
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
    const code = this.digits.join('');
    if (code.length !== 6) {
      this.message.set('Enter all 6 digits of your OTP.');
      this.messageIsError.set(true);
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.auth.verifyStudentOtp(this.lastRequested, code).subscribe({
      next: () => {
        this.busy.set(false);
        this.router.navigate(['/account']);
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(this.errText(err));
        this.messageIsError.set(true);
      },
    });
  }

  resendOtp() {
    if (this.resendIn() > 0) return;
    this.busy.set(true);
    this.auth.requestStudentOtp(this.lastRequested).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.devCode.set(res.devCode);
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
    this.devCode.set('');
  }

  onOtpInput(i: number, e: Event) {
    const target = e.target as HTMLInputElement;
    const val = target.value.replace(/\D/g, '');
    this.digits[i] = val;
    if (val && i < 5) document.getElementById(`otp${i + 1}`)?.focus();
  }

  onOtpBack(i: number, e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.value && i > 0) document.getElementById(`otp${i - 1}`)?.focus();
  }

  onOtpPaste(e: Event) {
    const clip = (e as ClipboardEvent).clipboardData?.getData('text') ?? '';
    const nums = clip.replace(/\D/g, '').slice(0, 6).split('');
    for (let i = 0; i < 6; i++) this.digits[i] = nums[i] ?? '';
    const focusIdx = Math.min(nums.length, 5);
    document.getElementById(`otp${focusIdx}`)?.focus();
    e.preventDefault();
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
