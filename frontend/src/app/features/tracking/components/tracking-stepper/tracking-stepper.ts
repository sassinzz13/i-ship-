import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Icon } from '../../../../shared/components/icon/icon';
import { TrackingStep, progressPercent } from '../../utilities/tracking-progress';

/** Horizontal journey stepper on wide screens, vertical on phones. */
@Component({
  selector: 'app-tracking-stepper',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Wide -->
    <div class="relative hidden sm:block">
      <div class="absolute top-4 right-[8%] left-[8%] h-1 rounded-full bg-slate-200"></div>
      <div class="absolute top-4 left-[8%] h-1 rounded-full transition-all" [class]="barClass()" [style.width]="'calc(' + percent() + '% * 0.84)'"></div>
      <ol class="relative grid grid-cols-6">
        @for (s of steps(); track s.status) {
          <li class="flex flex-col items-center text-center">
            <span class="flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-white" [class]="dotClass(s)">
              @switch (s.state) {
                @case ('done') { <app-icon name="check" size="sm" [stroke]="2.5" /> }
                @case ('problem') { <app-icon name="warning" size="sm" [stroke]="2" /> }
                @case ('current') { <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-white"></span> }
                @default { <span class="h-2 w-2 rounded-full bg-slate-300"></span> }
              }
            </span>
            <span class="mt-2 text-xs font-medium" [class]="labelClass(s)">{{ s.label }}</span>
          </li>
        }
      </ol>
    </div>
    <!-- Phone -->
    <ol class="space-y-3 sm:hidden">
      @for (s of steps(); track s.status) {
        <li class="flex items-center gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" [class]="dotClass(s)">
            @switch (s.state) {
              @case ('done') { <app-icon name="check" size="sm" [stroke]="2.5" /> }
              @case ('problem') { <app-icon name="warning" size="sm" /> }
              @case ('current') { <span class="h-2 w-2 animate-pulse rounded-full bg-white"></span> }
              @default { <span class="h-1.5 w-1.5 rounded-full bg-slate-300"></span> }
            }
          </span>
          <span class="text-sm font-medium" [class]="labelClass(s)">{{ s.label }}</span>
        </li>
      }
    </ol>
  `,
})
export class TrackingStepper {
  readonly steps = input.required<TrackingStep[]>();
  protected readonly percent = computed(() => progressPercent(this.steps()));
  protected readonly barClass = computed(() => (this.steps().some((s) => s.state === 'problem') ? 'bg-amber-400' : 'bg-brand-600'));

  protected dotClass(s: TrackingStep): string {
    return {
      done: 'bg-brand-600 text-white',
      current: 'bg-brand-600 text-white shadow-lg shadow-brand-600/30',
      problem: 'bg-amber-500 text-white',
      upcoming: 'bg-slate-100 text-slate-400',
    }[s.state];
  }

  protected labelClass(s: TrackingStep): string {
    return s.state === 'upcoming' ? 'text-slate-400' : s.state === 'problem' ? 'text-amber-700' : 'text-slate-800';
  }
}
