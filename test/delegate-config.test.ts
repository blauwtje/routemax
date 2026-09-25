import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';

const shippedJson = () => JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));

function writeConfig(config: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), 'routemax-config-')), 'routing.json');
  writeFileSync(path, JSON.stringify(config));
  return path;
}

describe('loadConfig', () => {
  it('loads the shipped config with its caps and defaults', () => {
    const config = loadConfig(DEFAULT_CONFIG_PATH);
    expect(config.budget).toEqual({ totalUsd: 10, perCallUsd: 0.25 });
    expect(config.retryThreshold).toBeNull();
    expect(config.exploreRedirect).toBe(false);
    expect(config.workerTimeoutMs).toBe(600_000);
    expect(config.testTimeoutMs).toBe(300_000);
    expect(config.proxy.telemetryPath.startsWith('~')).toBe(false);
  });

  it('names the current DeepSeek model ids, not the retired deepseek-v4-flash', () => {
    const models = Object.values(loadConfig(DEFAULT_CONFIG_PATH).tiers).map((tier) => tier.model);
    expect(new Set(models)).toEqual(new Set(['deepseek-flash', 'deepseek-v4-pro']));
  });

  it('rejects a rule with an unknown tier', () => {
    const config = shippedJson();
    config.rules[0].tier = 'gpt';
    expect(() => loadConfig(writeConfig(config))).toThrow();
  });

  it('rejects a claude task type that names a missing agent', () => {
    const config = shippedJson();
    config.claude.taskTypes.security = 'claude-missing';
    expect(() => loadConfig(writeConfig(config))).toThrow(/claude-missing/);
  });

  it('rejects a tier model without a price', () => {
    const config = shippedJson();
    delete config.prices['deepseek-v4-pro'];
    expect(() => loadConfig(writeConfig(config))).toThrow(/deepseek-v4-pro/);
  });
});
