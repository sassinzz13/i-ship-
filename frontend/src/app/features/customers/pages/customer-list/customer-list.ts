import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, signal } from '@angular/core';
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
import { CustomerFormDialog } from '../../components/customer-form-dialog/customer-form-dialog';
import { Customer } from '../../models/customer.model';
import { CustomerListQuery, CustomerListStore, customerQueryFromParams, customerQueryToParams } from '../../state/customer-list.store';

@Component({
  selector: 'app-customer-list',
  imports: [RouterLink, DatePipe, PageHeader, Pagination, SortHeader, Spinner, EmptyState, Icon, StatusBadge, LabelizePipe, CustomerFormDialog],
  providers: [CustomerListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Customers" subtitle="Senders, their address books and portal access">
      <button type="button" class="btn-primary" (click)="formOpen.set(true)"><app-icon name="plus" size="sm" /> New customer</button>
    </app-page-header>

    <div class="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <app-icon name="search" size="sm" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input type="search" class="form-input pl-9" placeholder="Search name, code, email, phone or company…" [value]="search()"
          (input)="onSearch($any($event.target).value)" aria-label="Search customers" />
      </div>
      <select class="form-input sm:!w-44" [value]="store.query().customerType" (change)="update({ customerType: $any($event.target).value })" aria-label="Type">
        <option value="">All types</option><option value="INDIVIDUAL">Individual</option><option value="BUSINESS">Business</option>
      </select>
      <select class="form-input sm:!w-36" [value]="store.query().active" (change)="update({ active: $any($event.target).value })" aria-label="Status">
        <option value="">Any status</option><option value="true">Active</option><option value="false">Inactive</option>
      </select>
    </div>

    <div class="card mt-4 overflow-hidden">
      @if (store.error(); as err) {
        <app-empty-state icon="warning" title="Could not load customers" [message]="err">
          <button type="button" class="btn-secondary" (click)="store.reload()">Retry</button>
        </app-empty-state>
      } @else if (store.loading() && store.items().length === 0) {
        <app-spinner label="Loading customers…" />
      } @else if (store.items().length === 0) {
        <app-empty-state icon="users" title="No customers found" message="Add a customer to start booking shipments.">
          <button type="button" class="btn-primary" (click)="formOpen.set(true)"><app-icon name="plus" size="sm" /> New customer</button>
        </app-empty-state>
      } @else {
        <div class="hidden overflow-x-auto md:block" [class.opacity-60]="store.loading()">
          <table class="table-base">
            <thead><tr>
              <th><app-sort-header field="fullName" [sort]="store.query().sort" (sortChange)="update({ sort: $event })">Customer</app-sort-header></th>
              <th><app-sort-header field="customerCode" [sort]="store.query().sort" (sortChange)="update({ sort: $event })">Code</app-sort-header></th>
              <th>Contact</th><th>Type</th><th>Portal</th><th>Status</th>
              <th><app-sort-header field="createdAt" [sort]="store.query().sort" (sortChange)="update({ sort: $event })">Since</app-sort-header></th>
            </tr></thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              @for (c of store.items(); track c.id) {
                <tr class="cursor-pointer" [routerLink]="['/customers', c.id]">
                  <td>
                    <div class="flex items-center gap-3">
                      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{{ initials(c) }}</span>
                      <div><p class="font-medium text-slate-900">{{ c.fullName }}</p>@if (c.companyName) { <p class="text-xs text-slate-500">{{ c.companyName }}</p> }</div>
                    </div>
                  </td>
                  <td class="font-mono text-xs">{{ c.customerCode }}</td>
                  <td><p>{{ c.phone }}</p><p class="text-xs text-slate-500">{{ c.email ?? '—' }}</p></td>
                  <td>{{ c.customerType | labelize }}</td>
                  <td>@if (c.hasPortalAccount) { <span class="inline-flex items-center gap-1 text-xs text-emerald-700"><app-icon name="check-circle" size="sm" /> Enabled</span> } @else { <span class="text-xs text-slate-400">—</span> }</td>
                  <td><app-status-badge [status]="c.isActive ? 'ACTIVE' : 'INACTIVE'" /></td>
                  <td class="text-slate-500">{{ c.createdAt | date: 'MMM d, y' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <ul class="divide-y divide-slate-100 md:hidden">
          @for (c of store.items(); track c.id) {
            <li><a [routerLink]="['/customers', c.id]" class="flex items-center gap-3 px-4 py-3">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{{ initials(c) }}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium text-slate-900">{{ c.fullName }}</p>
                <p class="truncate text-xs text-slate-500">{{ c.customerCode }} · {{ c.phone }}</p>
              </div>
              <app-status-badge [status]="c.isActive ? 'ACTIVE' : 'INACTIVE'" />
            </a></li>
          }
        </ul>
        <app-pagination [meta]="store.meta()" (pageChange)="go({ page: $event })" (pageSizeChange)="update({ pageSize: $event })" />
      }
    </div>

    <app-customer-form-dialog [open]="formOpen()" (closed)="formOpen.set(false)" (saved)="created($event)" />
  `,
})
export class CustomerList implements OnDestroy {
  protected readonly store = inject(CustomerListStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly formOpen = signal(false);
  protected readonly search = signal('');
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((p) => this.store.load(customerQueryFromParams(p)));
    effect(() => this.search.set(this.store.query().search));
  }

  protected onSearch(v: string): void {
    this.search.set(v);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update({ search: v.trim() }), 350);
  }

  protected update(patch: Partial<CustomerListQuery>): void {
    this.go({ ...patch, page: 1 });
  }

  protected go(patch: Partial<CustomerListQuery>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: customerQueryToParams({ ...this.store.query(), ...patch }) });
  }

  protected created(c: Customer): void {
    this.formOpen.set(false);
    void this.router.navigate(['/customers', c.id]);
  }

  protected initials(c: Customer): string {
    return c.fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
