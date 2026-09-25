import { chmodSync, copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { syncChezmoi } from '../src/config/sync-chezmoi';

function fakeChezmoi(sourceName: string, sourcePathExit: number) {
  const dir = mkdtempSync(join(tmpdir(), 'routemax-chezmoi-'));
  const target = join(dir, 'config.json');
  const source = join(dir, sourceName);
  const log = join(dir, 'calls.log');
  writeFileSync(target, '{"version":2}\n');
  const bin = join(dir, 'chezmoi');
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      `echo "$@" >> '${log}'`,
      `if [ "$1" = source-path ]; then echo '${source}'; exit ${sourcePathExit}; fi`,
      `if [ "$1" = re-add ]; then cp "$2" '${source}'; fi`,
      '',
    ].join('\n'),
  );
  chmodSync(bin, 0o755);
  return { bin, target, source, log };
}

describe('syncChezmoi', () => {
  it('re-adds a managed file so the source matches the target', async () => {
    const { bin, target, source, log } = fakeChezmoi('dot_config.json', 0);
    await expect(syncChezmoi(target, bin)).resolves.toMatchObject({ state: 'synced' });
    expect(readFileSync(source, 'utf8')).toBe(readFileSync(target, 'utf8'));
    expect(readFileSync(log, 'utf8')).toBe(`source-path ${target}\nre-add ${target}\n`);
  });

  it('leaves a template alone and says what to do by hand', async () => {
    const { bin, target, log } = fakeChezmoi('dot_config.json.tmpl', 0);
    const sync = await syncChezmoi(target, bin);
    expect(sync.state).toBe('template');
    expect(sync.message).toContain('.tmpl');
    expect(readFileSync(log, 'utf8')).not.toContain('re-add');
  });

  it('reports an unmanaged file and a missing chezmoi without failing', async () => {
    const { bin, target } = fakeChezmoi('dot_config.json', 1);
    await expect(syncChezmoi(target, bin)).resolves.toMatchObject({ state: 'unmanaged' });
    await expect(syncChezmoi(target, join(tmpdir(), 'no-such-chezmoi-bin'))).resolves.toMatchObject({ state: 'no-chezmoi' });
  });
});
