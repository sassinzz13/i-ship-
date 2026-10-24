export type LicenseState = 'expired' | 'expiring' | 'valid';

/** Days before expiry at which a license is flagged. */
export const LICENSE_WARNING_DAYS = 30;

/**
 * Classifies a YYYY-MM-DD license expiry date relative to `today`. A license
 * expiring today is still valid for today but flagged as expiring.
 */
export function licenseState(expiry: string, today: Date = new Date()): LicenseState {
  const [y, m, d] = expiry.split('-').map(Number);
  if (!y || !m || !d) return 'valid';
  const exp = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((exp - now) / 86_400_000);
  if (days < 0) return 'expired';
  if (days <= LICENSE_WARNING_DAYS) return 'expiring';
  return 'valid';
}

export function daysUntil(expiry: string, today: Date = new Date()): number {
  const [y, m, d] = expiry.split('-').map(Number);
  const exp = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((exp - now) / 86_400_000);
}
