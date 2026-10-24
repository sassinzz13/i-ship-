import { ServiceType, ShipmentStatus } from '../../shipments/models/shipment.model';

export interface PublicTracking {
  trackingNumber: string;
  currentStatus: ShipmentStatus;
  serviceType: ServiceType;
  origin: { city: string; province: string };
  destination: { city: string; province: string };
  totalQuantity: number;
  estimatedDeliveryAt: string | null;
  actualDeliveryAt: string | null;
  createdAt: string;
  timeline: { status: ShipmentStatus; description: string; location: string | null; at: string }[];
}
