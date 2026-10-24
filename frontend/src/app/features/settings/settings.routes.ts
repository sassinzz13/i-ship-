import { Routes } from '@angular/router';

import { roleGuard } from '../../core/guards/auth.guard';

export const SETTINGS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/account/account').then((m) => m.Account), title: 'Settings · i-Ship' },
  {
    path: 'users',
    canActivate: [roleGuard],
    data: { roles: ['ADMIN'] },
    loadComponent: () => import('./pages/user-admin/user-admin').then((m) => m.UserAdmin),
    title: 'Users · i-Ship',
  },
];
