import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { claudeUsageCostUsd } from './claude-prices';
import type { ClaudeUsage, ClaudeUsageByDay } from './read-claude-usage';

export interface ClaudeUsagePrice {
  usage: ClaudeUsage;
  costUsd: number | null;
}

export type ClaudeUsageDay = Record<string, ClaudeUsagePrice>;

export interface ClaudeUsageStore {
  days: Record<string, ClaudeUsageDay>;
}

const EMPTY_STORE: ClaudeUsageStore = { days: {} };

export function readClaudeUsageStore(path: string): ClaudeUsageStore {
  if (!existsSync(path)) return EMPTY_STORE;
  return JSON.parse(readFileSync(path, 'utf8')) as ClaudeUsageStore;
}

function priceDay(byModel: Record<string, ClaudeUsage>): ClaudeUsageDay {
  const priced: ClaudeUsageDay = {};
  for (const [model, usage] of Object.entries(byModel)) {
    priced[model] = { usage, costUsd: claudeUsageCostUsd(model, usage) };
  }
  return priced;
}

/**
 * Merges freshly read transcript usage into the stored daily totals. Days
 * present in `freshDays` overwrite the stored day so a re-read of a still
 * available transcript stays authoritative; days already stored but no
 * longer found (cleaned up by Claude Code) are kept as-is.
 */
export function mergeClaudeUsage(store: ClaudeUsageStore, freshDays: ClaudeUsageByDay): ClaudeUsageStore {
  const days = { ...store.days };
  for (const [day, byModel] of Object.entries(freshDays)) days[day] = priceDay(byModel);
  return { days };
}

export function recordClaudeUsage(path: string, freshDays: ClaudeUsageByDay): ClaudeUsageStore {
  const store = mergeClaudeUsage(readClaudeUsageStore(path), freshDays);
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`);
  renameSync(tempPath, path);
  return store;
}
