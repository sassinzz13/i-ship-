import { Routes } from '@angular/router';

import { authGuard, roleGuard } from './core/guards/auth.guard';
import { AdminShell } from './core/layout/admin-shell/admin-shell';

/**
 * Top-level routing. Each feature owns its child routes in
 * features/<name>/<name>.routes.ts and is lazy loaded here.
 */
export const routes: Routes = [
  { path: 'login', loadChildren: () => import('./features/authentication/authentication.routes').then((m) => m.AUTHENTICATION_ROUTES) },
  {
    path: '',
    component: AdminShell,
    canActivate: [authGuard],
    canActivateChild: [roleGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'settings' },
      { path: 'settings', loadChildren: () => import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES) },
    ],
  },
  { path: '**', redirectTo: '' },
];
