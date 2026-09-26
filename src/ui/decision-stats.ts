import { readFile } from 'node:fs/promises';
import type { ClaudeUsageDay } from '../claude-usage/claude-usage-store';
import type { ClaudeUsage } from '../claude-usage/read-claude-usage';
import type { DecisionRecord } from '../decision-log/decision-log';

export interface Tally {
  calls: number;
  costUsd: number;
}

export interface ClaudeModelTally {
  costUsd: number | null;
  unpricedTokens: number;
}

export interface ClaudeTally {
  costUsd: number;
  unpricedTokens: number;
  byModel: Record<string, ClaudeModelTally>;
}

export interface PeriodStats extends Tally {
  byTier: Record<string, Tally>;
  byModel: Record<string, Tally>;
  escalations: Record<string, number>;
  claude: ClaudeTally;
}

export interface DecisionStats {
  budget: { totalUsd: number; spentUsd: number; leftUsd: number };
  spendByProvider: Record<string, number>;
  today: PeriodStats;
  week: PeriodStats;
  claudeByDay: Record<string, number>;
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

function totalTokens(usage: ClaudeUsage): number {
  return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheCreation5mTokens + usage.cacheCreation1hTokens;
}

// Claude usage is stored per calendar day already, so a period's tally sums every stored day
// on or after the period's local day-key rather than filtering by exact timestamp.
function claudeTally(days: Record<string, ClaudeUsageDay>, sinceKey: string): ClaudeTally {
  const byModel: Record<string, ClaudeModelTally> = {};
  for (const [day, byModelUsage] of Object.entries(days)) {
    if (day < sinceKey) continue;
    for (const [model, priced] of Object.entries(byModelUsage)) {
      const tally = (byModel[model] ??= { costUsd: 0, unpricedTokens: 0 });
      if (priced.costUsd === null) {
        tally.costUsd = null;
        tally.unpricedTokens += totalTokens(priced.usage);
      } else if (tally.costUsd !== null) {
        tally.costUsd += priced.costUsd;
      }
    }
  }
  let costUsd = 0;
  let unpricedTokens = 0;
  for (const tally of Object.values(byModel)) {
    if (tally.costUsd !== null) costUsd += tally.costUsd;
    unpricedTokens += tally.unpricedTokens;
  }
  return { costUsd, unpricedTokens, byModel };
}

function periodStats(records: DecisionRecord[], days: Record<string, ClaudeUsageDay>, sinceKey: string): PeriodStats {
  const stats: PeriodStats = { calls: 0, costUsd: 0, byTier: {}, byModel: {}, escalations: {}, claude: { costUsd: 0, unpricedTokens: 0, byModel: {} } };
  for (const record of records) {
    stats.calls += 1;
    stats.costUsd += record.costUsd;
    addTally(stats.byTier, record.finalTier, record.costUsd);
    if (record.model) addTally(stats.byModel, record.model, record.costUsd);
    if (record.reason) stats.escalations[record.reason] = (stats.escalations[record.reason] ?? 0) + 1;
  }
  stats.claude = claudeTally(days, sinceKey);
  if (stats.byTier.claude) stats.byTier.claude.costUsd = stats.claude.costUsd;
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

// Local Y-M-D key, matching the calendar day the claude-usage store keys its entries by
// (startOfDay/startOfWeek above already reason in local time).
function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function claudeByDay(days: Record<string, ClaudeUsageDay>, now: Date): Record<string, number> {
  const result: Record<string, number> = {};
  for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    const key = dayKey(date);
    const byModel = days[key] ?? {};
    result[key] = Object.values(byModel).reduce((sum, priced) => sum + (priced.costUsd ?? 0), 0);
  }
  return result;
}

// A record without a provider (a disabled call, a budget refusal) cost 0, so leaving it out keeps
// the per-provider spend equal to the total spend. Claude cost never enters spentUsd: routemax
// does not pay for it, it only reports what the same work would have cost through Anthropic's API.
export function decisionStats(records: DecisionRecord[], totalUsd: number, now: Date, claudeDays: Record<string, ClaudeUsageDay>): DecisionStats {
  const spendByProvider: Record<string, number> = {};
  for (const record of records) {
    if (record.provider !== null) spendByProvider[record.provider] = (spendByProvider[record.provider] ?? 0) + record.costUsd;
  }
  const spentUsd = records.reduce((sum, record) => sum + record.costUsd, 0);
  const since = (start: Date) => records.filter((record) => new Date(record.ts) >= start);
  return {
    budget: { totalUsd, spentUsd, leftUsd: Math.max(0, totalUsd - spentUsd) },
    spendByProvider,
    today: periodStats(since(startOfDay(now)), claudeDays, dayKey(startOfDay(now))),
    week: periodStats(since(startOfWeek(now)), claudeDays, dayKey(startOfWeek(now))),
    claudeByDay: claudeByDay(claudeDays, now),
  };
}
