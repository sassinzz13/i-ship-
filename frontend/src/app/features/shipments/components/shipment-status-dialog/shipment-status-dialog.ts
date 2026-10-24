import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ToastService } from '../../../../core/services/toast.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Modal } from '../../../../shared/components/modal/modal';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { Shipment, ShipmentStatus } from '../../models/shipment.model';
import { ShipmentService } from '../../services/shipment.service';

const HINTS: Partial<Record<ShipmentStatus, string>> = {
  CONFIRMED: 'Booking verified and ready for pickup.',
  PICKED_UP: 'Parcel collected from the sender.',
  IN_TRANSIT: 'Moving between hubs.',
  RETURNED: 'Parcel is being returned to the sender.',
  CANCELLED: 'Stops the shipment permanently. A reason is required.',
};

/** Manual status change, limited to the server-provided transitions. */
@Component({
  selector: 'app-shipment-status-dialog',
  imports: [ReactiveFormsModule, Modal, FieldError, StatusBadge, LabelizePipe],
  template: `
    <app-modal [open]="open()" title="Update status" (closed)="closed.emit()">
      @if (shipment(); as s) {
        <p class="text-sm text-slate-600">Current status: <app-status-badge [status]="s.currentStatus" /></p>
        @if (s.allowedTransitions.length === 0) {
          <p class="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            No manual changes are available. Delivery outcomes are recorded by the assigned driver.
          </p>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="mt-4 space-y-4" novalidate>
            <div class="grid gap-2">
              @for (t of s.allowedTransitions; track t) {
                <label class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
                  [class]="form.controls.status.value === t ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'">
                  <input type="radio" formControlName="status" [value]="t" class="mt-0.5" />
                  <span><span class="font-medium text-slate-900">{{ t | labelize }}</span>
                    <span class="block text-xs text-slate-500">{{ hint(t) }}</span></span>
                </label>
              }
            </div>
            <div>
              <label class="form-label" for="st-location">Location (optional)</label>
              <input id="st-location" class="form-input" formControlName="location" placeholder="e.g. Pasig Hub" />
            </div>
            <div>
              <label class="form-label" for="st-notes">{{ form.controls.status.value === 'CANCELLED' ? 'Cancellation reason' : 'Notes (optional)' }}</label>
              <textarea id="st-notes" rows="3" class="form-input" formControlName="notes"></textarea>
              <app-field-error [control]="form.controls.notes" [server]="errors()['notes']" />
            </div>
            @if (error()) { <p class="form-error">{{ error() }}</p> }
            <div class="flex justify-end gap-2">
              <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
              <button type="submit" [class]="form.controls.status.value === 'CANCELLED' ? 'btn-danger' : 'btn-primary'" [disabled]="saving()">
                Update status
              </button>
            </div>
          </form>
        }
      }
    </app-modal>
  `,
})
export class ShipmentStatusDialog {
  readonly open = input(false);
  readonly shipment = input<Shipment | null>(null);
  readonly saved = output<Shipment>();
  readonly closed = output<void>();

  private readonly api = inject(ShipmentService);
  private readonly toast = inject(ToastService);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly form = inject(FormBuilder).nonNullable.group({
    status: ['' as ShipmentStatus | '', Validators.required],
    notes: ['', Validators.maxLength(1000)],
    location: ['', Validators.maxLength(200)],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.error.set(null);
      this.errors.set({});
      this.form.reset({ status: this.shipment()?.allowedTransitions[0] ?? '', notes: '', location: '' });
    });
    this.form.controls.status.valueChanges.subscribe((s) => {
      const notes = this.form.controls.notes;
      notes.setValidators(s === 'CANCELLED' ? [Validators.required, Validators.maxLength(1000)] : [Validators.maxLength(1000)]);
      notes.updateValueAndValidity({ emitEvent: false });
    });
  }

  protected hint(s: ShipmentStatus): string {
    return HINTS[s] ?? '';
  }

  submit(): void {
    const s = this.shipment();
    if (!s || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api.changeStatus(s.id, v.status as ShipmentStatus, v.notes.trim() || null, v.location.trim() || null).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.toast.success(`Status updated to ${v.status.replace(/_/g, ' ').toLowerCase()}`);
        this.saved.emit(updated);
      },
      error: (err) => {
        this.saving.set(false);
        const e = apiError(err);
        this.errors.set(e.details ?? {});
        this.error.set(e.message);
      },
    });
  }
}
