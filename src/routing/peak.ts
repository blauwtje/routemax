// Windows are [startHour, endHour) in UTC; Task 1's schema must use the same shape.
export interface PeakConfig {
  windowsUtc: [number, number][];
  weekdaysOnly: boolean;
  priceFactor: number;
}

export function isPeak(peak: PeakConfig | undefined, now: Date): boolean {
  if (!peak) return false;
  const day = now.getUTCDay();
  if (peak.weekdaysOnly && (day === 0 || day === 6)) return false;
  const hour = now.getUTCHours();
  return peak.windowsUtc.some(([start, end]) => hour >= start && hour < end);
}

export function priceFactor(peak: PeakConfig | undefined, now: Date): number {
  if (!peak || !isPeak(peak, now)) return 1;
  return peak.priceFactor;
}
