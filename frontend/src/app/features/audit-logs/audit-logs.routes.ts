import { Routes } from '@angular/router';

export const AUDIT_LOG_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/audit-log-list/audit-log-list').then((m) => m.AuditLogList), title: 'Audit logs · i-Ship' },
];
