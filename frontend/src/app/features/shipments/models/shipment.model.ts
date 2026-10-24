import { UserRef } from '../../../shared/models/common.model';
import { Address } from '../../addresses/models/address.model';

export type ShipmentStatus =
  | 'PENDING' | 'CONFIRMED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'FAILED_DELIVERY' | 'RETURNED' | 'CANCELLED';
export type ServiceType = 'STANDARD' | 'EXPRESS' | 'SAME_DAY' | 'NEXT_DAY';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'PENDING', 'CONFIRMED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED', 'CANCELLED',
];
export const SERVICE_TYPES: ServiceType[] = ['STANDARD', 'NEXT_DAY', 'EXPRESS', 'SAME_DAY'];
export const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'];

export interface ShipmentSummary {
  id: number;
  trackingNumber: string;
  customerId: number;
  customerName: string;
  recipientName: string;
  recipientCity: string;
  recipientProvince: string;
  serviceType: ServiceType;
  currentStatus: ShipmentStatus;
  paymentStatus: PaymentStatus;
  totalWeight: number;
  totalQuantity: number;
  shippingFee: number;
  estimatedDeliveryAt: string | null;
  createdAt: string;
}

export interface ShipmentItem {
  id: number;
  description: string;
  quantity: number;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  declaredValue: number;
}

export interface Shipment extends ShipmentSummary {
  customer: { id: number; customerCode: string; fullName: string; phone: string; email: string | null };
  sender: Address;
  recipient: Address;
  declaredValue: number;
  specialInstructions: string | null;
  cancellationReason: string | null;
  scheduledPickupAt: string | null;
  actualDeliveryAt: string | null;
  updatedAt: string;
  items: ShipmentItem[];
  allowedTransitions: ShipmentStatus[];
}

export interface ShipmentItemInput {
  description: string;
  quantity: number;
  weightKg: number;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  declaredValue?: number | null;
}

export interface ShipmentInput {
  customerId?: number;
  senderAddressId: number;
  recipientAddressId: number;
  serviceType: ServiceType;
  declaredValue?: number | null;
  shippingFee?: number | null;
  specialInstructions?: string | null;
  scheduledPickupAt?: string | null;
  estimatedDeliveryAt?: string | null;
  items: ShipmentItemInput[];
}

export interface StatusHistory {
  id: number;
  fromStatus: ShipmentStatus | null;
  toStatus: ShipmentStatus;
  notes: string | null;
  location: string | null;
  changedBy: UserRef | null;
  createdAt: string;
}

export interface Quote {
  serviceType: ServiceType;
  weight: number;
  shippingFee: number;
}
