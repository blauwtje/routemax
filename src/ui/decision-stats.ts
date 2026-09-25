import { readFile } from 'node:fs/promises';
import type { DecisionRecord } from '../decision-log/decision-log';

export interface Tally {
  calls: number;
  costUsd: number;
}

export interface PeriodStats extends Tally {
  byTier: Record<string, Tally>;
  byModel: Record<string, Tally>;
  escalations: Record<string, number>;
}

export interface DecisionStats {
  budget: { totalUsd: number; spentUsd: number; leftUsd: number };
  spendByProvider: Record<string, number>;
  today: PeriodStats;
  week: PeriodStats;
}

// Lines written before providers existed carry no provider field; they all ran on DeepSeek.
const LEGACY_PROVIDER = 'deepseek';

export async function readDecisions(logPath: string): Promise<DecisionRecord[]> {
  let text: string;
  try {
    text = await readFile(logPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const record = JSON.parse(line) as Record<string, unknown>;
      const withProvider = 'provider' in record ? record : { ...record, provider: LEGACY_PROVIDER };
      return withProvider as unknown as DecisionRecord;
    });
}

function addTally(tallies: Record<string, Tally>, key: string, costUsd: number): void {
  const tally = (tallies[key] ??= { calls: 0, costUsd: 0 });
  tally.calls += 1;
  tally.costUsd += costUsd;
}

function periodStats(records: DecisionRecord[]): PeriodStats {
  const stats: PeriodStats = { calls: 0, costUsd: 0, byTier: {}, byModel: {}, escalations: {} };
  for (const record of records) {
    stats.calls += 1;
    stats.costUsd += record.costUsd;
    addTally(stats.byTier, record.finalTier, record.costUsd);
    if (record.model) addTally(stats.byModel, record.model, record.costUsd);
    if (record.reason) stats.escalations[record.reason] = (stats.escalations[record.reason] ?? 0) + 1;
  }
  return stats;
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfWeek(date: Date): Date {
  const monday = startOfDay(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

// A record without a provider (a disabled call, a budget refusal) cost 0, so leaving it out keeps
// the per-provider spend equal to the total spend.
export function decisionStats(records: DecisionRecord[], totalUsd: number, now: Date): DecisionStats {
  const spendByProvider: Record<string, number> = {};
  for (const record of records) {
    if (record.provider !== null) spendByProvider[record.provider] = (spendByProvider[record.provider] ?? 0) + record.costUsd;
  }
  const spentUsd = records.reduce((sum, record) => sum + record.costUsd, 0);
  const since = (start: Date) => records.filter((record) => new Date(record.ts) >= start);
  return {
    budget: { totalUsd, spentUsd, leftUsd: Math.max(0, totalUsd - spentUsd) },
    spendByProvider,
    today: periodStats(since(startOfDay(now))),
    week: periodStats(since(startOfWeek(now))),
  };
}
