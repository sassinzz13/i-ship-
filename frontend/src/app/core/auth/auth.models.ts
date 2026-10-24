export type Role = 'ADMIN' | 'DISPATCHER' | 'STAFF' | 'DRIVER' | 'CUSTOMER';

export const OPERATIONS_ROLES: Role[] = ['ADMIN', 'DISPATCHER', 'STAFF'];
export const DISPATCH_ROLES: Role[] = ['ADMIN', 'DISPATCHER'];

export interface CurrentUser {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  customerId: number | null;
  driverId: number | null;
  lastLoginAt: string | null;
}

export interface SessionResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  expiresIn: number;
  user: CurrentUser;
}
