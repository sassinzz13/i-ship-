import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { DriverTasksStore } from '../../state/driver-tasks.store';

@Component({
  selector: 'app-driver-history',
  imports: [RouterLink, DatePipe, Spinner, EmptyState, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-4 text-xl font-bold text-slate-900">History</h1>
    @if (store.history() === null) {
      <app-spinner />
    } @else if (store.history()!.length === 0) {
      <div class="rounded-2xl bg-white ring-1 ring-slate-200"><app-empty-state icon="clock" title="No past deliveries" message="Completed and cancelled assignments appear here." /></div>
    } @else {
      <ul class="space-y-2">
        @for (a of store.history(); track a.id) {
          <li>
            <a [routerLink]="['/driver/assignments', a.id]" class="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:bg-slate-50">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono text-sm font-semibold text-slate-900">{{ a.shipment.trackingNumber }}</span>
                <app-status-badge [status]="a.shipment.currentStatus" />
              </div>
              <p class="mt-1 truncate text-sm text-slate-700">{{ a.shipment.recipientName }} · {{ a.shipment.recipientCity }}</p>
              <div class="mt-1 flex items-center justify-between text-xs text-slate-400">
                <span>{{ (a.completedAt ?? a.cancelledAt ?? a.assignedAt) | date: 'MMM d, y · h:mm a' }}</span>
                <app-status-badge [status]="a.status" />
              </div>
            </a>
          </li>
        }
      </ul>
    }
  `,
})
export class DriverHistory implements OnInit {
  protected readonly store = inject(DriverTasksStore);

  ngOnInit(): void {
    this.store.loadHistory();
  }
}
