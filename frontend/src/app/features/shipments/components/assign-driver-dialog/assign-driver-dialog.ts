import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ToastService } from '../../../../core/services/toast.service';
import { Modal } from '../../../../shared/components/modal/modal';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { Assignment } from '../../../assignments/models/assignment.model';
import { AssignmentService } from '../../../assignments/services/assignment.service';
import { Driver } from '../../../drivers/models/driver.model';
import { DriverService } from '../../../drivers/services/driver.service';
import { Vehicle } from '../../../vehicles/models/vehicle.model';
import { VehicleService } from '../../../vehicles/services/vehicle.service';
import { Shipment } from '../../models/shipment.model';

/** Dispatch a shipment: pick an eligible driver and a vehicle with enough
 *  capacity. The server re-validates every rule. */
@Component({
  selector: 'app-assign-driver-dialog',
  imports: [FormsModule, DecimalPipe, Modal, Spinner, StatusBadge, LabelizePipe],
  template: `
    <app-modal [open]="open()" title="Assign driver" size="lg" (closed)="closed.emit()">
      @if (loading()) {
        <app-spinner label="Loading drivers and vehicles…" />
      } @else {
        <div class="space-y-5">
          <div>
            <p class="form-label">Driver</p>
            <div class="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              @for (d of drivers(); track d.id) {
                <button type="button" (click)="driverId.set(d.id)" [disabled]="!eligible(d)"
                  class="rounded-lg border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                  [class]="driverId() === d.id ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300'">
                  <div class="flex items-center justify-between gap-2">
                    <span class="truncate font-medium text-slate-900">{{ d.fullName }}</span>
                    <app-status-badge [status]="d.availability" />
                  </div>
                  <p class="mt-0.5 text-xs text-slate-500">{{ d.employeeCode }} · {{ d.activeAssignments }} active</p>
                  @if (d.licenseExpired) { <p class="mt-1 text-xs font-medium text-rose-600">License expired</p> }
                </button>
              } @empty {
                <p class="text-sm text-slate-500">No active drivers found.</p>
              }
            </div>
          </div>

          <div>
            <p class="form-label">Vehicle</p>
            <div class="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              @for (v of vehicles(); track v.id) {
                <button type="button" (click)="vehicleId.set(v.id)" [disabled]="!fits(v)"
                  class="rounded-lg border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                  [class]="vehicleId() === v.id ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300'">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-mono font-medium text-slate-900">{{ v.plateNumber }}</span>
                    <app-status-badge [status]="v.status" />
                  </div>
                  <p class="mt-0.5 text-xs text-slate-500">{{ v.vehicleType | labelize }} · {{ v.brand }} {{ v.model }}</p>
                  <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full" [class]="fits(v) ? 'bg-emerald-500' : 'bg-rose-500'" [style.width.%]="loadPct(v)"></div>
                  </div>
                  <p class="mt-1 text-xs text-slate-500">{{ weight() | number: '1.0-2' }} / {{ v.weightCapacityKg | number: '1.0-0' }} kg capacity</p>
                </button>
              } @empty {
                <p class="text-sm text-slate-500">No usable vehicles found.</p>
              }
            </div>
          </div>

          <div>
            <label class="form-label" for="assign-notes">Notes for the driver (optional)</label>
            <textarea id="assign-notes" rows="2" class="form-input" [(ngModel)]="notes"></textarea>
          </div>

          @if (error()) { <p class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error() }}</p> }

          <div class="flex justify-end gap-2">
            <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
            <button type="button" class="btn-primary" [disabled]="!canSubmit() || saving()" (click)="submit()">Assign</button>
          </div>
        </div>
      }
    </app-modal>
  `,
})
export class AssignDriverDialog {
  readonly open = input(false);
  readonly shipment = input<Shipment | null>(null);
  readonly saved = output<Assignment>();
  readonly closed = output<void>();

  private readonly driversApi = inject(DriverService);
  private readonly vehiclesApi = inject(VehicleService);
  private readonly assignmentsApi = inject(AssignmentService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly drivers = signal<Driver[]>([]);
  protected readonly vehicles = signal<Vehicle[]>([]);
  protected readonly driverId = signal<number | null>(null);
  protected readonly vehicleId = signal<number | null>(null);
  protected notes = '';
  protected readonly weight = computed(() => this.shipment()?.totalWeight ?? 0);
  protected readonly canSubmit = computed(() => this.driverId() !== null && this.vehicleId() !== null);

  constructor() {
    effect(() => {
      if (this.open()) this.load();
    });
  }

  protected eligible(d: Driver): boolean {
    return d.status === 'ACTIVE' && !d.licenseExpired && d.availability !== 'OFF_DUTY';
  }

  protected fits(v: Vehicle): boolean {
    return (v.status === 'AVAILABLE' || v.status === 'IN_USE') && v.weightCapacityKg >= this.weight();
  }

  protected loadPct(v: Vehicle): number {
    return v.weightCapacityKg > 0 ? Math.min(100, (this.weight() / v.weightCapacityKg) * 100) : 100;
  }

  private load(): void {
    this.error.set(null);
    this.driverId.set(null);
    this.vehicleId.set(null);
    this.notes = '';
    this.loading.set(true);
    forkJoin({
      drivers: this.driversApi.list({ status: 'ACTIVE', pageSize: 100, sort: 'fullName' }),
      vehicles: this.vehiclesApi.list({ pageSize: 100, sort: 'plateNumber' }),
    }).subscribe({
      next: ({ drivers, vehicles }) => {
        // Available drivers first, then those already out on deliveries.
        const rank = (d: Driver) => (this.eligible(d) ? (d.availability === 'AVAILABLE' ? 0 : 1) : 2);
        this.drivers.set([...drivers.items].sort((a, b) => rank(a) - rank(b)));
        this.vehicles.set(vehicles.items.filter((v) => v.status !== 'RETIRED').sort((a, b) => Number(this.fits(b)) - Number(this.fits(a))));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err).message);
      },
    });
  }

  submit(): void {
    const s = this.shipment();
    if (!s || !this.canSubmit()) return;
    this.saving.set(true);
    this.error.set(null);
    this.assignmentsApi
      .create({ shipmentId: s.id, driverId: this.driverId()!, vehicleId: this.vehicleId()!, notes: this.notes.trim() || null })
      .subscribe({
        next: (a) => {
          this.saving.set(false);
          this.toast.success(`Assigned to ${a.driver.fullName}`);
          this.saved.emit(a);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(apiError(err).message);
        },
      });
  }
}
