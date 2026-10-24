import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center gap-3 py-10 text-sm text-slate-500" role="status">
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"></span>
      {{ label() }}
    </div>
  `,
})
export class Spinner {
  readonly label = input('Loading…');
}
