import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addLiveConfigToChezmoi } from '../src/setup/add-live-config-to-chezmoi';

function fakeChezmoi(sourcePathExit: number) {
  const dir = mkdtempSync(join(tmpdir(), 'routemax-setup-chezmoi-'));
  const configPath = join(dir, 'config.json');
  const log = join(dir, 'calls.log');
  writeFileSync(configPath, '{"version":2}\n');
  writeFileSync(log, '');
  const bin = join(dir, 'chezmoi');
  writeFileSync(bin, ['#!/bin/sh', `echo "$@" >> '${log}'`, `if [ "$1" = source-path ]; then exit ${sourcePathExit}; fi`, ''].join('\n'));
  chmodSync(bin, 0o755);
  return { bin, configPath, log };
}

describe('addLiveConfigToChezmoi', () => {
  it('adds a live config chezmoi does not manage yet', async () => {
    const { bin, configPath, log } = fakeChezmoi(1);
    await expect(addLiveConfigToChezmoi(configPath, bin)).resolves.toBe(`Added ${configPath} to the chezmoi source.`);
    expect(readFileSync(log, 'utf8')).toBe(`source-path ${configPath}\nadd ${configPath}\n`);
  });

  it('leaves a managed live config alone', async () => {
    const { bin, configPath, log } = fakeChezmoi(0);
    await expect(addLiveConfigToChezmoi(configPath, bin)).resolves.toBe(`${configPath} is already in the chezmoi source.`);
    expect(readFileSync(log, 'utf8')).toBe(`source-path ${configPath}\n`);
  });

  it('says what to run by hand when chezmoi is missing', async () => {
    const { configPath } = fakeChezmoi(1);
    await expect(addLiveConfigToChezmoi(configPath, join(tmpdir(), 'no-such-chezmoi-bin'))).resolves.toBe(
      `chezmoi is missing; run chezmoi add ${configPath} to keep the config.`,
    );
  });
});
