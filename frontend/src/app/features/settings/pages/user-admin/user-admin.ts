import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { DebouncedSearch } from '../../../../shared/components/debounced-search/debounced-search';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../../shared/components/icon/icon';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { SortHeader } from '../../../../shared/components/sort-header/sort-header';
import { Spinner } from '../../../../shared/components/spinner/spinner';
import { LabelizePipe } from '../../../../shared/pipes/labelize.pipe';
import { createQueryList } from '../../../../shared/utilities/query-list';
import { ResetPasswordDialog } from '../../components/reset-password-dialog/reset-password-dialog';
import { ROLES, UserFormDialog } from '../../components/user-form-dialog/user-form-dialog';
import { UserRecord } from '../../models/user.model';
import { UserAdminService } from '../../services/user-admin.service';

const ROLE_CLASS: Record<string, string> = {
  ADMIN: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  DISPATCHER: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  STAFF: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  DRIVER: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  CUSTOMER: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

@Component({
  selector: 'app-user-admin',
  imports: [RouterLink, DatePipe, PageHeader, Pagination, SortHeader, Spinner, EmptyState, Icon, LabelizePipe, DebouncedSearch, UserFormDialog, ResetPasswordDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/settings" class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><app-icon name="arrow-left" size="sm" /> Settings</a>
    <app-page-header title="Users" subtitle="Accounts, roles and access">
      <button type="button" class="btn-primary" (click)="edit(null)"><app-icon name="plus" size="sm" /> New user</button>
    </app-page-header>

    <div class="card">
      <div class="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[1fr_auto_auto]">
        <app-debounced-search placeholder="Search name or email…" [value]="list.value('search')" (search)="list.patch({ search: $event })" />
        <select class="form-input sm:w-40" [value]="list.value('role')" (change)="list.patch({ role: $any($event.target).value })" aria-label="Role">
          <option value="">All roles</option>
          @for (r of roles; track r) { <option [value]="r">{{ r | labelize }}</option> }
        </select>
        <select class="form-input sm:w-36" [value]="list.value('active')" (change)="list.patch({ active: $any($event.target).value })" aria-label="Status">
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      @if (list.loading() && list.items().length === 0) {
        <app-spinner />
      } @else if (list.error()) {
        <app-empty-state icon="warning" title="Could not load users" [message]="list.error()!">
          <button type="button" class="btn-secondary" (click)="list.reload()">Try again</button>
        </app-empty-state>
      } @else if (list.items().length === 0) {
        <app-empty-state icon="user" title="No users found" />
      } @else {
        <div class="overflow-x-auto" [class.opacity-60]="list.loading()">
          <table class="table-base">
            <thead>
              <tr>
                <th><app-sort-header field="fullName" [sort]="list.value('sort')" (sortChange)="list.setSort($event)">User</app-sort-header></th>
                <th><app-sort-header field="role" [sort]="list.value('sort')" (sortChange)="list.setSort($event)">Role</app-sort-header></th>
                <th>Status</th>
                <th><app-sort-header field="lastLoginAt" [sort]="list.value('sort')" (sortChange)="list.setSort($event)">Last sign-in</app-sort-header></th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (u of list.items(); track u.id) {
                <tr>
                  <td>
                    <p class="font-medium text-slate-900">{{ u.fullName }} @if (u.id === auth.user()?.id) { <span class="text-xs font-normal text-slate-400">(you)</span> }</p>
                    <p class="text-xs text-slate-500">{{ u.email }}</p>
                  </td>
                  <td><span class="rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset" [class]="roleClass(u.role)">{{ u.role | labelize }}</span></td>
                  <td>
                    @if (u.isActive) { <span class="text-sm text-emerald-700">Active</span> } @else { <span class="text-sm text-slate-400">Inactive</span> }
                  </td>
                  <td class="text-slate-500">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'MMM d, y · h:mm a') : 'Never' }}</td>
                  <td class="text-right">
                    <button type="button" class="btn-ghost !px-2 !py-1" (click)="edit(u)" [attr.aria-label]="'Edit ' + u.email"><app-icon name="pencil" size="sm" /></button>
                    <button type="button" class="btn-ghost !px-2 !py-1" (click)="resetting.set(u)" [attr.aria-label]="'Reset password for ' + u.email"><app-icon name="refresh" size="sm" /></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [meta]="list.meta()" (pageChange)="list.setPage($event)" (pageSizeChange)="list.setPageSize($event)" />
      }
    </div>

    <app-user-form-dialog [open]="formOpen()" [user]="editing()" (closed)="formOpen.set(false)" (saved)="onSaved()" />
    <app-reset-password-dialog [user]="resetting()" (closed)="resetting.set(null)" />
  `,
})
export class UserAdmin {
  protected readonly auth = inject(AuthService);
  private readonly users = inject(UserAdminService);

  protected readonly list = createQueryList((p) => this.users.list(p), { sort: 'fullName' });
  protected readonly roles = ROLES;
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<UserRecord | null>(null);
  protected readonly resetting = signal<UserRecord | null>(null);

  protected roleClass(role: string): string {
    return ROLE_CLASS[role] ?? ROLE_CLASS['CUSTOMER'];
  }

  protected edit(u: UserRecord | null): void {
    this.editing.set(u);
    this.formOpen.set(true);
  }

  protected onSaved(): void {
    this.formOpen.set(false);
    this.list.reload();
  }
}
