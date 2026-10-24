import { DecimalPipe, LowerCasePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, switchMap, catchError, of } from 'rxjs';

import { ToastService } from '../../../../core/services/toast.service';
import { DebouncedSearch } from '../../../../shared/components/debounced-search/debounced-search';
import { Icon } from '../../../../shared/components/icon/icon';
import { Modal } from '../../../../shared/components/modal/modal';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { Driver } from '../../../drivers/models/driver.model';
import { DriverService } from '../../../drivers/services/driver.service';
import { ShipmentStatus, ShipmentSummary } from '../../../shipments/models/shipment.model';
import { ShipmentService } from '../../../shipments/services/shipment.service';
import { Vehicle } from '../../../vehicles/models/vehicle.model';
import { VehicleService } from '../../../vehicles/services/vehicle.service';
import { Assignment } from '../../models/assignment.model';
import { AssignmentService } from '../../services/assignment.service';

export const ASSIGNABLE_STATUSES: ShipmentStatus[] = ['CONFIRMED', 'PICKED_UP', 'IN_TRANSIT', 'FAILED_DELIVERY'];

/** Vehicles that can legally carry `weight` kg right now. */
export function vehicleFits(v: Pick<Vehicle, 'status' | 'weightCapacityKg'>, weight: number): boolean {
  return (v.status === 'AVAILABLE' || v.status === 'IN_USE') && v.weightCapacityKg >= weight;
}

/** Drivers who may receive a new assignment. */
export function driverAssignable(d: Pick<Driver, 'status' | 'availability' | 'licenseExpired'>): boolean {
  return d.status === 'ACTIVE' && d.availability !== 'OFF_DUTY' && !d.licenseExpired;
}

@Component({
  selector: 'app-new-assignment-dialog',
  imports: [FormsModule, DecimalPipe, LowerCasePipe, Modal, Icon, StatusBadge, LabelizePipe, DebouncedSearch],
  template: `
    <app-modal [open]="open()" title="New assignment" size="lg" (closed)="closed.emit()">
      <ol class="mb-5 flex items-center gap-2 text-xs font-medium">
        @for (s of ['Shipment', 'Driver & vehicle']; track s; let i = $index) {
          <li class="flex items-center gap-2" [class.text-brand-700]="step() === i" [class.text-slate-400]="step() !== i">
            <span class="flex h-6 w-6 items-center justify-center rounded-full" [class]="step() >= i ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'">{{ i + 1 }}</span>
            {{ s }}
          </li>
          @if (i === 0) { <li class="h-px flex-1 bg-slate-200"></li> }
        }
      </ol>

      @if (step() === 0) {
        <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
          <app-debounced-search placeholder="Search tracking no., customer, recipient…" (search)="search.set($event)" />
          <select class="form-input sm:w-44" [ngModel]="status()" (ngModelChange)="status.set($event)" aria-label="Shipment status">
            @for (s of statuses; track s) { <option [value]="s">{{ s | labelize }}</option> }
          </select>
        </div>
        <ul class="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          @if (loadingShipments()) {
            <li class="p-4 text-center text-sm text-slate-500">Loading shipments…</li>
          }
          @for (s of shipments(); track s.id) {
            <li>
              <button type="button" class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50" (click)="pickShipment(s)">
                <div class="min-w-0">
                  <p class="font-mono text-sm font-semibold text-slate-900">{{ s.trackingNumber }}</p>
                  <p class="truncate text-sm text-slate-600">{{ s.recipientName }} · {{ s.recipientCity }}, {{ s.recipientProvince }}</p>
                  <p class="text-xs text-slate-400">{{ s.serviceType | labelize }} · {{ s.totalQuantity }} pcs · {{ s.totalWeight | number: '1.0-2' }} kg</p>
                </div>
                <app-icon name="chevron-right" class="text-slate-400" />
              </button>
            </li>
          } @empty {
            @if (!loadingShipments()) {
              <li class="p-6 text-center text-sm text-slate-500">No {{ status() | labelize | lowercase }} shipments match.</li>
            }
          }
        </ul>
      } @else {
        @let s = shipment()!;
        <div class="mb-4 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
          <div class="min-w-0">
            <p class="font-mono text-sm font-semibold text-brand-800">{{ s.trackingNumber }}</p>
            <p class="truncate text-sm text-brand-900/80">{{ s.recipientName }} · {{ s.recipientCity }} · {{ s.totalWeight | number: '1.0-2' }} kg</p>
          </div>
          <button type="button" class="btn-ghost !px-2 !py-1 text-xs" (click)="step.set(0)">Change</button>
        </div>

        <div class="grid gap-5 md:grid-cols-2">
          <section>
            <h3 class="mb-2 text-sm font-semibold text-slate-700">Driver</h3>
            <ul class="max-h-72 space-y-2 overflow-y-auto pr-1">
              @for (d of drivers(); track d.id) {
                @let ok = assignable(d);
                <li>
                  <button type="button" [disabled]="!ok" (click)="driverId.set(d.id)"
                    class="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
                    [class]="driverId() === d.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 hover:border-slate-300'">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{{ d.fullName.charAt(0) }}</span>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-slate-900">{{ d.fullName }}</p>
                      <p class="text-xs text-slate-500">{{ d.employeeCode }} · {{ d.activeAssignments }} active</p>
                    </div>
                    @if (d.licenseExpired) { <span class="text-xs text-rose-600">License expired</span> }
                    @else { <app-status-badge [status]="d.availability" /> }
                  </button>
                </li>
              } @empty {
                <li class="text-sm text-slate-500">No active drivers.</li>
              }
            </ul>
          </section>
          <section>
            <h3 class="mb-2 text-sm font-semibold text-slate-700">Vehicle</h3>
            <ul class="max-h-72 space-y-2 overflow-y-auto pr-1">
              @for (v of vehicles(); track v.id) {
                @let fits = fitsShipment(v);
                <li>
                  <button type="button" [disabled]="!fits" (click)="vehicleId.set(v.id)"
                    class="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
                    [class]="vehicleId() === v.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 hover:border-slate-300'">
                    <app-icon name="truck" class="text-slate-500" />
                    <div class="min-w-0 flex-1">
                      <p class="font-mono text-sm font-semibold text-slate-900">{{ v.plateNumber }}</p>
                      <p class="truncate text-xs text-slate-500">{{ v.brand }} {{ v.model }} · {{ v.weightCapacityKg | number: '1.0-0' }} kg</p>
                    </div>
                    @if (!fits && v.weightCapacityKg < s.totalWeight) { <span class="text-xs text-rose-600">Too small</span> }
                    @else { <app-status-badge [status]="v.status" /> }
                  </button>
                </li>
              } @empty {
                <li class="text-sm text-slate-500">No vehicles in service.</li>
              }
            </ul>
          </section>
        </div>

        <label class="form-label mt-5" for="a-notes">Notes for the driver <span class="font-normal text-slate-400">(optional)</span></label>
        <textarea id="a-notes" rows="2" class="form-input" [(ngModel)]="notes" maxlength="500"></textarea>

        @if (error()) { <p class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error() }}</p> }

        <div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
          <button type="button" class="btn-primary" [disabled]="!canSubmit() || saving()" (click)="submit()">
            <app-icon name="check" size="sm" /> Assign
          </button>
        </div>
      }
    </app-modal>
  `,
})
export class NewAssignmentDialog {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly created = output<Assignment>();

