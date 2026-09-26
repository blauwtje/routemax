import type { CSSProperties } from 'react';
import { Sparkline } from '@/components/sparkline';
import { TierChip } from '@/components/tier-chip';
import { useCountUp } from '@/hooks/use-count-up';
import { formatUsd } from '@/lib/format';
import { getTierColors } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';
import './tier-stat-card.css';

interface TierStatCardProps {
  tier: string;
  label: string;
  calls: number;
  costUsd: number;
  costNote?: string;
  share: number;
  sparklineValues: number[];
  index: number;
}

/**
 * One tier's stat wall card: count-up spend, calls, share and a 7-day sparkline, all in the
 * tier's hue (contract: kinetic-figures / tier-regions). Entrance rises 8px with a per-card
 * stagger, driven by the tier-stat-card-enter CSS keyframe (see tier-stat-card.css) so the
 * wall's resting state is opacity 1 / translateY(0) and a missed or throttled animation frame
 * can never leave a card invisible; figures and the rise both render at final state under
 * prefers-reduced-motion.
 */
export function TierStatCard({ tier, label, calls, costUsd, costNote, share, sparklineValues, index }: TierStatCardProps) {
  const colors = getTierColors(tier);
  const spend = useCountUp(costUsd, 700);
  const callsDisplay = Math.round(useCountUp(calls, 700));

  return (
    <div
      className={cn(
        'tier-stat-card group relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface-1 p-4 shadow-panel',
        colors.text,
      )}
      style={{ '--tier-card-delay': `calc(var(--stagger-card) * ${index})` } as CSSProperties}
    >
      <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-px', colors.dot)} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 shadow-[0_0_32px_-8px_currentColor] transition-opacity duration-200 ease-out-expo group-hover:opacity-60"
      />
      <TierChip tier={tier} label={label} />
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-[32px] leading-none font-medium tracking-[-0.02em] tabular-nums text-foreground">
          {formatUsd(spend)}
        </span>
        {costNote !== undefined && (
          <span
            className="text-xs text-muted-foreground"
            title="Estimated from Claude Code's session logs on this Mac at Anthropic list prices; not your actual bill and not counted in the budget."
          >
            {costNote}
          </span>
        )}
      </p>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-mono tabular-nums">{callsDisplay} calls</span>
        <span className="font-mono tabular-nums">{share}%</span>
      </div>
      <Sparkline values={sparklineValues} color={`var(--tier-${tier})`} />
    </div>
  );
}
