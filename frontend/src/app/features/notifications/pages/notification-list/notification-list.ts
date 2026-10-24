import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { UnreadCountService } from '../../../../core/services/unread-count.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { apiError } from '../../../../shared/utilities/http';
import { createQueryList } from '../../../../shared/utilities/query-list';
import { AppNotification } from '../../models/notification.model';
import { NotificationService } from '../../services/notification.service';
import { notificationLink } from '../../utils/notification-link';

const TYPE_ICON: Record<string, string> = { shipment: 'cube', assignment: 'clipboard', payment: 'banknotes', delivery: 'check-circle' };

@Component({
  selector: 'app-notification-list',
  imports: [DatePipe, PageHeader, Pagination, Spinner, EmptyState, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Notifications" subtitle="Updates about your shipments and assignments">
      <button type="button" class="btn-secondary" [disabled]="markingAll()" (click)="markAll()"><app-icon name="check" size="sm" /> Mark all read</button>
    </app-page-header>

    <div class="card mx-auto max-w-3xl">
      <div class="flex gap-1 border-b border-slate-200 p-2">
        @for (t of [{ k: '', l: 'All' }, { k: 'true', l: 'Unread' }]; track t.k) {
          <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium" [class]="list.value('unread') === t.k ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
            (click)="list.patch({ unread: t.k })">{{ t.l }}</button>
        }
      </div>

      @if (list.loading() && list.items().length === 0) {
        <app-spinner />
      } @else if (list.error()) {
        <app-empty-state icon="warning" title="Could not load notifications" [message]="list.error()!">
          <button type="button" class="btn-secondary" (click)="list.reload()">Try again</button>
        </app-empty-state>
      } @else if (list.items().length === 0) {
        <app-empty-state icon="bell" [title]="list.value('unread') ? 'No unread notifications' : 'No notifications yet'" message="You're all caught up." />
      } @else {
        <ul class="divide-y divide-slate-100">
          @for (n of list.items(); track n.id) {
            <li>
              <button type="button" class="flex w-full gap-3 px-4 py-4 text-left transition hover:bg-slate-50" [class.bg-brand-50/40]="!isRead(n)" (click)="open(n)">
                <span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full" [class]="isRead(n) ? 'bg-slate-100 text-slate-500' : 'bg-brand-100 text-brand-700'">
                  <app-icon [name]="icon(n)" />
                  @if (!isRead(n)) { <span class="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-brand-600 ring-2 ring-white"></span> }
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-start justify-between gap-3">
                    <span class="text-sm" [class]="isRead(n) ? 'text-slate-700' : 'font-semibold text-slate-900'">{{ n.title }}</span>
                    <time class="shrink-0 text-xs text-slate-400">{{ n.createdAt | date: 'MMM d, h:mm a' }}</time>
                  </span>
                  <span class="mt-0.5 block text-sm text-slate-500">{{ n.message }}</span>
                </span>
              </button>
            </li>
          }
        </ul>
        <app-pagination [meta]="list.meta()" (pageChange)="list.setPage($event)" (pageSizeChange)="list.setPageSize($event)" />
      }
    </div>
  `,
})
export class NotificationList {
  private readonly notifications = inject(NotificationService);
  private readonly unread = inject(UnreadCountService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly list = createQueryList((p) => this.notifications.list(p));
  protected readonly markingAll = signal(false);
  /** Ids marked read locally so the UI updates without refetching. */
  private readonly readIds = signal<Set<number>>(new Set());

  protected isRead(n: AppNotification): boolean {
    return !!n.readAt || this.readIds().has(n.id);
  }

  protected icon(n: AppNotification): string {
    return TYPE_ICON[n.entityType ?? ''] ?? 'bell';
  }

  protected open(n: AppNotification): void {
    if (!this.isRead(n)) {
      this.readIds.update((s) => new Set(s).add(n.id));
      this.notifications.markRead(n.id).subscribe({ next: () => this.unread.load(), error: () => undefined });
    }
    const link = notificationLink(n, this.auth.role());
    if (link) void this.router.navigateByUrl(link);
  }

  protected markAll(): void {
    this.markingAll.set(true);
    this.notifications.markAllRead().subscribe({
      next: () => {
        this.markingAll.set(false);
        this.readIds.set(new Set(this.list.items().map((n) => n.id)));
        this.unread.load();
        this.list.reload();
      },
      error: (err) => {
        this.markingAll.set(false);
        this.toast.error(apiError(err).message);
      },
    });
  }
}
