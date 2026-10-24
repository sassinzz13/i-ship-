import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DebouncedSearch } from '../../../../shared/components/debounced-search/debounced-search';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { createQueryList } from '../../../../shared/utilities/query-list';
import { ATTEMPT_OUTCOMES } from '../../models/delivery.model';
import { DeliveryService } from '../../services/delivery.service';

@Component({
  selector: 'app-delivery-log',
  imports: [RouterLink, DatePipe, PageHeader, Pagination, Spinner, EmptyState, StatusBadge, Icon, LabelizePipe, DebouncedSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Deliveries" subtitle="Every delivery attempt recorded by drivers" />

    <div class="card">
      <div class="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <app-debounced-search placeholder="Search tracking no. or driver…" [value]="list.value('search')" (search)="list.patch({ search: $event })" />
        <select class="form-input md:w-52" [value]="list.value('outcome')" (change)="list.patch({ outcome: $any($event.target).value })" aria-label="Outcome">
          <option value="">All outcomes</option>
          @for (o of outcomes; track o) { <option [value]="o">{{ o | labelize }}</option> }
        </select>
        <input type="date" class="form-input md:w-40" [value]="list.value('dateFrom')" (change)="list.patch({ dateFrom: $any($event.target).value })" aria-label="From date" />
        <input type="date" class="form-input md:w-40" [value]="list.value('dateTo')" (change)="list.patch({ dateTo: $any($event.target).value })" aria-label="To date" />
      </div>

      @if (list.loading() && list.items().length === 0) {
        <app-spinner />
      } @else if (list.error()) {
        <app-empty-state icon="warning" title="Could not load deliveries" [message]="list.error()!">
          <button type="button" class="btn-secondary" (click)="list.reload()">Try again</button>
        </app-empty-state>
      } @else if (list.items().length === 0) {
        <app-empty-state icon="check-circle" title="No delivery attempts" message="Attempts appear here once drivers start delivering." />
      } @else {
        <div class="hidden overflow-x-auto md:block" [class.opacity-60]="list.loading()">
          <table class="table-base">
            <thead>
              <tr><th>When</th><th>Shipment</th><th>Attempt</th><th>Outcome</th><th>Driver</th><th>Notes</th><th>Location</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (a of list.items(); track a.id) {
                <tr>
                  <td class="text-slate-500">{{ a.attemptedAt | date: 'MMM d, y · h:mm a' }}</td>
                  <td><a [routerLink]="['/shipments', a.shipmentId]" class="font-mono font-medium text-brand-700 hover:underline">{{ a.trackingNumber }}</a></td>
                  <td class="tabular-nums">#{{ a.attemptNumber }}</td>
                  <td><app-status-badge [status]="a.outcome" /></td>
                  <td>{{ a.driverName ?? a.recordedBy?.fullName ?? '—' }}</td>
                  <td class="max-w-xs truncate text-slate-500" [title]="a.notes ?? ''">{{ a.notes ?? '—' }}</td>
                  <td>
                    @if (a.latitude !== null && a.longitude !== null) {
                      <a class="inline-flex items-center gap-1 text-brand-700 hover:underline" target="_blank" rel="noopener"
                        [href]="'https://www.google.com/maps/search/?api=1&query=' + a.latitude + ',' + a.longitude"><app-icon name="map-pin" size="sm" /> Map</a>
                    } @else { <span class="text-slate-400">—</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <ul class="divide-y divide-slate-100 md:hidden">
          @for (a of list.items(); track a.id) {
            <li class="p-4">
              <div class="flex items-center justify-between gap-2">
                <a [routerLink]="['/shipments', a.shipmentId]" class="font-mono text-sm font-medium text-brand-700">{{ a.trackingNumber }}</a>
                <app-status-badge [status]="a.outcome" />
              </div>
              <p class="mt-1 text-sm text-slate-600">Attempt #{{ a.attemptNumber }} · {{ a.driverName ?? '—' }}</p>
              <p class="text-xs text-slate-400">{{ a.attemptedAt | date: 'MMM d, y · h:mm a' }}</p>
              @if (a.notes) { <p class="mt-1 text-sm text-slate-500">{{ a.notes }}</p> }
            </li>
          }
        </ul>
        <app-pagination [meta]="list.meta()" (pageChange)="list.setPage($event)" (pageSizeChange)="list.setPageSize($event)" />
      }
    </div>
  `,
})
export class DeliveryLog {
  private readonly deliveries = inject(DeliveryService);
  protected readonly list = createQueryList((p) => this.deliveries.list(p));
  protected readonly outcomes = ATTEMPT_OUTCOMES;
}
