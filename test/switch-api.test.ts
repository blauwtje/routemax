import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isRouterEnabled, routerSwitchPath } from '../src/router-switch/router-switch';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

let server: UiServer;
let homeDir = '';

beforeAll(async () => {
  homeDir = mkdtempSync(join(tmpdir(), 'routemax-switch-'));
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes(testUiDeps(homeDir)));
});

afterAll(() => server.close());

describe('switch API', () => {
  it('reads a missing switch file as on', async () => {
    const reply = await uiCall(server.port, 'GET', '/api/switch', pageHeaders(server.port, server.token));
    expect(reply.json()).toEqual({ enabled: true });
  });

  it('writes off and on to the switch file', async () => {
    const off = await uiCall(server.port, 'PUT', '/api/switch', pageHeaders(server.port, server.token, true), { enabled: false });
    expect(off.json()).toEqual({ enabled: false });
    expect(readFileSync(routerSwitchPath(homeDir), 'utf8').trim()).toBe('off');
    expect(isRouterEnabled(homeDir)).toBe(false);
    await uiCall(server.port, 'PUT', '/api/switch', pageHeaders(server.port, server.token, true), { enabled: true });
    expect(readFileSync(routerSwitchPath(homeDir), 'utf8').trim()).toBe('on');
  });

  it('refuses a body without a boolean enabled and leaves the file unchanged', async () => {
    const reply = await uiCall(server.port, 'PUT', '/api/switch', pageHeaders(server.port, server.token, true), { enabled: 'off' });
    expect(reply.status).toBe(422);
    expect((reply.json() as { issues: string[] }).issues[0]).toMatch(/^enabled: /);
    expect(readFileSync(routerSwitchPath(homeDir), 'utf8').trim()).toBe('on');
  });

  it('refuses a switch write from a foreign Origin with 403 and leaves the file unchanged', async () => {
    const headers = { ...pageHeaders(server.port, server.token, true), origin: 'http://evil.test' };
    const reply = await uiCall(server.port, 'PUT', '/api/switch', headers, { enabled: false });
    expect([reply.status, reply.text]).toEqual([403, '']);
    expect(isRouterEnabled(homeDir)).toBe(true);
  });
});
