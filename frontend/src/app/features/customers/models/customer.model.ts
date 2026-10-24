export type CustomerType = 'INDIVIDUAL' | 'BUSINESS';

export interface Customer {
  id: number;
  customerCode: string;
  userId: number | null;
  customerType: CustomerType;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string;
  notes: string | null;
  isActive: boolean;
  hasPortalAccount: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInput {
  customerType?: CustomerType;
  fullName: string;
  companyName?: string | null;
  email?: string | null;
  phone: string;
  notes?: string | null;
  isActive?: boolean;
  portalAccount?: { email: string; password: string } | null;
}
