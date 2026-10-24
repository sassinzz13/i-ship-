import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { Icon } from '../../../shared/components/icon/icon';
import { LabelizePipe } from '../../../shared/pipes/labelize.pipe';
import { AuthService } from '../../auth/auth.service';
import { UnreadCountService } from '../../services/unread-count.service';
import { NAV_ITEMS } from '../navigation';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, LabelizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh lg:pl-64">
      <!-- Mobile drawer backdrop -->
      @if (drawerOpen()) {
        <div class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" (click)="drawerOpen.set(false)"></div>
      }

      <aside class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform lg:translate-x-0"
        [class.-translate-x-full]="!drawerOpen()">
        <div class="flex h-16 items-center gap-2 px-5">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white"><app-icon name="truck" /></div>
          <div>
            <p class="text-lg font-bold leading-tight text-white">i-Ship</p>
            <p class="text-[11px] leading-tight text-slate-400">Delivery management</p>
          </div>
        </div>
        <nav class="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          @for (item of nav(); track item.label) {
            <a [routerLink]="item.path" routerLinkActive="!bg-slate-800 !text-white" [routerLinkActiveOptions]="{ exact: item.path === '/settings' }"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-800/60 hover:text-white">
              <app-icon [name]="item.icon" />
              <span class="flex-1">{{ item.label }}</span>
              @if (item.path === '/notifications' && unread.count() > 0) {
                <span class="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">{{ unread.count() }}</span>
              }
            </a>
          }
        </nav>
        <div class="border-t border-slate-800 p-4">
          <p class="truncate text-sm font-medium text-white">{{ auth.user()?.fullName }}</p>
          <p class="truncate text-xs text-slate-400">{{ auth.user()?.email }} · {{ auth.role() | labelize }}</p>
          <button type="button" class="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-800" (click)="auth.logout()">
            <app-icon name="logout" /> Sign out
          </button>
        </div>
      </aside>

      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button type="button" class="btn-ghost !p-2 lg:hidden" (click)="drawerOpen.set(true)" aria-label="Open menu"><app-icon name="menu" /></button>
        <p class="font-semibold text-slate-900 lg:hidden">i-Ship</p>
        <div class="flex-1"></div>
        <a routerLink="/track" class="btn-ghost hidden sm:inline-flex"><app-icon name="search" size="sm" /> Track</a>
        @if (showNotifications()) {
          <a routerLink="/notifications" class="btn-ghost relative !p-2" aria-label="Notifications">
            <app-icon name="bell" />
            @if (unread.count() > 0) {
              <span class="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white"></span>
            }
          </a>
        }
        <a routerLink="/settings" class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700" [attr.aria-label]="'Account settings'">
          {{ initials() }}
        </a>
      </header>

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminShell implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly unread = inject(UnreadCountService);
  private readonly router = inject(Router);

  protected readonly drawerOpen = signal(false);
  protected readonly nav = computed(() => {
    const role = this.auth.role();
    return NAV_ITEMS.filter((i) => role && i.roles.includes(role));
  });
  protected readonly showNotifications = computed(() => this.nav().some((i) => i.path === '/notifications'));
  protected readonly initials = computed(() =>
    (this.auth.user()?.fullName ?? '?')
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.drawerOpen.set(false));
  }

  ngOnInit(): void {
    if (this.showNotifications()) this.unread.start();
  }

  ngOnDestroy(): void {
    this.unread.stop();
  }
}
