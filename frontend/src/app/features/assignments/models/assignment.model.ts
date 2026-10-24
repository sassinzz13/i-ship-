import { UserRef } from '../../../shared/models/common.model';
import { ServiceType, ShipmentStatus } from '../../shipments/models/shipment.model';
import { VehicleType } from '../../vehicles/models/vehicle.model';

export type AssignmentStatus = 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'];
export const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'];

export interface Assignment {
  id: number;
  shipmentId: number;
  driverId: number;
  vehicleId: number;
  status: AssignmentStatus;
  notes: string | null;
  assignedAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  shipment: {
    id: number;
    trackingNumber: string;
    currentStatus: ShipmentStatus;
    serviceType: ServiceType;
    totalWeight: number;
    totalQuantity: number;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    recipientCity: string;
    specialInstructions: string | null;
    estimatedDeliveryAt: string | null;
  };
  driver: { id: number; fullName: string; employeeCode: string; phone: string };
  vehicle: { id: number; plateNumber: string; vehicleType: VehicleType; brand: string; model: string };
  assignedBy: UserRef | null;
}

export interface CreateAssignmentInput {
  shipmentId: number;
  driverId: number;
  vehicleId: number;
  notes?: string | null;
}
