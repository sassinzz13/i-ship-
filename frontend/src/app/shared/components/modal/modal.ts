import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icon } from '../icon/icon';

@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" [attr.aria-label]="title()">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" (click)="closed.emit()"></div>
        <div class="relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" [class]="widthClass()">
          <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 class="text-lg font-semibold text-slate-900">{{ title() }}</h2>
            <button type="button" class="btn-ghost !p-1.5" (click)="closed.emit()" aria-label="Close"><app-icon name="x" /></button>
          </div>
          <div class="overflow-y-auto px-5 py-4"><ng-content /></div>
        </div>
      </div>
    }
  `,
})
export class Modal {
  readonly open = input(false);
  readonly title = input('');
  readonly size = input<'md' | 'lg' | 'xl'>('md');
  readonly closed = output<void>();
  protected widthClass(): string {
    return { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[this.size()];
  }
}
