import { describe, expect, it } from 'vitest';
import { addUsage, EMPTY_USAGE, usageCostUsd } from '../src/budget/usage-cost';

const price = { inputUsd: 0.3, cacheHitUsd: 0.03, outputUsd: 1.2 };

describe('usageCostUsd', () => {
  it('prices uncached input, cache hits and output per 1M tokens', () => {
    const usage = { inputTokens: 900_000, cacheCreationTokens: 100_000, cacheReadTokens: 1_000_000, outputTokens: 500_000 };
    expect(usageCostUsd(price, usage)).toBeCloseTo(0.3 + 0.03 + 0.6, 10);
  });

  it('costs nothing for empty usage', () => {
    expect(usageCostUsd(price, EMPTY_USAGE)).toBe(0);
  });

  it('adds usage field by field', () => {
    const one = { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheCreationTokens: 4 };
    expect(addUsage(one, one)).toEqual({ inputTokens: 2, outputTokens: 4, cacheReadTokens: 6, cacheCreationTokens: 8 });
  });
});
