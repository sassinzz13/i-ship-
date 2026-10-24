export type VehicleType = 'MOTORCYCLE' | 'CAR' | 'VAN' | 'TRUCK';
export type VehicleStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';

export const VEHICLE_TYPES: VehicleType[] = ['MOTORCYCLE', 'CAR', 'VAN', 'TRUCK'];
export const VEHICLE_STATUSES: VehicleStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];

export interface Vehicle {
  id: number;
  plateNumber: string;
  vehicleType: VehicleType;
  brand: string;
  model: string;
  year: number | null;
  weightCapacityKg: number;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleInput {
  plateNumber: string;
  vehicleType: VehicleType;
  brand: string;
  model: string;
  year?: number | null;
  weightCapacityKg: number;
  status?: VehicleStatus;
}
