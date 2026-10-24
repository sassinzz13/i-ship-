import { Routes } from '@angular/router';

import { roleGuard } from '../../core/guards/auth.guard';

const OPS = ['ADMIN', 'DISPATCHER', 'STAFF'];

export const SHIPMENTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/shipment-list/shipment-list').then((m) => m.ShipmentList), title: 'Shipments · i-Ship' },
  {
    path: 'new',
    canActivate: [roleGuard],
    data: { roles: OPS },
    loadComponent: () => import('./pages/shipment-form/shipment-form').then((m) => m.ShipmentForm),
    title: 'New shipment · i-Ship',
  },
  { path: ':id', loadComponent: () => import('./pages/shipment-detail/shipment-detail').then((m) => m.ShipmentDetail), title: 'Shipment · i-Ship' },
  {
    path: ':id/edit',
    canActivate: [roleGuard],
    data: { roles: OPS },
    loadComponent: () => import('./pages/shipment-form/shipment-form').then((m) => m.ShipmentForm),
    title: 'Edit shipment · i-Ship',
  },
];
