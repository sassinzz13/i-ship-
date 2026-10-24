import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Role } from '../../../../core/auth/auth.models';
import { ToastService } from '../../../../core/services/toast.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Modal } from '../../../../shared/components/modal/modal';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { UserRecord } from '../../models/user.model';
import { UserAdminService } from '../../services/user-admin.service';

export const ROLES: Role[] = ['ADMIN', 'DISPATCHER', 'STAFF', 'DRIVER', 'CUSTOMER'];

/** Create a user, or edit name/phone/role/active when `user` is set. */
@Component({
  selector: 'app-user-form-dialog',
  imports: [ReactiveFormsModule, Modal, FieldError, LabelizePipe],
  template: `
    <app-modal [open]="open()" [title]="user() ? 'Edit user' : 'New user'" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-4">
        @if (!user()) {
          <div>
            <label class="form-label" for="u-email">Email</label>
            <input id="u-email" type="email" class="form-input" formControlName="email" autocomplete="off" />
            <app-field-error [control]="form.controls.email" [server]="errors()['email']" />
          </div>
          <div>
            <label class="form-label" for="u-pass">Temporary password</label>
            <input id="u-pass" type="text" class="form-input font-mono" formControlName="password" autocomplete="new-password" />
            <app-field-error [control]="form.controls.password" [server]="errors()['password']" />
          </div>
        } @else {
          <p class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{{ user()!.email }}</p>
        }
        <div>
          <label class="form-label" for="u-name">Full name</label>
          <input id="u-name" class="form-input" formControlName="fullName" />
          <app-field-error [control]="form.controls.fullName" [server]="errors()['fullName']" />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="form-label" for="u-phone">Phone <span class="font-normal text-slate-400">(optional)</span></label>
            <input id="u-phone" type="tel" class="form-input" formControlName="phone" />
            <app-field-error [control]="form.controls.phone" [server]="errors()['phone']" />
          </div>
          <div>
            <label class="form-label" for="u-role">Role</label>
            <select id="u-role" class="form-input" formControlName="role">
              @for (r of roles; track r) { <option [value]="r">{{ r | labelize }}</option> }
            </select>
          </div>
        </div>
        @if (form.controls.role.value === 'DRIVER' || form.controls.role.value === 'CUSTOMER') {
          <p class="text-xs text-amber-700">Tip: create drivers from the Drivers page and customers from Customers so their profiles are linked.</p>
        }
        @if (user()) {
          <label class="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600" formControlName="isActive" /> Account active
          </label>
        }
        <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" class="btn-secondary" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="saving()">{{ user() ? 'Save changes' : 'Create user' }}</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class UserFormDialog {
  readonly open = input(false);
  readonly user = input<UserRecord | null>(null);
  readonly closed = output<void>();
  readonly saved = output<UserRecord>();

  private readonly users = inject(UserAdminService);
  private readonly toast = inject(ToastService);
  protected readonly roles = ROLES;
  protected readonly saving = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
    phone: ['', Validators.maxLength(30)],
    role: ['STAFF' as Role, Validators.required],
    isActive: [true],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const u = this.user();
      this.errors.set({});
      this.form.reset({ email: u?.email ?? '', password: '', fullName: u?.fullName ?? '', phone: u?.phone ?? '', role: u?.role ?? 'STAFF', isActive: u?.isActive ?? true });
      // Email and password are only collected when creating.
      for (const c of [this.form.controls.email, this.form.controls.password]) {
        if (u) c.disable();
        else c.enable();
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const existing = this.user();
    const phone = v.phone.trim() || null;
    const req = existing
      ? this.users.update(existing.id, { fullName: v.fullName.trim(), phone, role: v.role, isActive: v.isActive })
      : this.users.create({ email: v.email.trim(), password: v.password, fullName: v.fullName.trim(), phone, role: v.role });
    this.saving.set(true);
    req.subscribe({
      next: (u) => {
        this.saving.set(false);
        this.toast.success(existing ? 'User updated' : `User ${u.email} created`);
        this.saved.emit(u);
      },
      error: (err) => {
        this.saving.set(false);
        const e = apiError(err);
        this.errors.set(e.details ?? {});
        this.toast.error(e.message);
      },
    });
  }
}
