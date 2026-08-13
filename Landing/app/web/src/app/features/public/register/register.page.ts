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

type FieldErrors = Partial<Record<keyof RegisterPayload, string>>;

const NAME_RE = /^[\p{L}]+(?:[ .'-][\p{L}]+)*$/u;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\d{10}$/;

interface RegisterResult {
  registrationCode: string;
  student: { code: string; name: string; grade: string; email: string };
  competition: { code: string; title: string };
}

interface GradeOption {
  name: string;
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
                <div class="field" [class.err]="errors.name">
                  <label>Student Name <span class="req">*</span></label>
                  <input name="name" [(ngModel)]="form.name" (blur)="validate('name')" (input)="errors.name = ''" autocomplete="name" placeholder="Full name" [maxlength]="120" />
                  @if (errors.name) {
                    <div class="f-err">{{ errors.name }}</div>
                  }
                </div>
                <div class="field" [class.err]="errors.grade">
                  <label>Class / Grade <span class="req">*</span></label>
                  <select name="grade" [(ngModel)]="form.grade" (blur)="validate('grade')" (change)="errors.grade = ''">
                    <option value="">Select class / grade…</option>
                    @for (g of grades(); track g) {
                      <option [value]="g">{{ g }}</option>
                    }
                  </select>
                  @if (errors.grade) {
                    <div class="f-err">{{ errors.grade }}</div>
                  }
                </div>
              </div>
              <div class="field" [class.err]="errors.email">
                <label>Email Address <span class="req">*</span></label>
                <input name="email" [(ngModel)]="form.email" type="email" (blur)="validate('email')" (input)="errors.email = ''" autocomplete="email" placeholder="you@example.com" [maxlength]="190" />
                @if (errors.email) {
                  <div class="f-err">{{ errors.email }}</div>
                }
              </div>
              <div class="reg-row">
                <div class="field" [class.err]="errors.parent">
                  <label>Parent Name</label>
                  <input name="parentName" [(ngModel)]="form.parent" (blur)="validate('parent')" (input)="errors.parent = ''" autocomplete="name" placeholder="Parent / Guardian" [maxlength]="120" />
                  @if (errors.parent) {
                    <div class="f-err">{{ errors.parent }}</div>
                  }
                </div>
                <div class="field" [class.err]="errors.phone">
                  <label>Mobile Number <span class="req">*</span></label>
                  <input name="phone" [(ngModel)]="form.phone" (blur)="validate('phone')" (input)="errors.phone = ''" inputmode="numeric" autocomplete="tel" placeholder="10-digit mobile" [maxlength]="10" />
                  @if (errors.phone) {
                    <div class="f-err">{{ errors.phone }}</div>
                  }
                </div>
              </div>
              <div class="field"><label>School Name <span class="opt">(optional)</span></label><input name="school" [(ngModel)]="form.school" placeholder="School name" [maxlength]="190" /></div>

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
  readonly grades = signal<string[]>([]);
  result: RegisterResult | null = null;

  form: RegisterPayload = { name: '', grade: '', email: '', phone: '', parent: '', school: '' };
  errors: FieldErrors = {};

  constructor() {
    this.api.get<GradeOption[]>('/public/grades').subscribe({
      next: (rows) => this.grades.set((rows ?? []).map((g) => g.name)),
      error: () => this.grades.set([]),
    });
  }

  validate(field: keyof RegisterPayload): string {
    const f = this.form;
    const value = f[field].trim();
    switch (field) {
      case 'name':
        if (!value) return 'Student name is required.';
        if (!NAME_RE.test(value) || value.length < 2) return 'Student name should contain only letters (no numbers or symbols).';
        return '';
      case 'grade':
        if (!value) return 'Please select a class / grade.';
        return '';
      case 'email':
        if (!value) return 'Email address is required.';
        if (!EMAIL_RE.test(value)) return 'Enter a valid email address.';
        return '';
      case 'phone':
        if (!value) return 'Mobile number is required.';
        if (!PHONE_RE.test(value)) return 'Enter a valid 10-digit mobile number.';
        return '';
      case 'parent':
        if (value && !NAME_RE.test(value)) return 'Parent name should contain only letters (no numbers or symbols).';
        return '';
      default:
        return '';
    }
  }

  submit() {
    const f = this.form;
    const name = f.name.trim();
    const grade = f.grade;
    const email = f.email.trim();
    const phone = f.phone.trim();

    this.errors = {};
    for (const key of ['name', 'grade', 'email', 'phone'] as const) {
      const err = this.validate(key);
      if (err) this.errors[key] = err;
    }
    if (f.parent.trim() && !NAME_RE.test(f.parent.trim())) {
      this.errors.parent = 'Parent name should contain only letters (no numbers or symbols).';
    }

    if (Object.keys(this.errors).length > 0) {
      this.message.set('');
      this.messageIsError.set(true);
      return;
    }
    if (!name || !grade || !email || !phone) {
      this.message.set('Please fill in all required fields (name, grade, email and mobile).');
      this.messageIsError.set(true);
      return;
    }
    if (!EMAIL_RE.test(email)) {
      this.message.set('Enter a valid email address.');
      this.messageIsError.set(true);
      return;
    }
    if (!PHONE_RE.test(phone)) {
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
    this.errors = {};
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
