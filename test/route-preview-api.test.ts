import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Tier } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { planRoute, type PlanRequest } from '../src/routing/plan-route';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

const config = loadConfig(DEFAULT_CONFIG_PATH);
const request = (taskType: string, requestedTier: Tier, task = 'Do the task.', flags: string[] = []): PlanRequest => ({ task, taskType, requestedTier, flags });

const SEED_CASES: Array<[string, PlanRequest]> = [
  ['search at flash-low', request('search', 'flash-low')],
  ['boilerplate', request('boilerplate', 'flash-low')],
  ['tests', request('tests', 'flash-low')],
  ['build', request('build', 'flash-low')],
  ['security', request('security', 'flash-low')],
  ['migration', request('migration', 'flash-low')],
  ['the OAuth keyword', request('simple-edit', 'flash-low', 'Fix the OAuth callback')],
  ['a read-only search with a keyword', request('search', 'flash-low', 'Find where the auth token is read')],
  ['a read-only summary with a keyword', request('summarize', 'flash-low', 'Summarize the migration scripts')],
  ['author as a whole word', request('simple-edit', 'flash-low', 'Rename the author field')],
  ['the irreversible flag', request('search', 'flash-low', 'Find old rows', ['irreversible'])],
  ['search requested at pro-high', request('search', 'pro-high')],
  ['an unknown type at flash-high', request('unknown-type', 'flash-high')],
  ['a build with Claude effort high', { ...request('build', 'flash-low'), claudeEffort: 'high' }],
];

let server: UiServer;
let homeDir = '';

beforeAll(async () => {
  homeDir = mkdtempSync(join(tmpdir(), 'routemax-preview-api-'));
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes(testUiDeps(homeDir)));
});

afterAll(() => server.close());

const preview = (body: unknown) => uiCall(server.port, 'POST', '/api/route-preview', pageHeaders(server.port, server.token, true), body);

describe('route preview API', () => {
  it.each(SEED_CASES)('returns the same plan as the router for %s', async (_name, planRequest) => {
    const reply = await preview({ config, request: planRequest });
    expect(reply.status).toBe(200);
    expect(reply.json()).toEqual(planRoute(config, planRequest));
  });

  it('plans a seed search on the DeepSeek flash tier', async () => {
    expect((await preview({ config, request: request('search', 'flash-low') })).json()).toMatchObject({ tier: 'flash-low', provider: 'deepseek', model: 'deepseek-flash' });
  });

  it('refuses an invalid config with the field named', async () => {
    const broken = structuredClone(config) as unknown as { providers: Record<string, { models: Record<string, Record<string, unknown>> }> };
    delete broken.providers.deepseek.models['deepseek-flash'].outputUsd;
    const reply = await preview({ config: broken, request: request('search', 'flash-low') });
    expect(reply.status).toBe(422);
    expect((reply.json() as { issues: string[] }).issues).toEqual(expect.arrayContaining([expect.stringMatching(/^providers\.deepseek\.models\.deepseek-flash\.outputUsd/)]));
  });

  it('runs no worker and writes no decision', () => {
    expect(existsSync(decisionLogPath(homeDir))).toBe(false);
  });
});
