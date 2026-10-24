import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../../shared/components/icon/icon';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { TrackForm } from '../../components/track-form/track-form';
import { TrackingStepper } from '../../components/tracking-stepper/tracking-stepper';
import { PublicTracking } from '../../models/tracking.model';
import { TrackingService } from '../../services/tracking.service';
import { outcomeOf, trackingSteps } from '../../utilities/tracking-progress';

const HEADLINES = {
  progress: { title: 'On its way', tone: 'from-brand-600 to-brand-800' },
  delivered: { title: 'Delivered', tone: 'from-emerald-500 to-emerald-700' },
  attention: { title: 'Delivery attempt failed', tone: 'from-amber-500 to-amber-600' },
  returned: { title: 'Returned to sender', tone: 'from-cyan-600 to-cyan-800' },
  cancelled: { title: 'Shipment cancelled', tone: 'from-slate-500 to-slate-700' },
};

@Component({
  selector: 'app-track-result',
  imports: [DatePipe, RouterLink, Icon, StatusBadge, LabelizePipe, TrackForm, TrackingStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pt-4 sm:pt-8">
      <a routerLink="/track" class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><app-icon name="arrow-left" size="sm" /> Track another parcel</a>

      @if (loading()) {
        <div class="space-y-4">
          <div class="h-44 animate-pulse rounded-2xl bg-slate-200"></div>
          <div class="h-24 animate-pulse rounded-2xl bg-slate-200"></div>
          <div class="h-64 animate-pulse rounded-2xl bg-slate-200"></div>
        </div>
      } @else if (notFound()) {
        <div class="card p-6 text-center sm:p-10">
          <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><app-icon name="search" size="lg" /></span>
          <h1 class="mt-4 text-xl font-semibold text-slate-900">We couldn't find that shipment</h1>
          <p class="mt-1 text-sm text-slate-500">Check the tracking number <span class="font-mono font-medium text-slate-700">{{ trackingNumber() }}</span> and try again.</p>
          <div class="mx-auto mt-6 max-w-md text-left"><app-track-form [initial]="trackingNumber()" /></div>
        </div>
      } @else if (error(); as err) {
        <div class="card p-6 text-center">
          <p class="font-medium text-slate-800">Tracking is temporarily unavailable</p>
          <p class="mt-1 text-sm text-slate-500">{{ err }}</p>
          <button type="button" class="btn-secondary mt-4" (click)="load()"><app-icon name="refresh" size="sm" /> Try again</button>
        </div>
      } @else if (data(); as t) {
        <!-- Hero -->
        <section class="overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white shadow-lg sm:p-8" [class]="headline().tone">
          <p class="font-mono text-sm text-white/80">{{ t.trackingNumber }}</p>
          <h1 class="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{{ headline().title }}</h1>
          <p class="mt-2 text-white/90">
            @if (t.actualDeliveryAt) {
              Delivered on {{ t.actualDeliveryAt | date: 'EEEE, MMM d · h:mm a' }}
            } @else if (t.estimatedDeliveryAt && outcome() === 'progress') {
              Estimated delivery {{ t.estimatedDeliveryAt | date: 'EEEE, MMM d' }}
            } @else if (outcome() === 'attention') {
              Our rider couldn't complete the delivery. We'll try again or contact you.
            } @else {
              Current status: {{ t.currentStatus | labelize }}
            }
          </p>
          <div class="mt-6 flex items-center gap-3 rounded-xl bg-white/10 p-4 backdrop-blur-sm">
            <div class="min-w-0 flex-1">
              <p class="text-[11px] tracking-wide text-white/70 uppercase">From</p>
              <p class="truncate font-semibold">{{ t.origin.city }}</p>
              <p class="truncate text-xs text-white/70">{{ t.origin.province }}</p>
            </div>
            <app-icon name="truck" size="lg" class="shrink-0 text-white/80" />
            <div class="min-w-0 flex-1 text-right">
              <p class="text-[11px] tracking-wide text-white/70 uppercase">To</p>
              <p class="truncate font-semibold">{{ t.destination.city }}</p>
              <p class="truncate text-xs text-white/70">{{ t.destination.province }}</p>
            </div>
          </div>
        </section>

        <!-- Stepper -->
        <section class="card mt-4 p-5 sm:p-6"><app-tracking-stepper [steps]="steps()" /></section>

        <!-- Details + timeline -->
        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <section class="card p-5">
            <h2 class="text-sm font-semibold text-slate-900">Shipment</h2>
            <dl class="mt-3 space-y-3 text-sm">
              <div><dt class="text-xs text-slate-500">Status</dt><dd class="mt-0.5"><app-status-badge [status]="t.currentStatus" /></dd></div>
              <div><dt class="text-xs text-slate-500">Service</dt><dd class="font-medium text-slate-800">{{ t.serviceType | labelize }}</dd></div>
              <div><dt class="text-xs text-slate-500">Pieces</dt><dd class="font-medium text-slate-800">{{ t.totalQuantity }}</dd></div>
              <div><dt class="text-xs text-slate-500">Booked</dt><dd class="font-medium text-slate-800">{{ t.createdAt | date: 'MMM d, y' }}</dd></div>
            </dl>
          </section>
          <section class="card p-5 sm:col-span-2">
            <h2 class="text-sm font-semibold text-slate-900">Tracking history</h2>
            <ol class="relative mt-4 ml-2 border-l border-slate-200">
              @for (e of t.timeline; track $index; let first = $first) {
                <li class="mb-5 ml-5 last:mb-0">
                  <span class="absolute -left-[6px] mt-1.5 h-3 w-3 rounded-full ring-4 ring-white" [class]="first ? 'bg-brand-600' : 'bg-slate-300'"></span>
                  <p class="text-sm font-medium" [class]="first ? 'text-slate-900' : 'text-slate-600'">{{ e.description || (e.status | labelize) }}</p>
                  <p class="text-xs text-slate-500">{{ e.at | date: 'MMM d, y · h:mm a' }} @if (e.location) { · {{ e.location }} }</p>
                </li>
              }
            </ol>
          </section>
        </div>
        <p class="mt-6 text-center text-xs text-slate-400">For privacy, names, phone numbers and street addresses are not shown on this page.</p>
      }
    </div>
  `,
})
export class TrackResult {
  readonly trackingNumber = input.required<string>();
  private readonly api = inject(TrackingService);

  protected readonly data = signal<PublicTracking | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly outcome = computed(() => outcomeOf(this.data()?.currentStatus ?? 'PENDING'));
  protected readonly headline = computed(() => HEADLINES[this.outcome()]);
  protected readonly steps = computed(() => {
    const t = this.data();
    return t ? trackingSteps(t.currentStatus, t.timeline.map((e) => e.status)) : [];
  });

  constructor() {
    effect(() => {
      if (this.trackingNumber()) this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set(null);
    this.api.track(this.trackingNumber()).subscribe({
      next: (t) => {
        this.data.set(t);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err instanceof HttpErrorResponse && (err.status === 404 || err.status === 400)) this.notFound.set(true);
        else this.error.set(apiError(err).message);
      },
    });
  }
}
