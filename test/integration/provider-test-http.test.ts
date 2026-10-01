import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DelegateConfig } from '../../src/config/config-schema';
import { DEFAULT_CONFIG_PATH } from '../../src/config/delegate-config';
import { migrateConfig } from '../../src/config/migrate-config';
import { ensureProxy } from '../../src/proxy/ensure-proxy';
import { apiRoutes } from '../../src/ui/api-routes';
import { startUiServer, type UiServer } from '../../src/ui/ui-server';
import { freePort } from '../helpers/free-port';
import { pageHeaders, uiCall } from '../helpers/ui-client';
import { testUiDeps } from '../helpers/ui-deps';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FAKE_UPSTREAM = join(ROOT, 'test/fixtures/fake-upstream.mjs');
const FAKE_KEY = 'sk-fake-DO-NOT-LEAK';
const TEST_TIMEOUT_MS = 180_000;

let server: UiServer;
let pidFile = '';

beforeAll(async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'routemax-provider-http-')));
  const home = join(root, 'home');
  const deepseekHome = join(home, '.claude-deepseek');
  for (const dir of [deepseekHome, join(root, 'proxy', 'node_modules', '.bin')]) mkdirSync(dir, { recursive: true });
  const port = await freePort();
  pidFile = join(root, 'upstream.pid');
  writeFileSync(join(deepseekHome, 'env.vars'), `ANTHROPIC_BASE_URL=http://127.0.0.1:${port}\nCLAUDE_CONFIG_DIR=${deepseekHome}\nANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash\n`);
  writeFileSync(join(deepseekHome, 'mcp.json'), '{"mcpServers":{}}\n');
  writeFileSync(join(deepseekHome, 'settings.json'), '{}\n');
  writeFileSync(join(root, 'proxy', 'node_modules', '.bin', 'tsx'), `#!/bin/sh\nexec node "${FAKE_UPSTREAM}"\n`, { mode: 0o755 });
  vi.stubEnv('FAKE_UPSTREAM_PORT', String(port));
  vi.stubEnv('FAKE_UPSTREAM_PID_FILE', pidFile);
  vi.stubEnv('FAKE_UPSTREAM_EXPECTED_AUTH', `Bearer ${FAKE_KEY}`);

  const config = migrateConfig(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'))) as DelegateConfig;
  config.proxy = { dir: join(root, 'proxy') };
  config.workerTimeoutMs = 120_000;
  config.providers.deepseek.repairProxy = { port, logPath: join(root, 'proxy.log'), telemetryPath: join(root, 'telemetry.jsonl') };
  config.providers.broken = { ...config.providers.deepseek, name: 'Broken', keyVariable: 'BAD_API_KEY' };
  const deps = testUiDeps(home);
  writeFileSync(deps.configPath, `${JSON.stringify(config, null, 2)}\n`);
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes({
    ...deps,
    delegateDeps: () => ({
      config,
      homeDir: home,
      cwd: root,
      env: { ...process.env, HOME: home },
      readLaneKey: (_homeDir, variableName) => (variableName === 'BAD_API_KEY' ? 'sk-wrong-key' : FAKE_KEY),
      ensureProxy,
      fetchImpl: fetch,
    }),
  }));
});

afterAll(async () => {
  await server.close();
  vi.unstubAllEnvs();
  if (existsSync(pidFile)) process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGTERM');
});

const testOn = (providerId: string) =>
  uiCall(server.port, 'POST', `/api/providers/${providerId}/test`, pageHeaders(server.port, server.token, true), { model: 'deepseek-flash' });

describe('provider test over HTTP', () => {
  it('passes a working provider with its cost', async () => {
    const reply = await testOn('deepseek');
    expect(reply.status).toBe(200);
    expect(reply.json()).toMatchObject({ providerId: 'deepseek', model: 'deepseek-flash', passed: true });
    expect((reply.json() as { costUsd: number }).costUsd).toBeGreaterThan(0);
  }, TEST_TIMEOUT_MS);

  it('fails a provider whose upstream refuses the key, with its cost', async () => {
    const reply = await testOn('broken');
    expect(reply.json()).toMatchObject({ providerId: 'broken', passed: false, costUsd: expect.any(Number) });
    expect(reply.text).not.toContain('sk-wrong-key');
  }, TEST_TIMEOUT_MS);

  it('keeps both results for the page', async () => {
    const reply = await uiCall(server.port, 'GET', '/api/provider-tests', pageHeaders(server.port, server.token));
    expect(reply.json()).toMatchObject({ deepseek: { passed: true }, broken: { passed: false } });
    expect(reply.text).not.toContain(FAKE_KEY);
  });

  it('answers 404 for an unknown provider and 422 for an unknown model', async () => {
    expect((await testOn('nope')).status).toBe(404);
    const reply = await uiCall(server.port, 'POST', '/api/providers/deepseek/test', pageHeaders(server.port, server.token, true), { model: 'nope' });
    expect(reply.status).toBe(422);
  });
});
