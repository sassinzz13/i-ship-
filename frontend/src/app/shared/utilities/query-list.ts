import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Observable, Subject, catchError, map, merge, of, switchMap, tap } from 'rxjs';

import { ListParams, Page, PageMeta } from '../models/api.model';
import { apiError } from './http';

/**
 * Paginated list state synced to the URL query string, so filters, sorting
 * and the page survive reloads and are shareable. Must be created in an
 * injection context (e.g. a component field initializer).
 */
export function createQueryList<T>(fetch: (params: ListParams) => Observable<Page<T>>, defaults: ListParams = {}) {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);

  const items = signal<T[]>([]);
  const meta = signal<PageMeta | null>(null);
  const loading = signal(true);
  const error = signal<string | null>(null);
  const params = signal<ListParams>({ ...defaults });
  const reload$ = new Subject<void>();

  const fromQuery = (qp: ParamMap): ListParams => {
    const p: ListParams = { ...defaults };
    for (const k of qp.keys) p[k] = qp.get(k);
    return p;
  };

  merge(route.queryParamMap.pipe(map(fromQuery)), reload$.pipe(map(() => params())))
    .pipe(
      tap((p) => {
        params.set(p);
        loading.set(true);
        error.set(null);
      }),
      switchMap((p) =>
        fetch(p).pipe(
          catchError((err) => {
            error.set(apiError(err).message);
            return of(null);
          }),
        ),
      ),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe((page) => {
      loading.set(false);
      if (page) {
        items.set(page.items);
        meta.set(page.meta);
      }
    });

  /** Merges changes into the query string. Filter changes reset to page 1. */
  const patch = (changes: ListParams, resetPage = true) => {
    const queryParams: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(changes)) queryParams[k] = v === '' || v === undefined ? null : v;
    if (resetPage && !('page' in changes)) queryParams['page'] = null;
    void router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  };

  return {
    items,
    meta,
    loading,
    error,
    params,
    patch,
    reload: () => reload$.next(),
    setPage: (page: number) => patch({ page }, false),
    setPageSize: (pageSize: number) => patch({ pageSize }),
    setSort: (sort: string) => patch({ sort }, false),
    /** String value of a param, '' when unset. */
    value: (key: string) => {
      const v = params()[key];
      return v === null || v === undefined ? '' : String(v);
    },
  };
}

export type QueryList<T> = ReturnType<typeof createQueryList<T>>;
