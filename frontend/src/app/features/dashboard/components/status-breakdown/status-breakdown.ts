import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DashboardSummary } from '../../models/dashboard.model';

const SEGMENTS: { key: keyof DashboardSummary['shipments']; status: string; label: string; color: string }[] = [
  { key: 'pending', status: 'PENDING', label: 'Pending', color: 'bg-slate-400' },
  { key: 'confirmed', status: 'CONFIRMED', label: 'Confirmed', color: 'bg-blue-500' },
  { key: 'pickedUp', status: 'PICKED_UP', label: 'Picked up', color: 'bg-indigo-500' },
  { key: 'inTransit', status: 'IN_TRANSIT', label: 'In transit', color: 'bg-violet-500' },
  { key: 'outForDelivery', status: 'OUT_FOR_DELIVERY', label: 'Out for delivery', color: 'bg-amber-500' },
  { key: 'delivered', status: 'DELIVERED', label: 'Delivered', color: 'bg-emerald-500' },
  { key: 'failedDelivery', status: 'FAILED_DELIVERY', label: 'Failed', color: 'bg-rose-500' },
  { key: 'returned', status: 'RETURNED', label: 'Returned', color: 'bg-cyan-500' },
  { key: 'cancelled', status: 'CANCELLED', label: 'Cancelled', color: 'bg-slate-300' },
];

/** Stacked bar of shipments by status with a clickable legend. */
@Component({
  selector: 'app-status-breakdown',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-3 overflow-hidden rounded-full bg-slate-100">
      @for (s of segments(); track s.key) {
        @if (s.value > 0) { <div [class]="s.color" [style.width.%]="s.pct" [attr.title]="s.label + ': ' + s.value"></div> }
      }
    </div>
    <ul class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      @for (s of segments(); track s.key) {
        <li>
          <a routerLink="/shipments" [queryParams]="{ status: s.status }" class="flex items-center justify-between gap-2 rounded px-1 hover:bg-slate-50">
            <span class="flex items-center gap-2 text-slate-600"><span class="h-2.5 w-2.5 rounded-full" [class]="s.color"></span>{{ s.label }}</span>
            <span class="font-medium tabular-nums text-slate-900">{{ s.value }}</span>
          </a>
        </li>
      }
    </ul>
  `,
})
export class StatusBreakdown {
  readonly counts = input.required<DashboardSummary['shipments']>();
  protected readonly segments = computed(() => {
    const c = this.counts();
    const total = Math.max(1, SEGMENTS.reduce((t, s) => t + (c[s.key] ?? 0), 0));
    return SEGMENTS.map((s) => ({ ...s, value: c[s.key] ?? 0, pct: ((c[s.key] ?? 0) / total) * 100 }));
  });
}
