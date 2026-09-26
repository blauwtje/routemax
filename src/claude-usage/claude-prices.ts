import type { ClaudeUsage } from './read-claude-usage';

// Rates are Anthropic's list prices per million tokens, confirmed against
// https://claude.com/pricing on 2026-09-26. Cache write is 1.25x the input
// rate for a 5-minute TTL and 2x the input rate for a 1-hour TTL; cache read
// is Anthropic's published per-model hit price, which does not follow a
// fixed ratio to input.
interface ClaudePrice {
  prefix: string;
  inputUsd: number;
  outputUsd: number;
  cacheReadUsd: number;
}

function cacheWrite5mUsd(price: ClaudePrice): number {
  return price.inputUsd * 1.25;
}

function cacheWrite1hUsd(price: ClaudePrice): number {
  return price.inputUsd * 2;
}

// Ordered longest-prefix-first so "claude-opus-5-5" is checked before the
// "claude-opus-5" it would otherwise also match.
const CLAUDE_PRICES: ClaudePrice[] = [
  { prefix: 'claude-opus-5-5', inputUsd: 4, outputUsd: 20, cacheReadUsd: 0.2 },
  { prefix: 'claude-sonnet-4-6', inputUsd: 3, outputUsd: 15, cacheReadUsd: 0.3 },
  { prefix: 'claude-sonnet-4-5', inputUsd: 3, outputUsd: 15, cacheReadUsd: 0.3 },
  { prefix: 'claude-haiku-4-5', inputUsd: 1, outputUsd: 5, cacheReadUsd: 0.1 },
  { prefix: 'claude-opus-4-8', inputUsd: 5, outputUsd: 25, cacheReadUsd: 0.5 },
  { prefix: 'claude-opus-4-7', inputUsd: 5, outputUsd: 25, cacheReadUsd: 0.5 },
  { prefix: 'claude-opus-4-6', inputUsd: 5, outputUsd: 25, cacheReadUsd: 0.5 },
  { prefix: 'claude-opus-4-5', inputUsd: 5, outputUsd: 25, cacheReadUsd: 0.5 },
  { prefix: 'claude-opus-5', inputUsd: 5, outputUsd: 25, cacheReadUsd: 0.5 },
  { prefix: 'claude-sonnet-5', inputUsd: 2, outputUsd: 10, cacheReadUsd: 0.2 },
].sort((left, right) => right.prefix.length - left.prefix.length);

const TOKENS_PER_PRICE_UNIT = 1_000_000;

function priceForModel(model: string): ClaudePrice | null {
  return CLAUDE_PRICES.find((price) => model.startsWith(price.prefix)) ?? null;
}

/**
 * Prices Claude usage at Anthropic's list rates. Returns null for a model
 * absent from the bundled table; the caller counts those tokens as unpriced
 * rather than guessing a rate.
 */
export function claudeUsageCostUsd(model: string, usage: ClaudeUsage): number | null {
  const price = priceForModel(model);
  if (!price) return null;

  const cost =
    usage.inputTokens * price.inputUsd +
    usage.outputTokens * price.outputUsd +
    usage.cacheReadTokens * price.cacheReadUsd +
    usage.cacheCreation5mTokens * cacheWrite5mUsd(price) +
    usage.cacheCreation1hTokens * cacheWrite1hUsd(price);

  return cost / TOKENS_PER_PRICE_UNIT;
}
