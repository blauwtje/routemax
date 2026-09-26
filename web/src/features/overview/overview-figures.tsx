import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import type { PeriodStats, StatsResponse } from '@/lib/api-types';
import { formatUsd } from '@/lib/format';
import { getTierColors } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';

const TIER_ORDER = ['flash-low', 'flash-high', 'pro-high', 'claude'] as const;

export const PERIODS = [
  { key: 'week', label: 'This week' },
  { key: 'today', label: 'Today' },
] as const;

export type Period = (typeof PERIODS)[number]['key'];

interface OverviewFiguresProps {
  budget: StatsResponse['budget'];
  stats: PeriodStats;
  period: Period;
  onPeriodChange: (period: Period) => void;
}

/**
 * The hero band's budget line: a segmented bar in tier hues that sweeps in on mount (scaleX
 * from 0, expo, staggered per segment), plus the This week/Today segmented control with a
 * sliding thumb (contract: kinetic-figures / stat-wall). No new keyframe: the sweep and the
 * thumb both use a CSS transition armed after the first paint, so prefers-reduced-motion's
 * global near-zero transition-duration rule already removes the travel.
 */
export function OverviewFigures({ budget, stats, period, onPeriodChange }: OverviewFiguresProps) {
  const [swept, setSwept] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSwept(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const total = budget.totalUsd;
  const segments = TIER_ORDER.map((tier) => {
    const costUsd = stats.byTier[tier]?.costUsd ?? 0;
    const percent = total > 0 ? Math.min(100, (costUsd / total) * 100) : 0;
    return { tier, costUsd, percent };
  });
  const filledPercent = segments.reduce((sum, segment) => sum + segment.percent, 0);
  const remainderPercent = Math.max(0, 100 - filledPercent);
  const railSummary = segments.map((segment) => `${segment.tier}: ${formatUsd(segment.costUsd)}`).join(', ');
  const activeIndex = PERIODS.findIndex((entry) => entry.key === period);

  return (
    <div className="overview-budget flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <p>
          <span className="font-mono tabular-nums">{formatUsd(budget.spentUsd)}</span> of{' '}
          <span className="font-mono tabular-nums">{formatUsd(budget.totalUsd)}</span> this week
        </p>
        <p className="text-muted-foreground">
          <span className="font-mono tabular-nums">{formatUsd(budget.leftUsd)}</span> left
        </p>
      </div>
      <div
        role="img"
        aria-label={`Budget for the period: ${railSummary}, ${formatUsd(budget.leftUsd)} unfilled of ${formatUsd(total)} total`}
        className="overview-budget-rail flex h-3.5 w-full overflow-hidden rounded-full bg-surface-2 shadow-well"
      >
        {segments.map((segment, index) => (
          <span
            key={segment.tier}
            aria-hidden="true"
            className={cn('h-full flex-shrink-0 origin-left motion-safe:transition-transform ease-out-expo', getTierColors(segment.tier).dot)}
            style={
              {
                width: `${segment.percent}%`,
                minWidth: segment.costUsd > 0 ? 4 : 0,
                transform: swept ? 'scaleX(1)' : 'scaleX(0)',
                transitionDuration: 'var(--dur-sparkline)',
                transitionDelay: `calc(var(--stagger-sparkline) * ${index})`,
              } as CSSProperties
            }
          />
        ))}
        <span aria-hidden="true" className="h-full" style={{ width: `${remainderPercent}%` } as CSSProperties} />
      </div>
      <div
        className="overview-period-toggle relative grid w-fit grid-cols-2 rounded-full border border-border bg-surface-2 p-1"
        role="group"
        aria-label="Breakdown period"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-1 rounded-full bg-surface-1 shadow-well motion-safe:transition-transform ease-out-expo"
          style={{
            width: 'calc(50% - 0.25rem)',
            left: '0.25rem',
            transitionDuration: '200ms',
            transform: activeIndex === 1 ? 'translateX(calc(100% + 0.25rem))' : 'translateX(0px)',
          }}
        />
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={period === key}
            onClick={() => onPeriodChange(key)}
            className={cn(
              'relative z-10 min-h-6 rounded-full px-3 py-1.5 text-center text-sm font-medium transition-colors ease-out-expo',
              period === key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
