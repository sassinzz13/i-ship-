import { Routes } from '@angular/router';

export const TRACKING_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/track-search/track-search').then((m) => m.TrackSearch), title: 'Track a shipment · i-Ship' },
  { path: ':trackingNumber', loadComponent: () => import('./pages/track-result/track-result').then((m) => m.TrackResult), title: 'Tracking · i-Ship' },
];
