import { driverAssignable, vehicleFits } from './new-assignment-dialog';
import { tabToParams } from '../../pages/assignment-board/assignment-board';

describe('assignment rules (client-side hints)', () => {
  it('vehicle must be in service and large enough', () => {
    expect(vehicleFits({ status: 'AVAILABLE', weightCapacityKg: 100 }, 80)).toBe(true);
    expect(vehicleFits({ status: 'IN_USE', weightCapacityKg: 80 }, 80)).toBe(true);
    expect(vehicleFits({ status: 'AVAILABLE', weightCapacityKg: 50 }, 80)).toBe(false);
    expect(vehicleFits({ status: 'MAINTENANCE', weightCapacityKg: 500 }, 1)).toBe(false);
    expect(vehicleFits({ status: 'RETIRED', weightCapacityKg: 500 }, 1)).toBe(false);
  });

  it('driver must be active, on duty and licensed', () => {
    expect(driverAssignable({ status: 'ACTIVE', availability: 'AVAILABLE', licenseExpired: false })).toBe(true);
    expect(driverAssignable({ status: 'ACTIVE', availability: 'ON_DELIVERY', licenseExpired: false })).toBe(true);
    expect(driverAssignable({ status: 'ACTIVE', availability: 'OFF_DUTY', licenseExpired: false })).toBe(false);
    expect(driverAssignable({ status: 'ON_LEAVE', availability: 'AVAILABLE', licenseExpired: false })).toBe(false);
    expect(driverAssignable({ status: 'ACTIVE', availability: 'AVAILABLE', licenseExpired: true })).toBe(false);
  });

  it('maps board tabs to API filters', () => {
    expect(tabToParams({ tab: 'active', page: 2 })).toEqual({ active: true, page: 2 });
    expect(tabToParams({})).toEqual({ active: true });
    expect(tabToParams({ tab: 'COMPLETED', driverId: '3' })).toEqual({ status: 'COMPLETED', driverId: '3' });
  });
});
