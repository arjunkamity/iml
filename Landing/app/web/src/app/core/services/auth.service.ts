import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type Role = 'STUDENT' | 'SCHOOL' | 'PANEL' | 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER';

export interface AuthUser {
  id: number;
  name: string;
  email?: string;
  role: Role;
  modules?: string[];
}

export interface SchoolProfile {
  id: number;
  code: string;
  name: string;
  city: string | null;
  contact: string | null;
  coordinator: string | null;
  email: string | null;
  phone: string | null;
  hasPassword: boolean;
}

export interface OtpChallenge {
  expiresIn: number;
}

/** schoolLogin()'s other possible result — the password given was correct
 * but it's still the auto-set default (the school's own phone number), so
 * no session was issued. See SchoolLoginPage's 'force-reset' step and
 * AuthService.completeSchoolFirstLogin. */
export interface SchoolMustChangePassword {
  mustChangePassword: true;
  schoolId: number;
}

const TOKEN_KEY = 'iml_access_token';
const REFRESH_KEY = 'iml_refresh_token';
const USER_KEY = 'iml_user';

const ROLE_MAP: Record<string, Role> = {
  'Super Admin': 'SUPER_ADMIN',
  Editor: 'EDITOR',
  Viewer: 'VIEWER',
};

function mapAdmin(admin: {
  id: number;
  name: string;
  email: string;
  role: string;
  modules?: string[];
}): AuthUser {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: ROLE_MAP[admin.role] ?? 'VIEWER',
    modules: admin.modules,
  };
}

function mapStudent(student: { id: number; name: string; email?: string }): AuthUser {
  return { id: student.id, name: student.name, email: student.email, role: 'STUDENT' };
}

