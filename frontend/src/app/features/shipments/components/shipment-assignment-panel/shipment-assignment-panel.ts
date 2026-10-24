import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icon } from '../../../../shared/components/icon/icon';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { ACTIVE_ASSIGNMENT_STATUSES, Assignment } from '../../../assignments/models/assignment.model';

/** Current (or most recent) assignment plus a compact history. */
@Component({
  selector: 'app-shipment-assignment-panel',
  imports: [DatePipe, Icon, StatusBadge, LabelizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 class="font-semibold text-slate-900">Driver &amp; vehicle</h2>
        @if (canAssign() && !active()) {
          <button type="button" class="btn-primary !py-1.5" (click)="assign.emit()"><app-icon name="truck" size="sm" /> Assign driver</button>
        }
      </header>
      <div class="p-5">
        @if (loading()) {
          <div class="h-20 animate-pulse rounded-lg bg-slate-100"></div>
        } @else if (current(); as a) {
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700"><app-icon name="user" /></span>
              <div>
                <p class="font-medium text-slate-900">{{ a.driver.fullName }}</p>
                <p class="text-xs text-slate-500">{{ a.driver.employeeCode }} · {{ a.driver.phone }}</p>
              </div>
            </div>
            <app-status-badge [status]="a.status" />
          </div>
          <div class="mt-4 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <app-icon name="truck" class="text-slate-400" />
            <span class="font-mono font-medium text-slate-800">{{ a.vehicle.plateNumber }}</span>
            <span class="text-slate-500">{{ a.vehicle.vehicleType | labelize }} · {{ a.vehicle.brand }} {{ a.vehicle.model }}</span>
          </div>
          <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div><dt class="text-slate-500">Assigned</dt><dd class="text-slate-800">{{ a.assignedAt | date: 'MMM d, h:mm a' }}</dd></div>
            <div><dt class="text-slate-500">Accepted</dt><dd class="text-slate-800">{{ a.acceptedAt ? (a.acceptedAt | date: 'MMM d, h:mm a') : '—' }}</dd></div>
            <div><dt class="text-slate-500">Started</dt><dd class="text-slate-800">{{ a.startedAt ? (a.startedAt | date: 'MMM d, h:mm a') : '—' }}</dd></div>
            <div><dt class="text-slate-500">Completed</dt><dd class="text-slate-800">{{ a.completedAt ? (a.completedAt | date: 'MMM d, h:mm a') : '—' }}</dd></div>
          </dl>
          @if (a.assignedBy) { <p class="mt-3 text-xs text-slate-400">Dispatched by {{ a.assignedBy.fullName }}</p> }
          @if (a.notes) { <p class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{{ a.notes }}</p> }
          @if (canAssign() && active()) {
            <div class="mt-4 flex justify-end">
              <button type="button" class="btn-ghost !py-1.5 text-rose-600" (click)="cancel.emit(a)">Cancel assignment</button>
            </div>
          }
        } @else {
          <div class="flex flex-col items-center py-4 text-center">
            <span class="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><app-icon name="truck" /></span>
            <p class="text-sm font-medium text-slate-700">No driver assigned</p>
            <p class="text-xs text-slate-500">{{ canAssign() ? 'Assign a driver and vehicle to dispatch this shipment.' : 'A driver will be assigned soon.' }}</p>
          </div>
        }

        @if (previous().length > 0) {
          <details class="mt-4 border-t border-slate-100 pt-3 text-sm">
            <summary class="cursor-pointer text-xs font-medium text-slate-500">Previous assignments ({{ previous().length }})</summary>
            <ul class="mt-2 space-y-2">
              @for (p of previous(); track p.id) {
                <li class="flex items-center justify-between text-xs">
                  <span>{{ p.driver.fullName }} · <span class="font-mono">{{ p.vehicle.plateNumber }}</span> · {{ p.assignedAt | date: 'MMM d' }}</span>
                  <app-status-badge [status]="p.status" />
                </li>
              }
            </ul>
          </details>
        }
      </div>
    </section>
  `,
})
export class ShipmentAssignmentPanel {
  readonly assignments = input<Assignment[]>([]);
  readonly loading = input(false);
  readonly canAssign = input(false);
  readonly assign = output<void>();
  readonly cancel = output<Assignment>();

  protected readonly active = computed(() => this.assignments().find((a) => ACTIVE_ASSIGNMENT_STATUSES.includes(a.status)) ?? null);
  protected readonly current = computed(() => this.active() ?? this.assignments()[0] ?? null);
  protected readonly previous = computed(() => this.assignments().filter((a) => a !== this.current()));
}
