import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ToastService } from '../../../../core/services/toast.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Icon } from '../../../../shared/components/icon/icon';
import { Modal } from '../../../../shared/components/modal/modal';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { PesoPipe } from '../../../../shared/pipes/peso.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { ShipmentSummary } from '../../../shipments/models/shipment.model';
import { ShipmentService } from '../../../shipments/services/shipment.service';
import { PAYMENT_METHODS, Payment, PaymentMethod } from '../../models/payment.model';
import { PaymentService } from '../../services/payment.service';

/** Shipment the payment is for. Passed in from the shipment page or looked
 *  up by tracking number on the payments page. */
export interface PaymentTarget {
  id: number;
  trackingNumber: string;
  shippingFee: number;
  customerName?: string;
}

@Component({
  selector: 'app-record-payment-dialog',
  imports: [ReactiveFormsModule, Modal, FieldError, Icon, StatusBadge, LabelizePipe, PesoPipe],
  template: `
    <app-modal [open]="open()" title="Record payment" (closed)="closed.emit()">
      @if (!target()) {
        <div>
          <label class="form-label" for="pay-lookup">Shipment tracking number</label>
          <div class="flex gap-2">
            <input id="pay-lookup" class="form-input font-mono uppercase" placeholder="ISH-20261024-000001" [value]="lookupTerm()"
              (input)="lookupTerm.set($any($event.target).value)" (keydown.enter)="$event.preventDefault(); lookup()" />
            <button type="button" class="btn-secondary" (click)="lookup()" [disabled]="looking()"><app-icon name="search" size="sm" /></button>
          </div>
          @if (lookupError()) { <p class="form-error">{{ lookupError() }}</p> }
          <ul class="mt-3 space-y-2">
            @for (s of lookupResults(); track s.id) {
              <li>
                <button type="button" class="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-left text-sm hover:border-brand-300"
                  (click)="choose(s)">
                  <span class="min-w-0">
                    <span class="block font-mono font-medium text-brand-700">{{ s.trackingNumber }}</span>
                    <span class="block truncate text-xs text-slate-500">{{ s.customerName }} → {{ s.recipientName }}</span>
                  </span>
                  <span class="text-right">
                    <span class="block font-medium">{{ s.shippingFee | peso }}</span>
                    <app-status-badge [status]="s.paymentStatus" />
                  </span>
                </button>
              </li>
            }
          </ul>
        </div>
      } @else {
        @let t = target()!;
        <div class="mb-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span><span class="font-mono font-medium text-slate-900">{{ t.trackingNumber }}</span>
            @if (t.customerName) { <span class="block text-xs text-slate-500">{{ t.customerName }}</span> }</span>
          <span class="text-right text-xs text-slate-500">Shipping fee<span class="block text-sm font-semibold text-slate-900">{{ t.shippingFee | peso }}</span></span>
        </div>
        @if (!fixedTarget()) {
          <button type="button" class="btn-ghost mb-3 !px-0 text-xs" (click)="target.set(null)">← Choose another shipment</button>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-4 sm:grid-cols-2" novalidate>
          <div>
            <label class="form-label" for="pay-amount">Amount (₱)</label>
            <input id="pay-amount" type="number" min="0.01" step="0.01" class="form-input" formControlName="amount" />
            <app-field-error [control]="form.controls.amount" [server]="errors()['amount']" />
          </div>
          <div>
            <label class="form-label" for="pay-status">Status</label>
            <select id="pay-status" class="form-input" formControlName="status">
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <p class="form-label">Method</p>
            <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
              @for (m of methods; track m) {
                <button type="button" class="rounded-lg border px-2 py-2 text-xs font-medium"
                  [class]="form.controls.method.value === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'"
                  (click)="setMethod(m)">{{ m | labelize }}</button>
              }
            </div>
          </div>
          <div class="sm:col-span-2">
            <label class="form-label" for="pay-ref">Reference {{ referenceRequired() ? '' : '(optional)' }}</label>
            <input id="pay-ref" class="form-input" formControlName="reference" placeholder="Transaction / receipt number" />
            <app-field-error [control]="form.controls.reference" [server]="errors()['reference']" />
          </div>
          <div class="sm:col-span-2">
            <label class="form-label" for="pay-notes">Notes (optional)</label>
            <input id="pay-notes" class="form-input" formControlName="notes" />
          </div>
          @if (error()) { <p class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{{ error() }}</p> }
          <div class="flex justify-end gap-2 sm:col-span-2">
            <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
            <button type="submit" class="btn-primary" [disabled]="saving()">Record payment</button>
          </div>
        </form>
      }
    </app-modal>
  `,
})
export class RecordPaymentDialog {
  readonly open = input(false);
  /** Preselected shipment; when null the dialog starts with a lookup. */
  readonly shipment = input<PaymentTarget | null>(null);
  /** Amount still owed, used as the default amount. */
  readonly balance = input<number | null>(null);
  readonly saved = output<Payment>();
  readonly closed = output<void>();

