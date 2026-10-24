import { Routes } from '@angular/router';

export const VEHICLES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/vehicle-list/vehicle-list').then((m) => m.VehicleList), title: 'Vehicles · i-Ship' },
];
