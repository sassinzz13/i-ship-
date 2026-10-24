import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { ToastService } from '../../../../core/services/toast.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Icon } from '../../../../shared/components/icon/icon';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { PesoPipe } from '../../../../shared/pipes/peso.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { AddressFormDialog } from '../../../addresses/components/address-form-dialog/address-form-dialog';
import { AddressPicker } from '../../../addresses/components/address-picker/address-picker';
import { Address } from '../../../addresses/models/address.model';
import { AddressService } from '../../../addresses/services/address.service';
import { CustomerPicker } from '../../../customers/components/customer-picker/customer-picker';
import { Customer } from '../../../customers/models/customer.model';
import { CustomerService } from '../../../customers/services/customer.service';
import { ItemsEditor } from '../../components/items-editor/items-editor';
import { SERVICE_TYPES, ServiceType, Shipment, ShipmentInput } from '../../models/shipment.model';
import { ShipmentService } from '../../services/shipment.service';
import { ItemForm, RATE_CARD, estimateFee, fromLocalInput, itemTotals, newItemForm, toLocalInput } from '../../utilities/shipment-form.utils';

type AddressTarget = 'sender' | 'recipient';

/** Create (/shipments/new) and edit (/shipments/:id/edit). Default change
 *  detection because the template reads reactive-form state. */
