import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import type { DelegateRequest } from '../src/delegate/delegate-result';
import type { SmartRouteDeps } from '../src/routing/smart-route';
import { smartRoute } from '../src/routing/smart-route';

const shipped = loadConfig(DEFAULT_CONFIG_PATH);
const request = (overrides: Partial<DelegateRequest> = {}): DelegateRequest => ({
  task: 'Add a greeting file.',
  taskType: 'boilerplate',
  requestedTier: 'flash-low',
  flags: [],
  ...overrides,
});

function deps(overrides: Partial<SmartRouteDeps> = {}): SmartRouteDeps {
  return {
    readApiKey: vi.fn(async () => 'test-key'),
    fetchImpl: vi.fn(async () => {
      throw new Error('fetchImpl should not be called');
    }),
    ...overrides,
  };
}

describe('smartRoute', () => {
  it('sends a Claude-only rule match straight through without a check', async () => {
    const routeDeps = deps();
    const plan = await smartRoute(shipped, request({ taskType: 'security' }), routeDeps);
    expect(plan).toMatchObject({ tier: 'claude', agent: 'claude-opus-xhigh', routedBy: 'rules', checkCostUsd: 0 });
    expect(routeDeps.fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back to the plain rule tier when smart routing is off', async () => {
    const config = { ...shipped, smartRouting: { ...shipped.smartRouting, enabled: false } };
    const routeDeps = deps();
    const plan = await smartRoute(config, request(), routeDeps);
    expect(plan).toMatchObject({ tier: 'flash-high', raisedBy: 'boilerplate-tests-edits', routedBy: 'off', checkCostUsd: 0 });
    expect(routeDeps.fetchImpl).not.toHaveBeenCalled();
  });

  it('trusts a confident score and skips the check', async () => {
    const routeDeps = deps();
    const task = 'Refactor and rewrite the payment module; decide the best algorithm trade-off for retries.';
    const plan = await smartRoute(shipped, request({ task, taskType: 'boilerplate' }), routeDeps);
    expect(plan.routedBy).toBe('score');
    expect(plan.checkCostUsd).toBe(0);
    expect(routeDeps.fetchImpl).not.toHaveBeenCalled();
  });

  it('checks an unclear task and uses the check tier and effort', async () => {
    const responseBody = {
      content: [{ type: 'text', text: '{"tier":"pro-high","effort":"high"}' }],
      usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    };
    const routeDeps = deps({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify(responseBody), { status: 200 })) as unknown as typeof fetch,
    });
    const plan = await smartRoute(shipped, request({ task: 'do the thing', taskType: 'other' }), routeDeps);
    expect(plan).toMatchObject({ tier: 'pro-high', routedBy: 'check' });
    expect(plan.checkCostUsd).toBeGreaterThan(0);
    expect(routeDeps.readApiKey).toHaveBeenCalledWith(shipped.providers.deepseek.keychainService);
  });

  it('keeps the score result when the check fails', async () => {
    const routeDeps = deps({ fetchImpl: vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch });
    const plan = await smartRoute(shipped, request({ task: 'do the thing', taskType: 'other' }), routeDeps);
    expect(plan.routedBy).toBe('score');
    expect(plan.checkCostUsd).toBe(0);
  });

  it('keeps the score result when the key lookup throws', async () => {
    const routeDeps = deps({
      readApiKey: vi.fn(async () => {
        throw new Error('DeepSeek API key not found in Keychain (service deepseek_api_key).');
      }),
    });
    const plan = await smartRoute(shipped, request({ task: 'do the thing', taskType: 'other' }), routeDeps);
    expect(plan.routedBy).toBe('score');
    expect(plan.checkCostUsd).toBe(0);
    expect(plan.routeReason).toContain('DeepSeek API key not found in Keychain');
    expect(routeDeps.fetchImpl).not.toHaveBeenCalled();
  });
});
