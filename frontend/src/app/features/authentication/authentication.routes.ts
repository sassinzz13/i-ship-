import { Routes } from '@angular/router';

import { guestGuard } from '../../core/guards/auth.guard';

export const AUTHENTICATION_ROUTES: Routes = [
  { path: '', canActivate: [guestGuard], loadComponent: () => import('./pages/login/login').then((m) => m.Login), title: 'Sign in · i-Ship' },
];
