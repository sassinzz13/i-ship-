import { UserRef } from '../../../shared/models/common.model';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'GCASH' | 'MAYA' | 'OTHER';
export type PaymentRecordStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'GCASH', 'MAYA', 'OTHER'];
export const PAYMENT_RECORD_STATUSES: PaymentRecordStatus[] = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];

export interface Payment {
  id: number;
  shipmentId: number;
  trackingNumber: string;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  status: PaymentRecordStatus;
  paidAt: string | null;
  notes: string | null;
  recordedBy: UserRef | null;
  createdAt: string;
}

export interface PaymentInput {
  shipmentId: number;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  status: 'PENDING' | 'PAID';
  paidAt?: string | null;
  notes?: string | null;
}
