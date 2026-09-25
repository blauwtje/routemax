import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { providerTestsPath } from '../src/config/routemax-paths';
import { decisionLogPath } from '../src/decision-log/decision-log';
import type { DelegateDeps } from '../src/delegate/delegate';
import { setRouterEnabled } from '../src/router-switch/router-switch';
import { readProviderTests, recordProviderTest, testProvider, type ProviderTestResult } from '../src/ui/provider-test';

function routerOffDeps(): DelegateDeps {
  const homeDir = mkdtempSync(join(tmpdir(), 'routemax-provider-test-'));
  setRouterEnabled(homeDir, false);
  return {
    config: loadConfig(DEFAULT_CONFIG_PATH),
    homeDir,
    cwd: homeDir,
    env: {},
    readApiKey: async () => {
      throw new Error('No key is read while the router is off.');
    },
    ensureProxy: async () => {
      throw new Error('No proxy starts while the router is off.');
    },
  };
}

describe('testProvider', () => {
  it('fails with the router off and logs the call as provider-test', async () => {
    const deps = routerOffDeps();
    expect(await testProvider(deps, 'deepseek', 'deepseek-flash')).toEqual({
      providerId: 'deepseek',
      model: 'deepseek-flash',
      passed: false,
      costUsd: 0,
      testedAt: expect.any(String),
      detail: 'The router is off; switch it on to test a provider.',
    });
    const lines = readFileSync(decisionLogPath(deps.homeDir), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(lines).toEqual([expect.objectContaining({ taskType: 'provider-test', status: 'disabled', costUsd: 0 })]);
  });

  it('leaves the given config unchanged', async () => {
    const deps = routerOffDeps();
    const before = structuredClone(deps.config);
    await testProvider(deps, 'deepseek', 'deepseek-flash');
    expect(deps.config).toEqual(before);
  });
});

describe('provider test results', () => {
  const result: ProviderTestResult = { providerId: 'deepseek', model: 'deepseek-flash', passed: false, costUsd: 0, testedAt: '2026-09-25T10:00:00.000Z', detail: 'The worker stopped with upstream_error.' };

  it('lives beside the routemax backups', () => {
    expect(providerTestsPath('/home/test')).toBe('/home/test/.local/state/routemax/provider-tests.json');
  });

  it('reads nothing before the first test', () => {
    expect(readProviderTests(providerTestsPath(mkdtempSync(join(tmpdir(), 'routemax-provider-tests-'))))).toEqual({});
  });

  it('keeps the latest result per provider', () => {
    const path = providerTestsPath(mkdtempSync(join(tmpdir(), 'routemax-provider-tests-')));
    recordProviderTest(path, result);
    recordProviderTest(path, { ...result, providerId: 'openrouter', model: 'openrouter-model' });
    recordProviderTest(path, { ...result, passed: true, costUsd: 0.002, detail: 'The deepseek-flash worker finished the test task.' });
    expect(readProviderTests(path)).toEqual({
      deepseek: { ...result, passed: true, costUsd: 0.002, detail: 'The deepseek-flash worker finished the test task.' },
      openrouter: { ...result, providerId: 'openrouter', model: 'openrouter-model' },
    });
  });
});
