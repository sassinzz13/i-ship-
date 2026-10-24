import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon } from '../icon/icon';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <app-icon [name]="icon()" size="lg" />
      </div>
      <p class="font-medium text-slate-700">{{ title() }}</p>
      @if (message()) { <p class="mt-1 max-w-sm text-sm text-slate-500">{{ message() }}</p> }
      <div class="mt-4"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly title = input('Nothing here yet');
  readonly message = input<string>();
  readonly icon = input('cube');
}