function mapSchool(school: SchoolProfile): AuthUser {
  return { id: school.id, name: school.name, email: school.email ?? undefined, role: 'SCHOOL' };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  readonly user = signal<AuthUser | null>(this.readUser());

  get accessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  get isAuthenticated(): boolean {
    return !!this.user();
  }

  get isAdmin(): boolean {
    const role = this.user()?.role;
    return role === 'SUPER_ADMIN' || role === 'EDITOR' || role === 'VIEWER';
  }

  get isStudent(): boolean {
    return this.user()?.role === 'STUDENT';
  }

  get isPanel(): boolean {
    return this.user()?.role === 'PANEL';
  }

  /** A panelist who has finished the two-step sign-in (see the panel login page). */
  applyPanelSession(accessToken: string, panelist: { id: number; name: string; email?: string }): void {
    this.setSession(accessToken, '', { id: panelist.id, name: panelist.name, email: panelist.email, role: 'PANEL' });
  }

  get isSchool(): boolean {
    return this.user()?.role === 'SCHOOL';
  }

  adminLogin(email: string, password: string): Observable<AuthUser> {
    return this.api
      .post<{ accessToken: string; refreshToken: string; admin: Parameters<typeof mapAdmin>[0] }>(
        '/auth/admin/login',
        { email, password },
      )
      .pipe(
        map((res) => {
          this.setSession(res.accessToken, res.refreshToken, mapAdmin(res.admin));
          return mapAdmin(res.admin);
        }),
      );
  }

  requestStudentOtp(identifier: { email?: string; phone?: string }): Observable<OtpChallenge> {
    return this.api.post<OtpChallenge>('/auth/student/request-otp', identifier);
  }

  studentLogin(email: string, password: string): Observable<AuthUser> {
    return this.api
      .post<{
        accessToken: string;
        student: { id: number; name: string; email?: string };
      }>('/auth/student/login', { email, password })
      .pipe(
        map((res) => {
          this.setSession(res.accessToken, '', mapStudent(res.student));
          return mapStudent(res.student);
        }),
      );
  }

  /** Applies a session the register flow already obtained (see PublicService.register) — no extra API call. */
  applySession(accessToken: string, student: { id: number; name: string; email?: string }): AuthUser {
    const user = mapStudent(student);
    this.setSession(accessToken, '', user);
    return user;
  }

  /** Exchanges an exam-reminder magic-link token for a real session — see MagicLinkPage. */
  consumeExamLink(token: string): Observable<{
    accessToken: string;
    student: { id: number; name: string; email?: string };
    examCode: string;
  }> {
    return this.api.post('/auth/exam-link/consume', { token });
  }

  /** Exchanges an admin-generated direct-login token (?sid=&token= on the
   * homepage) for a real session — see tokenLoginGuard. */
  consumeAccessToken(sid: string, token: string): Observable<{
    accessToken: string;
    student: { id: number; name: string; email?: string };
  }> {
    return this.api.post('/auth/student/access-token/consume', { sid, token });
  }

  verifyStudentOtp(identifier: { email?: string; phone?: string }, code: string): Observable<AuthUser> {
    return this.api
      .post<{
        accessToken: string;
        student: { id: number; name: string; email?: string };
      }>('/auth/student/verify-otp', { ...identifier, code })
      .pipe(
        map((res) => {
          this.setSession(res.accessToken, '', mapStudent(res.student));
          return mapStudent(res.student);
        }),
      );
  }

  /** Identifier is email OR phone — a school signs in with whichever the
   * admin set for it, unlike a student's password login (email-only).
   * A correct-but-still-default password comes back as
   * SchoolMustChangePassword instead of a session — see
   * SchoolMustChangePassword and completeSchoolFirstLogin. */
  schoolLogin(
    identifier: { email?: string; phone?: string },
    password: string,
  ): Observable<AuthUser | SchoolMustChangePassword> {
    return this.api
      .post<{ accessToken?: string; school?: SchoolProfile; mustChangePassword?: true; schoolId?: number }>(
        '/auth/school/login',
        { ...identifier, password },
      )
      .pipe(
        map((res) => {
          if (res.mustChangePassword) {
            return { mustChangePassword: true, schoolId: res.schoolId! };
          }
          this.setSession(res.accessToken!, '', mapSchool(res.school!));
          return mapSchool(res.school!);
        }),
      );
  }

  /** Exchanges an admin-generated school login link (Admin > Schools >
   * Magic Link) for a real session — see SchoolLinkPage. */
  consumeSchoolLink(token: string): Observable<AuthUser> {
    return this.api
      .post<{ accessToken: string; school: SchoolProfile }>('/auth/school/link/consume', { token })
      .pipe(
        map((res) => {
          this.setSession(res.accessToken, '', mapSchool(res.school));
          return mapSchool(res.school);
        }),
      );
  }

  /** Completes the forced first-login flow: the code that schoolLogin()
   * auto-sent to both registered channels, plus the school's chosen
   * password, in one call — only on success does a real session start. */
  completeSchoolFirstLogin(schoolId: number, code: string, newPassword: string): Observable<AuthUser> {
    return this.api
      .post<{ accessToken: string; school: SchoolProfile }>('/auth/school/first-login/complete', {
        schoolId,
        code,
        newPassword,
      })
      .pipe(
        map((res) => {
          this.setSession(res.accessToken, '', mapSchool(res.school));
          return mapSchool(res.school);
        }),
      );
  }

  resendSchoolFirstLoginOtp(schoolId: number): Observable<OtpChallenge> {
    return this.api.post<OtpChallenge>('/auth/school/first-login/resend-otp', { schoolId });
  }

  /** Step 1 of school self-signup — see SchoolRegisterPage. Own endpoint
   * from requestSchoolOtp: this proves email/phone ownership before any
   * School row exists to look up by them. */
  requestSchoolRegisterOtp(email: string, phone: string): Observable<OtpChallenge> {
    return this.api.post<OtpChallenge>('/auth/school/register/otp', { email, phone });
  }

  /** Step 2: creates the school and signs it in immediately — unlike an
   * admin-created school, there's no forced first-login here since the
   * coordinator just chose their own real password. */
  registerSchool(payload: {
    name: string;
    city?: string;
    contact?: string;
    contactSecondary?: string;
    schoolEmail?: string;
    coordinator: string;
    email: string;
    phone: string;
    password: string;
    otp: string;
  }): Observable<AuthUser> {
    return this.api
      .post<{ accessToken: string; school: SchoolProfile }>('/auth/school/register', payload)
      .pipe(
        map((res) => {
          this.setSession(res.accessToken, '', mapSchool(res.school));
          return mapSchool(res.school);
        }),
      );
  }

  requestSchoolOtp(identifier: { email?: string; phone?: string }): Observable<OtpChallenge> {
    return this.api.post<OtpChallenge>('/auth/school/request-otp', identifier);
  }

  verifySchoolOtp(identifier: { email?: string; phone?: string }, code: string): Observable<AuthUser> {
    return this.api
      .post<{ accessToken: string; school: SchoolProfile }>('/auth/school/verify-otp', { ...identifier, code })
      .pipe(
        map((res) => {
          this.setSession(res.accessToken, '', mapSchool(res.school));
          return mapSchool(res.school);
        }),
      );
  }

  me(): Observable<AuthUser> {
    return this.api
      .get<{
        admin?: Parameters<typeof mapAdmin>[0];
        student?: { id: number; name: string; email?: string };
        school?: SchoolProfile;
      }>('/auth/me')
      .pipe(
        map((res) => {
          if (res.admin) {
            const user = mapAdmin(res.admin);
            this.setSession(this.accessToken ?? '', this.readRefresh() ?? '', user);
            return user;
          }
          if (res.school) {
            const user = mapSchool(res.school);
            this.setSession(this.accessToken ?? '', '', user);
            return user;
          }
          if (res.student) {
            const user = mapStudent(res.student);
            this.setSession(this.accessToken ?? '', '', user);
            return user;
          }
          throw new Error('Unexpected /auth/me payload');
        }),
      );
  }

  refresh(): Observable<AuthUser> {
    const refreshToken = this.readRefresh();
    return this.api
      .post<{ accessToken: string; refreshToken: string; admin: Parameters<typeof mapAdmin>[0] }>(
        '/auth/refresh',
        { refreshToken },
      )
      .pipe(
        map((res) => {
          this.setSession(res.accessToken, res.refreshToken, mapAdmin(res.admin));
          return mapAdmin(res.admin);
        }),
      );
  }

  logout(): void {
    const refreshToken = this.readRefresh();
    if (refreshToken) {
      this.api.post<{ ok: boolean }>('/auth/logout', { refreshToken }).subscribe({ error: () => undefined });
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
  }

  setSession(token: string, refreshToken: string, user: AuthUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
  }

  hasModule(code: string): boolean {
    const u = this.user();
    if (!u) return false;
    if (u.role === 'SUPER_ADMIN') return true;
    return !!u.modules?.includes(code);
  }

  private readRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  private readUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
