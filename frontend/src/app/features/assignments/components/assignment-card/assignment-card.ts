import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../../shared/components/icon/icon';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { ACTIVE_ASSIGNMENT_STATUSES, Assignment } from '../../models/assignment.model';

@Component({
  selector: 'app-assignment-card',
  imports: [RouterLink, DatePipe, DecimalPipe, Icon, StatusBadge, LabelizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = assignment();
    <article class="card flex h-full flex-col p-4">
      <header class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <a [routerLink]="['/shipments', a.shipmentId]" class="font-mono text-sm font-semibold text-brand-700 hover:underline">{{ a.shipment.trackingNumber }}</a>
          <p class="mt-0.5 truncate text-sm font-medium text-slate-900">{{ a.shipment.recipientName }}</p>
          <p class="truncate text-xs text-slate-500">{{ a.shipment.recipientCity }} · {{ a.shipment.serviceType | labelize }} · {{ a.shipment.totalWeight | number: '1.0-2' }} kg</p>
        </div>
        <app-status-badge [status]="a.status" />
      </header>

      <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div class="min-w-0">
          <dt class="flex items-center gap-1 text-xs text-slate-500"><app-icon name="id" size="sm" /> Driver</dt>
          <dd class="truncate font-medium text-slate-800">
            <a [routerLink]="['/drivers', a.driverId]" class="hover:text-brand-700">{{ a.driver.fullName }}</a>
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="flex items-center gap-1 text-xs text-slate-500"><app-icon name="truck" size="sm" /> Vehicle</dt>
          <dd class="truncate font-medium text-slate-800">{{ a.vehicle.plateNumber }} <span class="font-normal text-slate-500">{{ a.vehicle.vehicleType | labelize }}</span></dd>
        </div>
      </dl>

      <ol class="mt-4 grid grid-cols-4 gap-1 text-[11px]">
        @for (s of steps(); track s.label) {
          <li class="min-w-0">
            <div class="h-1.5 rounded-full" [class]="s.at ? (s.bad ? 'bg-rose-400' : 'bg-brand-500') : 'bg-slate-200'"></div>
            <p class="mt-1 truncate font-medium" [class.text-slate-700]="s.at" [class.text-slate-400]="!s.at">{{ s.label }}</p>
            <p class="truncate text-slate-400">{{ s.at ? (s.at | date: 'MMM d, h:mm a') : '—' }}</p>
          </li>
        }
      </ol>

      @if (a.notes) { <p class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{{ a.notes }}</p> }

      <footer class="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-slate-400">
        <span>by {{ a.assignedBy?.fullName ?? 'system' }}</span>
        @if (isActive()) {
          <button type="button" class="btn-ghost !px-2 !py-1 text-rose-600 hover:bg-rose-50" (click)="cancel.emit(a)">
            <app-icon name="x-circle" size="sm" /> Cancel
          </button>
        }
      </footer>
    </article>
  `,
})
export class AssignmentCard {
  readonly assignment = input.required<Assignment>();
  readonly cancel = output<Assignment>();

  protected readonly isActive = computed(() => ACTIVE_ASSIGNMENT_STATUSES.includes(this.assignment().status));
  protected readonly steps = computed(() => {
    const a = this.assignment();
    const ended = a.status === 'CANCELLED' || a.status === 'REJECTED';
    return [
      { label: 'Assigned', at: a.assignedAt, bad: false },
      { label: 'Accepted', at: a.acceptedAt, bad: false },
      { label: 'Started', at: a.startedAt, bad: false },
      ended
        ? { label: a.status === 'CANCELLED' ? 'Cancelled' : 'Rejected', at: a.cancelledAt ?? a.completedAt ?? a.assignedAt, bad: true }
        : { label: 'Completed', at: a.completedAt, bad: false },
    ];
  });
}
