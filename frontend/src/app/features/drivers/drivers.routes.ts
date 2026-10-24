import { Routes } from '@angular/router';

export const DRIVERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/driver-list/driver-list').then((m) => m.DriverList), title: 'Drivers · i-Ship' },
  { path: ':id', loadComponent: () => import('./pages/driver-detail/driver-detail').then((m) => m.DriverDetail), title: 'Driver · i-Ship' },
];
