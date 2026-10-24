import { fitWithin } from './image';

describe('fitWithin', () => {
  it('scales landscape photos to the max width', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales portrait photos to the max height', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('never upscales small images', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('handles square and degenerate inputs', () => {
    expect(fitWithin(2000, 2000, 1600)).toEqual({ width: 1600, height: 1600 });
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
  });
});
