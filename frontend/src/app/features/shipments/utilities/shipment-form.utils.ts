import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';

import { ServiceType } from '../models/shipment.model';

/** Published rate card (docs/API.md). The server quote is authoritative;
 *  this is only used as an offline estimate. */
export const RATE_CARD: Record<ServiceType, { base: number; perKg: number; label: string; eta: string }> = {
  STANDARD: { base: 80, perKg: 15, label: 'Standard', eta: '3–5 days' },
  NEXT_DAY: { base: 120, perKg: 20, label: 'Next day', eta: 'Next business day' },
  EXPRESS: { base: 150, perKg: 25, label: 'Express', eta: '1–2 days' },
  SAME_DAY: { base: 250, perKg: 30, label: 'Same day', eta: 'Within the day' },
};

export function estimateFee(service: ServiceType, weightKg: number): number {
  const r = RATE_CARD[service];
  return Math.round((r.base + r.perKg * Math.max(weightKg, 0)) * 100) / 100;
}

export type ItemForm = FormGroup<{
  description: FormControl<string>;
  quantity: FormControl<number>;
  weightKg: FormControl<number | null>;
  lengthCm: FormControl<number | null>;
  widthCm: FormControl<number | null>;
  heightCm: FormControl<number | null>;
  declaredValue: FormControl<number | null>;
}>;

export function newItemForm(fb: FormBuilder, v: Partial<ReturnType<ItemForm['getRawValue']>> = {}): ItemForm {
  return fb.nonNullable.group({
    description: [v.description ?? '', [Validators.required, Validators.maxLength(200)]],
    quantity: [v.quantity ?? 1, [Validators.required, Validators.min(1), Validators.max(10000)]],
    weightKg: fb.control<number | null>(v.weightKg ?? null, [Validators.required, Validators.min(0.01), Validators.max(10000)]),
    lengthCm: fb.control<number | null>(v.lengthCm ?? null, [Validators.min(0.1)]),
    widthCm: fb.control<number | null>(v.widthCm ?? null, [Validators.min(0.1)]),
    heightCm: fb.control<number | null>(v.heightCm ?? null, [Validators.min(0.1)]),
    declaredValue: fb.control<number | null>(v.declaredValue ?? null, [Validators.min(0)]),
  });
}

export interface ItemTotals {
  quantity: number;
  weight: number;
  declaredValue: number;
}

/** Mirrors the server's totals: weight = Σ quantity × weightKg. */
export function itemTotals(items: { quantity: number | null; weightKg: number | null; declaredValue: number | null }[]): ItemTotals {
  return items.reduce<ItemTotals>(
    (t, i) => ({
      quantity: t.quantity + (Number(i.quantity) || 0),
      weight: Math.round((t.weight + (Number(i.quantity) || 0) * (Number(i.weightKg) || 0)) * 100) / 100,
      declaredValue: t.declaredValue + (Number(i.declaredValue) || 0),
    }),
    { quantity: 0, weight: 0, declaredValue: 0 },
  );
}

/** ISO timestamp → value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO timestamp (or null). */
export function fromLocalInput(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
