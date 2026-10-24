import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { API_BASE } from '../config/api.config';

const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];

function withToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * Attaches the access token to API calls. On a 401 it refreshes once (shared
 * across concurrent requests) and retries; if refreshing fails the session
 * is expired and the user is sent to the login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE)) return next(req);
  const auth = inject(AuthService);
  if (AUTH_ENDPOINTS.some((p) => req.url.startsWith(API_BASE + p))) return next(req);

  return next(withToken(req, auth.accessToken())).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !auth.isAuthenticated()) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        catchError((refreshErr) => {
          auth.expire();
          return throwError(() => refreshErr);
        }),
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};
