import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Modal } from '../modal/modal';

@Component({
  selector: 'app-confirm-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="title()" (closed)="cancelled.emit()">
      <p class="text-sm text-slate-600">{{ message() }}</p>
      <ng-content />
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn-secondary" (click)="cancelled.emit()">Cancel</button>
        <button type="button" [class]="danger() ? 'btn-danger' : 'btn-primary'" [disabled]="busy()" (click)="confirmed.emit()">
          {{ confirmLabel() }}
        </button>
      </div>
    </app-modal>
  `,
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly title = input('Are you sure?');
  readonly message = input('');
  readonly confirmLabel = input('Confirm');
  readonly danger = input(false);
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
