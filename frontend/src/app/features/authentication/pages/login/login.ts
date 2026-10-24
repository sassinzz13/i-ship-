import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Icon } from '../../../../shared/components/icon/icon';
import { apiError } from '../../../../shared/utilities/http';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, FieldError, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh">
      <div class="relative hidden flex-1 flex-col justify-between overflow-hidden bg-brand-800 p-12 text-white lg:flex">
        <div class="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl"></div>
        <div class="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl"></div>
        <div class="relative flex items-center gap-3">
          <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><app-icon name="truck" size="lg" /></span>
          <span class="text-2xl font-bold">i-Ship</span>
        </div>
        <div class="relative max-w-md">
          <h2 class="text-4xl leading-tight font-semibold">Every parcel, every driver, one dashboard.</h2>
          <p class="mt-4 text-brand-100">Create shipments, dispatch drivers, capture proof of delivery and keep customers informed in real time.</p>
        </div>
        <p class="relative text-sm text-brand-200">Delivery &amp; Shipment Management System</p>
      </div>

      <div class="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div class="w-full max-w-sm">
          <div class="mb-8 flex items-center gap-2 lg:hidden">
            <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white"><app-icon name="truck" /></span>
            <span class="text-xl font-bold text-slate-900">i-Ship</span>
          </div>
          <h1 class="text-2xl font-semibold text-slate-900">Sign in</h1>
          <p class="mt-1 text-sm text-slate-500">Use the account provided by your administrator.</p>

          @if (notice()) {
            <div class="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{{ notice() }}</div>
          }
          @if (error()) {
            <div class="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error() }}</div>
          }

          <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div>
              <label class="form-label" for="email">Email</label>
              <input id="email" type="email" class="form-input" formControlName="email" autocomplete="username" inputmode="email" />
              <app-field-error [control]="form.controls.email" />
            </div>
            <div>
              <label class="form-label" for="password">Password</label>
              <div class="relative">
                <input id="password" [type]="showPassword() ? 'text' : 'password'" class="form-input pr-10" formControlName="password" autocomplete="current-password" />
                <button type="button" class="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600" (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"><app-icon name="eye" size="sm" /></button>
              </div>
              <app-field-error [control]="form.controls.password" />
            </div>
            <button type="submit" class="btn-primary btn-lg w-full" [disabled]="loading()">
              @if (loading()) { <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> }
              Sign in
            </button>
          </form>

          <div class="mt-8 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p class="font-medium text-slate-700">Tracking a parcel?</p>
            <p class="mt-1 text-slate-500">No account needed. <a routerLink="/track" class="font-medium text-brand-600 hover:underline">Track a shipment →</a></p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly notice = signal(
    this.route.snapshot.queryParamMap.get('expired') ? 'Your session has expired. Please sign in again.' : null,
  );

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const safe = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : this.auth.homeUrl();
        void this.router.navigateByUrl(safe);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err).message);
      },
    });
  }
}
