import { UserRef } from '../../../shared/models/common.model';

export type AttemptOutcome = 'SUCCESSFUL' | 'RECIPIENT_UNAVAILABLE' | 'WRONG_ADDRESS' | 'REFUSED' | 'DAMAGED_PACKAGE' | 'OTHER';
export const FAILED_OUTCOMES: Exclude<AttemptOutcome, 'SUCCESSFUL'>[] = [
  'RECIPIENT_UNAVAILABLE', 'WRONG_ADDRESS', 'REFUSED', 'DAMAGED_PACKAGE', 'OTHER',
];
export const ATTEMPT_OUTCOMES: AttemptOutcome[] = ['SUCCESSFUL', ...FAILED_OUTCOMES];

export type RecipientRelationship = 'SELF' | 'FAMILY' | 'FRIEND' | 'NEIGHBOR' | 'COLLEAGUE' | 'SECURITY_GUARD' | 'OTHER';
export const RECIPIENT_RELATIONSHIPS: RecipientRelationship[] = ['SELF', 'FAMILY', 'FRIEND', 'NEIGHBOR', 'COLLEAGUE', 'SECURITY_GUARD', 'OTHER'];

export interface DeliveryAttempt {
  id: number;
  shipmentId: number;
  trackingNumber: string;
  assignmentId: number;
  attemptNumber: number;
  outcome: AttemptOutcome;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  attemptedAt: string;
  driverName: string | null;
  recordedBy: UserRef | null;
}

export interface ProofOfDelivery {
  id: number;
  shipmentId: number;
  attemptId: number;
  recipientName: string;
  recipientRelationship: RecipientRelationship;
  notes: string | null;
  deliveredAt: string;
  hasSignature: boolean;
  hasPhoto: boolean;
  createdBy: UserRef | null;
}

export interface DeliveryRecord {
  attempts: DeliveryAttempt[];
  proof: ProofOfDelivery | null;
}

export interface FailedAttemptInput {
  outcome: Exclude<AttemptOutcome, 'SUCCESSFUL'>;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ProofInput {
  recipientName: string;
  recipientRelationship: RecipientRelationship;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  signature?: Blob | null;
  photo?: Blob | null;
}
