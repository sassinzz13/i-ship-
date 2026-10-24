import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { AccountService } from '../../services/account.service';

function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const a = group.get('newPassword')?.value;
  const b = group.get('confirm')?.value;
  return a && b && a !== b ? { mismatch: true } : null;
}

@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, FieldError, LabelizePipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Settings" subtitle="Your account and security" />
    <div class="grid gap-6 lg:grid-cols-3">
      <section class="card p-5">
        <h2 class="font-semibold text-slate-900">Profile</h2>
        @if (auth.user(); as u) {
          <dl class="mt-4 space-y-3 text-sm">
            <div><dt class="text-slate-500">Name</dt><dd class="font-medium text-slate-900">{{ u.fullName }}</dd></div>
            <div><dt class="text-slate-500">Email</dt><dd class="font-medium text-slate-900">{{ u.email }}</dd></div>
            <div><dt class="text-slate-500">Role</dt><dd class="font-medium text-slate-900">{{ u.role | labelize }}</dd></div>
            @if (u.lastLoginAt) {
              <div><dt class="text-slate-500">Last sign-in</dt><dd class="text-slate-900">{{ u.lastLoginAt | date: 'medium' }}</dd></div>
            }
          </dl>
        }
        @if (auth.hasRole('ADMIN')) {
          <a routerLink="/settings/users" class="btn-secondary mt-5 w-full">Manage users</a>
        }
      </section>

      <section class="card p-5 lg:col-span-2">
        <h2 class="font-semibold text-slate-900">Change password</h2>
        <p class="mt-1 text-sm text-slate-500">Changing your password signs you out of every device.</p>
        <form class="mt-4 grid max-w-md gap-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div>
            <label class="form-label" for="current">Current password</label>
            <input id="current" type="password" class="form-input" formControlName="currentPassword" autocomplete="current-password" />
            <app-field-error [control]="form.controls.currentPassword" [server]="serverErrors()['currentPassword']" />
          </div>
          <div>
            <label class="form-label" for="new">New password</label>
            <input id="new" type="password" class="form-input" formControlName="newPassword" autocomplete="new-password" />
            <app-field-error [control]="form.controls.newPassword" [server]="serverErrors()['newPassword']" />
          </div>
          <div>
            <label class="form-label" for="confirm">Confirm new password</label>
            <input id="confirm" type="password" class="form-input" formControlName="confirm" autocomplete="new-password" />
            @if (form.errors?.['mismatch'] && form.controls.confirm.touched) { <p class="form-error">Passwords do not match</p> }
          </div>
          <div><button type="submit" class="btn-primary" [disabled]="saving()">Update password</button></div>
        </form>
      </section>
    </div>
  `,
})
export class Account {
  protected readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly toast = inject(ToastService);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirm: ['', Validators.required],
    },
    { validators: matchPasswords },
  );
  protected readonly saving = signal(false);
  protected readonly serverErrors = signal<Record<string, string>>({});

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.serverErrors.set({});
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.account.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.toast.success('Password updated. Please sign in again.');
        this.auth.expire();
      },
      error: (err) => {
        this.saving.set(false);
        const e = apiError(err);
        this.serverErrors.set(e.details ?? {});
        if (!e.details) this.toast.error(e.message);
      },
    });
  }
}
