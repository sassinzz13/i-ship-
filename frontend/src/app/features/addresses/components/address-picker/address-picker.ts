import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icon } from '../../../../shared/components/icon/icon';
import { Address, formatAddress } from '../../models/address.model';

/** Selectable list of a customer's addresses. */
@Component({
  selector: 'app-address-picker',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="radiogroup" [attr.aria-label]="label()" class="grid gap-2">
      @for (a of addresses(); track a.id) {
        <button type="button" role="radio" [attr.aria-checked]="a.id === selectedId()" [disabled]="a.id === disabledId()"
          (click)="selected.emit(a.id)"
          class="flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40"
          [class]="a.id === selectedId() ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:border-slate-300'">
          <span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
            [class]="a.id === selectedId() ? 'border-brand-600 bg-brand-600' : 'border-slate-300'">
            @if (a.id === selectedId()) { <span class="h-1.5 w-1.5 rounded-full bg-white"></span> }
          </span>
          <span class="min-w-0">
            <span class="flex items-center gap-2">
              <span class="font-medium text-slate-900">{{ a.contactName }}</span>
              <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{{ a.label }}</span>
              @if (a.isDefault) { <span class="rounded bg-brand-100 px-1.5 py-0.5 text-[11px] text-brand-700">Default</span> }
            </span>
            <span class="mt-0.5 block text-slate-600">{{ format(a) }}</span>
            <span class="block text-xs text-slate-500">{{ a.contactPhone }}</span>
          </span>
        </button>
      } @empty {
        <p class="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No saved addresses yet.</p>
      }
      <button type="button" class="btn-ghost justify-start text-brand-700" (click)="add.emit()">
        <app-icon name="plus" size="sm" /> Add new address
      </button>
    </div>
  `,
})
export class AddressPicker {
  readonly addresses = input<Address[]>([]);
  readonly selectedId = input<number | null>(null);
  /** An address that cannot be chosen (e.g. the sender when picking the recipient). */
  readonly disabledId = input<number | null>(null);
  readonly label = input('Address');
  readonly selected = output<number>();
  readonly add = output<void>();
  protected readonly format = formatAddress;
}
