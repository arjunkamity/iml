import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { Router } from '@angular/router';

const RETRY_HEADER = 'X-IML-Retried';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private refreshInFlight: Observable<string | null> | null = null;

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.auth.accessToken;
    let request = req;
    if (token) {
      request = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
    return next.handle(request).pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.includes('/auth/')) {
          if (req.headers.has(RETRY_HEADER) || !this.auth.refreshToken) {
            return this.logoutAndThrow();
          }
          return this.getFreshToken().pipe(
            switchMap((fresh) => {
              if (!fresh) {
                return this.logoutAndThrow();
              }
              const retry = req.clone({
                setHeaders: { Authorization: `Bearer ${fresh}`, [RETRY_HEADER]: 'true' },
              });
              return next.handle(retry);
            }),
          );
        }
        return throwError(() => err);
      }),
    );
  }

  private getFreshToken(): Observable<string | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.auth.refresh().pipe(
        map(() => this.auth.accessToken),
        tap(() => {
          this.refreshInFlight = null;
        }),
        catchError(() => {
          this.refreshInFlight = null;
          return of(null);
        }),
        shareReplay(1),
      );
    }
    return this.refreshInFlight;
  }

  private logoutAndThrow(): Observable<never> {
    const wasAdmin = this.auth.isAdmin;
    const wasPanel = this.auth.isPanel;
    this.auth.logout();
    this.router.navigate([wasAdmin ? '/admin/login' : wasPanel ? '/panel/login' : '/login']);
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));
  }
}
