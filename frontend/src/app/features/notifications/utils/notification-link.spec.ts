import { notificationLink } from './notification-link';

describe('notificationLink', () => {
  it('routes shipment notifications by role', () => {
    expect(notificationLink({ entityType: 'shipment', entityId: 12 }, 'CUSTOMER')).toBe('/shipments/12');
    expect(notificationLink({ entityType: 'shipment', entityId: 12 }, 'DRIVER')).toBe('/driver');
  });

  it('routes assignment notifications by role', () => {
    expect(notificationLink({ entityType: 'assignment', entityId: 4 }, 'DRIVER')).toBe('/driver/assignments/4');
    expect(notificationLink({ entityType: 'assignment', entityId: 4 }, 'DISPATCHER')).toBe('/assignments');
  });

  it('returns null for unknown entities', () => {
    expect(notificationLink({ entityType: null, entityId: null }, 'ADMIN')).toBeNull();
  });
});
