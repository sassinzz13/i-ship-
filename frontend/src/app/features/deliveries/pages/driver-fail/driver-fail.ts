import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ToastService } from '../../../../core/services/toast.service';
import { Icon } from '../../../../shared/components/icon/icon';
import { apiError } from '../../../../shared/utilities/http';
import { Assignment } from '../../../assignments/models/assignment.model';
import { AttemptOutcome, FAILED_OUTCOMES } from '../../models/delivery.model';
import { DeliveryService } from '../../services/delivery.service';
import { DriverTasksStore } from '../../state/driver-tasks.store';
import { currentPosition } from '../../utils/geo';

type FailedOutcome = Exclude<AttemptOutcome, 'SUCCESSFUL'>;

const META: Record<FailedOutcome, { title: string; hint: string; icon: string }> = {
  RECIPIENT_UNAVAILABLE: { title: 'Recipient unavailable', hint: 'No one home or not answering', icon: 'user' },
  WRONG_ADDRESS: { title: 'Wrong address', hint: 'Address incorrect or cannot be found', icon: 'map-pin' },
  REFUSED: { title: 'Refused', hint: 'Recipient refused the package', icon: 'x-circle' },
  DAMAGED_PACKAGE: { title: 'Damaged package', hint: 'Package damaged before handover', icon: 'warning' },
  OTHER: { title: 'Other reason', hint: 'Describe what happened', icon: 'info' },
};

@Component({
  selector: 'app-driver-fail',
  imports: [FormsModule, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="['/driver/assignments', id()]" class="mb-3 inline-flex items-center gap-1 py-1 text-sm font-medium text-slate-500"><app-icon name="arrow-left" size="sm" /> Back</a>
    <h1 class="text-xl font-bold text-slate-900">Report failed attempt</h1>
    @if (task(); as t) { <p class="text-sm text-slate-500">{{ t.shipment.trackingNumber }} · {{ t.shipment.recipientName }}</p> }

    <div class="mt-4 space-y-2 pb-28" role="radiogroup" aria-label="Reason">
      @for (o of outcomes; track o) {
        <button type="button" role="radio" [attr.aria-checked]="outcome() === o" (click)="outcome.set(o)"
          class="flex w-full items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left transition"
          [class]="outcome() === o ? 'border-rose-500 bg-rose-50' : 'border-transparent ring-1 ring-slate-200'">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" [class]="outcome() === o ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'">
            <app-icon [name]="meta[o].icon" />
          </span>
          <span class="min-w-0">
            <span class="block font-semibold text-slate-900">{{ meta[o].title }}</span>
            <span class="block text-sm text-slate-500">{{ meta[o].hint }}</span>
          </span>
        </button>
      }

      <div class="pt-2">
        <label class="form-label" for="f-notes">Notes @if (outcome() === 'OTHER') { <span class="text-rose-600">*</span> } @else { <span class="font-normal text-slate-400">(optional)</span> }</label>
        <textarea id="f-notes" rows="3" class="form-input" [ngModel]="notes()" (ngModelChange)="notes.set($event)" maxlength="1000"
          placeholder="Called twice, left a notice at the door…"></textarea>
        @if (notesMissing() && touched()) { <p class="form-error">Please describe what happened</p> }
      </div>

      @if (error()) { <p class="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error() }}</p> }
    </div>

    <div class="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-xl px-4">
      <button type="button" class="btn-danger btn-lg w-full shadow-lg" [disabled]="!outcome() || saving()" (click)="submit()">
        {{ saving() ? 'Submitting…' : 'Submit failed attempt' }}
      </button>
    </div>
  `,
})
export class DriverFail implements OnInit {
  readonly id = input.required<string>();

  private readonly store = inject(DriverTasksStore);
  private readonly deliveries = inject(DeliveryService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly outcomes = FAILED_OUTCOMES;
  protected readonly meta = META;
  protected readonly task = signal<Assignment | null>(null);
  protected readonly outcome = signal<FailedOutcome | null>(null);
  protected readonly notes = signal('');
  protected readonly touched = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notesMissing = computed(() => this.outcome() === 'OTHER' && !this.notes().trim());

  ngOnInit(): void {
    const id = Number(this.id());
    const cached = this.store.find(id);
    if (cached) this.task.set(cached);
    this.store.fetch(id).subscribe({ next: (a) => this.task.set(a), error: (err) => this.error.set(apiError(err).message) });
  }

  protected async submit(): Promise<void> {
    this.touched.set(true);
    const outcome = this.outcome();
    const t = this.task();
    if (!outcome || this.notesMissing() || !t) return;
    this.saving.set(true);
    this.error.set(null);
    const pos = await currentPosition(5000);
    this.deliveries
      .recordFailedAttempt(t.shipmentId, { outcome, notes: this.notes().trim() || null, latitude: pos?.latitude ?? null, longitude: pos?.longitude ?? null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.store.complete(t.id);
          this.toast.info('Failed attempt recorded. Dispatch will reschedule.');
          void this.router.navigateByUrl('/driver');
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(apiError(err).message);
        },
      });
  }
}
