import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface DayPoint {
  date: string;
  created: number;
  delivered: number;
}

const W = 640;
const H = 220;
const PAD = { top: 16, right: 8, bottom: 28, left: 32 };

/** Grouped bar chart (created vs delivered per day) drawn as inline SVG. */
@Component({
  selector: 'app-shipments-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="h-56 w-full" role="img" [attr.aria-label]="summary()">
        @for (t of ticks(); track t.value) {
          <line [attr.x1]="pad.left" [attr.x2]="w - pad.right" [attr.y1]="t.y" [attr.y2]="t.y" class="stroke-slate-100" />
          <text [attr.x]="pad.left - 8" [attr.y]="t.y + 4" text-anchor="end" class="fill-slate-400 text-[11px]">{{ t.value }}</text>
        }
        @for (b of bars(); track b.date; let i = $index) {
          <g (mouseenter)="hover.set(i)" (mouseleave)="hover.set(null)" class="cursor-default">
            <rect [attr.x]="b.slotX" [attr.y]="pad.top" [attr.width]="b.slotW" [attr.height]="plotH" class="fill-transparent" />
            <rect [attr.x]="b.x1" [attr.y]="b.yCreated" [attr.width]="b.barW" [attr.height]="b.hCreated" rx="3" class="fill-brand-500" [attr.opacity]="hover() === null || hover() === i ? 1 : 0.4" />
            <rect [attr.x]="b.x2" [attr.y]="b.yDelivered" [attr.width]="b.barW" [attr.height]="b.hDelivered" rx="3" class="fill-emerald-500" [attr.opacity]="hover() === null || hover() === i ? 1 : 0.4" />
            <text [attr.x]="b.slotX + b.slotW / 2" [attr.y]="h - 8" text-anchor="middle" class="fill-slate-500 text-[11px]">{{ b.label }}</text>
          </g>
        }
      </svg>
      @if (hover() !== null && bars()[hover()!]; as b) {
        <div class="pointer-events-none absolute top-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          [style.left.%]="((b.slotX + b.slotW / 2) / w) * 100" style="transform: translateX(-50%)">
          <p class="font-medium text-slate-800">{{ b.long }}</p>
          <p class="text-brand-700">{{ b.created }} created</p>
          <p class="text-emerald-700">{{ b.delivered }} delivered</p>
        </div>
      }
    </div>
    <div class="mt-2 flex items-center justify-center gap-5 text-xs text-slate-600">
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-brand-500"></span> Created</span>
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-emerald-500"></span> Delivered</span>
    </div>
  `,
})
export class ShipmentsChart {
  readonly data = input<DayPoint[]>([]);
  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly plotH = H - PAD.top - PAD.bottom;
  protected readonly hover = signal<number | null>(null);

  private readonly max = computed(() => {
    const m = Math.max(1, ...this.data().flatMap((d) => [d.created, d.delivered]));
    // Round the axis up to a friendly number.
    const step = m <= 5 ? 1 : m <= 20 ? 5 : m <= 50 ? 10 : Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / step) * step;
  });

  protected readonly ticks = computed(() => {
    const max = this.max();
    return [0, 0.5, 1].map((f) => ({ value: Math.round(max * f), y: PAD.top + this.plotH * (1 - f) }));
  });

  protected readonly bars = computed(() => {
    const d = this.data();
    const slotW = (W - PAD.left - PAD.right) / Math.max(d.length, 1);
    const barW = Math.min(18, slotW * 0.3);
    const scale = (v: number) => (v / this.max()) * this.plotH;
    return d.map((p, i) => {
      const slotX = PAD.left + i * slotW;
      const mid = slotX + slotW / 2;
      const date = new Date(p.date + 'T00:00:00');
      return {
        ...p,
        slotX, slotW, barW,
        x1: mid - barW - 2,
        x2: mid + 2,
        hCreated: scale(p.created),
        yCreated: PAD.top + this.plotH - scale(p.created),
        hDelivered: scale(p.delivered),
        yDelivered: PAD.top + this.plotH - scale(p.delivered),
        label: date.toLocaleDateString('en-PH', { weekday: 'short' }),
        long: date.toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' }),
      };
    });
  });

  protected readonly summary = computed(() => {
    const d = this.data();
    const c = d.reduce((t, x) => t + x.created, 0);
    const v = d.reduce((t, x) => t + x.delivered, 0);
    return `Last ${d.length} days: ${c} shipments created, ${v} delivered`;
  });
}
