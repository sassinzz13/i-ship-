import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { SortHeader } from '../../../../shared/components/sort-header/sort-header';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { PesoPipe } from '../../../../shared/pipes/peso.pipe';
import { PaymentAction, PaymentStatusDialog } from '../../components/payment-status-dialog/payment-status-dialog';
import { RecordPaymentDialog } from '../../components/record-payment-dialog/record-payment-dialog';
import { PAYMENT_METHODS, PAYMENT_RECORD_STATUSES, Payment } from '../../models/payment.model';
import { PaymentListQuery, PaymentListStore, paymentQueryFromParams, paymentQueryToParams } from '../../state/payment-list.store';

@Component({
  selector: 'app-payment-list',
  imports: [
    RouterLink, DatePipe, PageHeader, Pagination, SortHeader, Spinner, EmptyState, Icon, StatusBadge, LabelizePipe, PesoPipe,
    RecordPaymentDialog, PaymentStatusDialog,
  ],
  providers: [PaymentListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Payments" subtitle="Shipping fee collections and refunds">
      <button type="button" class="btn-primary" (click)="recordOpen.set(true)"><app-icon name="plus" size="sm" /> Record payment</button>
    </app-page-header>

    <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="card p-4"><p class="text-xs text-slate-500">Matching</p><p class="mt-1 text-xl font-semibold">{{ store.meta()?.total ?? 0 }} <span class="text-sm font-normal text-slate-500">payments</span></p></div>
      <div class="card p-4"><p class="text-xs text-slate-500">Collected (page)</p><p class="mt-1 text-xl font-semibold text-emerald-700">{{ collected() | peso }}</p></div>
      <div class="card p-4"><p class="text-xs text-slate-500">Pending (page)</p><p class="mt-1 text-xl font-semibold text-amber-700">{{ pending() | peso }}</p></div>
      <div class="card p-4"><p class="text-xs text-slate-500">Refunded (page)</p><p class="mt-1 text-xl font-semibold text-slate-700">{{ refunded() | peso }}</p></div>
    </div>

    <div class="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
      <div class="relative sm:col-span-2 lg:col-span-1">
        <app-icon name="search" size="sm" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input type="search" class="form-input pl-9" placeholder="Tracking #, customer, reference…" [value]="search()"
          (input)="onSearch($any($event.target).value)" aria-label="Search payments" />
      </div>
      <select class="form-input" [value]="store.query().status" (change)="update({ status: $any($event.target).value })" aria-label="Status">
        <option value="">All statuses</option>
        @for (s of statuses; track s) { <option [value]="s">{{ s | labelize }}</option> }
      </select>
      <select class="form-input" [value]="store.query().method" (change)="update({ method: $any($event.target).value })" aria-label="Method">
        <option value="">All methods</option>
        @for (m of methods; track m) { <option [value]="m">{{ m | labelize }}</option> }
      </select>
      <input type="date" class="form-input" [value]="store.query().dateFrom" (change)="update({ dateFrom: $any($event.target).value })" aria-label="From date" />
      <input type="date" class="form-input" [value]="store.query().dateTo" (change)="update({ dateTo: $any($event.target).value })" aria-label="To date" />
    </div>

    <div class="card mt-4 overflow-hidden">
      @if (store.error(); as err) {
        <app-empty-state icon="warning" title="Could not load payments" [message]="err">
          <button type="button" class="btn-secondary" (click)="store.reload()">Retry</button>
        </app-empty-state>
      } @else if (store.loading() && store.items().length === 0) {
        <app-spinner label="Loading payments…" />
      } @else if (store.items().length === 0) {
        <app-empty-state icon="banknotes" title="No payments found" message="Recorded payments will appear here." />
      } @else {
        <div class="hidden overflow-x-auto md:block" [class.opacity-60]="store.loading()">
          <table class="table-base">
            <thead><tr>
              <th>Shipment</th><th>Customer</th>
              <th class="text-right"><app-sort-header field="amount" [sort]="store.query().sort" (sortChange)="update({ sort: $event })">Amount</app-sort-header></th>
              <th>Method</th><th>Reference</th><th>Status</th>
              <th><app-sort-header field="paidAt" [sort]="store.query().sort" (sortChange)="update({ sort: $event })">Paid</app-sort-header></th>
              <th><app-sort-header field="createdAt" [sort]="store.query().sort" (sortChange)="update({ sort: $event })">Recorded</app-sort-header></th>
              <th></th>
            </tr></thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              @for (p of store.items(); track p.id) {
                <tr>
                  <td><a [routerLink]="['/shipments', p.shipmentId]" class="font-mono text-[13px] font-medium text-brand-700 hover:underline">{{ p.trackingNumber }}</a></td>
                  <td class="max-w-[12rem] truncate">{{ p.customerName }}</td>
                  <td class="text-right font-medium tabular-nums">{{ p.amount | peso }}</td>
                  <td>{{ p.method | labelize }}</td>
                  <td class="font-mono text-xs text-slate-500">{{ p.reference ?? '—' }}</td>
                  <td><app-status-badge [status]="p.status" /></td>
                  <td class="text-slate-500">{{ p.paidAt ? (p.paidAt | date: 'MMM d, y') : '—' }}</td>
                  <td class="text-slate-500"><p>{{ p.createdAt | date: 'MMM d, y' }}</p>@if (p.recordedBy) { <p class="text-xs">{{ p.recordedBy.fullName }}</p> }</td>
                  <td class="text-right">
                    @if (p.status === 'PENDING') {
                      <button type="button" class="btn-ghost !px-2 !py-1 text-xs text-emerald-700" (click)="act(p, 'PAID')">Mark paid</button>
                      <button type="button" class="btn-ghost !px-2 !py-1 text-xs text-rose-600" (click)="act(p, 'FAILED')">Failed</button>
                    } @else if (p.status === 'PAID') {
                      <button type="button" class="btn-ghost !px-2 !py-1 text-xs" (click)="act(p, 'REFUNDED')">Refund</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <ul class="divide-y divide-slate-100 md:hidden">
          @for (p of store.items(); track p.id) {
            <li class="px-4 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <a [routerLink]="['/shipments', p.shipmentId]" class="font-mono text-[13px] font-semibold text-brand-700">{{ p.trackingNumber }}</a>
                  <p class="truncate text-xs text-slate-500">{{ p.customerName }} · {{ p.method | labelize }}</p>
                </div>
                <div class="text-right"><p class="font-semibold">{{ p.amount | peso }}</p><app-status-badge [status]="p.status" /></div>
              </div>
              @if (p.status === 'PENDING' || p.status === 'PAID') {
                <div class="mt-2 flex justify-end gap-1">
                  @if (p.status === 'PENDING') {
                    <button type="button" class="btn-secondary !px-3 !py-1 text-xs" (click)="act(p, 'PAID')">Mark paid</button>
                  } @else {
                    <button type="button" class="btn-ghost !px-3 !py-1 text-xs" (click)="act(p, 'REFUNDED')">Refund</button>
                  }
                </div>
              }
            </li>
          }
        </ul>
        <app-pagination [meta]="store.meta()" (pageChange)="go({ page: $event })" (pageSizeChange)="update({ pageSize: $event })" />
      }
    </div>

    <app-record-payment-dialog [open]="recordOpen()" (closed)="recordOpen.set(false)" (saved)="recorded()" />
    <app-payment-status-dialog [open]="actionTarget() !== null" [payment]="actionTarget()" [action]="action()"
      (closed)="actionTarget.set(null)" (saved)="updated($event)" />
  `,
})
export class PaymentList implements OnDestroy {
  protected readonly store = inject(PaymentListStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly statuses = PAYMENT_RECORD_STATUSES;
  protected readonly methods = PAYMENT_METHODS;
  protected readonly recordOpen = signal(false);
  protected readonly actionTarget = signal<Payment | null>(null);
  protected readonly action = signal<PaymentAction>('PAID');
  protected readonly search = signal('');
  private timer: ReturnType<typeof setTimeout> | null = null;

  private sum(status: Payment['status']) {
    return computed(() => this.store.items().filter((p) => p.status === status).reduce((t, p) => t + p.amount, 0));
  }
  protected readonly collected = this.sum('PAID');
  protected readonly pending = this.sum('PENDING');
  protected readonly refunded = this.sum('REFUNDED');

  constructor() {
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((p) => this.store.load(paymentQueryFromParams(p)));
    effect(() => this.search.set(this.store.query().search));
  }

  protected onSearch(v: string): void {
    this.search.set(v);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update({ search: v.trim() }), 350);
  }

  protected update(patch: Partial<PaymentListQuery>): void {
    this.go({ ...patch, page: 1 });
  }

  protected go(patch: Partial<PaymentListQuery>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: paymentQueryToParams({ ...this.store.query(), ...patch }) });
  }

  protected act(p: Payment, a: PaymentAction): void {
    this.action.set(a);
    this.actionTarget.set(p);
  }

  protected recorded(): void {
    this.recordOpen.set(false);
    this.store.reload();
  }

  protected updated(p: Payment): void {
    this.actionTarget.set(null);
    this.store.replace(p);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
