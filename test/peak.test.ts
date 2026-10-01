import { describe, expect, it } from 'vitest';
import type { Peak } from '../src/config/config-schema';
import { isPeak, priceFactor } from '../src/routing/peak';

const peak: Peak = {
  windowsUtc: [
    [1, 4],
    [6, 10],
  ],
  weekdaysOnly: true,
  priceFactor: 2,
};

describe('isPeak', () => {
  it.each([
    ['2026-10-05T09:59:00Z', true, 'Monday 09:59'],
    ['2026-10-05T10:00:00Z', false, 'Monday 10:00'],
    ['2026-10-05T01:00:00Z', true, 'Monday 01:00'],
    ['2026-10-05T04:00:00Z', false, 'Monday 04:00'],
    ['2026-10-05T05:00:00Z', false, 'Monday 05:00'],
    ['2026-10-05T06:00:00Z', true, 'Monday 06:00'],
    ['2026-10-03T08:00:00Z', false, 'Saturday 08:00'],
    ['2026-10-04T08:00:00Z', false, 'Sunday 08:00'],
  ])('%s is peak=%s (%s)', (iso, expected) => {
    expect(isPeak(peak, new Date(iso))).toBe(expected);
  });

  it('counts weekends when weekdaysOnly is off', () => {
    expect(isPeak({ ...peak, weekdaysOnly: false }, new Date('2026-10-03T08:00:00Z'))).toBe(true);
  });

  it('is off-peak without a peak object', () => {
    expect(isPeak(undefined, new Date('2026-10-05T08:00:00Z'))).toBe(false);
  });
});

describe('priceFactor', () => {
  it('doubles at peak', () => {
    expect(priceFactor(peak, new Date('2026-10-05T09:59:00Z'))).toBe(2);
  });

  it('is 1 off-peak and on weekends', () => {
    expect(priceFactor(peak, new Date('2026-10-05T10:00:00Z'))).toBe(1);
    expect(priceFactor(peak, new Date('2026-10-03T08:00:00Z'))).toBe(1);
  });

  it('is 1 without a peak object', () => {
    expect(priceFactor(undefined, new Date('2026-10-05T08:00:00Z'))).toBe(1);
  });
});
