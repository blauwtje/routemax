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

function emptySeries(): Record<TierColorKey, number[]> {
  return Object.fromEntries(TIER_ORDER.map((tier) => [tier, Array(7).fill(0)])) as Record<TierColorKey, number[]>;
}

/**
 * Buckets `/api/history` records by day (last 7 days, oldest first) per tier's spend, client-side,
 * so each tier's stat card can draw a sparkline (contract: kinetic-figures). Reuses the same
 * GET /api/history endpoint and api.request pattern as the History page; no API change.
 */
export function useDailyTierSpend(): Record<TierColorKey, number[]> {
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
      if (!(tier in result)) continue;
      result[tier][index] += record.costUsd;
    }
    return result;
  }, [state]);
}
