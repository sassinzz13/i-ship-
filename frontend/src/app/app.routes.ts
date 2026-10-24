import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { AuthService } from './core/auth/auth.service';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { AdminShell } from './core/layout/admin-shell/admin-shell';
import { DriverShell } from './core/layout/driver-shell/driver-shell';
import { PublicLayout } from './core/layout/public-layout/public-layout';

const OPS = ['ADMIN', 'DISPATCHER', 'STAFF'];
const DISPATCH = ['ADMIN', 'DISPATCHER'];

/**
 * Top-level routing. Each feature owns its child routes in
 * features/<name>/<name>.routes.ts and is lazy loaded here; `data.roles`
 * hides screens a role cannot use (the API enforces the same rules).
 */
export const routes: Routes = [
  { path: 'login', loadChildren: () => import('./features/authentication/authentication.routes').then((m) => m.AUTHENTICATION_ROUTES) },

  // Public tracking: no login required.
  {
    path: 'track',
    component: PublicLayout,
    loadChildren: () => import('./features/tracking/tracking.routes').then((m) => m.TRACKING_ROUTES),
  },

  // Mobile-first driver app.
  {
    path: 'driver',
    component: DriverShell,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['DRIVER'] },
    loadChildren: () => import('./features/deliveries/driver-app.routes').then((m) => m.DRIVER_APP_ROUTES),
  },

  // Back-office and customer portal.
  {
    path: '',
    component: AdminShell,
    canActivate: [authGuard],
    canActivateChild: [roleGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: () => inject(AuthService).homeUrl() },
      { path: 'dashboard', data: { roles: OPS }, loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES) },
      { path: 'shipments', data: { roles: [...OPS, 'CUSTOMER'] }, loadChildren: () => import('./features/shipments/shipments.routes').then((m) => m.SHIPMENTS_ROUTES) },
      { path: 'customers', data: { roles: OPS }, loadChildren: () => import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES) },
      { path: 'drivers', data: { roles: DISPATCH }, loadChildren: () => import('./features/drivers/drivers.routes').then((m) => m.DRIVERS_ROUTES) },
      { path: 'vehicles', data: { roles: DISPATCH }, loadChildren: () => import('./features/vehicles/vehicles.routes').then((m) => m.VEHICLES_ROUTES) },
      { path: 'assignments', data: { roles: DISPATCH }, loadChildren: () => import('./features/assignments/assignments.routes').then((m) => m.ASSIGNMENTS_ROUTES) },
      { path: 'deliveries', data: { roles: DISPATCH }, loadChildren: () => import('./features/deliveries/deliveries.routes').then((m) => m.DELIVERIES_ROUTES) },
      { path: 'payments', data: { roles: OPS }, loadChildren: () => import('./features/payments/payments.routes').then((m) => m.PAYMENTS_ROUTES) },
      { path: 'notifications', loadChildren: () => import('./features/notifications/notifications.routes').then((m) => m.NOTIFICATIONS_ROUTES) },
      { path: 'audit-logs', data: { roles: ['ADMIN'] }, loadChildren: () => import('./features/audit-logs/audit-logs.routes').then((m) => m.AUDIT_LOG_ROUTES) },
      { path: 'settings', loadChildren: () => import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES) },
    ],
  },
  { path: '**', redirectTo: '' },
];
