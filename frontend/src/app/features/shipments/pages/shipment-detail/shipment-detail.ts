import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { Timeline, TimelineEntry } from '../../../../shared/components/timeline/timeline';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { PesoPipe } from '../../../../shared/pipes/peso.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { AddressCard } from '../../../addresses/components/address-card/address-card';
import { Assignment } from '../../../assignments/models/assignment.model';
import { AssignmentService } from '../../../assignments/services/assignment.service';
import { DeliveryRecord } from '../../../deliveries/models/delivery.model';
import { DeliveryService } from '../../../deliveries/services/delivery.service';
import { PaymentTarget, RecordPaymentDialog } from '../../../payments/components/record-payment-dialog/record-payment-dialog';
import { Payment } from '../../../payments/models/payment.model';
import { PaymentService } from '../../../payments/services/payment.service';
import { AssignDriverDialog } from '../../components/assign-driver-dialog/assign-driver-dialog';
import { ShipmentAssignmentPanel } from '../../components/shipment-assignment-panel/shipment-assignment-panel';
import { ShipmentDeliveryPanel } from '../../components/shipment-delivery-panel/shipment-delivery-panel';
import { ShipmentPaymentsPanel } from '../../components/shipment-payments-panel/shipment-payments-panel';
import { ShipmentStatusDialog } from '../../components/shipment-status-dialog/shipment-status-dialog';
import { Shipment, StatusHistory } from '../../models/shipment.model';
import { ShipmentService } from '../../services/shipment.service';

