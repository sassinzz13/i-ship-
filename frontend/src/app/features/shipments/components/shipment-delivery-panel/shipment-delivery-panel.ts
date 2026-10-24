import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, signal } from '@angular/core';

import { Icon } from '../../../../shared/components/icon/icon';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { DeliveryRecord } from '../../../deliveries/models/delivery.model';
import { DeliveryService } from '../../../deliveries/services/delivery.service';

/** Delivery attempts and proof of delivery. Proof images need the bearer
 *  token, so they are fetched as blobs and shown via object URLs. */
@Component({
  selector: 'app-shipment-delivery-panel',
  imports: [DatePipe, Icon, StatusBadge, LabelizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <header class="border-b border-slate-100 px-5 py-3"><h2 class="font-semibold text-slate-900">Delivery</h2></header>
      <div class="p-5">
        @if (loading()) {
          <div class="h-16 animate-pulse rounded-lg bg-slate-100"></div>
        } @else {
          @if (record()?.proof; as pod) {
            <div class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div class="flex items-center gap-2 text-emerald-700">
                <app-icon name="check-circle" />
                <p class="font-semibold">Delivered {{ pod.deliveredAt | date: 'MMM d, y · h:mm a' }}</p>
              </div>
              <dl class="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt class="text-xs text-slate-500">Received by</dt><dd class="font-medium text-slate-900">{{ pod.recipientName }}</dd></div>
                <div><dt class="text-xs text-slate-500">Relationship</dt><dd class="text-slate-900">{{ pod.recipientRelationship | labelize }}</dd></div>
              </dl>
              @if (pod.notes) { <p class="mt-2 text-sm text-slate-600">{{ pod.notes }}</p> }
              <div class="mt-3 grid grid-cols-2 gap-3">
                @if (pod.hasSignature) {
                  <figure>
                    <figcaption class="mb-1 text-xs text-slate-500">Signature</figcaption>
                    @if (signatureUrl(); as url) {
                      <img [src]="url" alt="Recipient signature" class="h-28 w-full rounded-lg border border-slate-200 bg-white object-contain" />
                    } @else { <div class="h-28 animate-pulse rounded-lg bg-white"></div> }
                  </figure>
                }
                @if (pod.hasPhoto) {
                  <figure>
                    <figcaption class="mb-1 text-xs text-slate-500">Photo</figcaption>
                    @if (photoUrl(); as url) {
                      <a [href]="url" target="_blank" rel="noopener"><img [src]="url" alt="Proof of delivery photo" class="h-28 w-full rounded-lg border border-slate-200 object-cover" /></a>
                    } @else { <div class="h-28 animate-pulse rounded-lg bg-white"></div> }
                  </figure>
                }
              </div>
            </div>
          }

          <h3 class="mt-4 mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase first:mt-0">Attempts</h3>
          <ul class="space-y-2">
            @for (a of record()?.attempts ?? []; track a.id) {
              <li class="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <div>
                  <p class="font-medium text-slate-800">Attempt #{{ a.attemptNumber }}</p>
                  <p class="text-xs text-slate-500">{{ a.attemptedAt | date: 'MMM d, h:mm a' }} @if (a.driverName) { · {{ a.driverName }} }</p>
                  @if (a.notes) { <p class="mt-1 text-xs text-slate-600">{{ a.notes }}</p> }
                </div>
                <app-status-badge [status]="a.outcome" />
              </li>
            } @empty {
              <li class="text-sm text-slate-500">No delivery attempts yet.</li>
            }
          </ul>
        }
      </div>
    </section>
  `,
})
export class ShipmentDeliveryPanel implements OnDestroy {
  readonly shipmentId = input.required<number>();
  readonly record = input<DeliveryRecord | null>(null);
  readonly loading = input(false);

  private readonly api = inject(DeliveryService);
  protected readonly signatureUrl = signal<string | null>(null);
  protected readonly photoUrl = signal<string | null>(null);

  constructor() {
    effect(() => {
      const pod = this.record()?.proof;
      const id = this.shipmentId();
      this.revoke();
      if (pod?.hasSignature) this.fetch(id, 'signature');
      if (pod?.hasPhoto) this.fetch(id, 'photo');
    });
  }

  private fetch(id: number, kind: 'signature' | 'photo'): void {
    this.api.proofImage(id, kind).subscribe({
      next: (blob) => (kind === 'signature' ? this.signatureUrl : this.photoUrl).set(URL.createObjectURL(blob)),
      error: () => undefined,
    });
  }

  private revoke(): void {
    for (const s of [this.signatureUrl, this.photoUrl]) {
      const url = s();
      if (url) URL.revokeObjectURL(url);
      s.set(null);
    }
  }

  ngOnDestroy(): void {
    this.revoke();
  }
}
