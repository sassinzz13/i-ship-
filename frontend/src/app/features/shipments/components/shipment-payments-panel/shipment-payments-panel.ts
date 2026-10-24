import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icon } from '../../../../shared/components/icon/icon';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { PesoPipe } from '../../../../shared/pipes/peso.pipe';
import { Payment } from '../../../payments/models/payment.model';

@Component({
  selector: 'app-shipment-payments-panel',
  imports: [DatePipe, Icon, StatusBadge, LabelizePipe, PesoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 class="font-semibold text-slate-900">Payment</h2>
        <app-status-badge [status]="paymentStatus()" />
      </header>
      <div class="p-5">
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="rounded-lg bg-slate-50 p-2"><p class="text-[11px] text-slate-500 uppercase">Fee</p><p class="font-semibold text-slate-900">{{ fee() | peso }}</p></div>
          <div class="rounded-lg bg-emerald-50 p-2"><p class="text-[11px] text-emerald-700 uppercase">Paid</p><p class="font-semibold text-emerald-800">{{ paid() | peso }}</p></div>
          <div class="rounded-lg p-2" [class]="balance() > 0 ? 'bg-amber-50' : 'bg-slate-50'">
            <p class="text-[11px] uppercase" [class]="balance() > 0 ? 'text-amber-700' : 'text-slate-500'">Balance</p>
            <p class="font-semibold" [class]="balance() > 0 ? 'text-amber-800' : 'text-slate-900'">{{ balance() | peso }}</p>
          </div>
        </div>
        @if (loading()) {
          <div class="mt-4 h-12 animate-pulse rounded-lg bg-slate-100"></div>
        } @else {
          <ul class="mt-4 divide-y divide-slate-100">
            @for (p of payments(); track p.id) {
              <li class="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p class="font-medium text-slate-800">{{ p.amount | peso }} · {{ p.method | labelize }}</p>
                  <p class="text-xs text-slate-500">{{ (p.paidAt ?? p.createdAt) | date: 'MMM d, y' }} @if (p.reference) { · Ref {{ p.reference }} }</p>
                </div>
                <app-status-badge [status]="p.status" />
              </li>
            } @empty {
              <li class="py-2 text-sm text-slate-500">No payments recorded.</li>
            }
          </ul>
        }
        @if (canRecord()) {
          <button type="button" class="btn-secondary mt-3 w-full" (click)="record.emit(balance())"><app-icon name="banknotes" size="sm" /> Record payment</button>
        }
      </div>
    </section>
  `,
})
export class ShipmentPaymentsPanel {
  readonly payments = input<Payment[]>([]);
  readonly fee = input(0);
  readonly paymentStatus = input('UNPAID');
  readonly loading = input(false);
  readonly canRecord = input(false);
  readonly record = output<number>();

  protected readonly paid = computed(() =>
    this.payments().reduce((sum, p) => sum + (p.status === 'PAID' ? p.amount : 0), 0),
  );
  protected readonly balance = computed(() => Math.max(0, Math.round((this.fee() - this.paid()) * 100) / 100));
}
