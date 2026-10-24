import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Modal } from '../../../shared/components/modal/modal';

const REASONS = ['Vehicle issue', 'Outside my route', 'Not enough capacity', 'Personal emergency'];

/** Bottom sheet asking the driver why they reject an assignment. */
@Component({
  selector: 'app-reject-sheet',
  imports: [Modal, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" title="Reject assignment" (closed)="closed.emit()">
      <p class="text-sm text-slate-600">Let dispatch know why you can't take {{ trackingNumber() }}.</p>
      <div class="mt-4 grid gap-2">
        @for (r of reasons; track r) {
          <button type="button" class="rounded-xl border px-4 py-3 text-left text-sm font-medium"
            [class]="reason() === r ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-700'" (click)="reason.set(r)">{{ r }}</button>
        }
        <input class="form-input !py-3" placeholder="Other reason…" [ngModel]="custom()" (ngModelChange)="custom.set($event); reason.set('')" />
      </div>
      <button type="button" class="btn-danger btn-lg mt-5 w-full" [disabled]="!value() || busy()" (click)="confirmed.emit(value())">Reject assignment</button>
    </app-modal>
  `,
})
export class RejectSheet {
  readonly open = input(false);
  readonly busy = input(false);
  readonly trackingNumber = input('');
  readonly closed = output<void>();
  readonly confirmed = output<string>();

  protected readonly reasons = REASONS;
  protected readonly reason = signal('');
  protected readonly custom = signal('');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.reason.set('');
        this.custom.set('');
      }
    });
  }

  protected value(): string {
    return (this.reason() || this.custom()).trim();
  }
}
