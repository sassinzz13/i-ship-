import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Icon } from '../../../../shared/components/icon/icon';
import { TrackForm } from '../../components/track-form/track-form';

@Component({
  selector: 'app-track-search',
  imports: [TrackForm, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pt-8 pb-10 text-center sm:pt-16">
      <span class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-sm ring-1 ring-brand-100">
        <app-icon name="map-pin" size="sm" /> Real-time parcel tracking
      </span>
      <h1 class="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">Where is my parcel?</h1>
      <p class="mx-auto mt-3 max-w-lg text-slate-600">Enter the tracking number from your receipt or SMS to see where your shipment is right now.</p>
      <div class="mx-auto mt-8 max-w-xl text-left"><app-track-form /></div>
    </section>

    <section class="grid gap-4 sm:grid-cols-3">
      @for (f of features; track f.title) {
        <div class="card p-5">
          <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><app-icon [name]="f.icon" /></span>
          <p class="mt-3 font-semibold text-slate-900">{{ f.title }}</p>
          <p class="mt-1 text-sm text-slate-500">{{ f.text }}</p>
        </div>
      }
    </section>
  `,
})
export class TrackSearch {
  protected readonly features = [
    { icon: 'clock', title: 'Live status', text: 'Every scan and hand-off appears on the timeline as it happens.' },
    { icon: 'truck', title: 'Out for delivery', text: 'Know when a rider is on the way to your address.' },
    { icon: 'check-circle', title: 'Proof of delivery', text: 'Deliveries are confirmed with a signature or photo.' },
  ];
}
