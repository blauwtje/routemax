import { describe, expect, it } from 'vitest';
import type { ClaudeUsageDay } from '../src/claude-usage/claude-usage-store';
import type { DecisionRecord } from '../src/decision-log/decision-log';
import { decisionStats } from '../src/ui/decision-stats';

// Wednesday 23 September 2026, noon local time; that week starts on Monday 21 September.
const NOW = new Date(2026, 8, 23, 12);
const at = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString();
const NO_CLAUDE_DAYS: Record<string, ClaudeUsageDay> = {};

const record = (overrides: Partial<DecisionRecord>): DecisionRecord => ({
  ts: at(23, 9),
  cwd: '/tmp/project',
  taskType: 'search',
  requestedTier: 'flash-low',
  finalTier: 'flash-low',
  raisedBy: null,
  provider: 'deepseek',
  model: 'deepseek-flash',
  effort: 'low',
  costUsd: 0.02,
  status: 'done',
  reason: null,
  durationMs: 1000,
  retries: 0,
  inputTokens: 10,
  outputTokens: 10,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  ...overrides,
});

describe('decisionStats', () => {
  it('counts today and the week from Monday, with tier, model and escalation tallies', () => {
    const records = [
      record({}),
      record({ ts: at(23, 10), finalTier: 'pro-high', model: 'deepseek-v4-pro', costUsd: 0.1, status: 'escalate', reason: 'exit-code' }),
      record({ ts: at(21, 8), costUsd: 0.03 }),
      record({ ts: at(20, 23), costUsd: 0.5 }),
    ];
    const stats = decisionStats(records, 10, NOW, NO_CLAUDE_DAYS);
    expect(stats.today.calls).toBe(2);
    expect(stats.today.costUsd).toBeCloseTo(0.12, 10);
    expect(stats.today.byTier).toEqual({ 'flash-low': { calls: 1, costUsd: 0.02 }, 'pro-high': { calls: 1, costUsd: 0.1 } });
    expect(stats.today.byModel).toEqual({ 'deepseek-flash': { calls: 1, costUsd: 0.02 }, 'deepseek-v4-pro': { calls: 1, costUsd: 0.1 } });
    expect(stats.today.escalations).toEqual({ 'exit-code': 1 });
    expect(stats.week.calls).toBe(3);
    expect(stats.budget).toEqual({ totalUsd: 10, spentUsd: expect.closeTo(0.65, 10), leftUsd: expect.closeTo(9.35, 10) });
  });

  it('adds spend per provider up to the total spend and counts a disabled call with cost 0', () => {
    const records = [
      record({ costUsd: 0.2 }),
      record({ provider: 'openrouter', model: 'openai/gpt-5', costUsd: 0.3 }),
      record({ provider: null, finalTier: 'claude', model: null, effort: null, costUsd: 0, status: 'disabled' }),
    ];
    const stats = decisionStats(records, 10, NOW, NO_CLAUDE_DAYS);
    expect(stats.spendByProvider).toEqual({ deepseek: 0.2, openrouter: 0.3 });
    const byProvider = Object.values(stats.spendByProvider).reduce((sum, cost) => sum + cost, 0);
    expect(byProvider).toBeCloseTo(stats.budget.spentUsd, 10);
    expect(stats.today.calls).toBe(3);
    expect(stats.today.byTier.claude).toEqual({ calls: 1, costUsd: 0 });
  });

  it('never reports a negative budget left', () => {
    expect(decisionStats([record({ costUsd: 12 })], 10, NOW, NO_CLAUDE_DAYS).budget.leftUsd).toBe(0);
  });

  it('prices claude usage per period, overwrites byTier.claude.costUsd and reports the last 7 days', () => {
    const claudeDays: Record<string, ClaudeUsageDay> = {
      '2026-09-23': { 'claude-sonnet-5': { usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreation5mTokens: 0, cacheCreation1hTokens: 0 }, costUsd: 0.5 } },
      '2026-09-22': { 'claude-unknown-model': { usage: { inputTokens: 100, outputTokens: 0, cacheReadTokens: 0, cacheCreation5mTokens: 0, cacheCreation1hTokens: 0 }, costUsd: null } },
      '2026-08-01': { 'claude-sonnet-5': { usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreation5mTokens: 0, cacheCreation1hTokens: 0 }, costUsd: 9 } },
    };
    const records = [record({ finalTier: 'claude', model: null, effort: null, provider: null, costUsd: 0, status: 'disabled' })];
    const stats = decisionStats(records, 10, NOW, claudeDays);

    expect(stats.today.claude).toEqual({ costUsd: 0.5, unpricedTokens: 0, byModel: { 'claude-sonnet-5': { costUsd: 0.5, unpricedTokens: 0 } } });
    expect(stats.today.byTier.claude).toEqual({ calls: 1, costUsd: 0.5 });
    expect(stats.week.claude).toEqual({
      costUsd: 0.5,
      unpricedTokens: 100,
      byModel: { 'claude-sonnet-5': { costUsd: 0.5, unpricedTokens: 0 }, 'claude-unknown-model': { costUsd: null, unpricedTokens: 100 } },
    });
    expect(stats.week.byTier.claude).toEqual({ calls: 1, costUsd: 0.5 });
    // The old August day sits outside both periods, so it never enters either claude tally.
    expect(stats.budget.spentUsd).toBe(0);
    expect(Object.keys(stats.claudeByDay)).toEqual(['2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23']);
    expect(stats.claudeByDay['2026-09-23']).toBe(0.5);
    expect(stats.claudeByDay['2026-09-22']).toBe(0);
    expect(stats.claudeByDay['2026-09-21']).toBe(0);
  });
});