  private readonly payments = inject(PaymentService);
  private readonly shipments = inject(ShipmentService);
  private readonly toast = inject(ToastService);
  protected readonly methods = PAYMENT_METHODS;
  protected readonly target = signal<PaymentTarget | null>(null);
  protected readonly fixedTarget = signal(false);
  protected readonly lookupTerm = signal('');
  protected readonly lookupResults = signal<ShipmentSummary[]>([]);
  protected readonly lookupError = signal<string | null>(null);
  protected readonly looking = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly form = inject(FormBuilder).nonNullable.group({
    amount: this.fbNumber(),
    method: 'CASH' as PaymentMethod,
    status: 'PAID' as 'PAID' | 'PENDING',
    reference: ['', Validators.maxLength(100)],
    notes: ['', Validators.maxLength(500)],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const preset = this.shipment();
      this.target.set(preset);
      this.fixedTarget.set(!!preset);
      this.lookupTerm.set('');
      this.lookupResults.set([]);
      this.lookupError.set(null);
      this.error.set(null);
      this.errors.set({});
      this.form.reset({ amount: this.balance() ?? preset?.shippingFee ?? null, method: 'CASH', status: 'PAID', reference: '', notes: '' });
      this.updateReferenceRule();
    });
    this.form.controls.status.valueChanges.subscribe(() => this.updateReferenceRule());
  }

  protected referenceRequired(): boolean {
    const v = this.form.getRawValue();
    return v.status === 'PAID' && v.method !== 'CASH';
  }

  protected setMethod(m: PaymentMethod): void {
    this.form.controls.method.setValue(m);
    this.updateReferenceRule();
  }

  protected lookup(): void {
    const term = this.lookupTerm().trim();
    if (!term) return;
    this.looking.set(true);
    this.lookupError.set(null);
    this.shipments.list({ search: term, pageSize: 5 }).subscribe({
      next: (p) => {
        this.looking.set(false);
        this.lookupResults.set(p.items);
        if (p.items.length === 0) this.lookupError.set('No shipment matches that tracking number.');
      },
      error: (err) => {
        this.looking.set(false);
        this.lookupError.set(apiError(err).message);
      },
    });
  }

  protected choose(s: ShipmentSummary): void {
    this.target.set({ id: s.id, trackingNumber: s.trackingNumber, shippingFee: s.shippingFee, customerName: s.customerName });
    this.form.controls.amount.setValue(s.shippingFee);
  }

  submit(): void {
    const t = this.target();
    if (!t || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.payments
      .create({
        shipmentId: t.id, amount: Number(v.amount), method: v.method, status: v.status,
        reference: v.reference.trim() || null, notes: v.notes.trim() || null,
      })
      .subscribe({
        next: (p) => {
          this.saving.set(false);
          this.toast.success('Payment recorded');
          this.saved.emit(p);
        },
        error: (err) => {
          this.saving.set(false);
          const e = apiError(err);
          this.errors.set(e.details ?? {});
          this.error.set(e.message);
        },
      });
  }

  private updateReferenceRule(): void {
    const ref = this.form.controls.reference;
    ref.setValidators(this.referenceRequired() ? [Validators.required, Validators.maxLength(100)] : [Validators.maxLength(100)]);
    ref.updateValueAndValidity({ emitEvent: false });
  }

  private fbNumber() {
    return inject(FormBuilder).control<number | null>(null, [Validators.required, Validators.min(0.01)]);
  }
}
