import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Params } from '@angular/router';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';

import { PageMeta } from '../../../shared/models/api.model';
import { apiError } from '../../../shared/utilities/http';
import { PAYMENT_METHODS, PAYMENT_RECORD_STATUSES, Payment, PaymentMethod, PaymentRecordStatus } from '../models/payment.model';
import { PaymentService } from '../services/payment.service';

export interface PaymentListQuery {
  search: string;
  status: PaymentRecordStatus | '';
  method: PaymentMethod | '';
  dateFrom: string;
  dateTo: string;
  sort: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAYMENT_QUERY: PaymentListQuery = {
  search: '', status: '', method: '', dateFrom: '', dateTo: '', sort: '-createdAt', page: 1, pageSize: 20,
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function paymentQueryFromParams(p: Params): PaymentListQuery {
  const s = (k: string) => (typeof p[k] === 'string' ? (p[k] as string).trim() : '');
  const n = (k: string, d: number) => (Number.isInteger(Number(p[k])) && Number(p[k]) > 0 ? Number(p[k]) : d);
  return {
    search: s('search'),
    status: (PAYMENT_RECORD_STATUSES as string[]).includes(s('status')) ? (s('status') as PaymentRecordStatus) : '',
    method: (PAYMENT_METHODS as string[]).includes(s('method')) ? (s('method') as PaymentMethod) : '',
    dateFrom: DATE.test(s('dateFrom')) ? s('dateFrom') : '',
    dateTo: DATE.test(s('dateTo')) ? s('dateTo') : '',
    sort: s('sort') || DEFAULT_PAYMENT_QUERY.sort,
    page: n('page', 1),
    pageSize: Math.min(n('pageSize', 20), 100),
  };
}

export function paymentQueryToParams(q: PaymentListQuery): Params {
  const out: Params = {};
  for (const k of ['search', 'status', 'method', 'dateFrom', 'dateTo'] as const) if (q[k]) out[k] = q[k];
  if (q.sort !== DEFAULT_PAYMENT_QUERY.sort) out['sort'] = q.sort;
  if (q.page > 1) out['page'] = q.page;
  if (q.pageSize !== DEFAULT_PAYMENT_QUERY.pageSize) out['pageSize'] = q.pageSize;
  return out;
}

@Injectable()
export class PaymentListStore {
  private readonly api = inject(PaymentService);
  private readonly requests = new Subject<PaymentListQuery>();
  readonly query = signal(DEFAULT_PAYMENT_QUERY);
  readonly items = signal<Payment[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.requests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((q) =>
          this.api.list({ ...paymentQueryToParams(q), sort: q.sort, page: q.page, pageSize: q.pageSize }).pipe(
            catchError((err) => {
              this.error.set(apiError(err).message);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((p) => {
        this.loading.set(false);
        if (p) {
          this.items.set(p.items);
          this.meta.set(p.meta);
        }
      });
  }

  load(q: PaymentListQuery): void {
    this.query.set(q);
    this.requests.next(q);
  }

  reload(): void {
    this.requests.next(this.query());
  }

  /** Replaces one row after an update without refetching. */
  replace(p: Payment): void {
    this.items.update((list) => list.map((x) => (x.id === p.id ? p : x)));
  }
}
