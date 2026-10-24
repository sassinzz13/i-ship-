import { outcomeOf, progressPercent, trackingSteps } from './tracking-progress';

const states = (s: ReturnType<typeof trackingSteps>) => s.map((x) => x.state);

describe('tracking progress', () => {
  it('marks steps before the current one as done', () => {
    const steps = trackingSteps('IN_TRANSIT', ['PENDING', 'CONFIRMED', 'PICKED_UP', 'IN_TRANSIT']);
    expect(states(steps)).toEqual(['done', 'done', 'done', 'current', 'upcoming', 'upcoming']);
    expect(progressPercent(steps)).toBe(60);
  });

  it('completes every step when delivered', () => {
    const steps = trackingSteps('DELIVERED', ['PENDING', 'DELIVERED']);
    expect(states(steps).every((s) => s === 'done')).toBe(true);
    expect(progressPercent(steps)).toBe(100);
  });

  it('flags the out-for-delivery step on a failed attempt', () => {
    const steps = trackingSteps('FAILED_DELIVERY', ['PENDING', 'CONFIRMED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'FAILED_DELIVERY']);
    expect(states(steps)).toEqual(['done', 'done', 'done', 'done', 'problem', 'upcoming']);
  });

  it('flags the furthest reached step for returned and cancelled shipments', () => {
    expect(states(trackingSteps('RETURNED', ['PENDING', 'CONFIRMED', 'PICKED_UP', 'RETURNED']))).toEqual([
      'done', 'done', 'problem', 'upcoming', 'upcoming', 'upcoming',
    ]);
    expect(states(trackingSteps('CANCELLED', ['PENDING', 'CANCELLED']))).toEqual([
      'problem', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
    ]);
  });

  it('classifies outcomes', () => {
    expect(outcomeOf('OUT_FOR_DELIVERY')).toBe('progress');
    expect(outcomeOf('FAILED_DELIVERY')).toBe('attention');
    expect(outcomeOf('CANCELLED')).toBe('cancelled');
  });
});
