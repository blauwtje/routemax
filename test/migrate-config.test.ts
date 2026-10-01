import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EFFORT_ORDER, configSchema } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH } from '../src/config/delegate-config';
import { migrateConfig } from '../src/config/migrate-config';

const seed = () => JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
const migrated = () => configSchema.parse(migrateConfig(seed()));

describe('migrateConfig', () => {
  it('marks the result as version 2', () => {
    expect(migrated().version).toBe(2);
  });

  it('keeps every shared value unchanged', () => {
    const v1 = seed();
    const v2 = migrated();
    expect(v2.rules).toEqual(v1.rules.map((rule: object) => ({ taskTypes: [], keywords: [], keywordExemptTaskTypes: [], flags: [], ...rule })));
    for (const key of ['effortMap', 'claude', 'budget', 'workerTimeoutMs', 'testTimeoutMs', 'retryThreshold', 'projects', 'exploreRedirect', 'claudeBin'] as const) {
      expect(v2[key]).toEqual(v1[key]);
    }
    expect(v2.proxy).toEqual({ dir: v1.proxy.dir });
  });

  it('points every tier at the deepseek provider with its model and effort', () => {
    const v1 = seed();
    const v2 = migrated();
    for (const tier of ['flash-low', 'flash-high', 'pro-high'] as const) {
      expect(v2.tiers[tier]).toEqual({ provider: 'deepseek', model: v1.tiers[tier].model, effort: v1.tiers[tier].effort });
    }
  });

  it('moves the prices and proxy paths into the deepseek provider', () => {
    const v1 = seed();
    expect(migrated().providers.deepseek).toEqual({
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/anthropic',
      keychainService: 'deepseek_api_key',
      keyVariable: 'DEEPSEEK_API_KEY',
      models: v1.prices,
      efforts: [...EFFORT_ORDER],
      enabled: true,
      repairProxy: { port: 8787, logPath: v1.proxy.logPath, telemetryPath: v1.proxy.telemetryPath },
    });
  });

  it('adds OpenRouter as a disabled preset without models', () => {
    expect(migrated().providers.openrouter).toEqual({
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api',
      keychainService: 'openrouter_api_key',
      keyVariable: 'OPENROUTER_API_KEY',
      models: {},
      efforts: [...EFFORT_ORDER],
      enabled: false,
      repairProxy: null,
    });
  });

  it('returns a version 2 config unchanged', () => {
    const once = migrateConfig(seed());
    expect(migrateConfig(structuredClone(once))).toEqual(once);
  });

  it('leaves its input untouched', () => {
    const v1 = seed();
    const copy = structuredClone(v1);
    migrateConfig(v1);
    expect(v1).toEqual(copy);
  });

  it('names the field of an invalid version 1 file', () => {
    const v1 = seed();
    v1.rules[0].tier = 'gpt';
    expect(() => migrateConfig(v1)).toThrow(/rules\.0\.tier/);
  });
});
