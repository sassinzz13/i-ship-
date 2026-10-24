import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Params } from '@angular/router';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';

import { PageMeta } from '../../../shared/models/api.model';
import { apiError } from '../../../shared/utilities/http';
import { Customer, CustomerType } from '../models/customer.model';
import { CustomerService } from '../services/customer.service';

export interface CustomerListQuery {
  search: string;
  customerType: CustomerType | '';
  active: '' | 'true' | 'false';
  sort: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_CUSTOMER_QUERY: CustomerListQuery = { search: '', customerType: '', active: '', sort: '-createdAt', page: 1, pageSize: 20 };

export function customerQueryFromParams(p: Params): CustomerListQuery {
  const s = (k: string) => (typeof p[k] === 'string' ? (p[k] as string).trim() : '');
  const n = (k: string, d: number) => (Number.isInteger(Number(p[k])) && Number(p[k]) > 0 ? Number(p[k]) : d);
  const active = s('active');
  return {
    search: s('search'),
    customerType: (['INDIVIDUAL', 'BUSINESS'].includes(s('customerType')) ? s('customerType') : '') as CustomerType | '',
    active: active === 'true' || active === 'false' ? active : '',
    sort: s('sort') || DEFAULT_CUSTOMER_QUERY.sort,
    page: n('page', 1),
    pageSize: Math.min(n('pageSize', 20), 100),
  };
}

export function customerQueryToParams(q: CustomerListQuery): Params {
  const out: Params = {};
  if (q.search) out['search'] = q.search;
  if (q.customerType) out['customerType'] = q.customerType;
  if (q.active) out['active'] = q.active;
  if (q.sort !== DEFAULT_CUSTOMER_QUERY.sort) out['sort'] = q.sort;
  if (q.page > 1) out['page'] = q.page;
  if (q.pageSize !== DEFAULT_CUSTOMER_QUERY.pageSize) out['pageSize'] = q.pageSize;
  return out;
}

@Injectable()
export class CustomerListStore {
  private readonly api = inject(CustomerService);
  private readonly requests = new Subject<CustomerListQuery>();
  readonly query = signal(DEFAULT_CUSTOMER_QUERY);
  readonly items = signal<Customer[]>([]);
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
          this.api.list({ ...customerQueryToParams(q), sort: q.sort, page: q.page, pageSize: q.pageSize }).pipe(
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

  load(q: CustomerListQuery): void {
    this.query.set(q);
    this.requests.next(q);
  }

  reload(): void {
    this.requests.next(this.query());
  }
}
