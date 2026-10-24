export interface AddressInput {
  label?: string;
  contactName: string;
  contactPhone: string;
  line1: string;
  line2?: string | null;
  barangay?: string | null;
  city: string;
  province: string;
  postalCode?: string | null;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}

export interface Address extends Required<Pick<AddressInput, 'label' | 'contactName' | 'contactPhone' | 'line1' | 'city' | 'province'>> {
  id: number;
  customerId: number;
  line2: string | null;
  barangay: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Single-line rendering used in tables and pickers. */
export function formatAddress(a: Pick<Address, 'line1' | 'line2' | 'barangay' | 'city' | 'province'>): string {
  return [a.line1, a.line2, a.barangay, a.city, a.province].filter(Boolean).join(', ');
}
