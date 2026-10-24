import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { LabelizePipe } from '../../pipes/labelize.pipe';
import { statusTone } from '../status-badge/status-badge';

export interface TimelineEntry {
  status: string;
  at: string;
  notes?: string | null;
  location?: string | null;
  actor?: string | null;
}

const DOT: Record<string, string> = {
  gray: 'bg-slate-400', blue: 'bg-blue-500', indigo: 'bg-indigo-500', amber: 'bg-amber-500',
  green: 'bg-emerald-500', red: 'bg-rose-500', purple: 'bg-violet-500', cyan: 'bg-cyan-500',
};

/** Vertical status timeline, newest entry first. */
@Component({
  selector: 'app-timeline',
  imports: [DatePipe, LabelizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="relative ml-2 border-l border-slate-200">
      @for (e of entries(); track $index; let first = $first) {
        <li class="mb-6 ml-5 last:mb-0">
          <span class="absolute -left-[7px] mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white" [class]="dot(e.status)"></span>
          <p class="text-sm font-medium" [class.text-slate-900]="first" [class.text-slate-600]="!first">{{ e.status | labelize }}</p>
          <time class="block text-xs text-slate-500">{{ e.at | date: 'MMM d, y · h:mm a' }}</time>
          @if (e.location) { <p class="mt-1 text-xs text-slate-500">{{ e.location }}</p> }
          @if (e.notes) { <p class="mt-1 text-sm text-slate-600">{{ e.notes }}</p> }
          @if (e.actor) { <p class="mt-0.5 text-xs text-slate-400">by {{ e.actor }}</p> }
        </li>
      } @empty {
        <li class="ml-5 text-sm text-slate-500">No history yet.</li>
      }
    </ol>
  `,
})
export class Timeline {
  readonly entries = input<TimelineEntry[]>([]);
  protected dot(status: string): string {
    return DOT[statusTone(status)];
  }
}
