import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { VehicleType } from '../../models/vehicle.model';

/** Simple silhouette per vehicle type, tinted by status. */
@Component({
  selector: 'app-vehicle-type-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="flex items-center justify-center rounded-xl" [class]="box()">
      <svg viewBox="0 0 48 32" fill="currentColor" class="h-6 w-9" aria-hidden="true">
        @switch (type()) {
          @case ('MOTORCYCLE') {
            <circle cx="10" cy="23" r="6" fill="none" stroke="currentColor" stroke-width="3" />
            <circle cx="38" cy="23" r="6" fill="none" stroke="currentColor" stroke-width="3" />
            <path d="M10 23l9-11h8l5 6h6l-4 5H24l-4-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" />
            <path d="M27 12l3-5h5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          }
          @case ('CAR') {
            <path d="M6 20l4-8c1-2 3-3 5-3h16c2 0 4 1 5 3l4 8h2a2 2 0 012 2v3a2 2 0 01-2 2H4a2 2 0 01-2-2v-3a2 2 0 012-2z" />
            <circle cx="13" cy="27" r="4" class="text-white" fill="currentColor" /><circle cx="35" cy="27" r="4" class="text-white" fill="currentColor" />
          }
          @case ('VAN') {
            <path d="M3 8a3 3 0 013-3h24l9 7h4a3 3 0 013 3v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <circle cx="13" cy="27" r="4" class="text-white" fill="currentColor" /><circle cx="36" cy="27" r="4" class="text-white" fill="currentColor" />
          }
          @default {
            <path d="M2 6a2 2 0 012-2h24a2 2 0 012 2v18H2zM30 11h8l7 7v6H30z" />
            <circle cx="11" cy="27" r="4" class="text-white" fill="currentColor" /><circle cx="37" cy="27" r="4" class="text-white" fill="currentColor" />
          }
        }
      </svg>
    </span>
  `,
})
export class VehicleTypeIcon {
  readonly type = input.required<VehicleType>();
  readonly status = input<string>('AVAILABLE');
  readonly size = input<'md' | 'lg'>('md');
  protected readonly box = computed(() => {
    const tone =
      { AVAILABLE: 'bg-emerald-50 text-emerald-600', IN_USE: 'bg-amber-50 text-amber-600', MAINTENANCE: 'bg-rose-50 text-rose-600' }[
        this.status()
      ] ?? 'bg-slate-100 text-slate-500';
    return `${tone} ${this.size() === 'lg' ? 'h-14 w-14' : 'h-11 w-11'}`;
  });
}
