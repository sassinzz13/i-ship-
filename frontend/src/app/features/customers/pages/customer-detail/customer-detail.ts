import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { AddressCard } from '../../../addresses/components/address-card/address-card';
import { AddressFormDialog } from '../../../addresses/components/address-form-dialog/address-form-dialog';
import { Address } from '../../../addresses/models/address.model';
import { AddressService } from '../../../addresses/services/address.service';
import { ShipmentTable } from '../../../shipments/components/shipment-table/shipment-table';
import { ShipmentSummary } from '../../../shipments/models/shipment.model';
import { ShipmentService } from '../../../shipments/services/shipment.service';
import { CustomerFormDialog } from '../../components/customer-form-dialog/customer-form-dialog';
import { Customer } from '../../models/customer.model';
import { CustomerService } from '../../services/customer.service';

@Component({
  selector: 'app-customer-detail',
  imports: [
    RouterLink, DatePipe, Icon, Spinner, EmptyState, StatusBadge, LabelizePipe, AddressCard, AddressFormDialog,
    ConfirmDialog, CustomerFormDialog, ShipmentTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/customers" class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
      <app-icon name="arrow-left" size="sm" /> Customers
    </a>

    @if (loading()) {
      <app-spinner label="Loading customer…" />
    } @else if (error(); as err) {
      <div class="card"><app-empty-state icon="warning" title="Customer unavailable" [message]="err" /></div>
    } @else if (customer(); as c) {
      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Profile -->
        <section class="card p-5">
          <div class="flex items-start gap-4">
            <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white">{{ initials() }}</span>
            <div class="min-w-0">
              <h1 class="truncate text-xl font-semibold text-slate-900">{{ c.fullName }}</h1>
              @if (c.companyName) { <p class="truncate text-sm text-slate-600">{{ c.companyName }}</p> }
              <p class="mt-1 font-mono text-xs text-slate-500">{{ c.customerCode }}</p>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <app-status-badge [status]="c.isActive ? 'ACTIVE' : 'INACTIVE'" />
            <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{{ c.customerType | labelize }}</span>
            @if (c.hasPortalAccount) { <span class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Portal access</span> }
          </div>
          <dl class="mt-5 space-y-3 text-sm">
            <div class="flex items-center gap-2"><app-icon name="phone" size="sm" class="text-slate-400" /><a [href]="'tel:' + c.phone" class="text-slate-800 hover:text-brand-700">{{ c.phone }}</a></div>
            <div class="flex items-center gap-2"><app-icon name="bell" size="sm" class="text-slate-400" /><span class="text-slate-800">{{ c.email ?? 'No email' }}</span></div>
            <div class="flex items-center gap-2"><app-icon name="calendar" size="sm" class="text-slate-400" /><span class="text-slate-600">Customer since {{ c.createdAt | date: 'MMM y' }}</span></div>
          </dl>
          @if (c.notes) { <p class="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{{ c.notes }}</p> }
          <div class="mt-5 grid grid-cols-2 gap-2">
            <button type="button" class="btn-secondary" (click)="editOpen.set(true)"><app-icon name="pencil" size="sm" /> Edit</button>
            <a [routerLink]="['/shipments/new']" [queryParams]="{ customerId: c.id }" class="btn-primary"><app-icon name="plus" size="sm" /> Shipment</a>
          </div>
        </section>

        <!-- Address book -->
        <section class="card lg:col-span-2">
          <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 class="font-semibold text-slate-900">Address book</h2>
            <button type="button" class="btn-secondary !py-1.5" (click)="openAddress(null)"><app-icon name="plus" size="sm" /> Add address</button>
          </header>
          <div class="p-5">
            @if (addressesLoading()) {
              <div class="grid gap-3 sm:grid-cols-2"><div class="h-28 animate-pulse rounded-lg bg-slate-100"></div><div class="h-28 animate-pulse rounded-lg bg-slate-100"></div></div>
            } @else {
              <div class="grid gap-3 sm:grid-cols-2">
                @for (a of addresses(); track a.id) {
                  <div class="flex flex-col justify-between rounded-xl border p-4" [class]="a.isDefault ? 'border-brand-200 bg-brand-50/40' : 'border-slate-200'">
                    <app-address-card [address]="a" />
                    <div class="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
                      <button type="button" class="btn-ghost !px-2 !py-1 text-xs" (click)="openAddress(a)"><app-icon name="pencil" size="sm" /> Edit</button>
                      @if (!a.isDefault) {
                        <button type="button" class="btn-ghost !px-2 !py-1 text-xs" (click)="makeDefault(a)">Set default</button>
                      }
                      <button type="button" class="btn-ghost !px-2 !py-1 text-xs text-rose-600" (click)="archiveTarget.set(a)"><app-icon name="trash" size="sm" /> Archive</button>
                    </div>
                  </div>
                } @empty {
                  <p class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 sm:col-span-2">No addresses yet. Add a pickup or delivery address.</p>
                }
              </div>
            }
          </div>
        </section>

        <!-- Shipments -->
        <section class="card overflow-hidden lg:col-span-3">
          <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 class="font-semibold text-slate-900">Recent shipments</h2>
            <a [routerLink]="['/shipments']" [queryParams]="{ customerId: c.id }" class="text-sm font-medium text-brand-700 hover:underline">View all</a>
          </header>
          @if (shipmentsLoading()) {
            <app-spinner />
          } @else if (shipments().length === 0) {
            <app-empty-state icon="cube" title="No shipments yet" message="Shipments booked for this customer appear here." />
          } @else {
            <app-shipment-table [items]="shipments()" [showCustomer]="false" />
          }
        </section>
      </div>

      <app-customer-form-dialog [open]="editOpen()" [customer]="c" (closed)="editOpen.set(false)" (saved)="customerSaved($event)" />
      <app-address-form-dialog [open]="addressOpen()" [customerId]="c.id" [address]="editingAddress()"
        [defaults]="{ contactName: c.fullName, contactPhone: c.phone }" (closed)="addressOpen.set(false)" (saved)="addressSaved()" />
      <app-confirm-dialog [open]="archiveTarget() !== null" title="Archive address?" [danger]="true" confirmLabel="Archive"
        message="Archived addresses can no longer be used for new shipments. Existing shipments keep their address." [busy]="archiving()"
        (cancelled)="archiveTarget.set(null)" (confirmed)="archive()" />
    }
  `,
})
export class CustomerDetail {
  readonly id = input.required<string>();

  private readonly api = inject(CustomerService);
  private readonly addressApi = inject(AddressService);
  private readonly shipmentApi = inject(ShipmentService);
  private readonly toast = inject(ToastService);

  protected readonly customer = signal<Customer | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly addresses = signal<Address[]>([]);
  protected readonly addressesLoading = signal(false);
  protected readonly shipments = signal<ShipmentSummary[]>([]);
  protected readonly shipmentsLoading = signal(false);
  protected readonly editOpen = signal(false);
  protected readonly addressOpen = signal(false);
  protected readonly editingAddress = signal<Address | null>(null);
  protected readonly archiveTarget = signal<Address | null>(null);
  protected readonly archiving = signal(false);
  protected readonly initials = computed(() =>
    (this.customer()?.fullName ?? '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
  );

  constructor() {
    effect(() => {
      const id = Number(this.id());
      if (id) this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get(id).subscribe({
      next: (c) => {
        this.customer.set(c);
        this.loading.set(false);
        this.loadAddresses();
        this.loadShipments();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err).message);
      },
    });
  }

  private loadAddresses(): void {
    const c = this.customer();
    if (!c) return;
    this.addressesLoading.set(true);
    this.addressApi.listForCustomer(c.id).subscribe({
      next: (list) => {
        this.addresses.set(list);
        this.addressesLoading.set(false);
      },
      error: () => this.addressesLoading.set(false),
    });
  }

  private loadShipments(): void {
    const c = this.customer();
    if (!c) return;
    this.shipmentsLoading.set(true);
    this.shipmentApi.list({ customerId: c.id, pageSize: 5, sort: '-createdAt' }).subscribe({
      next: (p) => {
        this.shipments.set(p.items);
        this.shipmentsLoading.set(false);
      },
      error: () => this.shipmentsLoading.set(false),
    });
  }

  protected openAddress(a: Address | null): void {
    this.editingAddress.set(a);
    this.addressOpen.set(true);
  }

  protected addressSaved(): void {
    this.addressOpen.set(false);
    this.loadAddresses();
  }

  protected makeDefault(a: Address): void {
    const { id, customerId, archivedAt, createdAt, updatedAt, ...rest } = a;
    void customerId; void archivedAt; void createdAt; void updatedAt;
    this.addressApi.update(id, { ...rest, isDefault: true }).subscribe({
      next: () => {
        this.toast.success('Default address updated');
        this.loadAddresses();
      },
      error: (err) => this.toast.error(apiError(err).message),
    });
  }

  protected archive(): void {
    const a = this.archiveTarget();
    if (!a) return;
    this.archiving.set(true);
    this.addressApi.archive(a.id).subscribe({
      next: () => {
        this.archiving.set(false);
        this.archiveTarget.set(null);
        this.toast.success('Address archived');
        this.loadAddresses();
      },
      error: (err) => {
        this.archiving.set(false);
        this.toast.error(apiError(err).message);
      },
    });
  }

  protected customerSaved(c: Customer): void {
    this.editOpen.set(false);
    this.customer.set(c);
  }
}
