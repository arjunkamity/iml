import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-wrap aurora">
      <div class="card auth-card fade-up">
        <a routerLink="/" class="brand brand-link"><span class="b1">INDIA</span><span class="b2">MIND</span><span class="b1">LEAGUE</span></a>
        <h2>Participant Registration</h2>
        <p>Secure your spot in the Digital Qualifier.</p>

        @if (error()) { <div class="alert error">{{ error() }}</div> }
        @if (success()) { <div class="alert ok">{{ success() }}</div> }

        <label>School Code</label>
        <div class="row" style="flex-wrap:nowrap;">
          <input [(ngModel)]="schoolCode" placeholder="e.g. IML-NOI-0002" />
          <button class="btn" (click)="validate()" [disabled]="!schoolCode">Validate</button>
        </div>
        @if (schoolName()) { <div class="alert ok">✓ {{ schoolName() }}</div> }

        <div class="grid cols-2">
          <div>
            <label>Full Name</label>
            <input [(ngModel)]="fullName" />
          </div>
          <div>
            <label>Class / Grade</label>
            <input [(ngModel)]="grade" placeholder="e.g. 8" />
          </div>
        </div>

        <div class="grid cols-2">
          <div>
            <label>Email</label>
            <input type="email" [(ngModel)]="email" />
          </div>
          <div>
            <label>City</label>
            <input [(ngModel)]="city" />
          </div>
        </div>

        <div class="grid cols-2">
          <div>
            <label>Parent Name</label>
            <input [(ngModel)]="parentName" />
          </div>
          <div>
            <label>Parent Mobile</label>
            <input [(ngModel)]="parentPhone" />
          </div>
        </div>

        <label>Your Mobile Number (for OTP)</label>
        <div class="row" style="flex-wrap:nowrap;">
          <input [(ngModel)]="phone" [disabled]="otpSent()" placeholder="10-digit mobile" />
          <button class="btn" (click)="sendOtp()" [disabled]="!phone || otpSent()">Send OTP</button>
        </div>

        @if (otpSent()) {
          @if (devCode()) { <div class="alert ok">Dev OTP: <b>{{ devCode() }}</b></div> }
          <label>Enter OTP</label>
          <input [(ngModel)]="code" maxlength="6" placeholder="6-digit code" />
          <button class="btn btn-primary btn-block" style="margin-top:1rem;" [disabled]="busy()" (click)="submit()">
            {{ busy() ? 'Submitting…' : 'Complete Registration' }}
          </button>
        }

        <p class="center" style="margin-top:1rem;">
          Already registered? <a routerLink="/login">Login</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:1.5rem 1.5rem 3rem; }
    .auth-card { width:100%; max-width:580px; }
    .brand-link { display:inline-block; margin-bottom:.6rem; }
  `],
})
export class RegisterComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  schoolCode = '';
  schoolName = signal<string | null>(null);
  fullName = '';
  grade = '';
  email = '';
  city = '';
  parentName = '';
  parentPhone = '';
  phone = '';
  code = '';
  otpSent = signal(false);
  devCode = signal<string | null>(null);
  busy = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  ngOnInit() {
    const phone = this.route.snapshot.queryParamMap.get('phone');
    if (phone) this.phone = phone;
  }

  validate() {
    this.error.set(null);
    this.api
      .get<{ valid: boolean; schoolName?: string }>(`/schools/validate/${this.schoolCode}`)
      .subscribe({
        next: (r) => {
          if (r.valid) this.schoolName.set(r.schoolName ?? 'Valid school');
          else {
            this.schoolName.set(null);
            this.error.set('Invalid or inactive school code');
          }
        },
        error: () => this.error.set('Could not validate code'),
      });
  }

  sendOtp() {
    this.error.set(null);
    this.auth.requestOtp(this.phone, 'SMS', 'Registration').subscribe({
      next: (r) => {
        this.otpSent.set(true);
        this.devCode.set(r.devCode ?? null);
      },
      error: (e) => this.error.set(e?.error?.message ?? 'Could not send OTP'),
    });
  }

  submit() {
    this.error.set(null);
    this.busy.set(true);
    this.auth
      .registerStudent({
        schoolCode: this.schoolCode,
        fullName: this.fullName,
        phone: this.phone,
        code: this.code,
        email: this.email || undefined,
        grade: this.grade || undefined,
        city: this.city || undefined,
        parentName: this.parentName || undefined,
        parentPhone: this.parentPhone || undefined,
      })
      .subscribe({
        next: () => {
          this.success.set('Registered! Redirecting…');
          this.auth.goHome();
        },
        error: (e) => {
          this.error.set(e?.error?.message ?? 'Registration failed');
          this.busy.set(false);
        },
      });
  }
}
