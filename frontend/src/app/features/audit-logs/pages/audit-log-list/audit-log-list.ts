import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DebouncedSearch } from '../../../../shared/components/debounced-search/debounced-search';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { createQueryList } from '../../../../shared/utilities/query-list';
import { AuditLog } from '../../models/audit-log.model';
import { AuditLogService } from '../../services/audit-log.service';

const ENTITY_TYPES = ['shipment', 'customer', 'address', 'driver', 'vehicle', 'assignment', 'delivery_attempt', 'proof_of_delivery', 'payment', 'user', 'session'];

/** Admin-facing link for an audited entity, when one exists. */
export function entityLink(log: Pick<AuditLog, 'entityType' | 'entityId'>): string | null {
  if (!log.entityId) return null;
  switch (log.entityType) {
    case 'shipment':
      return `/shipments/${log.entityId}`;
    case 'customer':
      return `/customers/${log.entityId}`;
    case 'driver':
      return `/drivers/${log.entityId}`;
    default:
      return null;
  }
}

function actionTone(action: string): string {
  if (/failed|reuse|cancel|reject|archived|refund/.test(action)) return 'bg-rose-50 text-rose-700 ring-rose-600/20';
  if (/created|login$|delivered|completed/.test(action)) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  if (/status|updated|changed|reset/.test(action)) return 'bg-blue-50 text-blue-700 ring-blue-600/20';
  return 'bg-slate-100 text-slate-700 ring-slate-500/20';
}

@Component({
  selector: 'app-audit-log-list',
  imports: [RouterLink, DatePipe, JsonPipe, PageHeader, Pagination, Spinner, EmptyState, Icon, LabelizePipe, DebouncedSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Audit logs" subtitle="Immutable record of every change and sign-in" />

    <div class="card">
      <div class="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <app-debounced-search placeholder="Filter by action, e.g. shipment.status_changed" [value]="list.value('action')" (search)="list.patch({ action: $event })" />
        <select class="form-input md:w-48" [value]="list.value('entityType')" (change)="list.patch({ entityType: $any($event.target).value })" aria-label="Entity type">
          <option value="">All entities</option>
          @for (e of entityTypes; track e) { <option [value]="e">{{ e | labelize }}</option> }
        </select>
        <input type="date" class="form-input md:w-40" [value]="list.value('dateFrom')" (change)="list.patch({ dateFrom: $any($event.target).value })" aria-label="From date" />
        <input type="date" class="form-input md:w-40" [value]="list.value('dateTo')" (change)="list.patch({ dateTo: $any($event.target).value })" aria-label="To date" />
      </div>

      @if (list.loading() && list.items().length === 0) {
        <app-spinner />
      } @else if (list.error()) {
        <app-empty-state icon="warning" title="Could not load audit logs" [message]="list.error()!">
          <button type="button" class="btn-secondary" (click)="list.reload()">Try again</button>
        </app-empty-state>
      } @else if (list.items().length === 0) {
        <app-empty-state icon="document" title="No audit entries" message="No activity matches these filters." />
      } @else {
        <div class="overflow-x-auto" [class.opacity-60]="list.loading()">
          <table class="table-base">
            <thead><tr><th class="w-8"></th><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>IP address</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              @for (log of list.items(); track log.id) {
                <tr class="cursor-pointer" (click)="toggle(log.id)">
                  <td><app-icon [name]="expanded() === log.id ? 'chevron-down' : 'chevron-right'" size="sm" class="text-slate-400" /></td>
                  <td class="text-slate-500">{{ log.createdAt | date: 'MMM d, y · h:mm:ss a' }}</td>
                  <td>
                    @if (log.actorUserId) {
                      <p class="font-medium text-slate-900">{{ log.actorName ?? 'User #' + log.actorUserId }}</p>
                      <p class="text-xs text-slate-500">{{ log.actorEmail }} @if (log.actorRole) { · {{ log.actorRole | labelize }} }</p>
                    } @else { <span class="text-slate-400">System</span> }
                  </td>
                  <td><span class="rounded-md px-2 py-0.5 font-mono text-xs ring-1 ring-inset" [class]="tone(log.action)">{{ log.action }}</span></td>
                  <td>
                    @if (link(log); as l) {
                      <a [routerLink]="l" class="text-brand-700 hover:underline" (click)="$event.stopPropagation()">{{ log.entityType | labelize }} #{{ log.entityId }}</a>
                    } @else {
                      {{ log.entityType | labelize }}@if (log.entityId) { #{{ log.entityId }} }
                    }
                  </td>
                  <td class="font-mono text-xs text-slate-500">{{ log.ipAddress ?? '—' }}</td>
                </tr>
                @if (expanded() === log.id) {
                  <tr class="!bg-slate-50">
                    <td></td>
                    <td colspan="5" class="!whitespace-normal">
                      <div class="grid gap-3 py-1 lg:grid-cols-[2fr_1fr]">
                        <pre class="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-emerald-200">{{ log.changes | json }}</pre>
                        <dl class="space-y-1.5 text-xs">
                          <div><dt class="text-slate-500">Request ID</dt><dd class="font-mono text-slate-700">{{ log.requestId ?? '—' }}</dd></div>
                          <div><dt class="text-slate-500">User agent</dt><dd class="break-all text-slate-700">{{ log.userAgent ?? '—' }}</dd></div>
                        </dl>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
        <app-pagination [meta]="list.meta()" (pageChange)="list.setPage($event)" (pageSizeChange)="list.setPageSize($event)" />
      }
    </div>
  `,
})
export class AuditLogList {
  private readonly logs = inject(AuditLogService);
  protected readonly list = createQueryList((p) => this.logs.list(p), { pageSize: 50 });
  protected readonly entityTypes = ENTITY_TYPES;
  protected readonly expanded = signal<number | null>(null);

  protected toggle(id: number): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  protected link(log: AuditLog): string | null {
    return entityLink(log);
  }

  protected tone(action: string): string {
    return actionTone(action);
  }
}