  private readonly shipmentService = inject(ShipmentService);
  private readonly driverService = inject(DriverService);
  private readonly vehicleService = inject(VehicleService);
  private readonly assignments = inject(AssignmentService);
  private readonly toast = inject(ToastService);

  protected readonly statuses = ASSIGNABLE_STATUSES;
  protected readonly step = signal(0);
  protected readonly search = signal('');
  protected readonly status = signal<ShipmentStatus>('CONFIRMED');
  protected readonly shipments = signal<ShipmentSummary[]>([]);
  protected readonly loadingShipments = signal(false);
  protected readonly shipment = signal<ShipmentSummary | null>(null);
  protected readonly drivers = signal<Driver[]>([]);
  protected readonly vehicles = signal<Vehicle[]>([]);
  protected readonly driverId = signal<number | null>(null);
  protected readonly vehicleId = signal<number | null>(null);
  protected notes = '';
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canSubmit = computed(() => !!this.shipment() && !!this.driverId() && !!this.vehicleId());

  private readonly query$ = new Subject<{ status: ShipmentStatus; search: string }>();

  constructor() {
    this.query$
      .pipe(
        debounceTime(50),
        switchMap((q) => {
          this.loadingShipments.set(true);
          return this.shipmentService
            .list({ status: q.status, search: q.search, pageSize: 25, sort: 'createdAt' })
            .pipe(catchError(() => of({ items: [] as ShipmentSummary[], meta: null })));
        }),
      )
      .subscribe((p) => {
        this.shipments.set(p.items);
        this.loadingShipments.set(false);
      });

    effect(() => {
      if (this.open()) this.query$.next({ status: this.status(), search: this.search() });
    });

    effect(() => {
      if (!this.open()) return;
      this.step.set(0);
      this.shipment.set(null);
      this.driverId.set(null);
      this.vehicleId.set(null);
      this.notes = '';
      this.error.set(null);
      this.driverService.list({ status: 'ACTIVE', pageSize: 100, sort: 'fullName' }).subscribe((p) => this.drivers.set(p.items));
      this.vehicleService.list({ pageSize: 100, sort: 'plateNumber' }).subscribe((p) =>
        this.vehicles.set(p.items.filter((v) => v.status === 'AVAILABLE' || v.status === 'IN_USE')),
      );
    });
  }

  protected assignable(d: Driver): boolean {
    return driverAssignable(d);
  }

  protected fitsShipment(v: Vehicle): boolean {
    return vehicleFits(v, this.shipment()?.totalWeight ?? 0);
  }

  protected pickShipment(s: ShipmentSummary): void {
    this.shipment.set(s);
    if (this.vehicleId()) {
      const v = this.vehicles().find((x) => x.id === this.vehicleId());
      if (v && !vehicleFits(v, s.totalWeight)) this.vehicleId.set(null);
    }
    this.step.set(1);
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.error.set(null);
    this.assignments
      .create({ shipmentId: this.shipment()!.id, driverId: this.driverId()!, vehicleId: this.vehicleId()!, notes: this.notes.trim() || null })
      .subscribe({
        next: (a) => {
          this.saving.set(false);
          this.toast.success(`${a.shipment.trackingNumber} assigned to ${a.driver.fullName}`);
          this.created.emit(a);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(apiError(err).message);
        },
      });
  }
}