@Component({
  selector: 'app-shipment-detail',
  imports: [
    RouterLink, DatePipe, DecimalPipe, Icon, Spinner, EmptyState, StatusBadge, Timeline, LabelizePipe, PesoPipe, AddressCard,
    ConfirmDialog, ShipmentAssignmentPanel, ShipmentDeliveryPanel, ShipmentPaymentsPanel, ShipmentStatusDialog,
    AssignDriverDialog, RecordPaymentDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/shipments" class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
      <app-icon name="arrow-left" size="sm" /> {{ isCustomer() ? 'My shipments' : 'Shipments' }}
    </a>

    @if (loading()) {
      <app-spinner label="Loading shipment…" />
    } @else if (error(); as err) {
      <div class="card"><app-empty-state icon="warning" title="Shipment unavailable" [message]="err">
        <button type="button" class="btn-secondary" (click)="load()">Retry</button>
      </app-empty-state></div>
    } @else if (shipment(); as s) {
      <!-- Header -->
      <div class="card mb-6 p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="font-mono text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{{ s.trackingNumber }}</h1>
              <button type="button" class="btn-ghost !p-1.5" (click)="copy(s.trackingNumber)" aria-label="Copy tracking number">
                <app-icon [name]="copied() ? 'check' : 'document'" size="sm" />
              </button>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <app-status-badge [status]="s.currentStatus" />
              <app-status-badge [status]="s.paymentStatus" />
              <span>{{ s.serviceType | labelize }}</span>
              <span aria-hidden="true">·</span>
              <span>Created {{ s.createdAt | date: 'MMM d, y · h:mm a' }}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <a [routerLink]="['/track', s.trackingNumber]" target="_blank" class="btn-secondary"><app-icon name="map-pin" size="sm" /> Public tracking</a>
            @if (isOps()) {
              @if (editable()) {
                <a [routerLink]="['/shipments', s.id, 'edit']" class="btn-secondary"><app-icon name="pencil" size="sm" /> Edit</a>
              }
              @if (canDispatch() && !hasActiveAssignment() && assignable()) {
                <button type="button" class="btn-secondary" (click)="assignOpen.set(true)"><app-icon name="truck" size="sm" /> Assign driver</button>
              }
              <button type="button" class="btn-primary" (click)="statusOpen.set(true)" [disabled]="s.allowedTransitions.length === 0">
                <app-icon name="refresh" size="sm" /> Update status
              </button>
            }
          </div>
        </div>
        @if (s.currentStatus === 'CANCELLED' && s.cancellationReason) {
          <p class="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600"><span class="font-medium">Cancelled:</span> {{ s.cancellationReason }}</p>
        }
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <!-- Key facts -->
          <section class="card grid grid-cols-2 divide-slate-100 sm:grid-cols-4 sm:divide-x">
            <div class="p-4"><p class="text-xs text-slate-500">Pieces</p><p class="mt-1 text-lg font-semibold">{{ s.totalQuantity }}</p></div>
            <div class="p-4"><p class="text-xs text-slate-500">Weight</p><p class="mt-1 text-lg font-semibold">{{ s.totalWeight | number: '1.0-2' }} kg</p></div>
            <div class="p-4"><p class="text-xs text-slate-500">Shipping fee</p><p class="mt-1 text-lg font-semibold">{{ s.shippingFee | peso }}</p></div>
            <div class="p-4"><p class="text-xs text-slate-500">{{ s.actualDeliveryAt ? 'Delivered' : 'ETA' }}</p>
              <p class="mt-1 text-lg font-semibold">{{ (s.actualDeliveryAt ?? s.estimatedDeliveryAt) ? ((s.actualDeliveryAt ?? s.estimatedDeliveryAt) | date: 'MMM d') : '—' }}</p></div>
          </section>

          <!-- Parties -->
          <section class="card grid gap-0 sm:grid-cols-2 sm:divide-x sm:divide-slate-100">
            <div class="p-5">
              <h2 class="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase"><span class="h-2 w-2 rounded-full bg-brand-500"></span> Sender</h2>
              <app-address-card [address]="s.sender" [showLabel]="false" />
            </div>
            <div class="border-t border-slate-100 p-5 sm:border-t-0">
              <h2 class="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase"><span class="h-2 w-2 rounded-full bg-emerald-500"></span> Recipient</h2>
              <app-address-card [address]="s.recipient" [showLabel]="false" />
            </div>
            <div class="border-t border-slate-100 px-5 py-3 text-sm sm:col-span-2">
              <span class="text-slate-500">Customer:</span>
              @if (isOps()) {
                <a [routerLink]="['/customers', s.customer.id]" class="font-medium text-brand-700 hover:underline">{{ s.customer.fullName }}</a>
              } @else { <span class="font-medium">{{ s.customer.fullName }}</span> }
              <span class="text-slate-400"> · {{ s.customer.customerCode }}</span>
            </div>
          </section>

          <!-- Items -->
          <section class="card overflow-hidden">
            <header class="border-b border-slate-100 px-5 py-3"><h2 class="font-semibold text-slate-900">Package contents</h2></header>
            <div class="overflow-x-auto">
              <table class="table-base">
                <thead><tr><th>Description</th><th class="text-right">Qty</th><th class="text-right">Weight</th><th>Dimensions</th><th class="text-right">Value</th></tr></thead>
                <tbody class="divide-y divide-slate-100">
                  @for (i of s.items; track i.id) {
                    <tr>
                      <td class="font-medium text-slate-800">{{ i.description }}</td>
                      <td class="text-right">{{ i.quantity }}</td>
                      <td class="text-right">{{ i.weightKg | number: '1.0-2' }} kg</td>
                      <td class="text-slate-500">{{ dims(i) }}</td>
                      <td class="text-right">{{ i.declaredValue | peso }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot class="bg-slate-50 text-sm font-medium">
                  <tr><td class="px-4 py-2">Total</td><td class="px-4 py-2 text-right">{{ s.totalQuantity }}</td>
                    <td class="px-4 py-2 text-right">{{ s.totalWeight | number: '1.0-2' }} kg</td><td></td>
                    <td class="px-4 py-2 text-right">{{ s.declaredValue | peso }}</td></tr>
                </tfoot>
              </table>
            </div>
            @if (s.specialInstructions) {
              <div class="flex gap-2 border-t border-slate-100 bg-amber-50/60 px-5 py-3 text-sm text-amber-900">
                <app-icon name="info" size="sm" class="mt-0.5" /> {{ s.specialInstructions }}
              </div>
            }
          </section>

          <app-shipment-delivery-panel [shipmentId]="s.id" [record]="delivery()" [loading]="deliveryLoading()" />
        </div>

        <div class="space-y-6">
          <app-shipment-assignment-panel [assignments]="assignments()" [loading]="assignmentsLoading()" [canAssign]="canDispatch() && assignable()"
            (assign)="assignOpen.set(true)" (cancel)="cancelTarget.set($event)" />

          <app-shipment-payments-panel [payments]="payments()" [fee]="s.shippingFee" [paymentStatus]="s.paymentStatus"
            [loading]="paymentsLoading()" [canRecord]="isOps()" (record)="openPayment($event)" />

          <section class="card">
            <header class="border-b border-slate-100 px-5 py-3"><h2 class="font-semibold text-slate-900">Status history</h2></header>
            <div class="p-5">
              @if (historyLoading()) { <div class="h-24 animate-pulse rounded-lg bg-slate-100"></div> }
              @else { <app-timeline [entries]="timeline()" /> }
            </div>
          </section>
        </div>
      </div>

      <app-shipment-status-dialog [open]="statusOpen()" [shipment]="s" (closed)="statusOpen.set(false)" (saved)="statusSaved($event)" />
      <app-assign-driver-dialog [open]="assignOpen()" [shipment]="s" (closed)="assignOpen.set(false)" (saved)="assigned()" />
      <app-record-payment-dialog [open]="paymentOpen()" [shipment]="paymentTarget()" [balance]="paymentBalance()"
        (closed)="paymentOpen.set(false)" (saved)="paymentSaved()" />
      <app-confirm-dialog [open]="cancelTarget() !== null" title="Cancel assignment?" [danger]="true" confirmLabel="Cancel assignment"
        [message]="'The driver will no longer see this delivery. You can assign another driver afterwards.'" [busy]="cancelling()"
        (cancelled)="cancelTarget.set(null)" (confirmed)="cancelAssignment()" />
    }
  `,
})
export class ShipmentDetail {
  readonly id = input.required<string>();

  private readonly api = inject(ShipmentService);
  private readonly assignmentsApi = inject(AssignmentService);
  private readonly deliveriesApi = inject(DeliveryService);
  private readonly paymentsApi = inject(PaymentService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly shipment = signal<Shipment | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly history = signal<StatusHistory[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly assignments = signal<Assignment[]>([]);
  protected readonly assignmentsLoading = signal(false);
  protected readonly delivery = signal<DeliveryRecord | null>(null);
  protected readonly deliveryLoading = signal(false);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly paymentsLoading = signal(false);

  protected readonly statusOpen = signal(false);
  protected readonly assignOpen = signal(false);
  protected readonly paymentOpen = signal(false);
  protected readonly paymentBalance = signal<number | null>(null);
  protected readonly cancelTarget = signal<Assignment | null>(null);
  protected readonly cancelling = signal(false);
  protected readonly copied = signal(false);

  protected readonly isCustomer = computed(() => this.auth.hasRole('CUSTOMER'));
  protected readonly isOps = computed(() => this.auth.hasRole('ADMIN', 'DISPATCHER', 'STAFF'));
  protected readonly canDispatch = computed(() => this.auth.hasRole('ADMIN', 'DISPATCHER'));
  protected readonly editable = computed(() => ['PENDING', 'CONFIRMED'].includes(this.shipment()?.currentStatus ?? ''));
  protected readonly assignable = computed(() =>
    ['CONFIRMED', 'PICKED_UP', 'IN_TRANSIT', 'FAILED_DELIVERY'].includes(this.shipment()?.currentStatus ?? ''),
  );
  protected readonly hasActiveAssignment = computed(() =>
    this.assignments().some((a) => ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(a.status)),
  );
  protected readonly paymentTarget = computed<PaymentTarget | null>(() => {
    const s = this.shipment();
    return s ? { id: s.id, trackingNumber: s.trackingNumber, shippingFee: s.shippingFee, customerName: s.customerName } : null;
  });
  protected readonly timeline = computed<TimelineEntry[]>(() =>
    [...this.history()].reverse().map((h) => ({
      status: h.toStatus, at: h.createdAt, notes: h.notes, location: h.location, actor: this.isOps() ? h.changedBy?.fullName : null,
    })),
  );

  constructor() {
    effect(() => {
      if (this.id()) this.load();
    });
  }

  load(): void {
    const id = Number(this.id());
    this.loading.set(true);
    this.error.set(null);
    this.api.get(id).subscribe({
      next: (s) => {
        this.shipment.set(s);
        this.loading.set(false);
        this.loadRelated(id);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err).message);
      },
    });
  }

  private loadRelated(id: number): void {
    this.loadHistory(id);
    this.loadDelivery(id);
    if (this.canDispatch()) this.loadAssignments(id);
    if (this.isOps()) this.loadPayments(id);
  }

  private loadHistory(id: number): void {
    this.historyLoading.set(true);
    this.api.history(id).pipe(catchError(() => of([] as StatusHistory[]))).subscribe((h) => {
      this.history.set(h);
      this.historyLoading.set(false);
    });
  }

  private loadAssignments(id: number): void {
    this.assignmentsLoading.set(true);
    this.assignmentsApi.list({ shipmentId: id, pageSize: 20, sort: '-assignedAt' }).pipe(catchError(() => of(null))).subscribe((p) => {
      this.assignments.set(p?.items ?? []);
      this.assignmentsLoading.set(false);
    });
  }

  private loadDelivery(id: number): void {
    this.deliveryLoading.set(true);
    this.deliveriesApi.forShipment(id).pipe(catchError(() => of(null))).subscribe((d) => {
      this.delivery.set(d);
      this.deliveryLoading.set(false);
    });
  }

  private loadPayments(id: number): void {
    this.paymentsLoading.set(true);
    this.paymentsApi.list({ shipmentId: id, pageSize: 50 }).pipe(catchError(() => of(null))).subscribe((p) => {
      this.payments.set(p?.items ?? []);
      this.paymentsLoading.set(false);
    });
  }

  /** Re-reads the shipment without the full-page spinner. */
  private refresh(): void {
    const id = Number(this.id());
    this.api.get(id).subscribe((s) => this.shipment.set(s));
    this.loadRelated(id);
  }

  protected statusSaved(s: Shipment): void {
    this.statusOpen.set(false);
    this.shipment.set(s);
    this.refresh();
  }

  protected assigned(): void {
    this.assignOpen.set(false);
    this.refresh();
  }

  protected openPayment(balance: number): void {
    this.paymentBalance.set(balance > 0 ? balance : null);
    this.paymentOpen.set(true);
  }

  protected paymentSaved(): void {
    this.paymentOpen.set(false);
    this.refresh();
  }

  protected cancelAssignment(): void {
    const a = this.cancelTarget();
    if (!a) return;
    this.cancelling.set(true);
    this.assignmentsApi.cancel(a.id, 'Cancelled by dispatcher').subscribe({
      next: () => {
        this.cancelling.set(false);
        this.cancelTarget.set(null);
        this.toast.success('Assignment cancelled');
        this.refresh();
      },
      error: (err) => {
        this.cancelling.set(false);
        this.toast.error(apiError(err).message);
      },
    });
  }

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    });
  }

  protected dims(i: { lengthCm: number | null; widthCm: number | null; heightCm: number | null }): string {
    return i.lengthCm && i.widthCm && i.heightCm ? `${i.lengthCm} × ${i.widthCm} × ${i.heightCm} cm` : '—';
  }
}
