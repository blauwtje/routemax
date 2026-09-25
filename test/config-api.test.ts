import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { textHash } from '../src/config/config-store';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

let server: UiServer;
let configPath = '';
let chezmoiSource = '';

function fakeChezmoi(dir: string): string {
  chezmoiSource = join(dir, 'dot_config.json');
  const bin = join(dir, 'chezmoi');
  writeFileSync(
    bin,
    ['#!/bin/sh', `if [ "$1" = source-path ]; then echo '${chezmoiSource}'; fi`, `if [ "$1" = re-add ]; then cp "$2" '${chezmoiSource}'; fi`, ''].join('\n'),
  );
  chmodSync(bin, 0o755);
  return bin;
}

beforeAll(async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'routemax-config-api-'));
  const deps = { ...testUiDeps(homeDir), chezmoiBin: fakeChezmoi(homeDir) };
  configPath = deps.configPath;
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes(deps));
});

afterAll(() => server.close());

const call = (method: string, path: string, body?: unknown) =>
  uiCall(server.port, method, path, pageHeaders(server.port, server.token, method !== 'GET'), body);

async function loaded() {
  return (await call('GET', '/api/config')).json() as { config: Record<string, any>; hash: string; previousExists: boolean };
}

describe('config API', () => {
  it('returns the live config with the hash of its text', async () => {
    const { config, hash, previousExists } = await loaded();
    expect(hash).toBe(textHash(readFileSync(configPath, 'utf8')));
    expect(config).toEqual(JSON.parse(readFileSync(configPath, 'utf8')));
    expect(previousExists).toBe(false);
  });

  it('refuses a restore without a previous version with 404', async () => {
    const reply = await call('POST', '/api/config/restore', { baseHash: (await loaded()).hash });
    expect(reply.status).toBe(404);
    expect(reply.json()).toMatchObject({ error: 'missing' });
  });

  it('refuses a missing model price with the field named and leaves the file unchanged', async () => {
    const before = readFileSync(configPath, 'utf8');
    const { config, hash } = await loaded();
    delete config.providers.deepseek.models['deepseek-flash'].outputUsd;
    const reply = await call('PUT', '/api/config', { config, baseHash: hash });
    expect(reply.status).toBe(422);
    expect(reply.json()).toMatchObject({ error: 'invalid' });
    expect((reply.json() as { issues: string[] }).issues).toContainEqual(expect.stringMatching(/^providers\.deepseek\.models\.deepseek-flash\.outputUsd: /));
    expect(readFileSync(configPath, 'utf8')).toBe(before);
  });

  it('refuses a save on a stale hash with 409 and leaves the file unchanged', async () => {
    const before = readFileSync(configPath, 'utf8');
    const { config } = await loaded();
    const reply = await call('PUT', '/api/config', { config, baseHash: textHash('an older text') });
    expect(reply.status).toBe(409);
    expect(reply.json()).toMatchObject({ error: 'stale' });
    expect(readFileSync(configPath, 'utf8')).toBe(before);
  });

  it('refuses a save body without baseHash', async () => {
    const reply = await call('PUT', '/api/config', { config: {} });
    expect(reply.status).toBe(422);
    expect((reply.json() as { issues: string[] }).issues[0]).toMatch(/^baseHash: /);
  });

  it('saves, restores and undoes the restore, with the chezmoi source matching after each', async () => {
    const original = readFileSync(configPath, 'utf8');
    const { config, hash } = await loaded();
    config.budget.totalUsd = 42;
    const saved = await call('PUT', '/api/config', { config, baseHash: hash });
    expect(saved.status).toBe(200);
    expect(saved.json()).toMatchObject({ hash: textHash(readFileSync(configPath, 'utf8')), chezmoi: { state: 'synced' } });
    expect(JSON.parse(readFileSync(configPath, 'utf8')).budget.totalUsd).toBe(42);
    expect(readFileSync(chezmoiSource, 'utf8')).toBe(readFileSync(configPath, 'utf8'));
    expect((await loaded()).previousExists).toBe(true);

    const restored = await call('POST', '/api/config/restore', { baseHash: (saved.json() as { hash: string }).hash });
    expect(restored.status).toBe(200);
    expect(readFileSync(configPath, 'utf8')).toBe(original);
    expect(readFileSync(chezmoiSource, 'utf8')).toBe(original);

    const undone = await call('POST', '/api/config/restore', { baseHash: textHash(original) });
    expect(undone.status).toBe(200);
    expect(JSON.parse(readFileSync(configPath, 'utf8')).budget.totalUsd).toBe(42);
    expect(readFileSync(chezmoiSource, 'utf8')).toBe(readFileSync(configPath, 'utf8'));
  });
});
