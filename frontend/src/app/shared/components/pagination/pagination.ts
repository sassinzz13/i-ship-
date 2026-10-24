import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { PageMeta } from '../../models/api.model';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-pagination',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (meta(); as m) {
      <div class="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row">
        <p>
          @if (m.total === 0) { No results }
          @else { Showing <span class="font-medium">{{ from() }}</span>–<span class="font-medium">{{ to() }}</span> of <span class="font-medium">{{ m.total }}</span> }
        </p>
        <div class="flex items-center gap-2">
          <select class="form-input !w-auto !py-1" [value]="m.pageSize" (change)="pageSizeChange.emit(+$any($event.target).value)" aria-label="Rows per page">
            @for (s of sizes; track s) { <option [value]="s">{{ s }} / page</option> }
          </select>
          <button type="button" class="btn-secondary !px-2 !py-1" [disabled]="m.page <= 1" (click)="pageChange.emit(m.page - 1)" aria-label="Previous page">
            <app-icon name="chevron-left" size="sm" />
          </button>
          <span class="tabular-nums">{{ m.page }} / {{ m.totalPages || 1 }}</span>
          <button type="button" class="btn-secondary !px-2 !py-1" [disabled]="m.page >= m.totalPages" (click)="pageChange.emit(m.page + 1)" aria-label="Next page">
            <app-icon name="chevron-right" size="sm" />
          </button>
        </div>
      </div>
    }
  `,
})
export class Pagination {
  readonly meta = input<PageMeta | null>(null);
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  protected readonly sizes = [10, 20, 50, 100];
  protected readonly from = computed(() => {
    const m = this.meta();
    return m ? (m.page - 1) * m.pageSize + 1 : 0;
  });
  protected readonly to = computed(() => {
    const m = this.meta();
    return m ? Math.min(m.page * m.pageSize, m.total) : 0;
  });
}
