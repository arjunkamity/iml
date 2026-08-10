import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated) return true;
  const login = router.url.startsWith('/admin') ? '/admin/login' : '/login';
  return router.createUrlTree([login], {
    queryParams: { next: router.url },
  });
};
