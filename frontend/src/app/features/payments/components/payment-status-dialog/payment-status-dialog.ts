import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ToastService } from '../../../../core/services/toast.service';
import { Modal } from '../../../../shared/components/modal/modal';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { PesoPipe } from '../../../../shared/pipes/peso.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { Payment, PaymentRecordStatus } from '../../models/payment.model';
import { PaymentService } from '../../services/payment.service';

export type PaymentAction = Exclude<PaymentRecordStatus, 'PENDING'>;

/** Confirms marking a payment paid, failed or refunded. Non-cash payments
 *  need a reference when marked paid. */
@Component({
  selector: 'app-payment-status-dialog',
  imports: [FormsModule, Modal, LabelizePipe, PesoPipe],
  template: `
    <app-modal [open]="open()" [title]="title()" (closed)="closed.emit()">
      @if (payment(); as p) {
        <p class="text-sm text-slate-600">
          {{ p.amount | peso }} via {{ p.method | labelize }} for <span class="font-mono font-medium text-slate-800">{{ p.trackingNumber }}</span>.
        </p>
        @if (needsReference()) {
          <div class="mt-4">
            <label class="form-label" for="ps-ref">Reference number</label>
            <input id="ps-ref" class="form-input" [(ngModel)]="reference" placeholder="Transaction / receipt number" />
          </div>
        }
        @if (action() === 'REFUNDED') {
          <p class="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">The shipment's payment status will be recalculated.</p>
        }
        @if (error()) { <p class="form-error mt-3">{{ error() }}</p> }
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
          <button type="button" [class]="action() === 'PAID' ? 'btn-primary' : 'btn-danger'" [disabled]="saving() || (needsReference() && !reference.trim())"
            (click)="submit()">{{ title() }}</button>
        </div>
      }
    </app-modal>
  `,
})
export class PaymentStatusDialog {
  readonly open = input(false);
  readonly payment = input<Payment | null>(null);
  readonly action = input<PaymentAction>('PAID');
  readonly saved = output<Payment>();
  readonly closed = output<void>();

  private readonly api = inject(PaymentService);
  private readonly toast = inject(ToastService);
  protected reference = '';
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly title = computed(() => ({ PAID: 'Mark as paid', FAILED: 'Mark as failed', REFUNDED: 'Refund payment' })[this.action()]);
  protected readonly needsReference = computed(() => this.action() === 'PAID' && this.payment()?.method !== 'CASH' && !this.payment()?.reference);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.reference = this.payment()?.reference ?? '';
      this.error.set(null);
    });
  }

  submit(): void {
    const p = this.payment();
    if (!p) return;
    this.saving.set(true);
    this.api.updateStatus(p.id, this.action(), this.reference.trim() || null).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.toast.success('Payment updated');
        this.saved.emit(updated);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(apiError(err).message);
      },
    });
  }
}
