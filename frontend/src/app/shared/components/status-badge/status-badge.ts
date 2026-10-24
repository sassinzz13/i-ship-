import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { labelize } from '../../pipes/labelize.pipe';

type Tone = 'gray' | 'blue' | 'indigo' | 'amber' | 'green' | 'red' | 'purple' | 'cyan';

/** Visual tone for every status value the API returns. */
const TONES: Record<string, Tone> = {
  // shipments
  PENDING: 'gray', CONFIRMED: 'blue', PICKED_UP: 'indigo', IN_TRANSIT: 'purple',
  OUT_FOR_DELIVERY: 'amber', DELIVERED: 'green', FAILED_DELIVERY: 'red', RETURNED: 'cyan', CANCELLED: 'gray',
  // assignments
  ASSIGNED: 'blue', ACCEPTED: 'indigo', IN_PROGRESS: 'amber', COMPLETED: 'green', REJECTED: 'red',
  // payments
  UNPAID: 'amber', PARTIALLY_PAID: 'blue', PAID: 'green', REFUNDED: 'cyan', FAILED: 'red',
  // drivers / vehicles
  ACTIVE: 'green', INACTIVE: 'gray', ON_LEAVE: 'amber', SUSPENDED: 'red',
  AVAILABLE: 'green', ON_DELIVERY: 'amber', OFF_DUTY: 'gray', IN_USE: 'amber', MAINTENANCE: 'red', RETIRED: 'gray',
  // attempts
  SUCCESSFUL: 'green', RECIPIENT_UNAVAILABLE: 'amber', WRONG_ADDRESS: 'red', REFUSED: 'red', DAMAGED_PACKAGE: 'red', OTHER: 'gray',
};

const CLASSES: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  purple: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
};

export function statusTone(status: string): Tone {
  return TONES[status] ?? 'gray';
}

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap" [class]="classes()">
    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<string>();
  readonly text = input<string>();
  protected readonly label = computed(() => this.text() ?? labelize(this.status()));
  protected readonly classes = computed(() => CLASSES[statusTone(this.status())]);
}
