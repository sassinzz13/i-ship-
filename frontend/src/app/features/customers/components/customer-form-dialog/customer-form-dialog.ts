import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ToastService } from '../../../../core/services/toast.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Modal } from '../../../../shared/components/modal/modal';
import { apiError } from '../../../../shared/utilities/http';
import { Customer, CustomerInput, CustomerType } from '../../models/customer.model';
import { CustomerService } from '../../services/customer.service';

/** Create or edit a customer, optionally with a portal login. */
@Component({
  selector: 'app-customer-form-dialog',
  imports: [ReactiveFormsModule, Modal, FieldError],
  template: `
    <app-modal [open]="open()" [title]="customer() ? 'Edit customer' : 'New customer'" size="lg" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-5">
        <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Customer type">
          @for (t of types; track t.value) {
            <button type="button" role="radio" [attr.aria-checked]="form.controls.customerType.value === t.value"
              (click)="form.controls.customerType.setValue(t.value)"
              class="rounded-lg border p-3 text-left text-sm"
              [class]="form.controls.customerType.value === t.value ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300'">
              <span class="font-medium text-slate-900">{{ t.label }}</span><span class="block text-xs text-slate-500">{{ t.hint }}</span>
            </button>
          }
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div [class.sm:col-span-2]="form.controls.customerType.value !== 'BUSINESS'">
            <label class="form-label" for="c-name">{{ form.controls.customerType.value === 'BUSINESS' ? 'Contact person' : 'Full name' }}</label>
            <input id="c-name" class="form-input" formControlName="fullName" autocomplete="name" />
            <app-field-error [control]="form.controls.fullName" [server]="errors()['fullName']" />
          </div>
          @if (form.controls.customerType.value === 'BUSINESS') {
            <div>
              <label class="form-label" for="c-company">Company name</label>
              <input id="c-company" class="form-input" formControlName="companyName" autocomplete="organization" />
              <app-field-error [control]="form.controls.companyName" [server]="errors()['companyName']" />
            </div>
          }
          <div>
            <label class="form-label" for="c-phone">Mobile number</label>
            <input id="c-phone" class="form-input" formControlName="phone" inputmode="tel" placeholder="+63 917 123 4567" autocomplete="tel" />
            <app-field-error [control]="form.controls.phone" [server]="errors()['phone']" />
          </div>
          <div>
            <label class="form-label" for="c-email">Email (optional)</label>
            <input id="c-email" type="email" class="form-input" formControlName="email" autocomplete="email" />
            <app-field-error [control]="form.controls.email" [server]="errors()['email']" />
          </div>
          <div class="sm:col-span-2">
            <label class="form-label" for="c-notes">Notes (optional)</label>
            <textarea id="c-notes" rows="2" class="form-input" formControlName="notes"></textarea>
          </div>
          @if (customer()) {
            <label class="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" formControlName="isActive" class="h-4 w-4 rounded border-slate-300" /> Active customer
            </label>
          }
        </div>

        @if (!customer()) {
          <div class="rounded-xl border border-slate-200 p-4">
            <label class="flex items-start gap-3">
              <input type="checkbox" formControlName="createPortal" class="mt-1 h-4 w-4 rounded border-slate-300" />
              <span><span class="text-sm font-medium text-slate-900">Create portal login</span>
                <span class="block text-xs text-slate-500">Lets the customer sign in to view and track their own shipments.</span></span>
            </label>
            @if (form.controls.createPortal.value) {
              <div class="mt-4 grid gap-4 sm:grid-cols-2" formGroupName="portal">
                <div>
                  <label class="form-label" for="p-email">Login email</label>
                  <input id="p-email" type="email" class="form-input" formControlName="email" autocomplete="off" />
                  <app-field-error [control]="form.controls.portal.controls.email" [server]="errors()['portalAccount.email'] ?? errors()['email']" />
                </div>
                <div>
                  <label class="form-label" for="p-password">Temporary password</label>
                  <input id="p-password" type="text" class="form-input font-mono" formControlName="password" autocomplete="new-password" />
                  <app-field-error [control]="form.controls.portal.controls.password" [server]="errors()['portalAccount.password'] ?? errors()['password']" />
                </div>
              </div>
            }
          </div>
        }

        @if (error()) { <p class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error() }}</p> }
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="saving()">{{ customer() ? 'Save changes' : 'Create customer' }}</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class CustomerFormDialog {
  readonly open = input(false);
  readonly customer = input<Customer | null>(null);
  readonly saved = output<Customer>();
  readonly closed = output<void>();

  private readonly api = inject(CustomerService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly types: { value: CustomerType; label: string; hint: string }[] = [
    { value: 'INDIVIDUAL', label: 'Individual', hint: 'A person sending parcels' },
    { value: 'BUSINESS', label: 'Business', hint: 'A shop or company account' },
  ];
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly form = this.fb.nonNullable.group({
    customerType: this.fb.nonNullable.control<CustomerType>('INDIVIDUAL'),
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
    companyName: ['', Validators.maxLength(160)],
    phone: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(30)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    notes: ['', Validators.maxLength(1000)],
    isActive: true,
    createPortal: false,
    portal: this.fb.nonNullable.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const c = this.customer();
      this.error.set(null);
      this.errors.set({});
      this.form.reset({
        customerType: c?.customerType ?? 'INDIVIDUAL', fullName: c?.fullName ?? '', companyName: c?.companyName ?? '',
        phone: c?.phone ?? '', email: c?.email ?? '', notes: c?.notes ?? '', isActive: c?.isActive ?? true,
        createPortal: false, portal: { email: '', password: '' },
      });
      this.syncPortal(false);
    });
    this.form.controls.createPortal.valueChanges.subscribe((on) => this.syncPortal(on));
    this.form.controls.customerType.valueChanges.subscribe((t) => {
      const company = this.form.controls.companyName;
      company.setValidators(t === 'BUSINESS' ? [Validators.required, Validators.maxLength(160)] : [Validators.maxLength(160)]);
      company.updateValueAndValidity({ emitEvent: false });
    });
  }

  private syncPortal(on: boolean): void {
    const portal = this.form.controls.portal;
    if (on) {
      portal.enable({ emitEvent: false });
      if (!portal.controls.email.value) portal.controls.email.setValue(this.form.controls.email.value);
    } else {
      portal.disable({ emitEvent: false });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const input: CustomerInput = {
      customerType: v.customerType,
      fullName: v.fullName.trim(),
      companyName: v.customerType === 'BUSINESS' ? v.companyName.trim() || null : null,
      phone: v.phone.trim(),
      email: v.email.trim() || null,
      notes: v.notes.trim() || null,
    };
    const c = this.customer();
    if (c) input.isActive = v.isActive;
    else if (v.createPortal) input.portalAccount = { email: v.portal.email.trim(), password: v.portal.password };

    this.saving.set(true);
    this.error.set(null);
    (c ? this.api.update(c.id, input) : this.api.create(input)).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success(c ? 'Customer updated' : `Customer ${saved.customerCode} created`);
        this.saved.emit(saved);
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
