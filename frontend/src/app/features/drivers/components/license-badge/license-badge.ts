import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Icon } from '../../../../shared/components/icon/icon';
import { daysUntil, licenseState } from '../../utils/license';

@Component({
  selector: 'app-license-badge',
  imports: [Icon, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span [class.text-slate-700]="state() === 'valid'" [class.text-rose-700]="state() === 'expired'" [class.text-amber-700]="state() === 'expiring'">
        {{ expiry() | date: 'MMM d, y' }}
      </span>
      @if (state() === 'expired') {
        <span class="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-600/20">
          <app-icon name="warning" size="sm" /> Expired
        </span>
      } @else if (state() === 'expiring') {
        <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-600/20">
          <app-icon name="clock" size="sm" /> {{ days() === 0 ? 'Today' : days() + 'd left' }}
        </span>
      }
    </span>
  `,
})
export class LicenseBadge {
  readonly expiry = input.required<string>();
  protected readonly state = computed(() => licenseState(this.expiry()));
  protected readonly days = computed(() => daysUntil(this.expiry()));
}
