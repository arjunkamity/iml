import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

/** Lets `https://indiamindleague.com/?sid=<code>&token=<token>` (an
 * admin-generated direct-login link — see Admin > Registrations >
 * "Generate Login Link") sign a student straight in before the homepage
 * renders. A visit with no sid/token (i.e. every normal visitor) is a
 * no-op — resolves true immediately, no extra request. On a bad/expired
 * token, falls through to the ordinary homepage rather than erroring, since
 * this is a convenience path, not the primary login flow. */
export const tokenLoginGuard: CanActivateFn = (route) => {
  const sid = route.queryParamMap.get('sid');
  const token = route.queryParamMap.get('token');
  if (!sid || !token) return true;

  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.consumeAccessToken(sid, token).pipe(
    map((res) => {
      auth.applySession(res.accessToken, res.student);
      return router.createUrlTree(['/account']);
    }),
    catchError(() => of(true)),
  );
};
