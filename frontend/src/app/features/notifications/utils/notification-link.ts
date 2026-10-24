import { Role } from '../../../core/auth/auth.models';
import { AppNotification } from '../models/notification.model';

/** Where a notification should take the user, by entity and role. */
export function notificationLink(n: Pick<AppNotification, 'entityType' | 'entityId'>, role: Role | null): string | null {
  const driver = role === 'DRIVER';
  switch (n.entityType) {
    case 'shipment':
      if (driver) return '/driver';
      return n.entityId ? `/shipments/${n.entityId}` : '/shipments';
    case 'assignment':
      if (driver) return n.entityId ? `/driver/assignments/${n.entityId}` : '/driver';
      return '/assignments';
    case 'payment':
      return driver ? null : '/payments';
    default:
      return null;
  }
}
