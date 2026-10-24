import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col bg-gradient-to-b from-brand-50 to-slate-50">
      <header class="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <a routerLink="/track" class="flex items-center gap-2">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white"><app-icon name="truck" /></span>
          <span class="text-lg font-bold text-slate-900">i-Ship</span>
        </a>
        @if (auth.isAuthenticated()) {
          <a [routerLink]="auth.homeUrl()" class="btn-secondary">Go to app</a>
        } @else {
          <a routerLink="/login" class="btn-secondary">Staff sign in</a>
        }
      </header>
      <main class="mx-auto w-full max-w-3xl flex-1 px-4 pb-12"><router-outlet /></main>
      <footer class="py-6 text-center text-xs text-slate-400">© i-Ship Logistics</footer>
    </div>
  `,
})
export class PublicLayout {
  protected readonly auth = inject(AuthService);
}
