import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { apiError } from '../../../../shared/utilities/http';
import { Assignment } from '../../../assignments/models/assignment.model';
import { DriverTaskCard } from '../../components/driver-task-card/driver-task-card';
import { RejectSheet } from '../../components/reject-sheet';
import { DriverTasksStore } from '../../state/driver-tasks.store';

@Component({
  selector: 'app-driver-home',
  imports: [Icon, Spinner, EmptyState, DriverTaskCard, RejectSheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mb-5">
      <p class="text-sm text-slate-500">{{ greeting() }},</p>
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-900">{{ firstName() }}</h1>
        <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 active:bg-slate-100"
          (click)="refresh()" aria-label="Refresh">
          <app-icon name="refresh" [class.animate-spin]="store.loading()" />
        </button>
      </div>
    </section>

    <section class="mb-6 grid grid-cols-4 gap-2 text-center">
      @for (s of stats(); track s.label) {
        <div class="rounded-2xl bg-white px-1 py-3 shadow-sm ring-1 ring-slate-200">
          <p class="text-2xl font-bold tabular-nums" [class]="s.tone">{{ s.value }}</p>
          <p class="mt-0.5 text-[11px] leading-tight font-medium text-slate-500">{{ s.label }}</p>
        </div>
      }
    </section>

    <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Today's deliveries</h2>

    @if (store.loading() && !store.loaded()) {
      <app-spinner label="Loading your deliveries…" />
    } @else if (store.error() && store.active().length === 0) {
      <div class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <app-empty-state icon="warning" title="Couldn't load deliveries" [message]="store.error()!">
          <button type="button" class="btn-primary btn-lg" (click)="refresh()">Try again</button>
        </app-empty-state>
      </div>
    } @else if (store.active().length === 0) {
      <div class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <app-empty-state icon="check-circle" title="All caught up!" message="No deliveries assigned to you right now. New assignments will show up here.">
          <button type="button" class="btn-secondary btn-lg" (click)="refresh()"><app-icon name="refresh" /> Check again</button>
        </app-empty-state>
      </div>
    } @else {
      <div class="space-y-3">
        @for (t of store.active(); track t.id) {
          <app-driver-task-card [task]="t" [busy]="store.busyId() === t.id" (accept)="accept($event)" (reject)="rejecting.set($event)" (start)="start($event)" />
        }
      </div>
    }

    <app-reject-sheet [open]="!!rejecting()" [busy]="store.busyId() === rejecting()?.id" [trackingNumber]="rejecting()?.shipment?.trackingNumber ?? ''"
      (closed)="rejecting.set(null)" (confirmed)="reject($event)" />
  `,
})
export class DriverHome implements OnInit {
  protected readonly store = inject(DriverTasksStore);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly rejecting = signal<Assignment | null>(null);
  protected readonly firstName = computed(() => (this.auth.user()?.fullName ?? 'Driver').split(' ')[0]);
  protected readonly stats = computed(() => {
    const s = this.store.summary();
    return [
      { label: 'To accept', value: s.toAccept, tone: 'text-blue-600' },
      { label: 'Ready', value: s.ready, tone: 'text-indigo-600' },
      { label: 'On the road', value: s.inProgress, tone: 'text-amber-600' },
      { label: 'Done today', value: s.completedToday, tone: 'text-emerald-600' },
    ];
  });

  ngOnInit(): void {
    this.refresh();
  }

  protected greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  protected refresh(): void {
    this.store.load();
    this.store.loadHistory();
  }

  protected accept(a: Assignment): void {
    this.store.accept(a.id).subscribe({
      next: () => this.toast.success('Assignment accepted'),
      error: (err) => this.toast.error(apiError(err).message),
    });
  }

  protected start(a: Assignment): void {
    this.store.start(a.id).subscribe({
      next: () => {
        this.toast.success('Delivery started — drive safe!');
        void this.router.navigate(['/driver/assignments', a.id]);
      },
      error: (err) => this.toast.error(apiError(err).message),
    });
  }

  protected reject(reason: string): void {
    const a = this.rejecting();
    if (!a) return;
    this.store.reject(a.id, reason).subscribe({
      next: () => {
        this.rejecting.set(null);
        this.toast.info('Assignment rejected. Dispatch has been notified.');
      },
      error: (err) => this.toast.error(apiError(err).message),
    });
  }
}
