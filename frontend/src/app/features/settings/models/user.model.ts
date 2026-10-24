import { Role } from '../../../core/auth/auth.models';

export interface UserRecord {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
