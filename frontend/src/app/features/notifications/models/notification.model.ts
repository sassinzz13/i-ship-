export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: number | null;
  readAt: string | null;
  createdAt: string;
}
