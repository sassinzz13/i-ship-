import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../../shared/components/icon/icon';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { Assignment } from '../../../assignments/models/assignment.model';
import { taskActions } from '../../state/driver-tasks.store';

/** One delivery task on the driver's home screen. */
@Component({
  selector: 'app-driver-task-card',
  imports: [RouterLink, DecimalPipe, Icon, StatusBadge, LabelizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = task();
    <article class="overflow-hidden rounded-2xl border bg-white shadow-sm" [class]="a.status === 'IN_PROGRESS' ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'">
      <a [routerLink]="['/driver/assignments', a.id]" class="block p-4 active:bg-slate-50">
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-sm font-semibold text-slate-900">{{ a.shipment.trackingNumber }}</span>
          <app-status-badge [status]="a.status" />
        </div>
        <p class="mt-2 text-base font-semibold text-slate-900">{{ a.shipment.recipientName }}</p>
        <p class="mt-0.5 flex items-start gap-1.5 text-sm text-slate-600">
          <app-icon name="map-pin" size="sm" class="mt-0.5 text-slate-400" /><span>{{ a.shipment.recipientAddress }}</span>
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span class="rounded-full px-2 py-0.5 font-semibold" [class]="serviceClass()">{{ a.shipment.serviceType | labelize }}</span>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{{ a.shipment.totalQuantity }} pcs · {{ a.shipment.totalWeight | number: '1.0-2' }} kg</span>
          @if (a.shipment.specialInstructions) {
            <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-800"><app-icon name="info" size="sm" /> Instructions</span>
          }
        </div>
      </a>
      @if (actions().accept || actions().start || actions().deliver) {
        <div class="flex gap-2 border-t border-slate-100 bg-slate-50/60 p-3">
          @if (actions().reject) {
            <button type="button" class="btn-secondary btn-lg flex-1" [disabled]="busy()" (click)="reject.emit(a)">Reject</button>
          }
          @if (actions().accept) {
            <button type="button" class="btn-primary btn-lg flex-[2]" [disabled]="busy()" (click)="accept.emit(a)"><app-icon name="check" /> Accept</button>
          }
          @if (actions().start) {
            <button type="button" class="btn-primary btn-lg flex-1" [disabled]="busy()" (click)="start.emit(a)"><app-icon name="play" /> Start delivery</button>
          }
          @if (actions().deliver) {
            <a [routerLink]="['/driver/assignments', a.id]" class="btn btn-lg flex-1 bg-amber-500 text-white shadow-sm hover:bg-amber-600">
              <app-icon name="truck" /> Continue delivery
            </a>
          }
        </div>
      }
    </article>
  `,
})
export class DriverTaskCard {
  readonly task = input.required<Assignment>();
  readonly busy = input(false);
  readonly accept = output<Assignment>();
  readonly reject = output<Assignment>();
  readonly start = output<Assignment>();

  protected readonly actions = computed(() => taskActions(this.task().status));
  protected readonly serviceClass = computed(
    () =>
      ({
        SAME_DAY: 'bg-rose-100 text-rose-700',
        EXPRESS: 'bg-violet-100 text-violet-700',
        NEXT_DAY: 'bg-blue-100 text-blue-700',
      })[this.task().shipment.serviceType as string] ?? 'bg-slate-100 text-slate-700',
  );
}
