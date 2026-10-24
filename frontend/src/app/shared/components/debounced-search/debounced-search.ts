import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, effect, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Icon } from '../icon/icon';

/** Search box that emits trimmed terms after the user stops typing. */
@Component({
  selector: 'app-debounced-search',
  imports: [ReactiveFormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <app-icon name="search" size="sm" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
      <input type="search" class="form-input pl-9" [formControl]="control" [placeholder]="placeholder()" [attr.aria-label]="placeholder()" />
    </div>
  `,
})
export class DebouncedSearch implements OnInit {
  readonly value = input('');
  readonly placeholder = input('Search…');
  readonly search = output<string>();

  protected readonly control = new FormControl('', { nonNullable: true });
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Keep the box in sync when the URL changes (back/forward navigation).
    effect(() => {
      const v = this.value();
      if (v !== this.control.value.trim()) this.control.setValue(v, { emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.control.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.search.emit(v.trim()));
  }
}
