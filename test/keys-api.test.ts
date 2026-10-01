import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall, type UiReply } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

const FAKE_KEY = 'sk-keys-api-DO-NOT-LEAK';

let server: UiServer;
let homeDir = '';
const replies: UiReply[] = [];
const consoleLines: string[] = [];

function fakeSecurity(home: string): string {
  const bin = join(home, 'bin');
  const keychain = join(home, 'keychain');
  mkdirSync(bin, { recursive: true });
  mkdirSync(keychain, { recursive: true });
  const script = [
    '#!/bin/sh',
    `printf '%s\\n' "$*" >> "${join(home, 'security-argv.log')}"`,
    'if [ "$1" = -i ]; then',
    '  read -r line',
    `  service=$(printf '%s' "$line" | sed -E 's/.* -s "([^"]*)".*/\\1/')`,
    `  key=$(printf '%s' "$line" | sed -E 's/.* -w "([^"]*)".*/\\1/')`,
    `  printf '%s\\n' "$key" > "${keychain}/$service"`,
    '  exit 0',
    'fi',
    `[ "$1" = find-generic-password ] && [ -f "${keychain}/$5" ] || exit 44`,
    `cat "${keychain}/$5"`,
    '',
  ];
  writeFileSync(join(bin, 'security'), script.join('\n'), { mode: 0o755 });
  return bin;
}

async function call(method: string, path: string, body?: unknown): Promise<UiReply> {
  const reply = await uiCall(server.port, method, path, pageHeaders(server.port, server.token, method !== 'GET'), body);
  replies.push(reply);
  return reply;
}

beforeAll(async () => {
  homeDir = mkdtempSync(join(tmpdir(), 'routemax-keys-api-'));
  vi.stubEnv('PATH', `${fakeSecurity(homeDir)}:${process.env.PATH}`);
  for (const method of ['log', 'warn', 'error'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      consoleLines.push(args.map(String).join(' '));
    });
  }
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes(testUiDeps(homeDir)));
});

afterAll(async () => {
  await server.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('keys API', () => {
  it('reports a provider without a key as not present', async () => {
    expect((await call('GET', '/api/keys')).json()).toMatchObject({ keys: { deepseek: { present: false } } });
  });

  it('refuses a key with a quote without repeating it', async () => {
    const reply = await call('PUT', '/api/keys/deepseek', { key: `${FAKE_KEY}" -U` });
    expect(reply.status).toBe(422);
    expect(reply.json()).toEqual({ error: 'invalid', issues: ['key: The key is empty or holds a quote, a backslash or a control character.'] });
  });

  it('answers 404 for an unknown provider', async () => {
    expect((await call('PUT', '/api/keys/__proto__', { key: FAKE_KEY })).status).toBe(404);
  });

  it('never returns or logs the key', async () => {
    await call('GET', '/api/config');
    for (const reply of replies) expect(reply.text).not.toContain(FAKE_KEY);
    expect(consoleLines.join('\n')).not.toContain(FAKE_KEY);
  });
});
