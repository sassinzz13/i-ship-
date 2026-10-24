import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ToastService } from '../../../../core/services/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { Assignment } from '../../../assignments/models/assignment.model';
import { RejectSheet } from '../../components/reject-sheet';
import { DriverTasksStore, taskActions } from '../../state/driver-tasks.store';
import { mapsUrl } from '../../utils/geo';

@Component({
  selector: 'app-driver-task',
  imports: [RouterLink, DatePipe, DecimalPipe, Icon, Spinner, EmptyState, StatusBadge, LabelizePipe, RejectSheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/driver" class="mb-3 inline-flex items-center gap-1 py-1 text-sm font-medium text-slate-500"><app-icon name="arrow-left" size="sm" /> Deliveries</a>

    @if (!task() && loading()) {
      <app-spinner />
    } @else if (!task()) {
      <div class="rounded-2xl bg-white ring-1 ring-slate-200"><app-empty-state icon="warning" title="Delivery not found" [message]="error() ?? ''" /></div>
    } @else {
      @let a = task()!;
      <div class="space-y-3 pb-24">
        <section class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-sm font-semibold text-slate-900">{{ a.shipment.trackingNumber }}</span>
            <app-status-badge [status]="a.status" />
          </div>
          <p class="mt-1 text-xs text-slate-500">Shipment: {{ a.shipment.currentStatus | labelize }} · {{ a.shipment.serviceType | labelize }}
            @if (a.shipment.estimatedDeliveryAt) { · ETA {{ a.shipment.estimatedDeliveryAt | date: 'MMM d, h:mm a' }} }</p>
        </section>

        <section class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Recipient</p>
          <p class="mt-1 text-xl font-bold text-slate-900">{{ a.shipment.recipientName }}</p>
          <p class="mt-2 text-sm leading-relaxed text-slate-700">{{ a.shipment.recipientAddress }}</p>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <a [href]="'tel:' + a.shipment.recipientPhone" class="btn-secondary btn-lg"><app-icon name="phone" /> Call</a>
            <a [href]="maps()" target="_blank" rel="noopener" class="btn-secondary btn-lg"><app-icon name="map" /> Open in Maps</a>
          </div>
          <p class="mt-2 text-center text-xs text-slate-400">{{ a.shipment.recipientPhone }}</p>
        </section>

        @if (a.shipment.specialInstructions) {
          <section class="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <app-icon name="warning" class="text-amber-600" />
            <div>
              <p class="text-sm font-semibold text-amber-900">Special instructions</p>
              <p class="mt-0.5 text-sm text-amber-900/90">{{ a.shipment.specialInstructions }}</p>
            </div>
          </section>
        }

        <section class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200"><p class="text-lg font-bold text-slate-900">{{ a.shipment.totalQuantity }}</p><p class="text-xs text-slate-500">Pieces</p></div>
          <div class="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200"><p class="text-lg font-bold text-slate-900">{{ a.shipment.totalWeight | number: '1.0-2' }}</p><p class="text-xs text-slate-500">kg</p></div>
          <div class="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200"><p class="truncate text-lg font-bold text-slate-900">{{ a.vehicle.plateNumber }}</p><p class="text-xs text-slate-500">{{ a.vehicle.vehicleType | labelize }}</p></div>
        </section>

        @if (a.notes) {
          <section class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Dispatch notes</p>
            <p class="mt-1 text-sm text-slate-700">{{ a.notes }}</p>
          </section>
        }
      </div>

      <!-- Thumb-zone action bar above the tab bar -->
      @if (actions().accept || actions().start || actions().deliver) {
        <div class="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-xl px-4">
          <div class="flex gap-2 rounded-2xl bg-white/95 p-2 shadow-lg ring-1 ring-slate-200 backdrop-blur">
            @if (actions().accept) {
              <button type="button" class="btn-secondary btn-lg flex-1" [disabled]="busy()" (click)="rejectOpen.set(true)">Reject</button>
              <button type="button" class="btn-primary btn-lg flex-[2]" [disabled]="busy()" (click)="accept()"><app-icon name="check" /> Accept</button>
            }
            @if (actions().start) {
              <button type="button" class="btn-primary btn-lg w-full" [disabled]="busy()" (click)="start()"><app-icon name="play" /> Start delivery</button>
            }
            @if (actions().deliver) {
              <a [routerLink]="['/driver/assignments', a.id, 'fail']" class="btn-secondary btn-lg flex-1 !text-rose-700">Failed</a>
              <a [routerLink]="['/driver/assignments', a.id, 'deliver']" class="btn btn-lg flex-[2] bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"><app-icon name="check-circle" /> Delivered</a>
            }
          </div>
        </div>
      }

      <app-reject-sheet [open]="rejectOpen()" [busy]="busy()" [trackingNumber]="a.shipment.trackingNumber" (closed)="rejectOpen.set(false)" (confirmed)="reject($event)" />
    }
  `,
})
export class DriverTask implements OnInit {
  readonly id = input.required<string>();

  private readonly store = inject(DriverTasksStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly task = signal<Assignment | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rejectOpen = signal(false);
  protected readonly busy = computed(() => this.store.busyId() === this.task()?.id);
  protected readonly actions = computed(() => taskActions(this.task()?.status ?? 'COMPLETED'));
  protected readonly maps = computed(() => {
    const s = this.task()?.shipment;
    return s ? mapsUrl(s.recipientAddress) : '#';
  });

  ngOnInit(): void {
    const id = Number(this.id());
    const cached = this.store.find(id);
    if (cached) this.task.set(cached);
    this.store.fetch(id).subscribe({
      next: (a) => {
        this.task.set(a);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err).message);
      },
    });
  }

  protected accept(): void {
    this.store.accept(this.task()!.id).subscribe({
      next: (a) => {
        this.task.set(a);
        this.toast.success('Assignment accepted');
      },
      error: (err) => this.toast.error(apiError(err).message),
    });
  }

  protected start(): void {
    this.store.start(this.task()!.id).subscribe({
      next: (a) => {
        this.task.set(a);
        this.toast.success('Delivery started — drive safe!');
      },
      error: (err) => this.toast.error(apiError(err).message),
    });
  }

  protected reject(reason: string): void {
    this.store.reject(this.task()!.id, reason).subscribe({
      next: () => {
        this.toast.info('Assignment rejected');
        void this.router.navigateByUrl('/driver');
      },
      error: (err) => this.toast.error(apiError(err).message),
    });
  }
}
