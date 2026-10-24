import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ToastService } from '../../../../core/services/toast.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Icon } from '../../../../shared/components/icon/icon';
import { SignaturePad } from '../../../../shared/components/signature-pad/signature-pad';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { Assignment } from '../../../assignments/models/assignment.model';
import { RECIPIENT_RELATIONSHIPS, RecipientRelationship } from '../../models/delivery.model';
import { DeliveryService } from '../../services/delivery.service';
import { DriverTasksStore } from '../../state/driver-tasks.store';
import { currentPosition } from '../../utils/geo';
import { downscaleImage } from '../../utils/image';

@Component({
  selector: 'app-driver-deliver',
  imports: [ReactiveFormsModule, RouterLink, Icon, FieldError, SignaturePad, LabelizePipe],
  template: `
    @if (done()) {
      <div class="flex min-h-[70dvh] flex-col items-center justify-center text-center">
        <div class="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <app-icon name="check-circle" size="lg" class="scale-[2]" />
        </div>
        <h1 class="mt-6 text-2xl font-bold text-slate-900">Delivered!</h1>
        <p class="mt-2 text-slate-600">{{ task()?.shipment?.trackingNumber }} has been marked as delivered.</p>
        <a routerLink="/driver" class="btn-primary btn-lg mt-8 w-full max-w-xs">Back to deliveries</a>
      </div>
    } @else {
      <a [routerLink]="['/driver/assignments', id()]" class="mb-3 inline-flex items-center gap-1 py-1 text-sm font-medium text-slate-500"><app-icon name="arrow-left" size="sm" /> Back</a>
      <h1 class="text-xl font-bold text-slate-900">Proof of delivery</h1>
      @if (task(); as t) { <p class="text-sm text-slate-500">{{ t.shipment.trackingNumber }} · {{ t.shipment.recipientName }}</p> }

      <form class="mt-4 space-y-4 pb-28" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <section class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <label class="form-label" for="p-name">Received by</label>
          <input id="p-name" class="form-input !py-3 !text-base" formControlName="recipientName" autocomplete="off" />
          <app-field-error [control]="form.controls.recipientName" [server]="errors()['recipientName']" />

          <p class="form-label mt-4">Relationship to recipient</p>
          <div class="flex flex-wrap gap-2">
            @for (r of relationships; track r) {
              <button type="button" class="rounded-full px-4 py-2 text-sm font-medium ring-1 transition"
                [class]="form.controls.recipientRelationship.value === r ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-700 ring-slate-300'"
                (click)="form.controls.recipientRelationship.setValue(r)">{{ r | labelize }}</button>
            }
          </div>
        </section>

        <section class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="form-label flex items-center gap-1.5"><app-icon name="signature" size="sm" /> Recipient signature</p>
          <app-signature-pad (changed)="signature.set($event)" />
        </section>

        <section class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="form-label flex items-center gap-1.5"><app-icon name="camera" size="sm" /> Package photo</p>
          @if (photoUrl()) {
            <div class="relative overflow-hidden rounded-xl">
              <img [src]="photoUrl()" alt="Delivered package" class="max-h-72 w-full object-cover" />
              <button type="button" class="absolute top-2 right-2 rounded-full bg-slate-900/70 p-2 text-white" (click)="clearPhoto()" aria-label="Remove photo"><app-icon name="trash" size="sm" /></button>
            </div>
          } @else {
            <label class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-8 text-slate-500 active:bg-slate-50">
              <app-icon name="camera" size="lg" />
              <span class="text-sm font-medium">{{ processing() ? 'Processing…' : 'Take a photo' }}</span>
              <input type="file" accept="image/*" capture="environment" class="sr-only" (change)="onPhoto($event)" />
            </label>
          }
        </section>

        <section class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <label class="form-label" for="p-notes">Notes <span class="font-normal text-slate-400">(optional)</span></label>
          <textarea id="p-notes" rows="2" class="form-input" formControlName="notes" placeholder="Left with guard, gate 2…"></textarea>
          <label class="mt-3 flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" class="h-5 w-5 rounded border-slate-300 text-brand-600" formControlName="shareLocation" /> Attach my current location
          </label>
        </section>

        @if (error()) { <p class="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error() }}</p> }

        <div class="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-xl px-4">
          <button type="submit" class="btn btn-lg w-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700" [disabled]="saving() || processing()">
            @if (saving()) { <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> Submitting… }
            @else { <app-icon name="check-circle" /> Confirm delivery }
          </button>
        </div>
      </form>
    }
  `,
})
export class DriverDeliver implements OnInit, OnDestroy {
  readonly id = input.required<string>();

