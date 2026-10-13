import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

export function roleGuard(role: 'admin' | 'student' | 'school' | 'panel'): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated) {
      const login = role === 'admin' ? '/admin/login' : role === 'school' ? '/schools/login' : role === 'panel' ? '/panel/login' : '/login';
      return router.createUrlTree([login], { queryParams: { next: router.url } });
    }
    if (role === 'admin' && auth.isAdmin) return true;
    if (role === 'student' && auth.isStudent) return true;
    if (role === 'school' && auth.isSchool) return true;
    if (role === 'panel' && auth.isPanel) return true;
    return router.createUrlTree(['/']);
  };
}
