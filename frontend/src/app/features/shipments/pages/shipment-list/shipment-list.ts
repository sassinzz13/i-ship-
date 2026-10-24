import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { ShipmentFilters } from '../../components/shipment-filters/shipment-filters';
import { ShipmentTable } from '../../components/shipment-table/shipment-table';
import { ShipmentListQuery, ShipmentListStore, hasFilters, queryFromParams, queryToParams } from '../../state/shipment-list.store';

@Component({
  selector: 'app-shipment-list',
  imports: [RouterLink, PageHeader, Pagination, Spinner, EmptyState, Icon, ShipmentFilters, ShipmentTable],
  providers: [ShipmentListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="isCustomer() ? 'My shipments' : 'Shipments'"
      [subtitle]="isCustomer() ? 'Track every parcel you have sent with us' : 'Create, search and manage every shipment'">
      @if (canCreate()) {
        <a routerLink="/shipments/new" class="btn-primary"><app-icon name="plus" size="sm" /> New shipment</a>
      }
    </app-page-header>

    <app-shipment-filters [query]="store.query()" (changed)="update($event)" (cleared)="clear()"
      [searchPlaceholder]="isCustomer() ? 'Search tracking number or recipient…' : 'Search tracking number, customer or recipient…'" />

    <div class="card mt-4 overflow-hidden">
      @if (store.error(); as err) {
        <app-empty-state icon="warning" title="Could not load shipments" [message]="err">
          <button type="button" class="btn-secondary" (click)="store.reload()"><app-icon name="refresh" size="sm" /> Retry</button>
        </app-empty-state>
      } @else if (store.loading() && store.items().length === 0) {
        <app-spinner label="Loading shipments…" />
      } @else if (store.items().length === 0) {
        @if (filtered()) {
          <app-empty-state icon="search" title="No matching shipments" message="Try a different search or clear the filters.">
            <button type="button" class="btn-secondary" (click)="clear()">Clear filters</button>
          </app-empty-state>
        } @else {
          <app-empty-state icon="cube" title="No shipments yet"
            [message]="isCustomer() ? 'Shipments booked for you will appear here.' : 'Create the first shipment to get started.'">
            @if (canCreate()) { <a routerLink="/shipments/new" class="btn-primary"><app-icon name="plus" size="sm" /> New shipment</a> }
          </app-empty-state>
        }
      } @else {
        <div class="relative" [class.opacity-60]="store.loading()">
          <app-shipment-table [items]="store.items()" [sort]="store.query().sort" [showCustomer]="!isCustomer()" (sortChange)="update({ sort: $event })" />
        </div>
        <app-pagination [meta]="store.meta()" (pageChange)="go({ page: $event })" (pageSizeChange)="update({ pageSize: $event })" />
      }
    </div>
  `,
})
export class ShipmentList {
  protected readonly store = inject(ShipmentListStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly isCustomer = computed(() => this.auth.hasRole('CUSTOMER'));
  protected readonly canCreate = computed(() => this.auth.hasRole('ADMIN', 'DISPATCHER', 'STAFF'));
  protected readonly filtered = computed(() => hasFilters(this.store.query()));

  constructor() {
    // The URL is the source of truth for the query.
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((p) => this.store.load(queryFromParams(p)));
  }

  /** Applies a filter change and resets to the first page. */
  protected update(patch: Partial<ShipmentListQuery>): void {
    this.go({ ...patch, page: 1 });
  }

  protected go(patch: Partial<ShipmentListQuery>): void {
    const next = { ...this.store.query(), ...patch };
    void this.router.navigate([], { relativeTo: this.route, queryParams: queryToParams(next) });
  }

  protected clear(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }
}
