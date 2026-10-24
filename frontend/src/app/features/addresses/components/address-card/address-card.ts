import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon } from '../../../../shared/components/icon/icon';
import { Address } from '../../models/address.model';

/** Read-only address block used on detail pages and pickers. */
@Component({
  selector: 'app-address-card',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (address(); as a) {
      <div class="text-sm">
        <div class="flex items-center gap-2">
          <p class="font-medium text-slate-900">{{ a.contactName }}</p>
          @if (showLabel()) {
            <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{{ a.label }}</span>
          }
          @if (showLabel() && a.isDefault) {
            <span class="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">Default</span>
          }
        </div>
        <p class="mt-1 flex items-center gap-1.5 text-slate-600"><app-icon name="phone" size="sm" class="text-slate-400" />{{ a.contactPhone }}</p>
        <p class="mt-1 flex items-start gap-1.5 text-slate-600">
          <app-icon name="map-pin" size="sm" class="mt-0.5 text-slate-400" />
          <span>
            {{ a.line1 }}@if (a.line2) {, {{ a.line2 }}}<br />
            @if (a.barangay) { {{ a.barangay }}, } {{ a.city }}, {{ a.province }} @if (a.postalCode) { {{ a.postalCode }} }
          </span>
        </p>
      </div>
    }
  `,
})
export class AddressCard {
  readonly address = input<Address | null>(null);
  readonly showLabel = input(true);
}
