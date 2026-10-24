import { estimateFee, fromLocalInput, itemTotals, toLocalInput } from './shipment-form.utils';

describe('shipment form utilities', () => {
  it('computes totals as quantity × weight', () => {
    const t = itemTotals([
      { quantity: 2, weightKg: 1.25, declaredValue: 500 },
      { quantity: 1, weightKg: 3, declaredValue: null },
    ]);
    expect(t).toEqual({ quantity: 3, weight: 5.5, declaredValue: 500 });
  });

  it('estimates fees from the rate card', () => {
    expect(estimateFee('STANDARD', 2)).toBe(110);
    expect(estimateFee('SAME_DAY', 0)).toBe(250);
  });

  it('round-trips datetime-local values', () => {
    const local = '2026-10-24T14:30';
    expect(toLocalInput(fromLocalInput(local))).toBe(local);
    expect(fromLocalInput('')).toBeNull();
    expect(toLocalInput(null)).toBe('');
  });
});
