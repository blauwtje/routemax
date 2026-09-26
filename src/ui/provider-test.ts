import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { DelegateConfig } from '../config/config-schema';
import { delegate, type DelegateDeps } from '../delegate/delegate';
import type { DelegateResult } from '../delegate/delegate-result';

export interface ProviderTestResult {
  providerId: string;
  model: string;
  passed: boolean;
  costUsd: number;
  testedAt: string;
  detail: string;
}

type ProviderTestOutcome = Pick<ProviderTestResult, 'passed' | 'costUsd' | 'detail'>;

const TEST_TASK = 'Read hello.txt in the current folder and reply with its only line.';

function providerTestConfig(config: DelegateConfig, providerId: string, model: string): DelegateConfig {
  const copy = structuredClone(config);
  const provider = copy.providers[providerId];
  provider.enabled = true;
  copy.tiers['flash-low'] = { provider: providerId, model, effort: provider.efforts[0] };
  copy.rules = [];
  copy.smartRouting = { ...copy.smartRouting, enabled: false };
  return copy;
}

function outcomeOf(result: DelegateResult): ProviderTestOutcome {
  switch (result.status) {
    case 'done':
      return { passed: true, costUsd: result.costUsd, detail: `The ${result.model} worker finished the test task.` };
    case 'escalate':
      return { passed: false, costUsd: result.costUsd, detail: `The worker stopped with ${result.reason}.` };
    case 'use_claude':
      return { passed: false, costUsd: 0, detail: result.reason === 'disabled' ? 'The router is off; switch it on to test a provider.' : 'The router handed the test to Claude.' };
    case 'refused':
      return { passed: false, costUsd: 0, detail: result.message };
  }
}

export async function testProvider(deps: DelegateDeps, providerId: string, model: string): Promise<ProviderTestResult> {
  const cwd = mkdtempSync(join(tmpdir(), 'routemax-provider-test-'));
  writeFileSync(join(cwd, 'hello.txt'), 'routemax provider test\n');
  try {
    const request = { task: TEST_TASK, taskType: 'provider-test', requestedTier: 'flash-low' as const, flags: [] };
    const outcome = await delegate(request, { ...deps, config: providerTestConfig(deps.config, providerId, model), cwd }).then(
      outcomeOf,
      (error: unknown): ProviderTestOutcome => ({ passed: false, costUsd: 0, detail: error instanceof Error ? error.message : String(error) }),
    );
    return { providerId, model, ...outcome, testedAt: new Date().toISOString() };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

export function readProviderTests(path: string): Record<string, ProviderTestResult> {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, ProviderTestResult>;
}

export function recordProviderTest(path: string, result: ProviderTestResult): void {
  const results = { ...readProviderTests(path), [result.providerId]: result };
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(results, null, 2)}\n`);
  renameSync(tempPath, path);
}
