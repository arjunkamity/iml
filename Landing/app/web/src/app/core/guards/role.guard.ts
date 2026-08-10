import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

export function roleGuard(role: 'admin' | 'student'): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated) {
      const login = role === 'admin' ? '/admin/login' : '/login';
      return router.createUrlTree([login], { queryParams: { next: router.url } });
    }
    if (role === 'admin' && auth.isAdmin) return true;
    if (role === 'student' && auth.isStudent) return true;
    return router.createUrlTree(['/']);
  };
}
