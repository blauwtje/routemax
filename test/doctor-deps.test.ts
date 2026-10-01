import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { commandOnPath } from '../src/doctor/command-on-path';
import { doctorDeps } from '../src/doctor/doctor-deps';
import { ensureProxy } from '../src/proxy/ensure-proxy';
import { serverRegistration } from '../src/setup/register-server';
import { readLaneKey } from '../src/worker/read-lane-key';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

describe('doctorDeps', () => {
  it('builds the deps npm run doctor uses, with the registration from the config claudeBin', () => {
    const config = loadConfig(DEFAULT_CONFIG_PATH);
    expect(doctorDeps(ROOT, config, '/tmp/routemax-home')).toEqual({
      homeDir: '/tmp/routemax-home',
      repoRoot: ROOT,
      config,
      registration: serverRegistration(ROOT, config.claudeBin),
      readLaneKey,
      ensureProxy,
      commandOnPath,
    });
  });
});
