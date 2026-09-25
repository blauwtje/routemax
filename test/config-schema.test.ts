import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configIssues, configSchema, type Effort, type ModelPrice } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH } from '../src/config/delegate-config';
import { migrateConfig } from '../src/config/migrate-config';

const validConfig = () => configSchema.parse(migrateConfig(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'))));

describe('configIssues', () => {
  it('accepts the migrated seed', () => {
    expect(configIssues(validConfig())).toEqual([]);
  });

  it('names the tier field when a tier points at an unknown provider', () => {
    const config = validConfig();
    config.tiers['flash-low'].provider = 'missing';
    expect(configIssues(config)).toEqual(['tiers.flash-low.provider: provider missing does not exist']);
  });

  it('names the tier field when a tier points at a disabled provider', () => {
    const config = validConfig();
    config.providers.openrouter.models['openai/gpt-5'] = { inputUsd: 1, cacheHitUsd: 0.1, outputUsd: 4 };
    config.tiers['flash-low'] = { provider: 'openrouter', model: 'openai/gpt-5', effort: 'low' };
    expect(configIssues(config)).toEqual(['tiers.flash-low.provider: provider openrouter is disabled']);
  });

  it('names the tier model when its provider has no such model', () => {
    const config = validConfig();
    config.tiers['pro-high'].model = 'deepseek-missing';
    expect(configIssues(config)).toEqual(['tiers.pro-high.model: model deepseek-missing has no entry in providers.deepseek.models']);
  });

  it('names the price field when a model price is missing', () => {
    const config = validConfig();
    config.providers.deepseek.models['deepseek-flash'] = { cacheHitUsd: 0.006, outputUsd: 1.2 } as ModelPrice;
    expect(configIssues(config)).toContainEqual(expect.stringMatching(/^providers\.deepseek\.models\.deepseek-flash\.inputUsd: /));
  });

  it('names the budget field for a negative cap', () => {
    const config = validConfig();
    config.budget.totalUsd = -1;
    expect(configIssues(config)).toContainEqual(expect.stringMatching(/^budget\.totalUsd: /));
  });

  it('names the tier effort for an unknown effort', () => {
    const config = validConfig();
    config.tiers['pro-high'].effort = 'extreme' as Effort;
    expect(configIssues(config)).toContainEqual(expect.stringMatching(/^tiers\.pro-high\.effort: /));
  });
});
