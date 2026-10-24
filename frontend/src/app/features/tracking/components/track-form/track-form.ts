import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Icon } from '../../../../shared/components/icon/icon';

const PATTERN = /^ISH-\d{8}-\d{6}$/;

/** Tracking number input that navigates to /track/:trackingNumber. */
@Component({
  selector: 'app-track-form',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (submit)="$event.preventDefault(); submit()" class="flex flex-col gap-2 sm:flex-row" novalidate>
      <div class="relative flex-1">
        <app-icon name="search" class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
        <input type="text" class="form-input !py-3.5 pl-12 font-mono !text-base uppercase shadow-sm" [class.is-invalid]="error()"
          placeholder="ISH-20261024-000001" [value]="value()" (input)="value.set($any($event.target).value); error.set(null)"
          aria-label="Tracking number" autocomplete="off" autocapitalize="characters" spellcheck="false" />
      </div>
      <button type="submit" class="btn-primary btn-lg !py-3.5">Track</button>
    </form>
    @if (error()) { <p class="form-error mt-2">{{ error() }}</p> }
  `,
})
export class TrackForm {
  readonly initial = input('');
  private readonly router = inject(Router);
  protected readonly value = signal('');
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.value.set(this.initial());
  }

  protected submit(): void {
    const v = this.value().trim().toUpperCase().replace(/\s+/g, '');
    if (!v) {
      this.error.set('Enter your tracking number');
      return;
    }
    if (!PATTERN.test(v)) {
      this.error.set('Tracking numbers look like ISH-20261024-000001');
      return;
    }
    void this.router.navigate(['/track', v]);
  }
}
