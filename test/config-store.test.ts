import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH } from '../src/config/delegate-config';
import { readStoredConfig, restorePrevious, saveConfig, textHash } from '../src/config/config-store';
import { migrateConfig } from '../src/config/migrate-config';

function store() {
  const dir = mkdtempSync(join(tmpdir(), 'routemax-store-'));
  const configPath = join(dir, 'config.json');
  const previousPath = join(dir, 'backups', 'config.prev.json');
  const seed = migrateConfig(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'))) as Record<string, any>;
  writeFileSync(configPath, `${JSON.stringify(seed, null, 2)}\n`);
  return { configPath, previousPath, seed };
}

describe('config store', () => {
  it('saves a valid config, keeps the previous text and returns the new hash', () => {
    const { configPath, previousPath, seed } = store();
    const before = readFileSync(configPath, 'utf8');
    const loaded = readStoredConfig(configPath, previousPath);
    expect(loaded).toEqual({ config: seed, hash: textHash(before), previousExists: false });
    const changed = { ...seed, budget: { ...seed.budget, totalUsd: 42 } };
    const outcome = saveConfig(configPath, previousPath, changed, loaded.hash);
    expect(outcome).toEqual({ ok: true, hash: textHash(readFileSync(configPath, 'utf8')) });
    expect(JSON.parse(readFileSync(configPath, 'utf8')).budget.totalUsd).toBe(42);
    expect(readFileSync(previousPath, 'utf8')).toBe(before);
  });

  it('refuses a save based on a config that changed on disk and leaves the file unchanged', () => {
    const { configPath, previousPath, seed } = store();
    const before = readFileSync(configPath, 'utf8');
    const outcome = saveConfig(configPath, previousPath, seed, textHash('something older'));
    expect(outcome).toMatchObject({ ok: false, kind: 'stale' });
    expect(readFileSync(configPath, 'utf8')).toBe(before);
  });

  it('refuses an invalid config naming the field and leaves the file unchanged', () => {
    const { configPath, previousPath, seed } = store();
    const before = readFileSync(configPath, 'utf8');
    const hash = textHash(before);
    const negativeCap = saveConfig(configPath, previousPath, { ...seed, budget: { ...seed.budget, totalUsd: -1 } }, hash);
    expect(negativeCap).toMatchObject({ ok: false, kind: 'invalid' });
    expect(negativeCap.ok ? '' : negativeCap.issues.join('\n')).toContain('budget.totalUsd');
    const unknownProvider = saveConfig(configPath, previousPath, { ...seed, tiers: { ...seed.tiers, 'flash-low': { ...seed.tiers['flash-low'], provider: 'nope' } } }, hash);
    expect(unknownProvider.ok ? '' : unknownProvider.issues.join('\n')).toContain('tiers');
    const badEffort = saveConfig(configPath, previousPath, { ...seed, tiers: { ...seed.tiers, 'flash-low': { ...seed.tiers['flash-low'], effort: 'huge' } } }, hash);
    expect(badEffort.ok ? '' : badEffort.issues.join('\n')).toContain('effort');
    expect(readFileSync(configPath, 'utf8')).toBe(before);
  });

  it('restores the previous version, and a second restore undoes the first', () => {
    const { configPath, previousPath, seed } = store();
    const original = readFileSync(configPath, 'utf8');
    const saved = saveConfig(configPath, previousPath, { ...seed, retryThreshold: 7 }, textHash(original));
    if (!saved.ok) throw new Error(saved.issues.join('\n'));
    const edited = readFileSync(configPath, 'utf8');
    expect(restorePrevious(configPath, previousPath, saved.hash)).toEqual({ ok: true, hash: textHash(original) });
    expect(readFileSync(configPath, 'utf8')).toBe(original);
    expect(restorePrevious(configPath, previousPath, textHash(original))).toEqual({ ok: true, hash: textHash(edited) });
    expect(readFileSync(configPath, 'utf8')).toBe(edited);
  });

  it('refuses a restore without a previous version', () => {
    const { configPath, previousPath } = store();
    expect(restorePrevious(configPath, previousPath, textHash(readFileSync(configPath, 'utf8')))).toMatchObject({ ok: false, kind: 'missing' });
  });
});
