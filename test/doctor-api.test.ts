import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { runDoctorChecks, type DoctorDeps } from '../src/doctor/doctor-checks';
import { setRouterEnabled } from '../src/router-switch/router-switch';
import { serverRegistration } from '../src/setup/register-server';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

let server: UiServer;
let doctor: DoctorDeps;

beforeAll(async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'routemax-doctor-api-'));
  doctor = {
    homeDir,
    repoRoot: ROOT,
    config: loadConfig(DEFAULT_CONFIG_PATH),
    registration: serverRegistration(ROOT, join(homeDir, 'bin', 'claude')),
    readLaneKey: () => 'sk-doctor-api-DO-NOT-PRINT',
    ensureProxy: async () => 'running',
    commandOnPath: async () => true,
  };
  setRouterEnabled(homeDir, false);
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes({ ...testUiDeps(homeDir), doctorDeps: () => doctor }));
});

afterAll(() => server.close());

describe('doctor API', () => {
  it('returns the same checks as npm run doctor, with the router off as OK', async () => {
    const reply = await uiCall(server.port, 'GET', '/api/doctor', pageHeaders(server.port, server.token));
    const { checks } = reply.json() as { checks: Array<{ name: string; ok: boolean; message: string }> };
    expect(checks).toEqual(await runDoctorChecks(doctor));
    expect(checks.find((check) => check.name === 'router')).toMatchObject({ ok: true, message: expect.stringMatching(/^The router is off/) });
    expect(reply.text).not.toContain('sk-doctor-api-DO-NOT-PRINT');
  });
});
