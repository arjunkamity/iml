import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';

interface RegisterPayload {
  name: string;
  grade: string;
  email: string;
  phone: string;
  parent: string;
  school: string;
}

interface RegisterResult {
  registrationCode: string;
  student: { code: string; name: string; grade: string; email: string };
  competition: { code: string; title: string };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="bg-aurora"></div>
    <div class="bg-grid"></div>

    <a routerLink="/" class="auth-back">← Back to site</a>

    <main class="auth auth-wide">
      <div class="auth-card">

        <aside class="auth-aside">
          <div class="aa-sprites" aria-hidden="true">
            <img class="aspr a1" src="img/sprites/globe.png" alt="" />
            <img class="aspr a2" src="img/sprites/book.png" alt="" />
            <img class="aspr a3" src="img/sprites/pointed arrow.png" alt="" />
            <img class="aspr a4" src="img/sprites/triangle-set-sqare.png" alt="" />
            <img class="aspr a5" src="img/sprites/dots.png" alt="" />
          </div>

          <h2 class="aa-title">Challenge your thinking. <span class="gradient">Discover your strengths.</span></h2>
          <p class="aa-sub">Every student has the potential to lead, innovate and create positive change. The journey begins with a single step — unlock your leadership potential.</p>

          <ul class="aa-feats">
            <li><span class="aa-ic c-iq">🧠</span><div><b>Practice quizzes + Digital Qualifier</b><small>Full access from the moment you register</small></div></li>
            <li><span class="aa-ic c-eq">📊</span><div><b>Performance insights</b><small>See where you shine and where to grow</small></div></li>
            <li><span class="aa-ic c-val">🏆</span><div><b>Participation certificate</b><small>Plus eligibility for the next stages</small></div></li>
          </ul>

          <div class="aa-stats">
            <div><b>10k+</b><small>Students</small></div>
            <div><b>1000+</b><small>Schools</small></div>
            <div><b>Free</b><small>To enter</small></div>
          </div>
        </aside>

        <section class="auth-form">
          <img class="af-logo" src="img/new-logo-cut.png" alt="India Mind League" />
          <h1 class="af-title">Register for the Qualifier</h1>
          <p class="af-lead">Fill in the details below to enter the championship.</p>

          @if (!done()) {
            <form (ngSubmit)="submit()" novalidate>
              <div class="reg-row">
                <div class="field"><label>Student Name <span class="req">*</span></label><input name="name" [(ngModel)]="form.name" autocomplete="name" placeholder="Full name" required /></div>
                <div class="field"><label>Class / Grade <span class="req">*</span></label><input name="grade" [(ngModel)]="form.grade" placeholder="e.g. 9" required /></div>
              </div>
              <div class="field"><label>Email Address <span class="req">*</span></label><input name="email" [(ngModel)]="form.email" type="email" autocomplete="email" placeholder="you@example.com" required /></div>
              <div class="reg-row">
                <div class="field"><label>Parent Name</label><input name="parentName" [(ngModel)]="form.parent" autocomplete="name" placeholder="Parent / Guardian" /></div>
                <div class="field"><label>Mobile Number <span class="req">*</span></label><input name="phone" [(ngModel)]="form.phone" inputmode="numeric" autocomplete="tel" placeholder="10-digit mobile" required /></div>
              </div>
              <div class="field"><label>School Name <span class="opt">(optional)</span></label><input name="school" [(ngModel)]="form.school" placeholder="School name" /></div>

              @if (message()) {
                <div class="form-msg alert error" [class.ok]="!messageIsError()">{{ message() }}</div>
              }
              <button type="submit" class="btn btn-gold-solid btn-block btn-lg" [disabled]="busy()">{{ busy() ? 'Registering…' : 'Complete Registration' }}</button>
              <p class="hint reg-terms">By registering you agree to the championship terms &amp; data policy.</p>
            </form>
          }

          @if (done()) {
            <div class="form-success show">
              <div class="check"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
              <h3>You're registered! 🎉</h3>
              <p>Welcome to the India Mind League, <b>{{ result?.student?.name }}</b>. Your registration ID is <b>{{ result?.registrationCode }}</b> for <b>{{ result?.competition?.title }}</b>.</p>
              <div class="reg-success-cta">
                <a class="btn btn-gold-solid btn-lg" routerLink="/login">Proceed to Login →</a>
                <button class="btn btn-ghost btn-lg" type="button" (click)="reset()">Register another</button>
              </div>
            </div>
          }

          <p class="af-alt">Already registered? <a routerLink="/login">Login here</a></p>
        </section>

      </div>
    </main>
  `,
})
export class RegisterPage {
  private readonly api = inject(ApiService);

  readonly busy = signal(false);
  readonly done = signal(false);
  readonly message = signal('');
  readonly messageIsError = signal(true);
  result: RegisterResult | null = null;

  form: RegisterPayload = { name: '', grade: '', email: '', phone: '', parent: '', school: '' };

  submit() {
    const f = this.form;
    const name = f.name.trim();
    const grade = f.grade.trim();
    const email = f.email.trim();
    const phone = f.phone.trim();
    if (!name || !grade || !email || !phone) {
      this.message.set('Please fill in all required fields (name, grade, email and mobile).');
      this.messageIsError.set(true);
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      this.message.set('Enter a valid email address.');
      this.messageIsError.set(true);
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      this.message.set('Enter a valid 10-digit mobile number.');
      this.messageIsError.set(true);
      return;
    }

    this.busy.set(true);
    this.message.set('');
    this.api
      .post<RegisterResult>('/public/register', {
        name,
        grade,
        email,
        phone,
        parent: f.parent.trim() || undefined,
        school: f.school.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.result = res;
          this.done.set(true);
        },
        error: (err) => {
          this.busy.set(false);
          this.message.set(this.errText(err));
          this.messageIsError.set(true);
        },
      });
  }

  reset() {
    this.form = { name: '', grade: '', email: '', phone: '', parent: '', school: '' };
    this.result = null;
    this.message.set('');
    this.done.set(false);
  }

  private errText(err: unknown): string {
    const body = (err as { error?: { message?: string | string[] } })?.error;
    const m = body?.message;
    if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
    return m ?? 'Something went wrong. Please try again.';
  }
}
