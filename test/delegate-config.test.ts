import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, ensureLiveConfig, loadConfig } from '../src/config/delegate-config';
import { liveConfigPath, v1BackupPath } from '../src/config/routemax-paths';

const shippedJson = () => JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));

function writeConfig(config: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), 'routemax-config-')), 'routing.json');
  writeFileSync(path, JSON.stringify(config));
  return path;
}

describe('loadConfig', () => {
  it('loads the shipped config as version 2 with its caps and defaults', () => {
    const config = loadConfig(DEFAULT_CONFIG_PATH);
    expect(config.version).toBe(2);
    expect(config.budget).toEqual({ totalUsd: 10, perCallUsd: 0.25 });
    expect(config.retryThreshold).toBeNull();
    expect(config.exploreRedirect).toBe(false);
    expect(config.workerTimeoutMs).toBe(600_000);
    expect(config.testTimeoutMs).toBe(300_000);
    expect(config.providers.deepseek.repairProxy?.telemetryPath.startsWith('~')).toBe(false);
  });

  it('names the current DeepSeek model ids, not the retired deepseek-v4-flash', () => {
    const models = Object.values(loadConfig(DEFAULT_CONFIG_PATH).tiers).map((tier) => tier.model);
    expect(new Set(models)).toEqual(new Set(['deepseek-flash', 'deepseek-v4-pro']));
  });

  it('loads a version 2 file as written', () => {
    const migrated = loadConfig(DEFAULT_CONFIG_PATH);
    expect(loadConfig(writeConfig(migrated))).toEqual(migrated);
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

describe('ensureLiveConfig', () => {
  const seedText = readFileSync(DEFAULT_CONFIG_PATH, 'utf8');

  function tempHome() {
    const home = mkdtempSync(join(tmpdir(), 'routemax-home-'));
    const seedPath = join(home, 'routing.json');
    writeFileSync(seedPath, seedText);
    return { home, seedPath };
  }

  it('writes the live config once from the seed and keeps the version 1 original', () => {
    const { home, seedPath } = tempHome();
    const livePath = ensureLiveConfig(home, seedPath);
    expect(livePath).toBe(liveConfigPath(home));
    expect(JSON.parse(readFileSync(livePath, 'utf8')).version).toBe(2);
    expect(loadConfig(livePath).budget.totalUsd).toBe(10);
    expect(readFileSync(v1BackupPath(home), 'utf8')).toBe(seedText);

    const liveText = readFileSync(livePath, 'utf8');
    writeFileSync(seedPath, seedText.replace('"totalUsd": 10', '"totalUsd": 20'));
    expect(ensureLiveConfig(home, seedPath)).toBe(livePath);
    expect(readFileSync(livePath, 'utf8')).toBe(liveText);
    expect(readFileSync(v1BackupPath(home), 'utf8')).toBe(seedText);
  });

  it('never overwrites an existing version 1 backup', () => {
    const { home, seedPath } = tempHome();
    ensureLiveConfig(home, seedPath);
    rmSync(liveConfigPath(home));
    writeFileSync(seedPath, seedText.replace('"totalUsd": 10', '"totalUsd": 20'));
    ensureLiveConfig(home, seedPath);
    expect(loadConfig(liveConfigPath(home)).budget.totalUsd).toBe(20);
    expect(readFileSync(v1BackupPath(home), 'utf8')).toBe(seedText);
  });

  it('writes nothing when the seed is invalid', () => {
    const { home, seedPath } = tempHome();
    writeFileSync(seedPath, seedText.replace('"totalUsd": 10', '"totalUsd": -1'));
    expect(() => ensureLiveConfig(home, seedPath)).toThrow(/budget\.totalUsd/);
    expect(() => readFileSync(liveConfigPath(home))).toThrow(/ENOENT/);
  });
});
