import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { API_URL } from './config';
import {
  AuthUser,
  LoginResponse,
  OtpVerifyResponse,
  RoleCode,
} from './models';

const TOKEN_KEY = 'iml_token';
const USER_KEY = 'iml_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  user = signal<AuthUser | null>(this.readUser());
  isLoggedIn = computed(() => !!this.token());
  role = computed<RoleCode | null>(() => this.user()?.role ?? null);

  private readUser(): AuthUser | null {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
    } catch {
      return null;
    }
  }

  private persist(token: string, user: AuthUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.token.set(token);
    this.user.set(user);
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${API_URL}/auth/login`, { email, password })
      .pipe(tap((r) => this.persist(r.accessToken, r.user)));
  }

  requestOtp(target: string, channel: 'SMS' | 'Email', purpose: 'Login' | 'Registration') {
    return this.http.post<{ sent: boolean; devCode?: string }>(
      `${API_URL}/auth/otp/request`,
      { target, channel, purpose },
    );
  }

  verifyOtp(target: string, code: string) {
    return this.http
      .post<OtpVerifyResponse>(`${API_URL}/auth/otp/verify`, { target, code })
      .pipe(
        tap((r) => {
          if (r.accessToken && r.user) this.persist(r.accessToken, r.user);
        }),
      );
  }

  registerStudent(dto: Record<string, unknown>) {
    return this.http
      .post<LoginResponse>(`${API_URL}/students/register`, dto)
      .pipe(tap((r) => this.persist(r.accessToken, r.user)));
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
    void this.router.navigate(['/login']);
  }

  homeForRole(role: RoleCode | null): string {
    switch (role) {
      case 'ADMIN':
        return '/admin';
      case 'COORDINATOR':
        return '/coordinator';
      case 'STUDENT':
        return '/student';
      default:
        return '/';
    }
  }

  goHome() {
    void this.router.navigateByUrl(this.homeForRole(this.role()));
  }
}
