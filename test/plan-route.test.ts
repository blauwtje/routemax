import { describe, expect, it } from 'vitest';
import type { DelegateConfig } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import type { DelegateRequest } from '../src/delegate/delegate-result';
import { planRoute } from '../src/routing/plan-route';
import { fitEffort } from '../src/routing/resolve-effort';

const shipped = loadConfig(DEFAULT_CONFIG_PATH);
const request = (overrides: Partial<DelegateRequest> = {}): DelegateRequest => ({
  task: 'Add a greeting file.',
  taskType: 'boilerplate',
  requestedTier: 'flash-low',
  flags: [],
  ...overrides,
});

describe('fitEffort', () => {
  it.each([
    ['max', ['low', 'high'], 'high'],
    ['medium', ['high', 'low'], 'low'],
    ['low', ['medium', 'max'], 'medium'],
    ['high', ['low', 'medium', 'high', 'xhigh', 'max'], 'high'],
  ] as const)('fits %s into %j as %s', (effort, accepted, expected) => {
    expect(fitEffort(effort, [...accepted])).toBe(expected);
  });
});

describe('planRoute', () => {
  it('plans a boilerplate task on flash-high with the tier provider, model and effort', () => {
    expect(planRoute(shipped, request())).toEqual({ tier: 'flash-high', raisedBy: 'boilerplate-tests-edits', provider: 'deepseek', model: 'deepseek-flash', effort: 'high' });
  });

  it('names the Claude agent for a claude-tier task', () => {
    expect(planRoute(shipped, request({ taskType: 'security' }))).toMatchObject({ tier: 'claude', agent: 'claude-opus-xhigh' });
  });

  it('lowers the effort to one the provider accepts', () => {
    const config: DelegateConfig = { ...shipped, providers: { ...shipped.providers, deepseek: { ...shipped.providers.deepseek, efforts: ['low', 'high'] } } };
    expect(planRoute(config, request({ taskType: 'search', claudeEffort: 'xhigh' }))).toMatchObject({ tier: 'flash-low', effort: 'high' });
  });
});
