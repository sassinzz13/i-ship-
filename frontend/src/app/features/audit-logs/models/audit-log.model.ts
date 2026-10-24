export interface AuditLog {
  id: number;
  actorUserId: number | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  changes: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}
