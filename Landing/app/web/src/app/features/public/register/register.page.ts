import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { SiteSettingsService } from '@core/services/site-settings.service';
import { AuthService } from '@core/services/auth.service';
import { StudentDataService } from '../../account/student-data.service';
import { formatINR } from '../../account/format';

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
  duePayment: { stageId: number; stageName: string; price: number } | null;
  accessToken: string;
  authStudent: { id: number; name: string; email?: string };
  alreadyRegistered?: boolean;
}

/** Shape shown on the 'done' screen when an already-logged-in student
 * joins an additional competition — no OTP/session fields, they already
 * have a session. Deliberately a structural subset of RegisterResult so
 * the same template bindings (result?.student?.name, etc.) work for both. */
interface JoinedResult {
  registrationCode: string;
  student: { code: string; name: string; grade: string; email: string };
  competition: { code: string; title: string };
  duePayment: { stageId: number; stageName: string; price: number } | null;
  alreadyRegistered: boolean;
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
          <img class="af-logo" [src]="settings().logoDarkUrl" alt="India Mind League" />
          <h1 class="af-title">Register for the Qualifier</h1>
          @if (step() === 'form' || step() === 'otp') {
            @if (compTitle()) {
              <p class="reg-comp-banner">Registering for <b>{{ compTitle() }}</b></p>
            }
            <p class="af-lead">Fill in the details below to enter the championship.</p>
          }

          @if (step() === 'joining') {
            <div class="reg-joining">
              @if (joinError()) {
                <p class="f-err">{{ joinError() }}</p>
                <a class="btn btn-gold-solid btn-lg" routerLink="/competitions">Back to Competitions</a>
              } @else {
                <p class="hint">Adding you to {{ compCode() }}…</p>
              }
            </div>
          }