  private readonly store = inject(DriverTasksStore);
  private readonly deliveries = inject(DeliveryService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly relationships = RECIPIENT_RELATIONSHIPS;
  protected readonly task = signal<Assignment | null>(null);
  protected readonly signature = signal<Blob | null>(null);
  protected readonly photo = signal<Blob | null>(null);
  protected readonly photoUrl = signal<string | null>(null);
  protected readonly processing = signal(false);
  protected readonly saving = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  private doneTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    recipientName: ['', [Validators.required, Validators.maxLength(120)]],
    recipientRelationship: ['SELF' as RecipientRelationship],
    notes: ['', Validators.maxLength(1000)],
    shareLocation: [true],
  });

  ngOnInit(): void {
    const id = Number(this.id());
    const apply = (a: Assignment) => {
      this.task.set(a);
      if (!this.form.controls.recipientName.value) this.form.controls.recipientName.setValue(a.shipment.recipientName);
    };
    const cached = this.store.find(id);
    if (cached) apply(cached);
    this.store.fetch(id).subscribe({ next: apply, error: (err) => this.error.set(apiError(err).message) });
  }

  ngOnDestroy(): void {
    if (this.photoUrl()) URL.revokeObjectURL(this.photoUrl()!);
    if (this.doneTimer) clearTimeout(this.doneTimer);
  }

  protected async onPhoto(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.processing.set(true);
    const blob = await downscaleImage(file);
    this.processing.set(false);
    if (blob.size > 5 * 1024 * 1024) {
      this.toast.error('Photo is too large (max 5 MB). Try again.');
      return;
    }
    this.photo.set(blob);
    if (this.photoUrl()) URL.revokeObjectURL(this.photoUrl()!);
    this.photoUrl.set(URL.createObjectURL(blob));
  }

  protected clearPhoto(): void {
    if (this.photoUrl()) URL.revokeObjectURL(this.photoUrl()!);
    this.photoUrl.set(null);
    this.photo.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.signature() && !this.photo()) {
      this.error.set('Capture the recipient signature or a photo of the delivered package.');
      return;
    }
    this.error.set(null);
    this.errors.set({});
    this.saving.set(true);
    const v = this.form.getRawValue();
    const pos = v.shareLocation ? await currentPosition() : null;
    const shipmentId = this.task()?.shipmentId;
    if (!shipmentId) {
      this.saving.set(false);
      this.error.set('Delivery details are still loading. Try again in a moment.');
      return;
    }
    this.deliveries
      .submitProof(shipmentId, {
        recipientName: v.recipientName.trim(),
        recipientRelationship: v.recipientRelationship,
        notes: v.notes.trim() || null,
        latitude: pos?.latitude ?? null,
        longitude: pos?.longitude ?? null,
        signature: this.signature(),
        photo: this.photo(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.store.complete(this.task()!.id);
          this.done.set(true);
          this.doneTimer = setTimeout(() => void this.router.navigateByUrl('/driver'), 3500);
        },
        error: (err) => {
          this.saving.set(false);
          const e = apiError(err);
          this.errors.set(e.details ?? {});
          this.error.set(e.message);
        },
      });
  }
}
