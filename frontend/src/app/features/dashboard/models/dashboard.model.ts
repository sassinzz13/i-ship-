import { ShipmentSummary } from '../../shipments/models/shipment.model';

export interface DashboardSummary {
  shipments: {
    total: number; pending: number; confirmed: number; pickedUp: number; inTransit: number; outForDelivery: number;
    delivered: number; failedDelivery: number; returned: number; cancelled: number;
  };
  activeDrivers: number;
  availableDrivers: number;
  availableVehicles: number;
  pendingAssignments: number;
  unassignedShipments: number;
  deliveredToday: number;
  revenueToday: number;
  shipmentsByDay: { date: string; created: number; delivered: number }[];
  recentShipments: ShipmentSummary[];
}
