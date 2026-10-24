import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ToastService } from '../../../../core/services/toast.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Modal } from '../../../../shared/components/modal/modal';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { VEHICLE_STATUSES, VEHICLE_TYPES, Vehicle, VehicleStatus, VehicleType } from '../../models/vehicle.model';
import { VehicleService } from '../../services/vehicle.service';

/** Create or edit a vehicle. Pass `vehicle` to edit. */
@Component({
  selector: 'app-vehicle-form-dialog',
  imports: [ReactiveFormsModule, Modal, FieldError, LabelizePipe],
  template: `
    <app-modal [open]="open()" [title]="vehicle() ? 'Edit vehicle' : 'New vehicle'" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="form-label" for="v-plate">Plate number</label>
          <input id="v-plate" class="form-input font-mono uppercase" formControlName="plateNumber" placeholder="ABC 1234" (input)="upper()" />
          <app-field-error [control]="form.controls.plateNumber" [server]="errors()['plateNumber']" />
        </div>
        <div>
          <label class="form-label" for="v-type">Type</label>
          <select id="v-type" class="form-input" formControlName="vehicleType">
            @for (t of types; track t) { <option [value]="t">{{ t | labelize }}</option> }
          </select>
        </div>
        <div>
          <label class="form-label" for="v-brand">Brand</label>
          <input id="v-brand" class="form-input" formControlName="brand" placeholder="Toyota" />
          <app-field-error [control]="form.controls.brand" [server]="errors()['brand']" />
        </div>
        <div>
          <label class="form-label" for="v-model">Model</label>
          <input id="v-model" class="form-input" formControlName="model" placeholder="Hiace" />
          <app-field-error [control]="form.controls.model" [server]="errors()['model']" />
        </div>
        <div>
          <label class="form-label" for="v-year">Year <span class="font-normal text-slate-400">(optional)</span></label>
          <input id="v-year" type="number" class="form-input" formControlName="year" min="1980" max="2100" />
          <app-field-error [control]="form.controls.year" [server]="errors()['year']" />
        </div>
        <div>
          <label class="form-label" for="v-cap">Capacity (kg)</label>
          <input id="v-cap" type="number" class="form-input" formControlName="weightCapacityKg" min="1" step="0.5" />
          <app-field-error [control]="form.controls.weightCapacityKg" [server]="errors()['weightCapacityKg']" />
        </div>
        <div class="sm:col-span-2">
          <label class="form-label" for="v-status">Status</label>
          <select id="v-status" class="form-input" formControlName="status">
            @for (s of statuses; track s) { <option [value]="s">{{ s | labelize }}</option> }
          </select>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
          <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="saving()">{{ vehicle() ? 'Save changes' : 'Add vehicle' }}</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class VehicleFormDialog {
  readonly open = input(false);
  readonly vehicle = input<Vehicle | null>(null);
  readonly closed = output<void>();
  readonly saved = output<Vehicle>();

  private readonly vehicles = inject(VehicleService);
  private readonly toast = inject(ToastService);
  protected readonly types = VEHICLE_TYPES;
  protected readonly statuses = VEHICLE_STATUSES;
  protected readonly saving = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly form = inject(FormBuilder).group({
    plateNumber: ['', [Validators.required, Validators.maxLength(15)]],
    vehicleType: ['VAN' as VehicleType, Validators.required],
    brand: ['', [Validators.required, Validators.maxLength(60)]],
    model: ['', [Validators.required, Validators.maxLength(60)]],
    year: [null as number | null, [Validators.min(1980), Validators.max(2100)]],
    weightCapacityKg: [null as number | null, [Validators.required, Validators.min(1)]],
    status: ['AVAILABLE' as VehicleStatus, Validators.required],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.vehicle();
      this.errors.set({});
      this.form.reset(
        v
          ? { plateNumber: v.plateNumber, vehicleType: v.vehicleType, brand: v.brand, model: v.model, year: v.year, weightCapacityKg: v.weightCapacityKg, status: v.status }
          : { plateNumber: '', vehicleType: 'VAN', brand: '', model: '', year: null, weightCapacityKg: null, status: 'AVAILABLE' },
      );
    });
  }

  protected upper(): void {
    const c = this.form.controls.plateNumber;
    const v = (c.value ?? '').toUpperCase();
    if (v !== c.value) c.setValue(v, { emitEvent: false });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const input = {
      plateNumber: (v.plateNumber ?? '').trim().toUpperCase(),
      vehicleType: v.vehicleType!,
      brand: (v.brand ?? '').trim(),
      model: (v.model ?? '').trim(),
      year: v.year ? Number(v.year) : null,
      weightCapacityKg: Number(v.weightCapacityKg),
      status: v.status!,
    };
    const existing = this.vehicle();
    this.saving.set(true);
    (existing ? this.vehicles.update(existing.id, input) : this.vehicles.create(input)).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Vehicle updated' : `Vehicle ${saved.plateNumber} added`);
        this.saved.emit(saved);
      },
      error: (err) => {
        this.saving.set(false);
        const e = apiError(err);
        this.errors.set(e.details ?? {});
        this.toast.error(e.message);
      },
    });
  }
}
