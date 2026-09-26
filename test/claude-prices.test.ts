import { describe, expect, it } from 'vitest';
import { claudeUsageCostUsd } from '../src/claude-usage/claude-prices';

const EMPTY_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreation5mTokens: 0,
  cacheCreation1hTokens: 0,
};

describe('claudeUsageCostUsd', () => {
  it('prices input, output and cache read at Anthropic list rates', () => {
    const usage = { ...EMPTY_USAGE, inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 };
    expect(claudeUsageCostUsd('claude-sonnet-4-5', usage)).toBeCloseTo(3 + 15 + 0.3, 10);
  });

  it('prices a 5-minute cache write at 1.25x the input rate', () => {
    const usage = { ...EMPTY_USAGE, cacheCreation5mTokens: 1_000_000 };
    expect(claudeUsageCostUsd('claude-haiku-4-5', usage)).toBeCloseTo(1 * 1.25, 10);
  });

  it('prices a 1-hour cache write at 2x the input rate', () => {
    const usage = { ...EMPTY_USAGE, cacheCreation1hTokens: 1_000_000 };
    expect(claudeUsageCostUsd('claude-haiku-4-5', usage)).toBeCloseTo(1 * 2, 10);
  });

  it('matches the longest model-name prefix, not a shorter one that also matches', () => {
    const usage = { ...EMPTY_USAGE, inputTokens: 1_000_000 };
    expect(claudeUsageCostUsd('claude-opus-5-5-20260601', usage)).toBeCloseTo(4, 10);
    expect(claudeUsageCostUsd('claude-opus-5-20260601', usage)).toBeCloseTo(5, 10);
  });

  it('returns null cost for a model absent from the bundled table', () => {
    expect(claudeUsageCostUsd('claude-unknown-9000', EMPTY_USAGE)).toBeNull();
  });

  it('costs nothing for empty usage on a known model', () => {
    expect(claudeUsageCostUsd('claude-sonnet-4-5', EMPTY_USAGE)).toBe(0);
  });
});
