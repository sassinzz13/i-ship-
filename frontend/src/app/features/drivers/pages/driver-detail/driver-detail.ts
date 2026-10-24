import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ToastService } from '../../../../core/services/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Icon } from '../../../../shared/components/icon/icon';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { apiError } from '../../../../shared/utilities/http';
import { Assignment } from '../../../assignments/models/assignment.model';
import { AssignmentService } from '../../../assignments/services/assignment.service';
import { LicenseBadge } from '../../components/license-badge/license-badge';
import { DRIVER_AVAILABILITY, DRIVER_STATUSES, Driver } from '../../models/driver.model';
import { DriverService } from '../../services/driver.service';

@Component({
  selector: 'app-driver-detail',
  imports: [RouterLink, ReactiveFormsModule, DatePipe, Icon, Spinner, EmptyState, StatusBadge, FieldError, LabelizePipe, LicenseBadge],
  template: `
    <a routerLink="/drivers" class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
      <app-icon name="arrow-left" size="sm" /> Drivers
    </a>

    @if (loading()) {
      <app-spinner />
    } @else if (!driver()) {
      <app-empty-state icon="warning" title="Driver not found" [message]="loadError() ?? ''" />
    } @else {
      @let d = driver()!;
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-4">
          <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-lg font-semibold text-white">{{ initials(d.fullName) }}</span>
          <div>
            <h1 class="text-2xl font-semibold text-slate-900">{{ d.fullName }}</h1>
            <p class="text-sm text-slate-500">{{ d.employeeCode }} · {{ d.email }}</p>
            <div class="mt-1.5 flex flex-wrap gap-2"><app-status-badge [status]="d.status" /><app-status-badge [status]="d.availability" /></div>
          </div>
        </div>
        @if (!editing()) {
          <button type="button" class="btn-secondary" (click)="startEdit()"><app-icon name="pencil" size="sm" /> Edit driver</button>
        }
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <section class="card p-5 lg:col-span-1">
          @if (!editing()) {
            <h2 class="font-semibold text-slate-900">Profile</h2>
            <dl class="mt-4 space-y-3 text-sm">
              <div><dt class="text-slate-500">Phone</dt><dd><a class="font-medium text-brand-700" [href]="'tel:' + d.phone">{{ d.phone }}</a></dd></div>
              <div><dt class="text-slate-500">License number</dt><dd class="font-mono text-slate-900">{{ d.licenseNumber }}</dd></div>
              <div><dt class="text-slate-500">License expiry</dt><dd><app-license-badge [expiry]="d.licenseExpiry" /></dd></div>
              <div>
                <dt class="text-slate-500">Emergency contact</dt>
                <dd class="text-slate-900">
                  @if (d.emergencyContactName) { {{ d.emergencyContactName }} · {{ d.emergencyContactPhone }} } @else { — }
                </dd>
              </div>
              <div><dt class="text-slate-500">Active assignments</dt><dd class="font-medium text-slate-900">{{ d.activeAssignments }}</dd></div>
              <div><dt class="text-slate-500">Onboarded</dt><dd class="text-slate-900">{{ d.createdAt | date: 'MMM d, y' }}</dd></div>
            </dl>
          } @else {
            <h2 class="font-semibold text-slate-900">Edit driver</h2>
            <form class="mt-4 space-y-4" [formGroup]="form" (ngSubmit)="save()" novalidate>
              <div>
                <label class="form-label" for="e-name">Full name</label>
                <input id="e-name" class="form-input" formControlName="fullName" />
                <app-field-error [control]="form.controls.fullName" [server]="errors()['fullName']" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="form-label" for="e-status">Status</label>
                  <select id="e-status" class="form-input" formControlName="status">
                    @for (s of statuses; track s) { <option [value]="s">{{ s | labelize }}</option> }
                  </select>
                </div>
                <div>
                  <label class="form-label" for="e-av">Availability</label>
                  <select id="e-av" class="form-input" formControlName="availability">
                    @for (a of availability; track a) { <option [value]="a">{{ a | labelize }}</option> }
                  </select>
                </div>
              </div>
              <div>
                <label class="form-label" for="e-phone">Phone</label>
                <input id="e-phone" type="tel" class="form-input" formControlName="phone" />
                <app-field-error [control]="form.controls.phone" [server]="errors()['phone']" />
              </div>
              <div>
                <label class="form-label" for="e-code">Employee code</label>
                <input id="e-code" class="form-input uppercase" formControlName="employeeCode" />
                <app-field-error [control]="form.controls.employeeCode" [server]="errors()['employeeCode']" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="form-label" for="e-lic">License no.</label>
                  <input id="e-lic" class="form-input uppercase" formControlName="licenseNumber" />
                  <app-field-error [control]="form.controls.licenseNumber" [server]="errors()['licenseNumber']" />
                </div>
                <div>
                  <label class="form-label" for="e-exp">Expiry</label>
                  <input id="e-exp" type="date" class="form-input" formControlName="licenseExpiry" />
                  <app-field-error [control]="form.controls.licenseExpiry" [server]="errors()['licenseExpiry']" />
                </div>
              </div>
              <div>
                <label class="form-label" for="e-ecn">Emergency contact</label>
                <input id="e-ecn" class="form-input" formControlName="emergencyContactName" />
              </div>
              <div>
                <label class="form-label" for="e-ecp">Emergency phone</label>
                <input id="e-ecp" type="tel" class="form-input" formControlName="emergencyContactPhone" />
              </div>
              <div class="flex justify-end gap-2 pt-2">
                <button type="button" class="btn-secondary" (click)="editing.set(false)">Cancel</button>
                <button type="submit" class="btn-primary" [disabled]="saving()">Save changes</button>
              </div>
            </form>
          }
        </section>

        <section class="card lg:col-span-2">
          <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 class="font-semibold text-slate-900">Recent assignments</h2>
            <a [routerLink]="['/assignments']" [queryParams]="{ driverId: d.id }" class="text-sm font-medium text-brand-700 hover:underline">View all</a>
          </div>
          @if (assignments() === null) {
            <app-spinner />
          } @else if (assignments()!.length === 0) {
            <app-empty-state icon="clipboard" title="No assignments yet" message="Assignments for this driver will appear here." />
          } @else {
            <ul class="divide-y divide-slate-100">
              @for (a of assignments(); track a.id) {
                <li class="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div class="min-w-0">
                    <a [routerLink]="['/shipments', a.shipmentId]" class="font-mono text-sm font-medium text-brand-700 hover:underline">{{ a.shipment.trackingNumber }}</a>
                    <p class="truncate text-sm text-slate-600">{{ a.shipment.recipientName }} · {{ a.shipment.recipientCity }}</p>
                    <p class="text-xs text-slate-400">{{ a.vehicle.plateNumber }} · assigned {{ a.assignedAt | date: 'MMM d, y · h:mm a' }}</p>
                  </div>
                  <app-status-badge [status]="a.status" />
                </li>
              }
            </ul>
          }
        </section>
      </div>
    }
  `,
})
export class DriverDetail implements OnInit {
  /** Route parameter bound via withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly drivers = inject(DriverService);
  private readonly assignmentService = inject(AssignmentService);
  private readonly toast = inject(ToastService);

  protected readonly driver = signal<Driver | null>(null);
  protected readonly assignments = signal<Assignment[] | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly statuses = DRIVER_STATUSES;
  protected readonly availability = DRIVER_AVAILABILITY;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
    phone: ['', [Validators.required, Validators.minLength(5)]],
    employeeCode: ['', Validators.required],
    licenseNumber: ['', Validators.required],
    licenseExpiry: ['', Validators.required],
    emergencyContactName: [''],
    emergencyContactPhone: [''],
    status: ['ACTIVE' as Driver['status'], Validators.required],
    availability: ['AVAILABLE' as Driver['availability'], Validators.required],
  });

  ngOnInit(): void {
    const id = Number(this.id());
    this.drivers.get(id).subscribe({
      next: (d) => {
        this.driver.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(apiError(err).message);
        this.loading.set(false);
      },
    });
    this.assignmentService.list({ driverId: id, pageSize: 10, sort: '-assignedAt' }).subscribe({
      next: (p) => this.assignments.set(p.items),
      error: () => this.assignments.set([]),
    });
  }

  protected initials(name: string): string {
    return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  protected startEdit(): void {
    const d = this.driver()!;
    this.form.reset({
      fullName: d.fullName, phone: d.phone, employeeCode: d.employeeCode, licenseNumber: d.licenseNumber,
      licenseExpiry: d.licenseExpiry, emergencyContactName: d.emergencyContactName ?? '',
      emergencyContactPhone: d.emergencyContactPhone ?? '', status: d.status, availability: d.availability,
    });
    this.errors.set({});
    this.editing.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.drivers
      .update(this.driver()!.id, {
        ...v,
        employeeCode: v.employeeCode.trim().toUpperCase(),
        licenseNumber: v.licenseNumber.trim().toUpperCase(),
        emergencyContactName: v.emergencyContactName || null,
        emergencyContactPhone: v.emergencyContactPhone || null,
      })
      .subscribe({
        next: (d) => {
          this.driver.set(d);
          this.saving.set(false);
          this.editing.set(false);
          this.toast.success('Driver updated');
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
