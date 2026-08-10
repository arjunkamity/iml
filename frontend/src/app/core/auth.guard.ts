import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { RoleCode } from './models';

export function roleGuard(...roles: RoleCode[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) return router.parseUrl('/login');
    if (roles.length && !roles.includes(auth.role()!)) {
      return router.parseUrl(auth.homeForRole(auth.role()));
    }
    return true;
  };
}
