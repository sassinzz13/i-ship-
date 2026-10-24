import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { apiError } from '../../../../shared/utilities/http';
import { LicenseBadge } from '../../../drivers/components/license-badge/license-badge';
import { Driver } from '../../../drivers/models/driver.model';
import { DriverService } from '../../../drivers/services/driver.service';

@Component({
  selector: 'app-driver-profile',
  imports: [DatePipe, Icon, Spinner, EmptyState, StatusBadge, LicenseBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-4 text-xl font-bold text-slate-900">Profile</h1>
    @if (loading()) {
      <app-spinner />
    } @else if (!driver()) {
      <div class="rounded-2xl bg-white ring-1 ring-slate-200"><app-empty-state icon="warning" title="Profile unavailable" [message]="error() ?? ''" /></div>
    } @else {
      @let d = driver()!;
      <section class="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
        <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white">{{ d.fullName.charAt(0) }}</span>
        <p class="mt-3 text-lg font-bold text-slate-900">{{ d.fullName }}</p>
        <p class="text-sm text-slate-500">{{ d.employeeCode }} · {{ d.email }}</p>
        <div class="mt-2 flex justify-center gap-2"><app-status-badge [status]="d.status" /><app-status-badge [status]="d.availability" /></div>
      </section>

      <section class="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-semibold text-slate-900">{{ d.availability === 'OFF_DUTY' ? 'Off duty' : 'On duty' }}</p>
            <p class="text-sm text-slate-500">
              @if (d.availability === 'ON_DELIVERY') { You're on a delivery. Finish it to go off duty. }
              @else { Dispatch only assigns deliveries while you're on duty. }
            </p>
          </div>
          <button type="button" role="switch" [attr.aria-checked]="d.availability !== 'OFF_DUTY'" [disabled]="saving() || d.availability === 'ON_DELIVERY'"
            class="relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50" [class]="d.availability !== 'OFF_DUTY' ? 'bg-emerald-500' : 'bg-slate-300'"
            (click)="toggle()" aria-label="Toggle availability">
            <span class="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all" [class]="d.availability !== 'OFF_DUTY' ? 'left-7' : 'left-1'"></span>
          </button>
        </div>
      </section>

      <section class="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <dl class="space-y-3 text-sm">
          <div class="flex justify-between gap-4"><dt class="text-slate-500">Phone</dt><dd class="font-medium text-slate-900">{{ d.phone }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-slate-500">License</dt><dd class="font-mono text-slate-900">{{ d.licenseNumber }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-slate-500">Expires</dt><dd><app-license-badge [expiry]="d.licenseExpiry" /></dd></div>
          <div class="flex justify-between gap-4"><dt class="text-slate-500">Emergency contact</dt><dd class="text-right text-slate-900">{{ d.emergencyContactName ?? '—' }}<br /><span class="text-slate-500">{{ d.emergencyContactPhone }}</span></dd></div>
          <div class="flex justify-between gap-4"><dt class="text-slate-500">Driver since</dt><dd class="text-slate-900">{{ d.createdAt | date: 'MMM y' }}</dd></div>
        </dl>
      </section>
    }

    <button type="button" class="btn-secondary btn-lg mt-6 w-full !text-rose-700" (click)="auth.logout()"><app-icon name="logout" /> Sign out</button>
  `,
})
export class DriverProfile implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly drivers = inject(DriverService);
  private readonly toast = inject(ToastService);

  protected readonly driver = signal<Driver | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.drivers.me().subscribe({
      next: (d) => {
        this.driver.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiError(err).message);
        this.loading.set(false);
      },
    });
  }

  protected toggle(): void {
    const d = this.driver();
    if (!d || d.availability === 'ON_DELIVERY') return;
    const next = d.availability === 'OFF_DUTY' ? 'AVAILABLE' : 'OFF_DUTY';
    this.saving.set(true);
    this.drivers.setMyAvailability(next).subscribe({
      next: (u) => {
        this.driver.set(u);
        this.saving.set(false);
        this.toast.success(next === 'AVAILABLE' ? "You're on duty" : "You're off duty");
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(apiError(err).message);
      },
    });
  }
}
