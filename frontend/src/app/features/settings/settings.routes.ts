import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/account/account').then((m) => m.Account), title: 'Settings · i-Ship' },
];
