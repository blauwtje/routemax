import type { Peak } from '../config/config-schema';

// Windows are [startHour, endHour) in UTC.
export function isPeak(peak: Peak | undefined, now: Date): boolean {
  if (!peak) return false;
  const day = now.getUTCDay();
  if (peak.weekdaysOnly && (day === 0 || day === 6)) return false;
  const hour = now.getUTCHours();
  return peak.windowsUtc.some(([start, end]) => hour >= start && hour < end);
}

export function priceFactor(peak: Peak | undefined, now: Date): number {
  if (!peak || !isPeak(peak, now)) return 1;
  return peak.priceFactor;
}
