import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { apiError } from '../../shared/utilities/http';
import { ToastService } from '../services/toast.service';

/** Surfaces network failures and server errors as toasts. Validation and
 *  business errors (4xx) are left to the calling component. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500 || err.status === 429)) {
        toast.error(apiError(err).message);
      }
      return throwError(() => err);
    }),
  );
};
