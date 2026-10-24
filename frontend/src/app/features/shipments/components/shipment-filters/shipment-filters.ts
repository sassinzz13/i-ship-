import { ChangeDetectionStrategy, Component, OnDestroy, effect, input, output, signal } from '@angular/core';

import { Icon } from '../../../../shared/components/icon/icon';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { PAYMENT_STATUSES, SERVICE_TYPES, SHIPMENT_STATUSES } from '../../models/shipment.model';
import { ShipmentListQuery, hasFilters } from '../../state/shipment-list.store';

/** Search and filter bar for the shipment list. Emits partial query
 *  changes; the page writes them to the URL. */
@Component({
  selector: 'app-shipment-filters',
  imports: [Icon, LabelizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div class="relative flex-1">
          <app-icon name="search" size="sm" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input type="search" class="form-input pl-9" [placeholder]="searchPlaceholder()" [value]="searchText()"
            (input)="onSearch($any($event.target).value)" aria-label="Search shipments" />
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn-secondary lg:hidden" (click)="expanded.set(!expanded())" [attr.aria-expanded]="expanded()">
            <app-icon name="filter" size="sm" /> Filters
            @if (activeCount() > 0) { <span class="rounded-full bg-brand-600 px-1.5 text-[11px] text-white">{{ activeCount() }}</span> }
          </button>
          @if (filtered()) {
            <button type="button" class="btn-ghost" (click)="cleared.emit()">Clear</button>
          }
        </div>
      </div>

      <div class="mt-3 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid lg:grid-cols-5" [class.grid]="expanded()" [class.hidden]="!expanded()">
        <label class="block">
          <span class="form-label text-xs">Status</span>
          <select class="form-input" [value]="query().status" (change)="changed.emit({ status: $any($event.target).value })">
            <option value="">All statuses</option>
            @for (s of statuses; track s) { <option [value]="s">{{ s | labelize }}</option> }
          </select>
        </label>
        <label class="block">
          <span class="form-label text-xs">Service</span>
          <select class="form-input" [value]="query().serviceType" (change)="changed.emit({ serviceType: $any($event.target).value })">
            <option value="">All services</option>
            @for (s of services; track s) { <option [value]="s">{{ s | labelize }}</option> }
          </select>
        </label>
        <label class="block">
          <span class="form-label text-xs">Payment</span>
          <select class="form-input" [value]="query().paymentStatus" (change)="changed.emit({ paymentStatus: $any($event.target).value })">
            <option value="">Any payment</option>
            @for (s of payments; track s) { <option [value]="s">{{ s | labelize }}</option> }
          </select>
        </label>
        <label class="block">
          <span class="form-label text-xs">Created from</span>
          <input type="date" class="form-input" [value]="query().dateFrom" [max]="query().dateTo || null"
            (change)="changed.emit({ dateFrom: $any($event.target).value })" />
        </label>
        <label class="block">
          <span class="form-label text-xs">Created to</span>
          <input type="date" class="form-input" [value]="query().dateTo" [min]="query().dateFrom || null"
            (change)="changed.emit({ dateTo: $any($event.target).value })" />
        </label>
      </div>
    </div>
  `,
  host: { class: 'block' },
})
export class ShipmentFilters implements OnDestroy {
  readonly query = input.required<ShipmentListQuery>();
  readonly searchPlaceholder = input('Search tracking number, customer or recipient…');
  readonly changed = output<Partial<ShipmentListQuery>>();
  readonly cleared = output<void>();

  protected readonly statuses = SHIPMENT_STATUSES;
  protected readonly services = SERVICE_TYPES;
  protected readonly payments = PAYMENT_STATUSES;
  protected readonly searchText = signal('');
  protected readonly expanded = signal(typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Keep the box in sync when the URL changes (back button, links).
    effect(() => this.searchText.set(this.query().search));
  }

  protected filtered(): boolean {
    return hasFilters(this.query());
  }

  protected activeCount(): number {
    const q = this.query();
    return [q.status, q.serviceType, q.paymentStatus, q.dateFrom, q.dateTo].filter(Boolean).length;
  }

  protected onSearch(value: string): void {
    this.searchText.set(value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.changed.emit({ search: value.trim() }), 350);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
