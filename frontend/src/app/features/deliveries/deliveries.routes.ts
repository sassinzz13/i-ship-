import { Routes } from '@angular/router';

export const DELIVERIES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/delivery-log/delivery-log').then((m) => m.DeliveryLog), title: 'Deliveries · i-Ship' },
];
