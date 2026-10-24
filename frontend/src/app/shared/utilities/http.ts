import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiErrorBody, ApiSuccess, ListParams, Page } from '../models/api.model';

/** Unwraps the `{ success, data }` envelope. */
export function unwrap<T>() {
  return (source: Observable<ApiSuccess<T>>) => source.pipe(map((r) => r.data));
}

/** Unwraps a paginated envelope into `{ items, meta }`. */
export function unwrapPage<T>() {
  return (source: Observable<ApiSuccess<T[]>>) =>
    source.pipe(
      map(
        (r): Page<T> => ({
          items: r.data,
          meta: r.meta ?? { page: 1, pageSize: r.data.length, total: r.data.length, totalPages: 1 },
        }),
      ),
    );
}

/** Builds HttpParams, dropping empty values. */
export function toParams(params: ListParams = {}): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  }
  return p;
}

/** Extracts the API error body from an HTTP error, if present. */
export function apiError(err: unknown): ApiErrorBody {
  if (err instanceof HttpErrorResponse) {
    const body = err.error?.error as ApiErrorBody | undefined;
    if (body?.message) return body;
    if (err.status === 0) return { code: 'NETWORK', message: 'Cannot reach the server. Check your connection.' };
    return { code: 'HTTP_' + err.status, message: err.statusText || 'Request failed' };
  }
  return { code: 'UNKNOWN', message: 'Something went wrong' };
}
