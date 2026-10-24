import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-toast-container',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 sm:top-auto sm:right-4 sm:bottom-4 sm:left-auto sm:items-end" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-lg"
          [class.border-emerald-200]="t.kind === 'success'" [class.border-rose-200]="t.kind === 'error'" [class.border-slate-200]="t.kind === 'info'">
          <app-icon [name]="t.kind === 'success' ? 'check-circle' : t.kind === 'error' ? 'warning' : 'info'"
            [class]="t.kind === 'success' ? 'text-emerald-600' : t.kind === 'error' ? 'text-rose-600' : 'text-brand-600'" />
          <p class="flex-1 text-slate-700">{{ t.message }}</p>
          <button type="button" class="text-slate-400 hover:text-slate-600" (click)="toast.dismiss(t.id)" aria-label="Dismiss">
            <app-icon name="x" size="sm" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  protected readonly toast = inject(ToastService);
}
