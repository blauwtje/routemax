import type { ModelPrice } from '../config/config-schema';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export const EMPTY_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };

const TOKENS_PER_PRICE_UNIT = 1_000_000;

export function addUsage(left: TokenUsage, right: TokenUsage): TokenUsage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheCreationTokens: left.cacheCreationTokens + right.cacheCreationTokens,
  };
}

export function usageCostUsd(price: ModelPrice, usage: TokenUsage): number {
  const uncachedInput = (usage.inputTokens + usage.cacheCreationTokens) * price.inputUsd;
  const cachedInput = usage.cacheReadTokens * price.cacheHitUsd;
  const output = usage.outputTokens * price.outputUsd;
  return (uncachedInput + cachedInput + output) / TOKENS_PER_PRICE_UNIT;
}
