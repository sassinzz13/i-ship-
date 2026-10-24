import { ChangeDetectionStrategy, Component, OnDestroy, inject, input, output, signal } from '@angular/core';

import { Icon } from '../../../../shared/components/icon/icon';
import { Customer } from '../../models/customer.model';
import { CustomerService } from '../../services/customer.service';

/** Search-as-you-type customer selector. */
@Component({
  selector: 'app-customer-picker',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block relative', '(document:click)': 'onDocClick($event)' },
  template: `
    @if (selected(); as c) {
      <div class="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{{ initials(c.fullName) }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-900">{{ c.fullName }} @if (c.companyName) { <span class="text-slate-500">· {{ c.companyName }}</span> }</p>
          <p class="truncate text-xs text-slate-500">{{ c.customerCode }} · {{ c.phone }}</p>
        </div>
        @if (!locked()) {
          <button type="button" class="btn-ghost !px-2 !py-1 text-xs" (click)="clear()">Change</button>
        }
      </div>
    } @else {
      <div class="relative">
        <app-icon name="search" size="sm" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input type="search" class="form-input pl-9" [class.is-invalid]="invalid()" placeholder="Search customers by name, code or phone…"
          [value]="term()" (input)="search($any($event.target).value)" (focus)="open.set(true); results().length || search(term())"
          role="combobox" [attr.aria-expanded]="open()" aria-autocomplete="list" />
      </div>
      @if (open() && (loading() || results().length || term())) {
        <ul class="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg" role="listbox">
          @if (loading()) {
            <li class="px-3 py-2 text-sm text-slate-500">Searching…</li>
          }
          @for (c of results(); track c.id) {
            <li role="option" [attr.aria-selected]="false">
              <button type="button" class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50" (click)="pick(c)">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{{ initials(c.fullName) }}</span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium text-slate-800">{{ c.fullName }}</span>
                  <span class="block truncate text-xs text-slate-500">{{ c.customerCode }} · {{ c.phone }}</span>
                </span>
              </button>
            </li>
          } @empty {
            @if (!loading()) { <li class="px-3 py-2 text-sm text-slate-500">No customers found.</li> }
          }
        </ul>
      }
    }
  `,
})
export class CustomerPicker implements OnDestroy {
  readonly selected = input<Customer | null>(null);
  readonly locked = input(false);
  readonly invalid = input(false);
  readonly selectedChange = output<Customer | null>();

  private readonly api = inject(CustomerService);
  protected readonly term = signal('');
  protected readonly results = signal<Customer[]>([]);
  protected readonly loading = signal(false);
  protected readonly open = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  protected search(term: string): void {
    this.term.set(term);
    this.open.set(true);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const id = ++this.seq;
      this.loading.set(true);
      this.api.list({ search: term.trim(), active: true, pageSize: 8, sort: 'fullName' }).subscribe({
        next: (p) => {
          if (id !== this.seq) return;
          this.results.set(p.items);
          this.loading.set(false);
        },
        error: () => id === this.seq && this.loading.set(false),
      });
    }, 250);
  }

  protected pick(c: Customer): void {
    this.open.set(false);
    this.selectedChange.emit(c);
  }

  protected clear(): void {
    this.term.set('');
    this.selectedChange.emit(null);
  }

  protected initials(name: string): string {
    return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  protected onDocClick(e: Event): void {
    const host = (e.target as HTMLElement | null)?.closest('app-customer-picker');
    if (!host) this.open.set(false);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
