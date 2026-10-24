import { Role } from '../auth/auth.models';

export interface NavItem {
  label: string;
  icon: string;
  path: string;
  roles: Role[];
}

const OPS: Role[] = ['ADMIN', 'DISPATCHER', 'STAFF'];
const DISPATCH: Role[] = ['ADMIN', 'DISPATCHER'];

/** Sidebar entries. Visibility mirrors backend RBAC; the server remains the
 *  source of truth for authorization. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'home', path: '/dashboard', roles: OPS },
  { label: 'Shipments', icon: 'cube', path: '/shipments', roles: OPS },
  { label: 'My shipments', icon: 'cube', path: '/shipments', roles: ['CUSTOMER'] },
  { label: 'Customers', icon: 'users', path: '/customers', roles: OPS },
  { label: 'Drivers', icon: 'id', path: '/drivers', roles: DISPATCH },
  { label: 'Vehicles', icon: 'truck', path: '/vehicles', roles: DISPATCH },
  { label: 'Assignments', icon: 'clipboard', path: '/assignments', roles: DISPATCH },
  { label: 'Deliveries', icon: 'check-circle', path: '/deliveries', roles: DISPATCH },
  { label: 'Payments', icon: 'banknotes', path: '/payments', roles: OPS },
  { label: 'Tracking', icon: 'map-pin', path: '/track', roles: [...OPS, 'CUSTOMER'] },
  { label: 'Notifications', icon: 'bell', path: '/notifications', roles: [...OPS, 'CUSTOMER'] },
  { label: 'Audit logs', icon: 'document', path: '/audit-logs', roles: ['ADMIN'] },
  { label: 'Users', icon: 'user', path: '/settings/users', roles: ['ADMIN'] },
  { label: 'Settings', icon: 'cog', path: '/settings', roles: [...OPS, 'CUSTOMER'] },
];
