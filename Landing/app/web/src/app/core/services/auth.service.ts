import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type Role = 'STUDENT' | 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER';

export interface AuthUser {
  id: number;
  name: string;
  email?: string;
  role: Role;
  modules?: string[];
}

export interface OtpChallenge {
  devCode: string;
  expiresIn: number;
  hint?: string;
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

  requestStudentOtp(email: string): Observable<OtpChallenge> {
    return this.api.post<OtpChallenge>('/auth/student/request-otp', { email });
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

  verifyStudentOtp(email: string, code: string): Observable<AuthUser> {
    return this.api
      .post<{
        accessToken: string;
        student: { id: number; name: string; email?: string };
      }>('/auth/student/verify-otp', { email, code })
      .pipe(
        map((res) => {
          this.setSession(res.accessToken, '', mapStudent(res.student));
          return mapStudent(res.student);
        }),
      );
  }

  me(): Observable<AuthUser> {
    return this.api
      .get<{ admin?: Parameters<typeof mapAdmin>[0]; student?: { id: number; name: string; email?: string } }>('/auth/me')
      .pipe(
        map((res) => {
          if (res.admin) {
            const user = mapAdmin(res.admin);
            this.setSession(this.accessToken ?? '', this.readRefresh() ?? '', user);
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