          @if (step() === 'form') {
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
              <div class="field sp-wrap">
                <label>School Name <span class="opt">(optional)</span></label>
                <input
                  name="school"
                  type="text"
                  readonly
                  [value]="form.school"
                  placeholder="Start typing to search, or enter a new school"
                  (focus)="openSchoolPicker()"
                  (click)="openSchoolPicker()"
                />
                @if (schoolPickerOpen()) {
                  <div class="sp-panel" role="dialog" aria-label="Select school">
                    <div class="sp-head">
                      <span>Select School</span>
                      <button type="button" class="sp-x" (click)="closeSchoolPicker()" aria-label="Close">✕</button>
                    </div>
                    <div class="sp-search">
                      <input
                        type="text"
                        [ngModel]="schoolQuery()"
                        (ngModelChange)="schoolQuery.set($event)"
                        [ngModelOptions]="{ standalone: true }"
                        (keydown.escape)="closeSchoolPicker()"
                        placeholder="Search schools…"
                        autocomplete="off"
                      />
                    </div>
                    <div class="sp-list">
                      @for (s of filteredSchools(); track s) {
                        <button type="button" class="sp-item" (click)="selectSchool(s)">
                          @for (part of matchParts(s); track $index) {
                            @if (part.hit) { <b>{{ part.text }}</b> } @else { {{ part.text }} }
                          }
                        </button>
                      } @empty {
                        <div class="sp-empty">No matching schools.</div>
                      }
                      @if (schoolQuery().trim() && !exactMatch()) {
                        <button type="button" class="sp-item sp-new" (click)="selectSchool(schoolQuery().trim())">
                          + Use "{{ schoolQuery().trim() }}" as a new school
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>

              @if (message()) {
                <div class="form-msg alert error" [class.ok]="!messageIsError()">{{ message() }}</div>
              }
              <button type="submit" class="btn btn-gold-solid btn-block btn-lg" [disabled]="busy()">{{ busy() ? 'Sending code…' : 'Continue →' }}</button>
              <p class="hint reg-terms">By registering you agree to the championship terms &amp; data policy.</p>
            </form>
          }

          @if (step() === 'otp') {
            <form (ngSubmit)="verifyAndRegister()" novalidate>
              <p class="otp-sent">We sent a 6-digit code to <b>{{ form.email }}</b>. <button type="button" class="linkbtn" (click)="backToForm()">Change</button></p>
              <div class="otp-boxes" id="regOtpBoxes">
                @for (i of [0, 1, 2, 3, 4, 5]; track i) {
                  <input
                    #otpInput
                    inputmode="numeric"
                    maxlength="1"
                    [attr.aria-label]="'OTP digit ' + (i + 1)"
                    [id]="'regotp' + i"
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
              <button class="btn btn-gold-solid btn-block btn-lg" type="submit" [disabled]="busy()">{{ busy() ? 'Verifying…' : 'Verify & Complete Registration' }}</button>
              <p class="otp-resend">Didn't get it? <button type="button" class="linkbtn" (click)="resendOtp()" [disabled]="resendIn() > 0">Resend in {{ resendIn() }}s</button></p>
            </form>
          }

          @if (step() === 'done') {
            <div class="form-success show">
              <div class="check"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
              @if (result?.alreadyRegistered) {
                <h3>You're already in! 👍</h3>
                <p>You were already registered for <b>{{ result?.competition?.title }}</b> — registration ID <b>{{ result?.registrationCode }}</b>.</p>
              } @else {
                <h3>You're registered! 🎉</h3>
                <p>Welcome to the India Mind League, <b>{{ result?.student?.name }}</b>. Your registration ID is <b>{{ result?.registrationCode }}</b> for <b>{{ result?.competition?.title }}</b>.</p>
              }

              @if (result?.duePayment) {
                <div class="reg-due-banner">
                  <span class="rdb-ic">💳</span>
                  <div class="rdb-body">
                    <b>One step left — pay to activate your eligibility</b>
                    <small>{{ result?.duePayment?.stageName }} needs a {{ formatINR(result!.duePayment!.price) }} payment before you're eligible to take it. You won't be able to participate until this is paid.</small>
                  </div>
                </div>
                @if (payError()) {
                  <div class="form-msg alert error">{{ payError() }}</div>
                }
                <div class="reg-success-cta">
                  <button class="btn btn-gold-solid btn-lg" type="button" [disabled]="payingNow()" (click)="payNow()">
                    {{ payingNow() ? 'Redirecting to payment…' : 'Pay ' + formatINR(result!.duePayment!.price) + ' Now →' }}
                  </button>
                  <a class="btn btn-ghost btn-lg" routerLink="/account">I'll pay later</a>
                </div>
              } @else {
                <div class="reg-success-cta">
                  <a class="btn btn-gold-solid btn-lg" routerLink="/account">Go to My Dashboard →</a>
                  <button class="btn btn-ghost btn-lg" type="button" (click)="reset()">Register another</button>
                </div>
              }
            </div>
          }

          @if (step() === 'form' || step() === 'otp') {
            <p class="af-alt">Already registered? <a routerLink="/login">Login here</a></p>
          }
        </section>

      </div>
    </main>

    @if (schoolPickerOpen()) {
      <div class="sp-backdrop" (click)="closeSchoolPicker()"></div>
    }
  `,
  styles: [
    `
      .reg-comp-banner { text-align: center; margin: 0.2rem 0 0.6rem; font-size: 0.92rem; color: var(--muted); }
      .reg-comp-banner b { color: var(--text); }
      .reg-joining { text-align: center; padding: 2rem 0; }
      .reg-joining .f-err { margin-bottom: 1rem; }
    `,
  ],
})
export class RegisterPage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly studentData = inject(StudentDataService);
  protected readonly settings = inject(SiteSettingsService).settings;
  protected readonly formatINR = formatINR;

  // Set by /register?comp=CODE (e.g. from the Competitions listing page) —
  // threaded straight through to /public/register so the student lands in
  // the right competition instead of whichever one is Live by default.
  protected readonly compCode = signal<string | null>(null);
  protected readonly compTitle = signal<string | null>(null);

  readonly busy = signal(false);
  readonly payingNow = signal(false);
  readonly payError = signal('');
  // 'joining' = already logged in, silently registering for ?comp=CODE
  // with no form at all — see the constructor's auth branch below.
  readonly step = signal<'form' | 'otp' | 'done' | 'joining'>('form');
  readonly message = signal('');
  readonly messageIsError = signal(true);
  readonly grades = signal<string[]>([]);
  readonly schools = signal<string[]>([]);
  readonly schoolPickerOpen = signal(false);
  readonly schoolQuery = signal('');

  readonly filteredSchools = computed(() => {
    const q = this.schoolQuery().trim().toLowerCase();
    const all = this.schools();
    const list = q ? all.filter((s) => s.toLowerCase().includes(q)) : all;
    return list.slice(0, 60);
  });

  readonly exactMatch = computed(() => {
    const q = this.schoolQuery().trim().toLowerCase();
    return !!q && this.schools().some((s) => s.toLowerCase() === q);
  });
  readonly resendIn = signal(0);
  readonly joinError = signal('');
  result: RegisterResult | JoinedResult | null = null;

  form: RegisterPayload = { name: '', grade: '', email: '', phone: '', parent: '', school: '' };
  errors: FieldErrors = {};
  digits: string[] = ['', '', '', '', '', ''];
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  // Meta Pixel — deliberately loaded only from this component, not from
  // the shared index.html <head> (there's just one index.html for the
  // whole SPA, so that would fire on every route). Torn down in
  // ngOnDestroy so nothing keeps referencing this page once the student
  // navigates elsewhere in the same SPA session.
  private pixelScriptEl: HTMLScriptElement | null = null;
  private pixelImgEl: HTMLImageElement | null = null;

  private loadMetaPixel(): void {
    const w = window as unknown as Record<string, any>;
    if (!w['fbq']) {
      const n: any = (w['fbq'] = function (...args: unknown[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
      });
      if (!w['_fbq']) w['_fbq'] = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
      this.pixelScriptEl = script;
    }
    w['fbq']('init', '1771489497235129');
    w['fbq']('track', 'PageView');

    const img = document.createElement('img');
    img.height = 1;
    img.width = 1;
    img.style.display = 'none';
    img.src = 'https://www.facebook.com/tr?id=1771489497235129&ev=PageView&noscript=1';
    document.body.appendChild(img);
    this.pixelImgEl = img;
  }

  constructor() {
    this.loadMetaPixel();

    const comp = this.route.snapshot.queryParamMap.get('comp')?.trim();

    // Already signed in (e.g. clicked "Register" on the Competitions page
    // in a live session) — they don't need the name/email/OTP form at
    // all, just add the registration under their existing account. With
    // no ?comp given there's no competition intent to act on here, so
    // send them to their dashboard instead of a form asking questions
    // we already have answers to.
    if (this.authService.isAuthenticated && this.authService.isStudent) {
      if (comp) {
        this.joinAsLoggedInStudent(comp);
      } else {
        this.router.navigate(['/account/schedules']);
      }
      return;
    }

    this.api.get<GradeOption[]>('/public/grades').subscribe({
      next: (rows) => this.grades.set((rows ?? []).map((g) => g.name)),
      error: () => this.grades.set([]),
    });
    this.api.get<string[]>('/public/schools').subscribe({
      next: (rows) => this.schools.set(rows ?? []),
      error: () => this.schools.set([]),
    });

    if (comp) {
      this.compCode.set(comp);
      this.api.get<{ code: string; title: string }[]>('/public/competitions').subscribe({
        next: (rows) => {
          const match = (rows ?? []).find((r) => r.code.toLowerCase() === comp.toLowerCase());
          if (match) this.compTitle.set(match.title);
        },
        error: () => {},
      });
    }
  }

  private joinAsLoggedInStudent(competitionCode: string) {
    this.step.set('joining');
    this.studentData.joinCompetition(competitionCode).subscribe({
      next: (res) => {
        const user = this.authService.user();
        this.result = {
          registrationCode: res.registrationCode,
          student: { code: '', name: user?.name ?? '', grade: '', email: user?.email ?? '' },
          competition: res.competition,
          duePayment: res.duePayment,
          alreadyRegistered: res.alreadyRegistered,
        };
        this.step.set('done');
      },
      error: (err) => {
        this.joinError.set(this.errText(err));
      },
    });
  }

  ngOnDestroy() {
    this.clearTimer();
    // Removing the DOM nodes doesn't "unload" fbevents.js — once loaded,
    // its side effects (the global fbq function) are just part of the JS
    // runtime for the rest of this session, same as any other loaded
    // script would be. What actually keeps tracking scoped to this page
    // is that nothing outside this component ever calls fbq() at all.
    // This is just tidy-up so the injected <script>/<img> don't linger
    // attached to <head>/<body> after the page they belong to is gone.
    this.pixelScriptEl?.remove();
    this.pixelScriptEl = null;
    this.pixelImgEl?.remove();
    this.pixelImgEl = null;
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
    this.api.post<{ expiresIn: number }>('/public/register/otp', { email, phone }).subscribe({
      next: () => {
        this.busy.set(false);
        this.digits = ['', '', '', '', '', ''];
        this.step.set('otp');
        this.startResend();
        setTimeout(() => document.getElementById('regotp0')?.focus(), 0);
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(this.errText(err));
        this.messageIsError.set(true);
      },
    });
  }

  verifyAndRegister() {
    if (this.busy()) return;
    const code = this.digits.join('');
    if (code.length !== 6) {
      this.message.set('Enter all 6 digits of the code.');
      this.messageIsError.set(true);
      return;
    }
    const f = this.form;
    this.busy.set(true);
    this.message.set('');
    this.api
      .post<RegisterResult>('/public/register', {
        name: f.name.trim(),
        grade: f.grade,
        email: f.email.trim(),
        phone: f.phone.trim(),
        parent: f.parent.trim() || undefined,
        school: f.school.trim() || undefined,
        competitionCode: this.compCode() ?? undefined,
        otp: code,
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.clearTimer();
          this.result = res;
          this.authService.applySession(res.accessToken, res.authStudent);
          this.step.set('done');
        },
        error: (err) => {
          this.busy.set(false);
          this.message.set(this.errText(err));
          this.messageIsError.set(true);
          // Wrong code — clear the boxes so retyping doesn't just re-submit
          // the same six digits (auto-submit fires again on the 6th digit).
          this.digits = ['', '', '', '', '', ''];
          setTimeout(() => document.getElementById('regotp0')?.focus(), 0);
        },
      });
  }

  resendOtp() {
    if (this.resendIn() > 0) return;
    this.busy.set(true);
    this.api
      .post<{ expiresIn: number }>('/public/register/otp', { email: this.form.email.trim(), phone: this.form.phone.trim() })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.digits = ['', '', '', '', '', ''];
          this.message.set('');
          this.startResend();
          setTimeout(() => document.getElementById('regotp0')?.focus(), 0);
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

  onOtpInput(i: number, e: Event) {
    const target = e.target as HTMLInputElement;
    const val = target.value.replace(/\D/g, '');
    this.digits[i] = val;
    if (val && i < 5) document.getElementById(`regotp${i + 1}`)?.focus();
    if (val && i === 5 && this.digits.every((d) => d)) this.verifyAndRegister();
  }

  onOtpBack(i: number, e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.value && i > 0) document.getElementById(`regotp${i - 1}`)?.focus();
  }

  onOtpPaste(e: Event) {
    const clip = (e as ClipboardEvent).clipboardData?.getData('text') ?? '';
    const nums = clip.replace(/\D/g, '').slice(0, 6).split('');
    for (let i = 0; i < 6; i++) this.digits[i] = nums[i] ?? '';
    const focusIdx = Math.min(nums.length, 5);
    document.getElementById(`regotp${focusIdx}`)?.focus();
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

  openSchoolPicker() {
    this.schoolQuery.set(this.form.school);
    this.schoolPickerOpen.set(true);
    setTimeout(() => document.querySelector<HTMLInputElement>('.sp-search input')?.focus(), 0);
  }

  closeSchoolPicker() {
    this.form.school = this.schoolQuery().trim();
    this.schoolPickerOpen.set(false);
  }

  selectSchool(name: string) {
    this.form.school = name;
    this.schoolQuery.set(name);
    this.schoolPickerOpen.set(false);
  }

  /** Splits a school name into plain/bold-matched segments for the "Google-style" suggestion highlight. */
  matchParts(name: string): { text: string; hit: boolean }[] {
    const q = this.schoolQuery().trim();
    if (!q) return [{ text: name, hit: false }];
    const idx = name.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return [{ text: name, hit: false }];
    const parts: { text: string; hit: boolean }[] = [];
    if (idx > 0) parts.push({ text: name.slice(0, idx), hit: false });
    parts.push({ text: name.slice(idx, idx + q.length), hit: true });
    if (idx + q.length < name.length) parts.push({ text: name.slice(idx + q.length), hit: false });
    return parts;
  }

  reset() {
    this.form = { name: '', grade: '', email: '', phone: '', parent: '', school: '' };
    this.errors = {};
    this.result = null;
    this.message.set('');
    this.step.set('form');
  }

  payNow() {
    const due = this.result?.duePayment;
    if (!due || this.payingNow()) return;
    this.payingNow.set(true);
    this.payError.set('');
    this.studentData.initiatePayment(due.stageId).subscribe({
      next: (init) => this.studentData.redirectToCheckout(init),
      error: (err) => {
        this.payingNow.set(false);
        this.payError.set(this.errText(err));
      },
    });
  }

  private errText(err: unknown): string {
    const body = (err as { error?: { message?: string | string[] } })?.error;
    const m = body?.message;
    if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
    return m ?? 'Something went wrong. Please try again.';
  }
}
