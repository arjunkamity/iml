import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-wrap aurora">
      <div class="card auth-card fade-up">
        <a routerLink="/" class="brand brand-link"><span class="b1">INDIA</span><span class="b2">MIND</span><span class="b1">LEAGUE</span></a>
        <h2>Welcome back</h2>
        <p class="faint" style="margin-top:-.2rem;">Sign in to continue to the League.</p>

        <div class="tabs">
          <button class="tab" [class.active]="mode() === 'otp'" (click)="mode.set('otp')">Participant (OTP)</button>
          <button class="tab" [class.active]="mode() === 'password'" (click)="mode.set('password')">School / Admin</button>
        </div>

        @if (error()) { <div class="alert error">{{ error() }}</div> }

        @if (mode() === 'password') {
          <label>Email</label>
          <input type="email" [(ngModel)]="email" placeholder="admin@indiamindleague.in" />
          <label>Password</label>
          <input type="password" [(ngModel)]="password" (keyup.enter)="loginPassword()" />
          <button class="btn btn-primary btn-block" style="margin-top:1rem;" [disabled]="busy()" (click)="loginPassword()">
            {{ busy() ? 'Signing in…' : 'Sign in' }}
          </button>
        } @else {
          <label>Mobile number</label>
          <input [(ngModel)]="phone" placeholder="10-digit mobile" [disabled]="otpSent()" />
          @if (!otpSent()) {
            <button class="btn btn-primary btn-block" style="margin-top:1rem;" [disabled]="busy()" (click)="sendOtp()">
              {{ busy() ? 'Sending…' : 'Send OTP' }}
            </button>
          } @else {
            @if (devCode()) { <div class="alert ok">Dev OTP: <b>{{ devCode() }}</b></div> }
            <label>Enter OTP</label>
            <input [(ngModel)]="code" maxlength="6" placeholder="6-digit code" (keyup.enter)="verifyOtp()" />
            <button class="btn btn-primary btn-block" style="margin-top:1rem;" [disabled]="busy()" (click)="verifyOtp()">
              {{ busy() ? 'Verifying…' : 'Verify & continue' }}
            </button>
          }
        }

        <p class="center" style="margin-top:1rem;">
          New participant? <a routerLink="/register">Register here</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:1.5rem; }
    .auth-card { width:100%; max-width:430px; }
    .brand-link { display:inline-block; margin-bottom:1.2rem; }
    .tabs { display:flex; gap:.4rem; margin:1rem 0; padding:.3rem; background:rgba(0,0,0,.25); border-radius:999px; border:1px solid var(--glass-border); }
    .tab { flex:1; background:transparent; border:0; color:var(--muted);
      padding:.55rem; border-radius:999px; cursor:pointer; font-weight:600; font-family:"Sora"; font-size:.85rem; transition:all .2s; }
    .tab.active { color:#0a0820; background:var(--grad-brand); }
  `],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  mode = signal<'otp' | 'password'>('otp');
  email = '';
  password = '';
  phone = '';
  code = '';
  otpSent = signal(false);
  devCode = signal<string | null>(null);
  busy = signal(false);
  error = signal<string | null>(null);

  loginPassword() {
    this.error.set(null);
    this.busy.set(true);
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.auth.goHome(),
      error: (e) => {
        this.error.set(e?.error?.message ?? 'Login failed');
        this.busy.set(false);
      },
    });
  }

  sendOtp() {
    this.error.set(null);
    this.busy.set(true);
    this.auth.requestOtp(this.phone, 'SMS', 'Login').subscribe({
      next: (r) => {
        this.otpSent.set(true);
        this.devCode.set(r.devCode ?? null);
        this.busy.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.message ?? 'Could not send OTP');
        this.busy.set(false);
      },
    });
  }

  verifyOtp() {
    this.error.set(null);
    this.busy.set(true);
    this.auth.verifyOtp(this.phone, this.code).subscribe({
      next: (r) => {
        if (r.accessToken) {
          this.auth.goHome();
        } else if (r.isNewUser) {
          void this.router.navigate(['/register'], { queryParams: { phone: this.phone } });
        }
        this.busy.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.message ?? 'Invalid OTP');
        this.busy.set(false);
      },
    });
  }
}
