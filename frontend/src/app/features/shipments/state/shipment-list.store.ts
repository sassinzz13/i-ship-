import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Params } from '@angular/router';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';

import { PageMeta } from '../../../shared/models/api.model';
import { apiError } from '../../../shared/utilities/http';
import { PaymentStatus, ServiceType, ShipmentStatus, ShipmentSummary } from '../models/shipment.model';
import { ShipmentService } from '../services/shipment.service';

export interface ShipmentListQuery {
  search: string;
  status: ShipmentStatus | '';
  serviceType: ServiceType | '';
  paymentStatus: PaymentStatus | '';
  customerId: number | null;
  dateFrom: string;
  dateTo: string;
  sort: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_SHIPMENT_QUERY: ShipmentListQuery = {
  search: '',
  status: '',
  serviceType: '',
  paymentStatus: '',
  customerId: null,
  dateFrom: '',
  dateTo: '',
  sort: '-createdAt',
  page: 1,
  pageSize: 20,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function positiveInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Reads the list query from URL query params, ignoring junk values. */
export function queryFromParams(p: Params): ShipmentListQuery {
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string).trim() : '');
  const customerId = positiveInt(p['customerId'], 0);
  return {
    search: str('search'),
    status: str('status') as ShipmentStatus | '',
    serviceType: str('serviceType') as ServiceType | '',
    paymentStatus: str('paymentStatus') as PaymentStatus | '',
    customerId: customerId || null,
    dateFrom: DATE_RE.test(str('dateFrom')) ? str('dateFrom') : '',
    dateTo: DATE_RE.test(str('dateTo')) ? str('dateTo') : '',
    sort: str('sort') || DEFAULT_SHIPMENT_QUERY.sort,
    page: positiveInt(p['page'], 1),
    pageSize: Math.min(positiveInt(p['pageSize'], DEFAULT_SHIPMENT_QUERY.pageSize), 100),
  };
}

/** Serializes a query to URL params, dropping defaults so URLs stay short. */
export function queryToParams(q: ShipmentListQuery): Params {
  const out: Params = {};
  const d = DEFAULT_SHIPMENT_QUERY;
  if (q.search) out['search'] = q.search;
  if (q.status) out['status'] = q.status;
  if (q.serviceType) out['serviceType'] = q.serviceType;
  if (q.paymentStatus) out['paymentStatus'] = q.paymentStatus;
  if (q.customerId) out['customerId'] = q.customerId;
  if (q.dateFrom) out['dateFrom'] = q.dateFrom;
  if (q.dateTo) out['dateTo'] = q.dateTo;
  if (q.sort && q.sort !== d.sort) out['sort'] = q.sort;
  if (q.page > 1) out['page'] = q.page;
  if (q.pageSize !== d.pageSize) out['pageSize'] = q.pageSize;
  return out;
}

/** True when any filter (not paging/sorting) is applied. */
export function hasFilters(q: ShipmentListQuery): boolean {
  return !!(q.search || q.status || q.serviceType || q.paymentStatus || q.customerId || q.dateFrom || q.dateTo);
}

/** List state for the shipments page. Provided per page component. */
@Injectable()
export class ShipmentListStore {
  private readonly api = inject(ShipmentService);
  private readonly requests = new Subject<ShipmentListQuery>();

  readonly query = signal<ShipmentListQuery>(DEFAULT_SHIPMENT_QUERY);
  readonly items = signal<ShipmentSummary[]>([]);
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
        // switchMap drops responses for superseded queries.
        switchMap((q) =>
          this.api.list({ ...queryToParams(q), page: q.page, pageSize: q.pageSize, sort: q.sort }).pipe(
            catchError((err) => {
              this.error.set(apiError(err).message);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((page) => {
        this.loading.set(false);
        if (page) {
          this.items.set(page.items);
          this.meta.set(page.meta);
        }
      });
  }

  load(q: ShipmentListQuery): void {
    this.query.set(q);
    this.requests.next(q);
  }

  reload(): void {
    this.requests.next(this.query());
  }
}
