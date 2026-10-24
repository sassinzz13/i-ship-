import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { ToastService } from '../../../../core/services/toast.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Modal } from '../../../../shared/components/modal/modal';
import { apiError } from '../../../../shared/utilities/http';
import { UserRecord } from '../../models/user.model';
import { UserAdminService } from '../../services/user-admin.service';

@Component({
  selector: 'app-reset-password-dialog',
  imports: [ReactiveFormsModule, Modal, FieldError],
  template: `
    <app-modal [open]="!!user()" title="Reset password" (closed)="closed.emit()">
      <p class="text-sm text-slate-600">Set a new password for <span class="font-medium text-slate-900">{{ user()?.email }}</span>. They will be signed out of every device.</p>
      <form class="mt-4" (ngSubmit)="submit()" novalidate>
        <label class="form-label" for="rp-pass">New password</label>
        <input id="rp-pass" type="text" class="form-input font-mono" [formControl]="password" autocomplete="new-password" />
        <app-field-error [control]="password" [server]="serverError()" />
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="btn-danger" [disabled]="saving()">Reset password</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class ResetPasswordDialog {
  readonly user = input<UserRecord | null>(null);
  readonly closed = output<void>();

  private readonly users = inject(UserAdminService);
  private readonly toast = inject(ToastService);
  protected readonly password = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(72)] });
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.user()) {
        this.password.reset('');
        this.serverError.set(null);
      }
    });
  }

  submit(): void {
    const u = this.user();
    if (!u || this.password.invalid) {
      this.password.markAsTouched();
      return;
    }
    this.saving.set(true);
    this.users.resetPassword(u.id, this.password.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Password reset');
        this.closed.emit();
      },
      error: (err) => {
        this.saving.set(false);
        const e = apiError(err);
        this.serverError.set(e.details?.['password'] ?? null);
        this.toast.error(e.message);
      },
    });
  }
}
