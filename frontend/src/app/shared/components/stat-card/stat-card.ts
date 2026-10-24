import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../icon/icon';

@Component({
  selector: 'app-stat-card',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="link()" [queryParams]="query()" class="card flex items-center gap-4 p-4 transition hover:border-brand-300 hover:shadow-md">
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" [class]="toneClass()">
        <app-icon [name]="icon()" size="lg" />
      </div>
      <div class="min-w-0">
        <p class="truncate text-sm text-slate-500">{{ label() }}</p>
        <p class="text-2xl font-semibold tabular-nums text-slate-900">{{ value() ?? '—' }}</p>
      </div>
    </a>
  `,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input<number | null>(null);
  readonly icon = input('cube');
  readonly toneClass = input('bg-brand-50 text-brand-600');
  readonly link = input<string | null>(null);
  readonly query = input<Record<string, string> | null>(null);
}