@Component({
  selector: 'app-shipment-form',
  imports: [
    ReactiveFormsModule, RouterLink, DecimalPipe, PageHeader, Spinner, FieldError, Icon, PesoPipe,
    CustomerPicker, AddressPicker, AddressFormDialog, ItemsEditor,
  ],
  template: `
    <app-page-header [title]="isEdit() ? 'Edit shipment' : 'New shipment'"
      [subtitle]="isEdit() ? original()?.trackingNumber : 'Book a parcel for pickup and delivery'">
      <a [routerLink]="isEdit() ? ['/shipments', id()] : ['/shipments']" class="btn-secondary"><app-icon name="arrow-left" size="sm" /> Back</a>
    </app-page-header>

    @if (loading()) {
      <app-spinner label="Loading shipment…" />
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <!-- 1. Customer -->
          <section class="card p-5">
            <h2 class="flex items-center gap-2 font-semibold text-slate-900"><span class="step">1</span> Customer</h2>
            <p class="mt-1 mb-4 text-sm text-slate-500">Who is sending this shipment?</p>
            <app-customer-picker [selected]="customer()" [locked]="isEdit()" [invalid]="submitted() && !customer()"
              (selectedChange)="selectCustomer($event)" />
            @if (submitted() && !customer()) { <p class="form-error">Select a customer</p> }
          </section>

          <!-- 2. Addresses -->
          <section class="card p-5" [class.opacity-50]="!customer()">
            <h2 class="flex items-center gap-2 font-semibold text-slate-900"><span class="step">2</span> Pickup &amp; delivery</h2>
            <p class="mt-1 mb-4 text-sm text-slate-500">Choose from the customer's address book or add a new address.</p>
            @if (!customer()) {
              <p class="text-sm text-slate-500">Select a customer first.</p>
            } @else if (addressesLoading()) {
              <app-spinner label="Loading addresses…" />
            } @else {
              <div class="grid gap-6 md:grid-cols-2">
                <div>
                  <p class="form-label">Sender (pickup)</p>
                  <app-address-picker label="Sender address" [addresses]="addresses()" [selectedId]="form.controls.senderAddressId.value"
                    [disabledId]="form.controls.recipientAddressId.value" (selected)="form.controls.senderAddressId.setValue($event)"
                    (add)="openAddress('sender')" />
                  <app-field-error [control]="form.controls.senderAddressId" [server]="errors()['senderAddressId']" />
                </div>
                <div>
                  <p class="form-label">Recipient (delivery)</p>
                  <app-address-picker label="Recipient address" [addresses]="addresses()" [selectedId]="form.controls.recipientAddressId.value"
                    [disabledId]="form.controls.senderAddressId.value" (selected)="form.controls.recipientAddressId.setValue($event)"
                    (add)="openAddress('recipient')" />
                  <app-field-error [control]="form.controls.recipientAddressId" [server]="errors()['recipientAddressId']" />
                </div>
              </div>
            }
          </section>

          <!-- 3. Package -->
          <section class="card p-5">
            <h2 class="flex items-center gap-2 font-semibold text-slate-900"><span class="step">3</span> Service &amp; package</h2>
            <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4" role="radiogroup" aria-label="Service type">
              @for (s of services; track s) {
                <button type="button" role="radio" [attr.aria-checked]="form.controls.serviceType.value === s"
                  (click)="form.controls.serviceType.setValue(s)"
                  class="rounded-xl border p-3 text-left transition"
                  [class]="form.controls.serviceType.value === s ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300'">
                  <p class="text-sm font-semibold text-slate-900">{{ rates[s].label }}</p>
                  <p class="text-xs text-slate-500">{{ rates[s].eta }}</p>
                  <p class="mt-2 text-xs text-slate-600">from {{ rates[s].base | peso }}</p>
                </button>
              }
            </div>
            <div class="mt-6">
              <app-items-editor [items]="form.controls.items" [errors]="errors()" (add)="addItem()" (remove)="removeItem($event)" />
            </div>
          </section>

          <!-- 4. Schedule -->
          <section class="card p-5">
            <h2 class="flex items-center gap-2 font-semibold text-slate-900"><span class="step">4</span> Schedule &amp; notes</h2>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label class="form-label" for="pickup">Scheduled pickup</label>
                <input id="pickup" type="datetime-local" class="form-input" formControlName="scheduledPickupAt" />
              </div>
              <div>
                <label class="form-label" for="eta">Estimated delivery</label>
                <input id="eta" type="datetime-local" class="form-input" formControlName="estimatedDeliveryAt" />
                <app-field-error [server]="errors()['estimatedDeliveryAt']" />
              </div>
              <div class="sm:col-span-2">
                <label class="form-label" for="notes">Special instructions</label>
                <textarea id="notes" rows="3" class="form-input" formControlName="specialInstructions"
                  placeholder="Fragile, call before arrival, leave with guard…"></textarea>
                <app-field-error [control]="form.controls.specialInstructions" />
              </div>
            </div>
          </section>
        </div>

        <!-- Summary -->
        <aside class="lg:col-span-1">
          <div class="card sticky top-20 p-5">
            <h2 class="font-semibold text-slate-900">Summary</h2>
            <dl class="mt-4 space-y-2 text-sm">
              <div class="flex justify-between"><dt class="text-slate-500">Service</dt><dd class="font-medium">{{ rates[form.controls.serviceType.value].label }}</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">Pieces</dt><dd class="font-medium">{{ totals.quantity }}</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">Total weight</dt><dd class="font-medium">{{ totals.weight | number: '1.0-2' }} kg</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">Declared value</dt><dd class="font-medium">{{ totals.declaredValue | peso }}</dd></div>
            </dl>
            <div class="mt-4 border-t border-slate-200 pt-4">
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">Shipping fee</span>
                @if (quoting()) { <span class="text-xs text-slate-400">Calculating…</span> }
              </div>
              @if (form.controls.overrideFee.value) {
                <input type="number" min="0" step="0.01" class="form-input mt-2" formControlName="shippingFee" aria-label="Shipping fee" />
                <app-field-error [control]="form.controls.shippingFee" [server]="errors()['shippingFee']" />
              } @else {
                <p class="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{{ quote() | peso }}</p>
                @if (quoteIsEstimate()) { <p class="text-xs text-slate-400">Estimated from the rate card</p> }
              }
              <label class="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" formControlName="overrideFee" class="h-4 w-4 rounded border-slate-300" (change)="onOverrideToggle()" /> Set fee manually
              </label>
            </div>
            @if (formError()) {
              <div class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ formError() }}</div>
            }
            <button type="submit" class="btn-primary btn-lg mt-5 w-full" [disabled]="saving()">
              @if (saving()) { <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> }
              {{ isEdit() ? 'Save changes' : 'Create shipment' }}
            </button>
          </div>
        </aside>
      </form>
    }

    @if (customer(); as c) {
      <app-address-form-dialog [open]="addressTarget() !== null" [customerId]="c.id"
        [defaults]="addressTarget() === 'sender' ? { contactName: c.fullName, contactPhone: c.phone } : null"
        (saved)="addressSaved($event)" (closed)="addressTarget.set(null)" />
    }
  `,
  styles: `
    .step { display: inline-flex; height: 1.5rem; width: 1.5rem; align-items: center; justify-content: center; border-radius: 9999px;
      background: var(--color-brand-100); color: var(--color-brand-700); font-size: 0.75rem; font-weight: 700; }
  `,
})
export class ShipmentForm implements OnInit {
  /** Route params (component input binding). */
  readonly id = input<string>();
  readonly customerId = input<string>();

