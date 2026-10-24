import { ShipmentStatus } from '../../shipments/models/shipment.model';

export type StepState = 'done' | 'current' | 'upcoming' | 'problem';

export interface TrackingStep {
  status: ShipmentStatus;
  label: string;
  state: StepState;
}

/** The happy-path journey shown in the stepper. */
export const MAIN_STEPS: { status: ShipmentStatus; label: string }[] = [
  { status: 'PENDING', label: 'Booked' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'PICKED_UP', label: 'Picked up' },
  { status: 'IN_TRANSIT', label: 'In transit' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { status: 'DELIVERED', label: 'Delivered' },
];

export type Outcome = 'progress' | 'delivered' | 'attention' | 'returned' | 'cancelled';

export function outcomeOf(status: ShipmentStatus): Outcome {
  switch (status) {
    case 'DELIVERED':
      return 'delivered';
    case 'FAILED_DELIVERY':
      return 'attention';
    case 'RETURNED':
      return 'returned';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'progress';
  }
}

/**
 * Builds stepper state. Alternate states (failed delivery, returned,
 * cancelled) mark the furthest step reached in the history as the problem
 * point; everything after it stays upcoming.
 */
export function trackingSteps(current: ShipmentStatus, history: ShipmentStatus[]): TrackingStep[] {
  const idx = (s: ShipmentStatus) => MAIN_STEPS.findIndex((m) => m.status === s);
  const reached = Math.max(idx(current), ...history.map(idx), 0);
  const outcome = outcomeOf(current);

  return MAIN_STEPS.map((m, i) => {
    let state: StepState;
    if (outcome === 'delivered') state = 'done';
    else if (outcome === 'progress') state = i < reached ? 'done' : i === reached ? 'current' : 'upcoming';
    else if (outcome === 'attention') {
      // A failed attempt happens while out for delivery.
      const at = idx('OUT_FOR_DELIVERY');
      state = i < at ? 'done' : i === at ? 'problem' : 'upcoming';
    } else state = i < reached ? 'done' : i === reached ? 'problem' : 'upcoming';
    return { ...m, state };
  });
}

/** Percentage of the journey completed, for the progress bar. */
export function progressPercent(steps: TrackingStep[]): number {
  const last = steps.reduce((acc, s, i) => (s.state !== 'upcoming' ? i : acc), 0);
  return Math.round((last / (steps.length - 1)) * 100);
}
