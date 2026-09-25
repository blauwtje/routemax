import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commandOnPath } from '../src/doctor/command-on-path';

function binDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'routemax-path-'));
  writeFileSync(join(dir, 'routemax'), '#!/bin/sh\n');
  chmodSync(join(dir, 'routemax'), 0o755);
  writeFileSync(join(dir, 'plain'), 'not executable\n');
  return dir;
}

describe('commandOnPath', () => {
  it('finds an executable in a later PATH entry', async () => {
    const dir = binDir();
    await expect(commandOnPath('routemax', ['/nonexistent-routemax-dir', dir].join(delimiter))).resolves.toBe(true);
  });

  it('ignores a file that is not executable and a name that is missing', async () => {
    const dir = binDir();
    await expect(commandOnPath('plain', dir)).resolves.toBe(false);
    await expect(commandOnPath('missing', dir)).resolves.toBe(false);
    await expect(commandOnPath('routemax', '')).resolves.toBe(false);
  });
});
