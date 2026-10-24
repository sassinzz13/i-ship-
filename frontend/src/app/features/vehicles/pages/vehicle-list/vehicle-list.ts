import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

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
import { VehicleFormDialog } from '../../components/vehicle-form-dialog/vehicle-form-dialog';
import { VehicleTypeIcon } from '../../components/vehicle-type-icon/vehicle-type-icon';
import { VEHICLE_STATUSES, VEHICLE_TYPES, Vehicle } from '../../models/vehicle.model';
import { VehicleService } from '../../services/vehicle.service';

@Component({
  selector: 'app-vehicle-list',
  imports: [PageHeader, Pagination, SortHeader, Spinner, EmptyState, StatusBadge, Icon, LabelizePipe, DecimalPipe,
    DebouncedSearch, VehicleFormDialog, VehicleTypeIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Vehicles" subtitle="Fleet capacity and availability">
      <button type="button" class="btn-primary" (click)="edit(null)"><app-icon name="plus" size="sm" /> New vehicle</button>
    </app-page-header>

    <div class="card">
      <div class="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[1fr_auto_auto]">
        <app-debounced-search placeholder="Search plate, brand, model…" [value]="list.value('search')" (search)="list.patch({ search: $event })" />
        <select class="form-input sm:w-40" [value]="list.value('vehicleType')" (change)="list.patch({ vehicleType: $any($event.target).value })" aria-label="Type">
          <option value="">All types</option>
          @for (t of types; track t) { <option [value]="t">{{ t | labelize }}</option> }
        </select>
        <select class="form-input sm:w-40" [value]="list.value('status')" (change)="list.patch({ status: $any($event.target).value })" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) { <option [value]="s">{{ s | labelize }}</option> }
        </select>
      </div>

      @if (list.loading() && list.items().length === 0) {
        <app-spinner />
      } @else if (list.error()) {
        <app-empty-state icon="warning" title="Could not load vehicles" [message]="list.error()!">
          <button type="button" class="btn-secondary" (click)="list.reload()">Try again</button>
        </app-empty-state>
      } @else if (list.items().length === 0) {
        <app-empty-state icon="truck" title="No vehicles found" message="Add your first vehicle to start dispatching." />
      } @else {
        <div class="hidden overflow-x-auto md:block" [class.opacity-60]="list.loading()">
          <table class="table-base">
            <thead>
              <tr>
                <th><app-sort-header field="plateNumber" [sort]="list.value('sort')" (sortChange)="list.setSort($event)">Vehicle</app-sort-header></th>
                <th>Type</th>
                <th>Year</th>
                <th class="text-right"><app-sort-header field="weightCapacityKg" [sort]="list.value('sort')" (sortChange)="list.setSort($event)">Capacity</app-sort-header></th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (v of list.items(); track v.id) {
                <tr>
                  <td>
                    <div class="flex items-center gap-3">
                      <app-vehicle-type-icon [type]="v.vehicleType" [status]="v.status" />
                      <div>
                        <p class="font-mono font-semibold text-slate-900">{{ v.plateNumber }}</p>
                        <p class="text-xs text-slate-500">{{ v.brand }} {{ v.model }}</p>
                      </div>
                    </div>
                  </td>
                  <td>{{ v.vehicleType | labelize }}</td>
                  <td>{{ v.year ?? '—' }}</td>
                  <td class="text-right tabular-nums">{{ v.weightCapacityKg | number: '1.0-1' }} kg</td>
                  <td><app-status-badge [status]="v.status" /></td>
                  <td class="text-right"><button type="button" class="btn-ghost !px-2 !py-1" (click)="edit(v)" [attr.aria-label]="'Edit ' + v.plateNumber"><app-icon name="pencil" size="sm" /></button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="grid gap-3 p-4 sm:grid-cols-2 md:hidden">
          @for (v of list.items(); track v.id) {
            <button type="button" class="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left active:bg-slate-50" (click)="edit(v)">
              <app-vehicle-type-icon [type]="v.vehicleType" [status]="v.status" size="lg" />
              <div class="min-w-0 flex-1">
                <p class="font-mono font-semibold text-slate-900">{{ v.plateNumber }}</p>
                <p class="truncate text-sm text-slate-500">{{ v.brand }} {{ v.model }} · {{ v.weightCapacityKg | number: '1.0-1' }} kg</p>
                <div class="mt-1"><app-status-badge [status]="v.status" /></div>
              </div>
            </button>
          }
        </div>
        <app-pagination [meta]="list.meta()" (pageChange)="list.setPage($event)" (pageSizeChange)="list.setPageSize($event)" />
      }
    </div>

    <app-vehicle-form-dialog [open]="dialogOpen()" [vehicle]="editing()" (closed)="dialogOpen.set(false)" (saved)="onSaved()" />
  `,
})
export class VehicleList {
  private readonly vehicles = inject(VehicleService);
  protected readonly list = createQueryList((p) => this.vehicles.list(p), { sort: 'plateNumber' });
  protected readonly types = VEHICLE_TYPES;
  protected readonly statuses = VEHICLE_STATUSES;
  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<Vehicle | null>(null);

  protected edit(v: Vehicle | null): void {
    this.editing.set(v);
    this.dialogOpen.set(true);
  }

  protected onSaved(): void {
    this.dialogOpen.set(false);
    this.list.reload();
  }
}
