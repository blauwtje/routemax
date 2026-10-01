import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { keysEnvPath } from '../src/config/routemax-paths';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall, type UiReply } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

const FAKE_KEY = 'sk-keys-api-DO-NOT-LEAK';

let server: UiServer;
let homeDir = '';

async function call(method: string, path: string, body?: unknown): Promise<UiReply> {
  return uiCall(server.port, method, path, pageHeaders(server.port, server.token, method !== 'GET'), body);
}

beforeAll(async () => {
  homeDir = mkdtempSync(join(tmpdir(), 'routemax-keys-api-'));
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes(testUiDeps(homeDir)));
});

afterAll(async () => {
  await server.close();
});

describe('keys API', () => {
  it('reports a provider without a key in keys.env as not present', async () => {
    expect((await call('GET', '/api/keys')).json()).toMatchObject({ keys: { deepseek: { present: false } } });
  });

  it('reports a provider whose key variable is in keys.env as present, without returning the key', async () => {
    mkdirSync(dirname(keysEnvPath(homeDir)), { recursive: true });
    writeFileSync(keysEnvPath(homeDir), `DEEPSEEK_API_KEY=${FAKE_KEY}\n`);
    const reply = await call('GET', '/api/keys');
    expect(reply.json()).toMatchObject({ keys: { deepseek: { present: true } } });
    expect(reply.text).not.toContain(FAKE_KEY);
  });

  it('has no route that stores a key', async () => {
    expect((await call('PUT', '/api/keys/deepseek', { key: FAKE_KEY })).status).toBe(404);
  });
});
