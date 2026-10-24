import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { PesoPipe } from '../../../../shared/pipes/peso.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { ShipmentTable } from '../../../shipments/components/shipment-table/shipment-table';
import { ShipmentsChart } from '../../components/shipments-chart/shipments-chart';
import { StatusBreakdown } from '../../components/status-breakdown/status-breakdown';
import { DashboardSummary } from '../../models/dashboard.model';
import { DashboardService } from '../../services/dashboard.service';

interface Card {
  label: string;
  value: number;
  icon: string;
  tone: string;
  link: string;
  query?: Record<string, string>;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, DatePipe, PageHeader, StatCard, Icon, EmptyState, PesoPipe, ShipmentsChart, StatusBreakdown, ShipmentTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="greeting()" [subtitle]="(today | date: 'EEEE, MMMM d, y') + ' · Operations overview'">
      <button type="button" class="btn-secondary" (click)="load()" [disabled]="loading()"><app-icon name="refresh" size="sm" /> Refresh</button>
      @if (canCreate()) {
        <a routerLink="/shipments/new" class="btn-primary"><app-icon name="plus" size="sm" /> New shipment</a>
      }
    </app-page-header>

    @if (error(); as err) {
      <div class="card"><app-empty-state icon="warning" title="Dashboard unavailable" [message]="err">
        <button type="button" class="btn-secondary" (click)="load()"><app-icon name="refresh" size="sm" /> Retry</button>
      </app-empty-state></div>
    } @else if (!data()) {
      <!-- Skeleton -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (i of skeleton; track i) { <div class="card h-[84px] animate-pulse bg-slate-100/60"></div> }
      </div>
      <div class="mt-6 grid gap-6 lg:grid-cols-3">
        <div class="card h-80 animate-pulse bg-slate-100/60 lg:col-span-2"></div>
        <div class="card h-80 animate-pulse bg-slate-100/60"></div>
      </div>
    } @else {
      @let d = data()!;
      <!-- Highlights -->
      <div class="mb-6 grid gap-4 md:grid-cols-3">
        <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-sm">
          <app-icon name="check-circle" size="lg" class="absolute top-4 right-4 text-white/30" />
          <p class="text-sm text-brand-100">Delivered today</p>
          <p class="mt-1 text-4xl font-bold tabular-nums">{{ d.deliveredToday }}</p>
          <p class="mt-2 text-xs text-brand-100">{{ d.shipments.outForDelivery }} still out for delivery</p>
        </div>
        <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-sm">
          <app-icon name="banknotes" size="lg" class="absolute top-4 right-4 text-white/30" />
          <p class="text-sm text-emerald-100">Revenue today</p>
          <p class="mt-1 text-4xl font-bold tabular-nums">{{ d.revenueToday | peso }}</p>
          <p class="mt-2 text-xs text-emerald-100">Payments marked paid today</p>
        </div>
        <a routerLink="/assignments" [queryParams]="{ status: 'ASSIGNED' }" class="relative overflow-hidden rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm transition hover:border-amber-300">
          <app-icon name="clipboard" size="lg" class="absolute top-4 right-4 text-amber-300" />
          <p class="text-sm text-amber-800">Needs dispatch</p>
          <p class="mt-1 text-4xl font-bold text-amber-900 tabular-nums">{{ d.unassignedShipments }}</p>
          <p class="mt-2 text-xs text-amber-700">Shipments without a driver · {{ d.pendingAssignments }} awaiting driver acceptance</p>
        </a>
      </div>

      <!-- KPI cards -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        @for (c of cards(); track c.label) {
          <app-stat-card [label]="c.label" [value]="c.value" [icon]="c.icon" [toneClass]="c.tone" [link]="c.link" [query]="c.query ?? null" />
        }
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-3">
        <section class="card p-5 lg:col-span-2">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-slate-900">Last 7 days</h2>
            <span class="text-xs text-slate-500">{{ weekCreated() }} created · {{ weekDelivered() }} delivered</span>
          </div>
          <div class="mt-4"><app-shipments-chart [data]="d.shipmentsByDay" /></div>
        </section>
        <section class="card p-5">
          <h2 class="font-semibold text-slate-900">Shipments by status</h2>
          <p class="mt-1 text-xs text-slate-500">{{ d.shipments.total }} shipments in total</p>
          <div class="mt-4"><app-status-breakdown [counts]="d.shipments" /></div>
        </section>
      </div>

      <section class="card mt-6 overflow-hidden">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 class="font-semibold text-slate-900">Recent shipments</h2>
          <a routerLink="/shipments" class="text-sm font-medium text-brand-700 hover:underline">View all</a>
        </header>
        @if (d.recentShipments.length) {
          <app-shipment-table [items]="d.recentShipments" />
        } @else {
          <app-empty-state icon="cube" title="No shipments yet" message="New shipments will show up here." />
        }
      </section>
    }
  `,
})
export class DashboardPage implements OnInit {
  private readonly api = inject(DashboardService);
  private readonly auth = inject(AuthService);
  protected readonly today = new Date();
  protected readonly skeleton = [1, 2, 3, 4, 5, 6, 7, 8];
  protected readonly data = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canCreate = computed(() => this.auth.hasRole('ADMIN', 'DISPATCHER', 'STAFF'));
  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const first = this.auth.user()?.fullName.split(' ')[0];
    return first ? `${part}, ${first}` : part;
  });

  protected readonly cards = computed<Card[]>(() => {
    const d = this.data();
    if (!d) return [];
    const s = d.shipments;
    const isDispatch = this.auth.hasRole('ADMIN', 'DISPATCHER');
    const cards: Card[] = [
      { label: 'Total shipments', value: s.total, icon: 'cube', tone: 'bg-brand-50 text-brand-600', link: '/shipments' },
      { label: 'Pending', value: s.pending, icon: 'clock', tone: 'bg-slate-100 text-slate-600', link: '/shipments', query: { status: 'PENDING' } },
      { label: 'In transit', value: s.inTransit, icon: 'truck', tone: 'bg-violet-50 text-violet-600', link: '/shipments', query: { status: 'IN_TRANSIT' } },
      { label: 'Out for delivery', value: s.outForDelivery, icon: 'map-pin', tone: 'bg-amber-50 text-amber-600', link: '/shipments', query: { status: 'OUT_FOR_DELIVERY' } },
      { label: 'Delivered', value: s.delivered, icon: 'check-circle', tone: 'bg-emerald-50 text-emerald-600', link: '/shipments', query: { status: 'DELIVERED' } },
      { label: 'Failed deliveries', value: s.failedDelivery, icon: 'warning', tone: 'bg-rose-50 text-rose-600', link: '/shipments', query: { status: 'FAILED_DELIVERY' } },
      { label: 'Returned', value: s.returned, icon: 'arrow-left', tone: 'bg-cyan-50 text-cyan-600', link: '/shipments', query: { status: 'RETURNED' } },
      { label: 'Active drivers', value: d.activeDrivers, icon: 'id', tone: 'bg-indigo-50 text-indigo-600', link: isDispatch ? '/drivers' : '/dashboard', query: isDispatch ? { status: 'ACTIVE' } : undefined },
      { label: 'Available vehicles', value: d.availableVehicles, icon: 'truck', tone: 'bg-teal-50 text-teal-600', link: isDispatch ? '/vehicles' : '/dashboard', query: isDispatch ? { status: 'AVAILABLE' } : undefined },
      { label: 'Pending assignments', value: d.pendingAssignments, icon: 'clipboard', tone: 'bg-orange-50 text-orange-600', link: isDispatch ? '/assignments' : '/dashboard', query: isDispatch ? { status: 'ASSIGNED' } : undefined },
    ];
    return cards;
  });

  protected readonly weekCreated = computed(() => (this.data()?.shipmentsByDay ?? []).reduce((t, d) => t + d.created, 0));
  protected readonly weekDelivered = computed(() => (this.data()?.shipmentsByDay ?? []).reduce((t, d) => t + d.delivered, 0));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.summary().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err).message);
      },
    });
  }
}
