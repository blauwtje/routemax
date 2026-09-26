import { useMemo } from 'react';
import { usePoll } from '@/hooks/use-poll';
import type { HistoryResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import type { TierColorKey } from '@/lib/tier-colors';

const loadHistory = () => api.request<HistoryResponse>('GET', '/api/history');

const TIER_ORDER: readonly TierColorKey[] = ['flash-low', 'flash-high', 'pro-high', 'claude'];
const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10);
}

// claudeByDay is keyed by local calendar day, matching the server's Claude usage store.
function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function emptySeries(): Record<TierColorKey, number[]> {
  return Object.fromEntries(TIER_ORDER.map((tier) => [tier, Array(7).fill(0)])) as Record<TierColorKey, number[]>;
}

/**
 * Buckets `/api/history` records by day (last 7 days, oldest first) per worker tier's spend,
 * client-side, so each tier's stat card can draw a sparkline (contract: kinetic-figures). The
 * Claude series comes from `claudeByDay` instead, because Claude's cost is read from its own
 * session logs, not from routemax's decisions.
 */
export function useDailyTierSpend(claudeByDay: Record<string, number> | undefined): Record<TierColorKey, number[]> {
  const { state } = usePoll(loadHistory);

  return useMemo(() => {
    if (state.kind !== 'loaded') return emptySeries();
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => dayKey(new Date(today.getTime() - (6 - i) * DAY_MS).toISOString()));
    const dayIndex = new Map(days.map((day, index) => [day, index]));
    const result = emptySeries();
    for (const record of state.value.records) {
      const index = dayIndex.get(dayKey(record.ts));
      if (index === undefined) continue;
      const tier = record.finalTier as TierColorKey;
      if (tier === 'claude' || !(tier in result)) continue;
      result[tier][index] += record.costUsd;
    }
    result.claude = Array.from({ length: 7 }, (_, i) => claudeByDay?.[localDayKey(new Date(today.getTime() - (6 - i) * DAY_MS))] ?? 0);
    return result;
  }, [state, claudeByDay]);
}
