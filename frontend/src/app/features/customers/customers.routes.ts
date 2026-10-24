import { Routes } from '@angular/router';

export const CUSTOMERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/customer-list/customer-list').then((m) => m.CustomerList), title: 'Customers · i-Ship' },
  { path: ':id', loadComponent: () => import('./pages/customer-detail/customer-detail').then((m) => m.CustomerDetail), title: 'Customer · i-Ship' },
];
