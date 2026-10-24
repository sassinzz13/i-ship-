import { daysUntil, licenseState } from './license';

describe('licenseState', () => {
  const today = new Date(2026, 9, 24); // Oct 24, 2026 local

  it('flags licenses that expired before today', () => {
    expect(licenseState('2026-10-23', today)).toBe('expired');
    expect(licenseState('2025-01-01', today)).toBe('expired');
  });

  it('flags licenses expiring today or within 30 days', () => {
    expect(licenseState('2026-10-24', today)).toBe('expiring');
    expect(licenseState('2026-11-23', today)).toBe('expiring');
  });

  it('treats licenses beyond the warning window as valid', () => {
    expect(licenseState('2026-11-24', today)).toBe('valid');
    expect(licenseState('2030-05-01', today)).toBe('valid');
  });

  it('ignores malformed dates', () => {
    expect(licenseState('', today)).toBe('valid');
  });

  it('counts whole days until expiry', () => {
    expect(daysUntil('2026-10-31', today)).toBe(7);
    expect(daysUntil('2026-10-20', today)).toBe(-4);
  });
});
