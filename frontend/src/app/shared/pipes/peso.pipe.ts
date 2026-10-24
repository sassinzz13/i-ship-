import { Pipe, PipeTransform } from '@angular/core';

const fmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

/** Formats amounts (numbers or numeric strings from the API) as PHP. */
@Pipe({ name: 'peso' })
export class PesoPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    const n = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(n) ? fmt.format(n) : '—';
  }
}
