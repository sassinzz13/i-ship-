import { Routes } from '@angular/router';

/** Mobile driver app, rendered inside DriverShell at /driver. */
export const DRIVER_APP_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/driver-home/driver-home').then((m) => m.DriverHome), title: 'My deliveries · i-Ship' },
  { path: 'history', loadComponent: () => import('./pages/driver-history/driver-history').then((m) => m.DriverHistory), title: 'History · i-Ship' },
  { path: 'profile', loadComponent: () => import('./pages/driver-profile/driver-profile').then((m) => m.DriverProfile), title: 'Profile · i-Ship' },
  { path: 'assignments/:id', loadComponent: () => import('./pages/driver-task/driver-task').then((m) => m.DriverTask), title: 'Delivery · i-Ship' },
  { path: 'assignments/:id/deliver', loadComponent: () => import('./pages/driver-deliver/driver-deliver').then((m) => m.DriverDeliver), title: 'Proof of delivery · i-Ship' },
  { path: 'assignments/:id/fail', loadComponent: () => import('./pages/driver-fail/driver-fail').then((m) => m.DriverFail), title: 'Failed attempt · i-Ship' },
];
