import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readApiKey } from '../src/worker/read-api-key';

const binDir = mkdtempSync(join(tmpdir(), 'routemax-security-'));
const originalPath = process.env.PATH;
const fakeSecurity = (body: string) => writeFileSync(join(binDir, 'security'), `#!/bin/sh\n${body}\n`, { mode: 0o755 });

beforeEach(() => {
  process.env.PATH = `${binDir}:${originalPath}`;
});
afterEach(() => {
  process.env.PATH = originalPath;
});

describe('readApiKey', () => {
  it('returns the password of Keychain service deepseek_api_key', async () => {
    fakeSecurity('[ "$1" = find-generic-password ] && [ "$4" = -s ] && [ "$5" = deepseek_api_key ] && [ "$6" = -w ] || exit 2\necho sk-fake-keychain');
    await expect(readApiKey()).resolves.toBe('sk-fake-keychain');
  });

  it('fails closed with a message that holds no secret when the item is missing', async () => {
    fakeSecurity('echo sk-fake-partial >&2\nexit 44');
    const error = await readApiKey().catch((caught: Error) => caught);
    expect(String(error)).toContain('DeepSeek API key not found in Keychain (service deepseek_api_key).');
    expect(String(error)).not.toContain('sk-fake-partial');
  });
});
