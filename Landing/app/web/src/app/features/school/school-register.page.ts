import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { SiteSettingsService } from '@core/services/site-settings.service';

@Component({
  selector: 'app-school-register',
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

          <h2 class="aa-title">Register Your<br /><span class="gradient">School</span></h2>
          <p class="aa-sub">Create your school's own portal account and start registering students for India Mind League.</p>

          <ul class="aa-feats">
            <li><span class="aa-ic c-iq">🏫</span><div><b>Your Own Login</b><small>Set your password right now — no waiting on anyone</small></div></li>
            <li><span class="aa-ic c-eq">🎓</span><div><b>Register Students</b><small>Add students the moment you're signed in</small></div></li>
            <li><span class="aa-ic c-val">✅</span><div><b>Reviewed, Not Blocked</b><small>Our team verifies new schools, but it never holds up your access</small></div></li>
          </ul>
        </aside>

        <section class="auth-form">
          <img class="af-logo" [src]="settings().logoDarkUrl" alt="India Mind League" />
          <h1 class="af-title">School Registration</h1>

          @if (step() === 'form') {
            <p class="af-lead">Tell us about your school. Already registered? <a routerLink="/schools/login">Login instead →</a></p>
            <form (ngSubmit)="sendOtp()" novalidate>
              <div class="field">
                <label for="name">School name *</label>
                <input id="name" name="name" [(ngModel)]="form.name" autocomplete="organization" placeholder="e.g. Amity International School, Noida" />
              </div>
              <div class="reg-row">
                <div class="field">
                  <label for="city">City</label>
                  <input id="city" name="city" [(ngModel)]="form.city" autocomplete="address-level2" placeholder="e.g. Noida" />
                </div>
                <div class="field">
                  <label for="schoolEmail">School's email</label>
                  <input id="schoolEmail" name="schoolEmail" type="email" [(ngModel)]="form.schoolEmail" placeholder="front office, info@… (optional)" />
                </div>
              </div>
              <div class="reg-row">
                <div class="field">
                  <label for="contact">Primary phone</label>
                  <input id="contact" name="contact" [(ngModel)]="form.contact" placeholder="School office number" />
                </div>
                <div class="field">
                  <label for="contactSecondary">Secondary phone</label>
                  <input id="contactSecondary" name="contactSecondary" [(ngModel)]="form.contactSecondary" placeholder="Optional" />
                </div>
              </div>

              <div class="field">
                <label for="coordinator">Your name (Coordinator) *</label>
                <input id="coordinator" name="coordinator" [(ngModel)]="form.coordinator" autocomplete="name" placeholder="Who's setting this up?" />
              </div>
              <div class="reg-row">
                <div class="field">
                  <label for="email">Your email *</label>
                  <input id="email" name="email" type="email" [(ngModel)]="form.email" autocomplete="email" placeholder="you@school.edu" />
                </div>
                <div class="field">
                  <label for="phone">Your phone *</label>
                  <input id="phone" name="phone" [(ngModel)]="form.phone" autocomplete="tel" placeholder="10-digit mobile" />
                </div>
              </div>
              <p class="hint">This email and phone become your login — we'll send a code here to verify it's really you.</p>

              <div class="reg-row">
                <div class="field">
                  <label for="password">Choose a password *</label>
                  <input id="password" name="password" type="password" [(ngModel)]="form.password" autocomplete="new-password" placeholder="At least 6 characters" />
                </div>
                <div class="field">
                  <label for="confirmPassword">Confirm password *</label>
                  <input id="confirmPassword" name="confirmPassword" type="password" [(ngModel)]="confirmPassword" autocomplete="new-password" placeholder="Re-enter password" />
                </div>
              </div>

              @if (message()) {
                <div class="form-msg alert error" [class.ok]="!messageIsError()">{{ message() }}</div>
              }
              <button class="btn btn-gold-solid btn-block btn-lg" type="submit" [disabled]="busy()">{{ busy() ? 'Sending code…' : 'Send Verification Code →' }}</button>
            </form>
          }

          @if (step() === 'otp') {
            <form (ngSubmit)="verifyAndRegister()" novalidate>
              <p class="otp-sent">We sent a 6-digit code to <b>{{ form.email }}</b> and <b>{{ form.phone }}</b>. <button type="button" class="linkbtn" (click)="backToForm()">Change details</button></p>
              <div class="otp-boxes" id="regOtpBoxes">
                @for (i of [0, 1, 2, 3, 4, 5]; track i) {
                  <input
                    inputmode="numeric"
                    maxlength="1"
                    [attr.aria-label]="'Verification code digit ' + (i + 1)"
                    [id]="'reg-otp' + i"
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
              <button class="btn btn-gold-solid btn-block btn-lg" type="submit" [disabled]="busy()">{{ busy() ? 'Creating account…' : 'Verify & Create Account' }}</button>
              <p class="otp-resend">Didn't get it? <button type="button" class="linkbtn" (click)="resendOtp()" [disabled]="resendIn() > 0">Resend in {{ resendIn() }}s</button></p>
            </form>
          }
        </section>
      </div>
    </main>
  `,
})
export class SchoolRegisterPage implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly settings = inject(SiteSettingsService).settings;

  readonly step = signal<'form' | 'otp'>('form');
  readonly busy = signal(false);
  readonly message = signal('');
  readonly messageIsError = signal(true);
  readonly resendIn = signal(0);

  form = {
    name: '',
    city: '',
    contact: '',
    contactSecondary: '',
    schoolEmail: '',
    coordinator: '',
    email: '',
    phone: '',
    password: '',
  };
  confirmPassword = '';
  digits: string[] = ['', '', '', '', '', ''];
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy() {
    this.clearTimer();
  }

  private validateForm(): string | null {
    if (!this.form.name.trim()) return 'Enter your school name.';
    if (!this.form.coordinator.trim()) return 'Enter your name.';
    if (!this.form.email.trim() || !this.form.email.includes('@')) return 'Enter a valid email.';
    if (!/^\d{10}$/.test(this.form.phone.replace(/\D/g, ''))) return 'Enter a valid 10-digit phone number.';
    if (!this.form.password || this.form.password.length < 6) return 'Choose a password with at least 6 characters.';
    if (this.form.password !== this.confirmPassword) return 'Passwords do not match.';
    return null;
  }

  sendOtp() {
    const err = this.validateForm();
    if (err) {
      this.message.set(err);
      this.messageIsError.set(true);
      return;
    }
    this.form.email = this.form.email.trim().toLowerCase();
    this.form.phone = this.form.phone.replace(/\D/g, '');
    this.busy.set(true);
    this.message.set('');
    this.auth.requestSchoolRegisterOtp(this.form.email, this.form.phone).subscribe({
      next: () => {
        this.busy.set(false);
        this.digits = ['', '', '', '', '', ''];
        this.step.set('otp');
        this.startResend();
        setTimeout(() => document.getElementById('reg-otp0')?.focus(), 0);
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(this.errText(err));
        this.messageIsError.set(true);
      },
    });
  }

  backToForm() {
    this.clearTimer();
    this.step.set('form');
    this.message.set('');
  }

  verifyAndRegister() {
    if (this.busy()) return;
    const code = this.digits.join('');
    if (code.length !== 6) {
      this.message.set('Enter all 6 digits of the code we sent.');
      this.messageIsError.set(true);
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.auth
      .registerSchool({
        name: this.form.name.trim(),
        city: this.form.city.trim() || undefined,
        contact: this.form.contact.trim() || undefined,
        contactSecondary: this.form.contactSecondary.trim() || undefined,
        schoolEmail: this.form.schoolEmail.trim() || undefined,
        coordinator: this.form.coordinator.trim(),
        email: this.form.email,
        phone: this.form.phone,
        password: this.form.password,
        otp: code,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.router.navigate(['/schools']);
        },
        error: (err) => {
          this.busy.set(false);
          this.message.set(this.errText(err));
          this.messageIsError.set(true);
          this.digits = ['', '', '', '', '', ''];
          setTimeout(() => document.getElementById('reg-otp0')?.focus(), 0);
        },
      });
  }

  resendOtp() {
    if (this.resendIn() > 0) return;
    this.busy.set(true);
    this.auth.requestSchoolRegisterOtp(this.form.email, this.form.phone).subscribe({
      next: () => {
        this.busy.set(false);
        this.digits = ['', '', '', '', '', ''];
        this.message.set('');
        this.startResend();
        setTimeout(() => document.getElementById('reg-otp0')?.focus(), 0);
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(this.errText(err));
        this.messageIsError.set(true);
      },
    });
  }

  onOtpInput(i: number, e: Event) {
    const target = e.target as HTMLInputElement;
    const val = target.value.replace(/\D/g, '');
    this.digits[i] = val;
    if (val && i < 5) document.getElementById(`reg-otp${i + 1}`)?.focus();
    if (val && i === 5 && this.digits.every((d) => d)) this.verifyAndRegister();
  }

  onOtpBack(i: number, e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.value && i > 0) document.getElementById(`reg-otp${i - 1}`)?.focus();
  }

  onOtpPaste(e: Event) {
    const clip = (e as ClipboardEvent).clipboardData?.getData('text') ?? '';
    const nums = clip.replace(/\D/g, '').slice(0, 6).split('');
    for (let i = 0; i < 6; i++) this.digits[i] = nums[i] ?? '';
    const focusIdx = Math.min(nums.length, 5);
    document.getElementById(`reg-otp${focusIdx}`)?.focus();
    e.preventDefault();
    if (this.digits.every((d) => d)) this.verifyAndRegister();
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
