import { TierStatCard } from './tier-stat-card';
import type { PeriodStats } from '@/lib/api-types';
import type { TierColorKey } from '@/lib/tier-colors';

const TIER_ORDER: readonly TierColorKey[] = ['flash-low', 'flash-high', 'pro-high', 'claude'];
const TIER_LABELS: Record<TierColorKey, string> = {
  'flash-low': 'Flash low',
  'flash-high': 'Flash high',
  'pro-high': 'Pro high',
  claude: 'Claude',
};

const CLAUDE_COST_NOTE = 'API-equivalent';

interface TierBreakdownProps {
  stats: PeriodStats;
  periodLabel: string;
  dailyTierSpend: Record<TierColorKey, number[]>;
}

/** The stat wall: one card per tier, cheapest to most expensive (contract: stat-wall / tier-regions). */
export function TierBreakdown({ stats, periodLabel, dailyTierSpend }: TierBreakdownProps) {
  const rows = TIER_ORDER.map((tier) => {
    const entry = stats.byTier[tier];
    const calls = entry?.calls ?? 0;
    const costUsd = tier === 'claude' ? stats.claude.costUsd : (entry?.costUsd ?? 0);
    const share = stats.calls > 0 ? Math.round((calls / stats.calls) * 100) : 0;
    return { tier, calls, costUsd, share };
  });

  return (
    <div className="overview-tiers flex flex-col gap-3">
      <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">
        Tiers, {periodLabel.toLowerCase()}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map(({ tier, calls, costUsd, share }, index) => (
          <TierStatCard
            key={tier}
            tier={tier}
            label={TIER_LABELS[tier]}
            calls={calls}
            costUsd={costUsd}
            share={share}
            costNote={tier === 'claude' ? CLAUDE_COST_NOTE : undefined}
            sparklineValues={dailyTierSpend[tier]}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
