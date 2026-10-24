import { Routes } from '@angular/router';

export const ASSIGNMENTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/assignment-board/assignment-board').then((m) => m.AssignmentBoard), title: 'Assignments · i-Ship' },
];
