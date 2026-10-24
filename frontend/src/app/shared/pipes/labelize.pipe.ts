import { Pipe, PipeTransform } from '@angular/core';

/** Turns enum values like OUT_FOR_DELIVERY into "Out for delivery". */
export function labelize(value: string | null | undefined): string {
  if (!value) return '';
  const s = value.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

@Pipe({ name: 'labelize' })
export class LabelizePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return labelize(value);
  }
}
