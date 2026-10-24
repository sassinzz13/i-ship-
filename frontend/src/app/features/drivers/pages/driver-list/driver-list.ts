import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DebouncedSearch } from '../../../../shared/components/debounced-search/debounced-search';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { SortHeader } from '../../../../shared/components/sort-header/sort-header';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { createQueryList } from '../../../../shared/utilities/query-list';
import { DriverCreateDialog } from '../../components/driver-create-dialog/driver-create-dialog';
import { LicenseBadge } from '../../components/license-badge/license-badge';
import { DRIVER_AVAILABILITY, DRIVER_STATUSES, Driver } from '../../models/driver.model';
import { DriverService } from '../../services/driver.service';

@Component({
  selector: 'app-driver-list',
  imports: [RouterLink, PageHeader, Pagination, SortHeader, Spinner, EmptyState, StatusBadge, Icon, LabelizePipe,
    DebouncedSearch, LicenseBadge, DriverCreateDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Drivers" subtitle="Driver roster, licenses and availability">
      <button type="button" class="btn-primary" (click)="createOpen.set(true)"><app-icon name="plus" size="sm" /> New driver</button>
    </app-page-header>

    <div class="card">
      <div class="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[1fr_auto_auto]">
        <app-debounced-search placeholder="Search name, code, license, email…" [value]="list.value('search')" (search)="list.patch({ search: $event })" />
        <select class="form-input sm:w-44" [value]="list.value('status')" (change)="list.patch({ status: $any($event.target).value })" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) { <option [value]="s">{{ s | labelize }}</option> }
        </select>
        <select class="form-input sm:w-44" [value]="list.value('availability')" (change)="list.patch({ availability: $any($event.target).value })" aria-label="Availability">
          <option value="">Any availability</option>
          @for (a of availability; track a) { <option [value]="a">{{ a | labelize }}</option> }
        </select>
      </div>

      @if (list.loading() && list.items().length === 0) {
        <app-spinner />
      } @else if (list.error()) {
        <app-empty-state icon="warning" title="Could not load drivers" [message]="list.error()!">
          <button type="button" class="btn-secondary" (click)="list.reload()">Try again</button>
        </app-empty-state>
      } @else if (list.items().length === 0) {
        <app-empty-state icon="id" title="No drivers found" message="Adjust the filters or onboard a new driver." />
      } @else {
        <!-- Desktop table -->
        <div class="hidden overflow-x-auto md:block" [class.opacity-60]="list.loading()">
          <table class="table-base">
            <thead>
              <tr>
                <th><app-sort-header field="fullName" [sort]="list.value('sort')" (sortChange)="list.setSort($event)">Driver</app-sort-header></th>
                <th><app-sort-header field="employeeCode" [sort]="list.value('sort')" (sortChange)="list.setSort($event)">Code</app-sort-header></th>
                <th>Phone</th>
                <th><app-sort-header field="licenseExpiry" [sort]="list.value('sort')" (sortChange)="list.setSort($event)">License expiry</app-sort-header></th>
                <th>Status</th>
                <th>Availability</th>
                <th class="text-right">Active jobs</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (d of list.items(); track d.id) {
                <tr class="cursor-pointer" (click)="open(d)">
                  <td>
                    <div class="flex items-center gap-3">
                      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{{ initials(d.fullName) }}</span>
                      <div>
                        <a [routerLink]="['/drivers', d.id]" class="font-medium text-slate-900 hover:text-brand-700" (click)="$event.stopPropagation()">{{ d.fullName }}</a>
                        <p class="text-xs text-slate-500">{{ d.email }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="font-mono text-xs">{{ d.employeeCode }}</td>
                  <td>{{ d.phone }}</td>
                  <td><app-license-badge [expiry]="d.licenseExpiry" /></td>
                  <td><app-status-badge [status]="d.status" /></td>
                  <td><app-status-badge [status]="d.availability" /></td>
                  <td class="text-right tabular-nums">{{ d.activeAssignments }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <!-- Mobile cards -->
        <ul class="divide-y divide-slate-100 md:hidden">
          @for (d of list.items(); track d.id) {
            <li>
              <a [routerLink]="['/drivers', d.id]" class="flex items-start gap-3 p-4 active:bg-slate-50">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{{ initials(d.fullName) }}</span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <p class="truncate font-medium text-slate-900">{{ d.fullName }}</p>
                    <app-status-badge [status]="d.availability" />
                  </div>
                  <p class="text-xs text-slate-500">{{ d.employeeCode }} · {{ d.phone }}</p>
                  <div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <app-status-badge [status]="d.status" />
                    <app-license-badge [expiry]="d.licenseExpiry" />
                  </div>
                </div>
              </a>
            </li>
          }
        </ul>
        <app-pagination [meta]="list.meta()" (pageChange)="list.setPage($event)" (pageSizeChange)="list.setPageSize($event)" />
      }
    </div>

    <app-driver-create-dialog [open]="createOpen()" (closed)="createOpen.set(false)" (created)="onCreated($event)" />
  `,
})
export class DriverList {
  private readonly drivers = inject(DriverService);
  private readonly router = inject(Router);

  protected readonly list = createQueryList((p) => this.drivers.list(p), { sort: 'fullName' });
  protected readonly statuses = DRIVER_STATUSES;
  protected readonly availability = DRIVER_AVAILABILITY;
  protected readonly createOpen = signal(false);

  protected initials(name: string): string {
    return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  protected open(d: Driver): void {
    void this.router.navigate(['/drivers', d.id]);
  }

  protected onCreated(d: Driver): void {
    this.createOpen.set(false);
    void this.router.navigate(['/drivers', d.id]);
  }
}
