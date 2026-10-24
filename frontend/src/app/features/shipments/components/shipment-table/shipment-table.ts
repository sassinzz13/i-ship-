import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SortHeader } from '../../../../shared/components/sort-header/sort-header';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { PesoPipe } from '../../../../shared/pipes/peso.pipe';
import { ShipmentSummary } from '../../models/shipment.model';

/** Shipment rows: a table on md+ screens and stacked cards on phones. */
@Component({
  selector: 'app-shipment-table',
  imports: [RouterLink, DatePipe, SortHeader, StatusBadge, LabelizePipe, PesoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hidden overflow-x-auto md:block">
      <table class="table-base">
        <thead>
          <tr>
            <th><app-sort-header field="trackingNumber" [sort]="sort()" (sortChange)="sortChange.emit($event)">Tracking #</app-sort-header></th>
            @if (showCustomer()) { <th>Customer</th> }
            <th>Recipient</th>
            <th>Service</th>
            <th><app-sort-header field="currentStatus" [sort]="sort()" (sortChange)="sortChange.emit($event)">Status</app-sort-header></th>
            <th>Payment</th>
            <th class="text-right"><app-sort-header field="shippingFee" [sort]="sort()" (sortChange)="sortChange.emit($event)">Fee</app-sort-header></th>
            <th><app-sort-header field="estimatedDeliveryAt" [sort]="sort()" (sortChange)="sortChange.emit($event)">ETA</app-sort-header></th>
            <th><app-sort-header field="createdAt" [sort]="sort()" (sortChange)="sortChange.emit($event)">Created</app-sort-header></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          @for (s of items(); track s.id) {
            <tr class="cursor-pointer" [routerLink]="['/shipments', s.id]">
              <td><a [routerLink]="['/shipments', s.id]" class="font-mono text-[13px] font-medium text-brand-700 hover:underline">{{ s.trackingNumber }}</a></td>
              @if (showCustomer()) { <td class="max-w-[12rem] truncate">{{ s.customerName }}</td> }
              <td>
                <p class="max-w-[12rem] truncate font-medium text-slate-800">{{ s.recipientName }}</p>
                <p class="text-xs text-slate-500">{{ s.recipientCity }}, {{ s.recipientProvince }}</p>
              </td>
              <td>{{ s.serviceType | labelize }}</td>
              <td><app-status-badge [status]="s.currentStatus" /></td>
              <td><app-status-badge [status]="s.paymentStatus" /></td>
              <td class="text-right tabular-nums">{{ s.shippingFee | peso }}</td>
              <td class="text-slate-500">{{ s.estimatedDeliveryAt ? (s.estimatedDeliveryAt | date: 'MMM d') : '—' }}</td>
              <td class="text-slate-500">{{ s.createdAt | date: 'MMM d, y' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <ul class="divide-y divide-slate-100 md:hidden">
      @for (s of items(); track s.id) {
        <li>
          <a [routerLink]="['/shipments', s.id]" class="block px-4 py-3 active:bg-slate-50">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-mono text-[13px] font-semibold text-brand-700">{{ s.trackingNumber }}</p>
                <p class="mt-0.5 truncate text-sm font-medium text-slate-800">{{ s.recipientName }}</p>
                <p class="truncate text-xs text-slate-500">{{ s.recipientCity }}, {{ s.recipientProvince }} · {{ s.serviceType | labelize }}</p>
              </div>
              <app-status-badge [status]="s.currentStatus" />
            </div>
            <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{{ s.createdAt | date: 'MMM d, y' }}</span>
              <span class="flex items-center gap-2"><app-status-badge [status]="s.paymentStatus" /> <span class="font-medium text-slate-700">{{ s.shippingFee | peso }}</span></span>
            </div>
          </a>
        </li>
      }
    </ul>
  `,
})
export class ShipmentTable {
  readonly items = input.required<ShipmentSummary[]>();
  readonly sort = input('');
  readonly showCustomer = input(true);
  readonly sortChange = output<string>();
}
