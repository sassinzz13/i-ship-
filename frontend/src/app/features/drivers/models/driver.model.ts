export type DriverStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED';
export type DriverAvailability = 'AVAILABLE' | 'ON_DELIVERY' | 'OFF_DUTY';

export const DRIVER_STATUSES: DriverStatus[] = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED'];
export const DRIVER_AVAILABILITY: DriverAvailability[] = ['AVAILABLE', 'ON_DELIVERY', 'OFF_DUTY'];

export interface Driver {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  employeeCode: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseExpired: boolean;
  phone: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  status: DriverStatus;
  availability: DriverAvailability;
  activeAssignments: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDriverInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  employeeCode: string;
  licenseNumber: string;
  licenseExpiry: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export interface UpdateDriverInput {
  fullName: string;
  phone: string;
  employeeCode: string;
  licenseNumber: string;
  licenseExpiry: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  status: DriverStatus;
  availability: DriverAvailability;
}
