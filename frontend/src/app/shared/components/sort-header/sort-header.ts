import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icon } from '../icon/icon';

/** Clickable column header. `sort` is the current value: "field" for
 *  ascending, "-field" for descending. */
@Component({
  selector: 'app-sort-header',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="inline-flex items-center gap-1 uppercase hover:text-slate-800" (click)="toggle()">
      <ng-content />
      @if (direction() === 'asc') { <app-icon name="chevron-up" size="sm" /> }
      @else if (direction() === 'desc') { <app-icon name="chevron-down" size="sm" /> }
    </button>
  `,
})
export class SortHeader {
  readonly field = input.required<string>();
  readonly sort = input<string>('');
  readonly sortChange = output<string>();

  protected readonly direction = computed(() => {
    const s = this.sort();
    if (s === this.field()) return 'asc';
    if (s === '-' + this.field()) return 'desc';
    return null;
  });

  protected toggle(): void {
    const d = this.direction();
    this.sortChange.emit(d === 'desc' ? this.field() : '-' + this.field());
  }
}
