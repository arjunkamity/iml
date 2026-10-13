import { Component, inject, isDevMode, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { firstAccessibleAdminPath } from './admin-shell';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="bg"></div>
    <div class="grid"></div>

    <main class="wrap">
      <a class="back" routerLink="/">← Back to website</a>

      <section class="card">
        <header class="hd">
          <span class="logo">India Mind League <small>Admin</small></span>
          <h1>Admin Sign In</h1>
          <p>Enter your credentials to open the control center.</p>
        </header>

        <form (ngSubmit)="submit()" novalidate>
          <label class="field">
            <span>Email address</span>
            <input
              type="email"
              name="email"
              autocomplete="username"
              placeholder="admin@amity.edu"
              [(ngModel)]="email"
              required
            />
          </label>

          <label class="field">
            <span>Password</span>
            <span class="pw">
              <input
                [type]="showPw ? 'text' : 'password'"
                name="password"
                autocomplete="current-password"
                placeholder="••••••••"
                [(ngModel)]="password"
                required
              />
              <button type="button" class="eye" (click)="showPw = !showPw" aria-label="Toggle password visibility">
                {{ showPw ? 'Hide' : 'Show' }}
              </button>
            </span>
          </label>

          @if (error) {
            <div class="err" role="alert">⚠ {{ error }}</div>
          }

          <button class="btn" type="submit" [disabled]="busy || !email || !password">
            {{ busy ? 'Signing in…' : 'Sign in →' }}
          </button>
        </form>

        <p class="alt">Student? <a routerLink="/login">Use the OTP login →</a></p>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        position: relative;
        color: #f4f2ff;
        font-family: 'Archivo', system-ui, sans-serif;
        overflow: hidden;
      }
      .bg {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(60rem 42rem at 78% -8%, rgba(37, 99, 235, 0.22), transparent 60%),
          radial-gradient(48rem 38rem at 8% 6%, rgba(59, 130, 246, 0.14), transparent 55%),
          radial-gradient(46rem 40rem at 50% 118%, rgba(232, 182, 74, 0.08), transparent 60%),
          linear-gradient(160deg, #123061, #0d2144 60%, #081326);
      }
      .grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.022) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.022) 1px, transparent 1px);
        background-size: 44px 44px;
        -webkit-mask-image: radial-gradient(circle at 50% 20%, #000 0%, transparent 72%);
        mask-image: radial-gradient(circle at 50% 20%, #000 0%, transparent 72%);
      }
      .wrap {
        position: relative;
        z-index: 1;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem 1rem;
      }
      .back {
        position: absolute;
        top: 1.4rem;
        left: 1.6rem;
        color: rgba(244, 242, 255, 0.75);
        text-decoration: none;
        font-size: 0.9rem;
      }
      .back:hover {
        color: #e8b64a;
      }
      .card {
        width: min(420px, 100%);
        background: linear-gradient(180deg, rgba(28, 26, 58, 0.9), rgba(11, 10, 29, 0.92));
        border: 1px solid rgba(232, 182, 74, 0.28);
        border-radius: 18px;
        padding: 2.2rem 2rem;
        box-shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }
      .hd {
        text-align: center;
        margin-bottom: 1.6rem;
      }
      .logo {
        font-weight: 800;
        letter-spacing: 0.01em;
      }
      .logo small {
        display: inline-block;
        margin-left: 0.4rem;
        padding: 0.12rem 0.5rem;
        border-radius: 999px;
        background: linear-gradient(180deg, #f5cc5a, #e0a92e);
        color: #241a02;
        font-size: 0.68rem;
        font-weight: 800;
        vertical-align: middle;
      }
      .hd h1 {
        font-family: 'Archivo', system-ui, sans-serif;
        font-size: 1.6rem;
        margin: 0.9rem 0 0.3rem;
        background: linear-gradient(120deg, #2563eb 0%, #7c3aed 50%, #ec4899 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: transparent;
      }
      .hd p {
        margin: 0;
        font-size: 0.92rem;
        color: rgba(244, 242, 255, 0.6);
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 1.1rem;
      }
      .field span {
        display: block;
        font-size: 0.8rem;
        color: rgba(244, 242, 255, 0.72);
        margin-bottom: 0.4rem;
      }
      .field input {
        width: 100%;
        box-sizing: border-box;
        padding: 0.72rem 0.85rem;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.06);
        color: #f4f2ff;
        font-family: inherit;
        font-size: 0.95rem;
      }
      .field input::placeholder {
        color: rgba(244, 242, 255, 0.35);
      }
      .field input:focus {
        outline: none;
        border-color: #e8b64a;
        box-shadow: 0 0 0 3px rgba(232, 182, 74, 0.18);
      }
      .pw {
        position: relative;
      }
      .pw input {
        padding-right: 4rem;
      }
      .eye {
        position: absolute;
        right: 0.35rem;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: 0;
        color: rgba(244, 242, 255, 0.6);
        cursor: pointer;
        font-family: inherit;
        font-size: 0.8rem;
        padding: 0.4rem 0.6rem;
      }
      .eye:hover {
        color: #e8b64a;
      }
      .err {
        background: rgba(220, 38, 38, 0.14);
        border: 1px solid rgba(220, 38, 38, 0.45);
        color: #fecaca;
        padding: 0.6rem 0.85rem;
        border-radius: 10px;
        font-size: 0.85rem;
      }
      .btn {
        margin-top: 0.2rem;
        padding: 0.8rem 1rem;
        border: 0;
        border-radius: 12px;
        background: linear-gradient(180deg, #f5cc5a, #e0a92e);
        color: #241a02;
        font-family: 'Archivo', system-ui, sans-serif;
        font-weight: 800;
        font-size: 0.98rem;
        cursor: pointer;
        box-shadow: 0 12px 28px -10px rgba(232, 182, 74, 0.7);
      }
      .btn:hover:not(:disabled) {
        filter: brightness(1.06);
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .alt {
        text-align: center;
        margin: 1.2rem 0 0;
        font-size: 0.88rem;
        color: rgba(244, 242, 255, 0.65);
      }
      .alt a {
        color: #e8b64a;
        text-decoration: none;
      }
    `,
  ],
})
export class AdminLoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  showPw = false;
  busy = false;
  error = '';

  ngOnInit(): void {
    if (this.auth.isAuthenticated && this.auth.isAdmin) {
      this.router.navigate([firstAccessibleAdminPath(this.auth)]);
      return;
    }
    // Dev-build convenience only: isDevMode() is false in the actual
    // production bundle (built with `ng build` / --configuration
    // production), so this never reaches indiamindleague.com. Matches the
    // seed admin in prisma/seed.ts (DEV_ADMIN_PASSWORD).
    if (isDevMode()) {
      this.email = 'arjun@amity.edu';
      this.password = 'Admin@123';
    }
  }

  submit(): void {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.auth.adminLogin(this.email.trim(), this.password).subscribe({
      next: () => {
        const next = this.route.snapshot.queryParamMap.get('next');
        this.router.navigate(next && next.startsWith('/admin') ? [next] : [firstAccessibleAdminPath(this.auth)]);
      },
      error: (err: unknown) => {
        this.busy = false;
        const body = err as { error?: { message?: string }; message?: string };
        this.error = body?.error?.message ?? body?.message ?? 'Sign in failed. Please try again.';
      },
    });
  }
}
