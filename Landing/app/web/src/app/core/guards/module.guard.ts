import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

/**
 * Enforces each admin route's own `data.mod` (already set on every child
 * route in admin.routes.ts, via the `mod()` helper — previously only used
 * to build the page title and the sidebar's own visibility filter). Without
 * this, an admin without a module checked on their account could still
 * open any /admin/* URL directly by typing it in, completely bypassing
 * the sidebar hiding that link — the sidebar was ever only cosmetic.
 *
 * Registered as canActivateChild on the admin shell route, so it runs
 * once per child navigation rather than being repeated on all 24 routes.
 */
export const moduleGuard: CanActivateChildFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const mod = route.data['mod'] as string | undefined;
  // a route may name several codes ("sc,rl"): holding any one of them is enough
  if (!mod || mod.split(',').some((m) => auth.hasModule(m.trim()))) return true;
  return router.createUrlTree(['/admin/forbidden']);
};
