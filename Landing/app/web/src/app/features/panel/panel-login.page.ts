import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { PanelApi, errText } from './panel-api.service';

type Step = 'login' | 'code' | 'forgot' | 'set' | 'done';

/**
 * The panel sign-in: user ID (email or phone) and password, then a code sent to the panelist's
 * email and phone (either channel's copy works). Also the page behind the invitation and
 * password-reset links (/panel/set-password/:token).
 */
@Component({
  selector: 'app-panel-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bg-aurora"></div>
    <div class="bg-grid"></div>
    <main class="auth" style="grid-template-columns: 1fr; place-items: center;">
      <div class="auth-card" style="grid-template-columns: 1fr; max-width: 440px; padding: 2.2rem 1.8rem;">
        <h1 class="af-title" style="margin:0 0 0.3rem">Evaluation Panel</h1>
        @switch (step()) {
          @case ('login') {
            <p class="af-lead">Sign in with your email or phone number and your password.</p>
            <form (ngSubmit)="login()" class="f">
              <label for="pl-user">Email or phone</label>
              <input id="pl-user" name="user" [(ngModel)]="userId" autocomplete="username" required />
              <label for="pl-pass">Password</label>
              <input id="pl-pass" name="pass" type="password" [(ngModel)]="password" autocomplete="current-password" required />
              @if (error()) { <p class="e">{{ error() }}</p> }
              <button class="btn btn-gold-solid" type="submit" [disabled]="busy() || !userId.trim() || !password">{{ busy() ? 'Checking…' : 'Continue' }}</button>
              <button class="lnk" type="button" (click)="step.set('forgot'); error.set('')">Forgot your password?</button>
            </form>
          }
          @case ('code') {
            <p class="af-lead">We sent a 6-digit code to your {{ sentTo() }}. Enter it here — either copy works.</p>
            <form (ngSubmit)="verify()" class="f">
              <label for="pl-code">Code</label>
              <input id="pl-code" name="code" [(ngModel)]="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="letter-spacing:0.4em;text-align:center;font-size:1.4rem" />
              @if (error()) { <p class="e">{{ error() }}</p> }
              <button class="btn btn-gold-solid" type="submit" [disabled]="busy() || code.trim().length !== 6">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
              <button class="lnk" type="button" (click)="back()">Start again</button>
            </form>
          }
          @case ('forgot') {
            <p class="af-lead">Enter your email or phone. If there is an account, we will send a link to set a new password.</p>
            <form (ngSubmit)="forgot()" class="f">
              <label for="pl-fu">Email or phone</label>
              <input id="pl-fu" name="fu" [(ngModel)]="userId" required />
              @if (error()) { <p class="e">{{ error() }}</p> }
              <button class="btn btn-gold-solid" type="submit" [disabled]="busy() || !userId.trim()">Send the link</button>
              <button class="lnk" type="button" (click)="back()">Back to sign in</button>
            </form>
          }
          @case ('set') {
            <p class="af-lead">Choose a password for your panel account (at least 8 characters).</p>
            <form (ngSubmit)="setPassword()" class="f">
              <label for="pl-np">New password</label>
              <input id="pl-np" name="np" type="password" [(ngModel)]="password" autocomplete="new-password" minlength="8" required />
              @if (error()) { <p class="e">{{ error() }}</p> }
              <button class="btn btn-gold-solid" type="submit" [disabled]="busy() || password.length < 8">{{ busy() ? 'Saving…' : 'Save password' }}</button>
            </form>
          }
          @case ('done') {
            <p class="af-lead">{{ doneText() }}</p>
            <button class="btn btn-gold-solid" (click)="back()">Go to sign in</button>
          }
        }
      </div>
    </main>
  `,
  styles: [
    `
      .f { display: grid; gap: 0.7rem; margin-top: 0.8rem; text-align: left; }
      .f label { font-weight: 700; font-size: 0.85rem; }
      .f input { min-height: 46px; padding: 0.55rem 0.8rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.25); color: inherit; font-size: 1rem; }
      .e { color: #fda4af; margin: 0; font-size: 0.9rem; }
      .lnk { background: none; border: 0; color: var(--muted, #9fb0d0); cursor: pointer; font-size: 0.85rem; text-decoration: underline; padding: 0.4rem; }
    `,
  ],
})
export class PanelLoginPage implements OnInit {
  private readonly api = inject(PanelApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly step = signal<Step>('login');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly sentTo = signal('email and phone');
  protected readonly doneText = signal('');
  protected userId = '';
  protected password = '';
  protected code = '';
  private challenge = '';
  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (this.token) this.step.set('set');
    else if (this.auth.isPanel) this.router.navigate(['/panel']);
  }

  protected back(): void {
    this.step.set('login');
    this.error.set('');
    this.password = '';
    this.code = '';
    if (this.token) this.router.navigate(['/panel/login']);
  }

  private run<T>(req: import('rxjs').Observable<T>, ok: (r: T) => void): void {
    this.busy.set(true);
    this.error.set('');
    req.subscribe({
      next: (r) => {
        this.busy.set(false);
        ok(r);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected login(): void {
    this.run(this.api.login(this.userId.trim(), this.password), (r) => {
      this.challenge = r.challenge;
      this.sentTo.set(r.sentTo.phone ? 'email and phone' : 'email');
      this.code = '';
      this.step.set('code');
    });
  }

  protected verify(): void {
    this.run(this.api.verify(this.challenge, this.code.trim()), (r) => {
      this.auth.applyPanelSession(r.accessToken, r.panelist);
      this.router.navigate(['/panel']);
    });
  }

  protected forgot(): void {
    this.run(this.api.forgot(this.userId.trim()), () => {
      this.doneText.set('If there is a panel account for that email or phone, a link to set a new password is on its way.');
      this.step.set('done');
    });
  }

  protected setPassword(): void {
    this.run(this.api.setPassword(this.token, this.password), () => {
      this.doneText.set('Your password is saved. You can sign in now.');
      this.step.set('done');
    });
  }
}