  private readonly fb = inject(FormBuilder);
  private readonly shipments = inject(ShipmentService);
  private readonly customersApi = inject(CustomerService);
  private readonly addressesApi = inject(AddressService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly services = SERVICE_TYPES;
  protected readonly rates = RATE_CARD;
  protected readonly isEdit = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly original = signal<Shipment | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly addresses = signal<Address[]>([]);
  protected readonly addressesLoading = signal(false);
  protected readonly addressTarget = signal<AddressTarget | null>(null);
  protected readonly quote = signal<number>(0);
  protected readonly quoteIsEstimate = signal(false);
  protected readonly quoting = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    serviceType: this.fb.nonNullable.control<ServiceType>('STANDARD'),
    senderAddressId: this.fb.control<number | null>(null, Validators.required),
    recipientAddressId: this.fb.control<number | null>(null, Validators.required),
    overrideFee: false,
    shippingFee: this.fb.control<number | null>(null, [Validators.min(0)]),
    specialInstructions: ['', Validators.maxLength(1000)],
    scheduledPickupAt: '',
    estimatedDeliveryAt: '',
    items: this.fb.array<ItemForm>([newItemForm(this.fb)]),
  });

  protected get totals() {
    return itemTotals(this.form.controls.items.getRawValue());
  }

  ngOnInit(): void {
    this.watchQuote();
    const id = Number(this.id());
    if (id) {
      this.isEdit.set(true);
      this.loadShipment(id);
    } else if (Number(this.customerId())) {
      this.customersApi.get(Number(this.customerId())).subscribe({ next: (c) => this.selectCustomer(c) });
    }
  }

  protected selectCustomer(c: Customer | null): void {
    this.customer.set(c);
    this.form.patchValue({ senderAddressId: null, recipientAddressId: null });
    this.addresses.set([]);
    if (c) this.loadAddresses(c.id, true);
  }

  protected openAddress(target: AddressTarget): void {
    this.addressTarget.set(target);
  }

  protected addressSaved(a: Address): void {
    const target = this.addressTarget();
    this.addressTarget.set(null);
    this.addresses.update((list) => [...list.map((x) => (a.isDefault ? { ...x, isDefault: false } : x)), a]);
    if (target === 'sender') this.form.controls.senderAddressId.setValue(a.id);
    if (target === 'recipient') this.form.controls.recipientAddressId.setValue(a.id);
  }

  protected addItem(): void {
    this.form.controls.items.push(newItemForm(this.fb));
  }

  protected removeItem(i: number): void {
    this.form.controls.items.removeAt(i);
  }

  protected onOverrideToggle(): void {
    if (this.form.controls.overrideFee.value && this.form.controls.shippingFee.value == null) {
      this.form.controls.shippingFee.setValue(this.quote());
    }
  }

  submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid || !this.customer()) {
      this.form.markAllAsTouched();
      this.formError.set('Please fix the highlighted fields.');
      return;
    }
    const v = this.form.getRawValue();
    const input: ShipmentInput = {
      senderAddressId: v.senderAddressId!,
      recipientAddressId: v.recipientAddressId!,
      serviceType: v.serviceType,
      shippingFee: v.overrideFee ? v.shippingFee : null,
      specialInstructions: v.specialInstructions.trim() || null,
      scheduledPickupAt: fromLocalInput(v.scheduledPickupAt),
      estimatedDeliveryAt: fromLocalInput(v.estimatedDeliveryAt),
      items: v.items.map((i) => ({
        description: i.description.trim(),
        quantity: Number(i.quantity),
        weightKg: Number(i.weightKg),
        lengthCm: i.lengthCm || null,
        widthCm: i.widthCm || null,
        heightCm: i.heightCm || null,
        declaredValue: i.declaredValue ?? null,
      })),
    };
    if (!this.isEdit()) input.customerId = this.customer()!.id;

    this.saving.set(true);
    this.errors.set({});
    const id = Number(this.id());
    const req = this.isEdit() ? this.shipments.update(id, input) : this.shipments.create(input);
    req.subscribe({
      next: (s) => {
        this.toast.success(this.isEdit() ? 'Shipment updated' : `Shipment ${s.trackingNumber} created`);
        void this.router.navigate(['/shipments', s.id]);
      },
      error: (err) => {
        this.saving.set(false);
        const e = apiError(err);
        this.errors.set(e.details ?? {});
        this.formError.set(e.message);
      },
    });
  }

  private loadShipment(id: number): void {
    this.loading.set(true);
    this.shipments.get(id).subscribe({
      next: (s) => {
        this.original.set(s);
        this.customer.set({
          id: s.customer.id, customerCode: s.customer.customerCode, fullName: s.customer.fullName, phone: s.customer.phone,
          email: s.customer.email, userId: null, customerType: 'INDIVIDUAL', companyName: null, notes: null, isActive: true,
          hasPortalAccount: false, createdAt: '', updatedAt: '',
        });
        const items = this.form.controls.items as FormArray<ItemForm>;
        items.clear();
        s.items.forEach((i) => items.push(newItemForm(this.fb, i)));
        if (items.length === 0) items.push(newItemForm(this.fb));
        this.form.patchValue({
          serviceType: s.serviceType,
          senderAddressId: s.sender.id,
          recipientAddressId: s.recipient.id,
          overrideFee: true,
          shippingFee: s.shippingFee,
          specialInstructions: s.specialInstructions ?? '',
          scheduledPickupAt: toLocalInput(s.scheduledPickupAt),
          estimatedDeliveryAt: toLocalInput(s.estimatedDeliveryAt),
        });
        this.loadAddresses(s.customer.id, false);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(apiError(err).message);
        void this.router.navigate(['/shipments']);
      },
    });
  }

  private loadAddresses(customerId: number, preselect: boolean): void {
    this.addressesLoading.set(true);
    this.addressesApi.listForCustomer(customerId).subscribe({
      next: (list) => {
        this.addresses.set(list);
        this.addressesLoading.set(false);
        const def = list.find((a) => a.isDefault);
        if (preselect && def && this.form.controls.senderAddressId.value == null) {
          this.form.controls.senderAddressId.setValue(def.id);
        }
      },
      error: () => this.addressesLoading.set(false),
    });
  }

  /** Re-quotes whenever service type or total weight changes. */
  private watchQuote(): void {
    this.form.valueChanges
      .pipe(
        map(() => ({ service: this.form.controls.serviceType.value, weight: this.totals.weight })),
        distinctUntilChanged((a, b) => a.service === b.service && a.weight === b.weight),
        debounceTime(300),
        switchMap(({ service, weight }) => {
          this.quoting.set(true);
          if (weight <= 0) return of({ fee: estimateFee(service, 0), estimate: true });
          return this.shipments.quote(service, weight).pipe(
            map((q) => ({ fee: q.shippingFee, estimate: false })),
            catchError(() => of({ fee: estimateFee(service, weight), estimate: true })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ fee, estimate }) => {
        this.quoting.set(false);
        this.quote.set(fee);
        this.quoteIsEstimate.set(estimate);
      });
    this.quote.set(estimateFee('STANDARD', 0));
    this.quoteIsEstimate.set(true);
  }
}
