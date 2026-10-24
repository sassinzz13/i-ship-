import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Role } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';

/** Requires a signed-in user. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Requires one of the roles listed in route `data.roles`. The backend
 *  enforces the same rules; this only keeps users out of screens they
 *  cannot use. */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const roles = (route.data['roles'] as Role[] | undefined) ?? [];
  if (roles.length === 0 || auth.hasRole(...roles)) return true;
  return inject(Router).createUrlTree([auth.homeUrl()]);
};

/** Keeps signed-in users away from the login page. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree([auth.homeUrl()]) : true;
};
