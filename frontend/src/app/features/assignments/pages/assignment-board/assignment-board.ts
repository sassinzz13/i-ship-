import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { ListParams } from '../../../../shared/models/api.model';
import { apiError } from '../../../../shared/utilities/http';
import { createQueryList } from '../../../../shared/utilities/query-list';
import { Driver } from '../../../drivers/models/driver.model';
import { DriverService } from '../../../drivers/services/driver.service';
import { AssignmentCard } from '../../components/assignment-card/assignment-card';
import { NewAssignmentDialog } from '../../components/new-assignment-dialog/new-assignment-dialog';
import { Assignment } from '../../models/assignment.model';
import { AssignmentService } from '../../services/assignment.service';

interface Tab {
  key: string;
  label: string;
}

const TABS: Tab[] = [
  { key: 'active', label: 'Active' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'REJECTED', label: 'Rejected' },
];

/** Maps the board's `tab` query param onto API filters. */
export function tabToParams(p: ListParams): ListParams {
  const { tab, ...rest } = p;
  if (!tab || tab === 'active') return { ...rest, active: true };
  return { ...rest, status: tab };
}

@Component({
  selector: 'app-assignment-board',
  imports: [FormsModule, PageHeader, Pagination, Spinner, EmptyState, Icon, AssignmentCard, NewAssignmentDialog, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Assignments" subtitle="Dispatch shipments to drivers and vehicles">
      <button type="button" class="btn-primary" (click)="createOpen.set(true)"><app-icon name="plus" size="sm" /> New assignment</button>
    </app-page-header>

    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <nav class="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" aria-label="Assignment status">
        @for (t of tabs; track t.key) {
          <button type="button" class="rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition"
            [class]="currentTab() === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'"
            (click)="list.patch({ tab: t.key })">{{ t.label }}</button>
        }
      </nav>
      <div class="flex gap-2">
        <select class="form-input lg:w-56" [value]="list.value('driverId')" (change)="list.patch({ driverId: $any($event.target).value })" aria-label="Driver">
          <option value="">All drivers</option>
          @for (d of drivers(); track d.id) { <option [value]="d.id">{{ d.fullName }}</option> }
        </select>
        <button type="button" class="btn-secondary !px-3" (click)="list.reload()" aria-label="Refresh"><app-icon name="refresh" size="sm" /></button>
      </div>
    </div>

    @if (list.loading() && list.items().length === 0) {
      <app-spinner />
    } @else if (list.error()) {
      <div class="card"><app-empty-state icon="warning" title="Could not load assignments" [message]="list.error()!">
        <button type="button" class="btn-secondary" (click)="list.reload()">Try again</button>
      </app-empty-state></div>
    } @else if (list.items().length === 0) {
      <div class="card"><app-empty-state icon="clipboard" title="No assignments here" message="Create an assignment to dispatch a shipment.">
        <button type="button" class="btn-primary" (click)="createOpen.set(true)"><app-icon name="plus" size="sm" /> New assignment</button>
      </app-empty-state></div>
    } @else {
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" [class.opacity-60]="list.loading()">
        @for (a of list.items(); track a.id) {
          <app-assignment-card [assignment]="a" (cancel)="toCancel.set($event)" />
        }
      </div>
      <div class="card mt-4"><app-pagination [meta]="list.meta()" (pageChange)="list.setPage($event)" (pageSizeChange)="list.setPageSize($event)" /></div>
    }

    <app-new-assignment-dialog [open]="createOpen()" (closed)="createOpen.set(false)" (created)="onCreated()" />

    <app-confirm-dialog [open]="!!toCancel()" title="Cancel assignment" confirmLabel="Cancel assignment" [danger]="true" [busy]="cancelling()"
      [message]="'Cancel ' + (toCancel()?.shipment?.trackingNumber ?? '') + ' for ' + (toCancel()?.driver?.fullName ?? '') + '? The shipment can then be reassigned.'"
      (cancelled)="toCancel.set(null)" (confirmed)="confirmCancel()">
      <label class="form-label mt-4" for="cancel-reason">Reason <span class="font-normal text-slate-400">(optional)</span></label>
      <input id="cancel-reason" class="form-input" [(ngModel)]="cancelReason" maxlength="300" />
    </app-confirm-dialog>
  `,
})
export class AssignmentBoard {
  private readonly assignments = inject(AssignmentService);
  private readonly toast = inject(ToastService);

  protected readonly tabs = TABS;
  protected readonly list = createQueryList((p) => this.assignments.list(tabToParams(p)), { tab: 'active', sort: '-assignedAt', pageSize: 24 });
  protected readonly drivers = signal<Driver[]>([]);
  protected readonly createOpen = signal(false);
  protected readonly toCancel = signal<Assignment | null>(null);
  protected readonly cancelling = signal(false);
  protected cancelReason = '';

  constructor() {
    inject(DriverService)
      .list({ pageSize: 100, sort: 'fullName' })
      .subscribe({ next: (p) => this.drivers.set(p.items), error: () => this.drivers.set([]) });
  }

  protected currentTab(): string {
    return this.list.value('tab') || 'active';
  }

  protected onCreated(): void {
    this.createOpen.set(false);
    this.list.reload();
  }

  protected confirmCancel(): void {
    const a = this.toCancel();
    if (!a) return;
    this.cancelling.set(true);
    this.assignments.cancel(a.id, this.cancelReason.trim() || null).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.toCancel.set(null);
        this.cancelReason = '';
        this.toast.success('Assignment cancelled');
        this.list.reload();
      },
      error: (err) => {
        this.cancelling.set(false);
        this.toast.error(apiError(err).message);
      },
    });
  }
}
