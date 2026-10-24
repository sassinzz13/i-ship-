import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ToastService } from '../../../../core/services/toast.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Modal } from '../../../../shared/components/modal/modal';
import { apiError } from '../../../../shared/utilities/http';
import { Driver } from '../../models/driver.model';
import { DriverService } from '../../services/driver.service';

/** Onboards a driver: creates the DRIVER login account and profile together. */
@Component({
  selector: 'app-driver-create-dialog',
  imports: [ReactiveFormsModule, Modal, FieldError],
  template: `
    <app-modal [open]="open()" title="New driver" size="lg" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-5">
        <fieldset>
          <legend class="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Login account</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="form-label" for="d-name">Full name</label>
              <input id="d-name" class="form-input" formControlName="fullName" autocomplete="off" />
              <app-field-error [control]="form.controls.fullName" [server]="errors()['fullName']" />
            </div>
            <div>
              <label class="form-label" for="d-email">Email</label>
              <input id="d-email" type="email" class="form-input" formControlName="email" autocomplete="off" />
              <app-field-error [control]="form.controls.email" [server]="errors()['email']" />
            </div>
            <div>
              <label class="form-label" for="d-pass">Temporary password</label>
              <input id="d-pass" type="text" class="form-input font-mono" formControlName="password" autocomplete="new-password" />
              <app-field-error [control]="form.controls.password" [server]="errors()['password']" />
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend class="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Driver details</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="form-label" for="d-code">Employee code</label>
              <input id="d-code" class="form-input uppercase" formControlName="employeeCode" placeholder="DRV-0001" />
              <app-field-error [control]="form.controls.employeeCode" [server]="errors()['employeeCode']" />
            </div>
            <div>
              <label class="form-label" for="d-phone">Phone</label>
              <input id="d-phone" type="tel" class="form-input" formControlName="phone" placeholder="+63 917 000 0000" />
              <app-field-error [control]="form.controls.phone" [server]="errors()['phone']" />
            </div>
            <div>
              <label class="form-label" for="d-lic">License number</label>
              <input id="d-lic" class="form-input uppercase" formControlName="licenseNumber" />
              <app-field-error [control]="form.controls.licenseNumber" [server]="errors()['licenseNumber']" />
            </div>
            <div>
              <label class="form-label" for="d-exp">License expiry</label>
              <input id="d-exp" type="date" class="form-input" formControlName="licenseExpiry" />
              <app-field-error [control]="form.controls.licenseExpiry" [server]="errors()['licenseExpiry']" />
            </div>
            <div>
              <label class="form-label" for="d-ecn">Emergency contact <span class="font-normal text-slate-400">(optional)</span></label>
              <input id="d-ecn" class="form-input" formControlName="emergencyContactName" />
            </div>
            <div>
              <label class="form-label" for="d-ecp">Emergency phone <span class="font-normal text-slate-400">(optional)</span></label>
              <input id="d-ecp" type="tel" class="form-input" formControlName="emergencyContactPhone" />
            </div>
          </div>
        </fieldset>
        <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="saving()">Create driver</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class DriverCreateDialog {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly created = output<Driver>();

  private readonly drivers = inject(DriverService);
  private readonly toast = inject(ToastService);
  protected readonly saving = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    employeeCode: ['', [Validators.required, Validators.maxLength(30)]],
    phone: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(30)]],
    licenseNumber: ['', [Validators.required, Validators.maxLength(40)]],
    licenseExpiry: ['', Validators.required],
    emergencyContactName: [''],
    emergencyContactPhone: [''],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset();
        this.errors.set({});
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.errors.set({});
    this.drivers
      .create({
        ...v,
        employeeCode: v.employeeCode.trim().toUpperCase(),
        licenseNumber: v.licenseNumber.trim().toUpperCase(),
        emergencyContactName: v.emergencyContactName || null,
        emergencyContactPhone: v.emergencyContactPhone || null,
      })
      .subscribe({
        next: (d) => {
          this.saving.set(false);
          this.toast.success(`Driver ${d.fullName} created`);
          this.created.emit(d);
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
