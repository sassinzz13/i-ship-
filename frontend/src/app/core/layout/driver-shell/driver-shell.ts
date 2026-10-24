import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';
import { AuthService } from '../../auth/auth.service';

/** Mobile-first shell for drivers: compact header and a bottom tab bar with
 *  large touch targets. */
@Component({
  selector: 'app-driver-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex min-h-dvh max-w-xl flex-col bg-slate-50">
      <header class="sticky top-0 z-20 flex h-14 items-center gap-3 bg-brand-700 px-4 text-white shadow">
        <app-icon name="truck" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold leading-tight">{{ auth.user()?.fullName }}</p>
          <p class="text-[11px] leading-tight text-brand-100">i-Ship Driver</p>
        </div>
        <button type="button" class="rounded-lg p-2 hover:bg-white/10" (click)="auth.logout()" aria-label="Sign out"><app-icon name="logout" /></button>
      </header>

      <main class="flex-1 px-4 pt-4 pb-24"><router-outlet /></main>

      <nav class="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div class="mx-auto grid max-w-xl grid-cols-3">
          @for (t of tabs; track t.path) {
            <a [routerLink]="t.path" routerLinkActive="!text-brand-600" [routerLinkActiveOptions]="{ exact: t.exact }"
              class="flex flex-col items-center gap-1 py-2.5 text-xs font-medium text-slate-500">
              <app-icon [name]="t.icon" size="lg" />{{ t.label }}
            </a>
          }
        </div>
      </nav>
    </div>
  `,
})
export class DriverShell {
  protected readonly auth = inject(AuthService);
  protected readonly tabs = [
    { label: 'Deliveries', icon: 'clipboard', path: '/driver', exact: true },
    { label: 'History', icon: 'clock', path: '/driver/history', exact: false },
    { label: 'Profile', icon: 'user', path: '/driver/profile', exact: false },
  ];
}
