import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ToastService } from '../../../../core/services/toast.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Modal } from '../../../../shared/components/modal/modal';
import { apiError } from '../../../../shared/utilities/http';
import { Address, AddressInput } from '../../models/address.model';
import { AddressService } from '../../services/address.service';

const LABELS = ['Home', 'Office', 'Warehouse', 'Store', 'Other'];

/** Create or edit an address in a customer's address book. */
@Component({
  selector: 'app-address-form-dialog',
  imports: [ReactiveFormsModule, Modal, FieldError],
  template: `
    <app-modal [open]="open()" [title]="address() ? 'Edit address' : 'Add address'" size="lg" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="form-label" for="addr-label">Label</label>
          <select id="addr-label" class="form-input" formControlName="label">
            @for (l of labels; track l) { <option [value]="l">{{ l }}</option> }
          </select>
        </div>
        <div class="flex items-end">
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" formControlName="isDefault" class="h-4 w-4 rounded border-slate-300 text-brand-600" /> Default address
          </label>
        </div>
        <div>
          <label class="form-label" for="addr-name">Contact name</label>
          <input id="addr-name" class="form-input" formControlName="contactName" autocomplete="name" />
          <app-field-error [control]="form.controls.contactName" [server]="errors()['contactName']" />
        </div>
        <div>
          <label class="form-label" for="addr-phone">Contact phone</label>
          <input id="addr-phone" class="form-input" formControlName="contactPhone" inputmode="tel" autocomplete="tel" />
          <app-field-error [control]="form.controls.contactPhone" [server]="errors()['contactPhone']" />
        </div>
        <div class="sm:col-span-2">
          <label class="form-label" for="addr-line1">Street address</label>
          <input id="addr-line1" class="form-input" formControlName="line1" placeholder="House/unit no., street" autocomplete="address-line1" />
          <app-field-error [control]="form.controls.line1" [server]="errors()['line1']" />
        </div>
        <div class="sm:col-span-2">
          <label class="form-label" for="addr-line2">Building, subdivision (optional)</label>
          <input id="addr-line2" class="form-input" formControlName="line2" autocomplete="address-line2" />
        </div>
        <div>
          <label class="form-label" for="addr-brgy">Barangay</label>
          <input id="addr-brgy" class="form-input" formControlName="barangay" />
        </div>
        <div>
          <label class="form-label" for="addr-city">City / municipality</label>
          <input id="addr-city" class="form-input" formControlName="city" autocomplete="address-level2" />
          <app-field-error [control]="form.controls.city" [server]="errors()['city']" />
        </div>
        <div>
          <label class="form-label" for="addr-prov">Province / region</label>
          <input id="addr-prov" class="form-input" formControlName="province" autocomplete="address-level1" />
          <app-field-error [control]="form.controls.province" [server]="errors()['province']" />
        </div>
        <div>
          <label class="form-label" for="addr-zip">Postal code</label>
          <input id="addr-zip" class="form-input" formControlName="postalCode" inputmode="numeric" autocomplete="postal-code" />
        </div>
        <div class="flex justify-end gap-2 pt-2 sm:col-span-2">
          <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="saving()">{{ address() ? 'Save changes' : 'Add address' }}</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class AddressFormDialog {
  readonly open = input(false);
  readonly customerId = input.required<number>();
  readonly address = input<Address | null>(null);
  /** Prefill for new addresses (e.g. the customer's name and phone). */
  readonly defaults = input<Partial<AddressInput> | null>(null);
  readonly saved = output<Address>();
  readonly closed = output<void>();

  private readonly api = inject(AddressService);
  private readonly toast = inject(ToastService);
  protected readonly labels = LABELS;
  protected readonly saving = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly form = inject(FormBuilder).nonNullable.group({
    label: 'Home',
    isDefault: false,
    contactName: ['', [Validators.required, Validators.maxLength(120)]],
    contactPhone: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(30)]],
    line1: ['', [Validators.required, Validators.maxLength(200)]],
    line2: '',
    barangay: '',
    city: ['', [Validators.required, Validators.maxLength(100)]],
    province: ['', [Validators.required, Validators.maxLength(100)]],
    postalCode: '',
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const a = this.address();
      const d = this.defaults() ?? {};
      this.errors.set({});
      this.form.reset({
        label: a?.label ?? d.label ?? 'Home',
        isDefault: a?.isDefault ?? false,
        contactName: a?.contactName ?? d.contactName ?? '',
        contactPhone: a?.contactPhone ?? d.contactPhone ?? '',
        line1: a?.line1 ?? '',
        line2: a?.line2 ?? '',
        barangay: a?.barangay ?? '',
        city: a?.city ?? d.city ?? '',
        province: a?.province ?? d.province ?? '',
        postalCode: a?.postalCode ?? '',
      });
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const input: AddressInput = {
      ...v,
      line2: v.line2 || null,
      barangay: v.barangay || null,
      postalCode: v.postalCode || null,
      country: 'PH',
    };
    const a = this.address();
    this.saving.set(true);
    const req = a ? this.api.update(a.id, input) : this.api.create(this.customerId(), input);
    req.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success(a ? 'Address updated' : 'Address added');
        this.saved.emit(saved);
      },
      error: (err) => {
        this.saving.set(false);
        const e = apiError(err);
        this.errors.set(e.details ?? {});
        if (!e.details) this.toast.error(e.message);
      },
    });
  }
}
