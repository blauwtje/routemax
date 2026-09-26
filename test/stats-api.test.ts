import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ClaudeUsageStore } from '../src/claude-usage/claude-usage-store';
import { claudeUsagePath } from '../src/config/routemax-paths';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

let server: UiServer;
let configPath = '';
let usagePath = '';

const line = (fields: Record<string, unknown>) =>
  JSON.stringify({
    ts: new Date().toISOString(),
    cwd: '/tmp/project',
    taskType: 'search',
    requestedTier: 'flash-low',
    finalTier: 'flash-low',
    raisedBy: null,
    model: 'deepseek-flash',
    effort: 'low',
    costUsd: 0.01,
    status: 'done',
    reason: null,
    durationMs: 1000,
    retries: 0,
    inputTokens: 10,
    outputTokens: 10,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    ...fields,
  });

// Local Y-M-D, matching how decision-stats keys a claude-usage day.
const todayKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

beforeAll(async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'routemax-stats-api-'));
  const deps = testUiDeps(homeDir);
  configPath = deps.configPath;
  const logPath = decisionLogPath(homeDir);
  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(
    logPath,
    [
      line({ costUsd: 0.25 }),
      line({ provider: 'openrouter', model: 'openai/gpt-5', costUsd: 0.5 }),
      line({ provider: null, finalTier: 'claude', model: null, effort: null, costUsd: 0, status: 'disabled' }),
      '',
    ].join('\n'),
  );
  const projectsDir = mkdtempSync(join(tmpdir(), 'routemax-claude-projects-'));
  const transcriptLine = {
    type: 'assistant',
    message: {
      id: 'msg_stats',
      model: 'claude-sonnet-5',
      content: [],
      usage: { input_tokens: 1_000_000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 } },
    },
    requestId: 'req_stats',
    timestamp: new Date().toISOString(),
  };
  mkdirSync(join(projectsDir, 'project'), { recursive: true });
  writeFileSync(join(projectsDir, 'project', 'session.jsonl'), `${JSON.stringify(transcriptLine)}\n`);
  usagePath = claudeUsagePath(homeDir);
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes({ ...deps, claudeProjectsDirs: [projectsDir] }));
});

afterAll(() => server.close());

const get = (path: string) => uiCall(server.port, 'GET', path, pageHeaders(server.port, server.token));

describe('history and stats API', () => {
  it('returns every log line, a line without provider as deepseek and a disabled call with cost 0', async () => {
    const { records } = (await get('/api/history')).json() as { records: Array<Record<string, unknown>> };
    expect(records.map((record) => [record.provider, record.status, record.costUsd])).toEqual([
      ['deepseek', 'done', 0.25],
      ['openrouter', 'done', 0.5],
      [null, 'disabled', 0],
    ]);
  });

  it('adds spend per provider up to the total spend, against the budget of the live config', async () => {
    const stats = (await get('/api/stats')).json() as {
      budget: { totalUsd: number; spentUsd: number };
      spendByProvider: Record<string, number>;
      today: { calls: number; claude: { costUsd: number }; byTier: Record<string, { calls: number; costUsd: number }> };
      claudeByDay: Record<string, number>;
    };
    expect(stats.spendByProvider).toEqual({ deepseek: 0.25, openrouter: 0.5 });
    expect(stats.budget.spentUsd).toBe(0.75);
    expect(stats.budget.totalUsd).toBe(JSON.parse(readFileSync(configPath, 'utf8')).budget.totalUsd);
  });

  it('reports claude API-equivalent cost beside the deepseek-only budget', async () => {
    const stats = (await get('/api/stats')).json() as {
      budget: { spentUsd: number };
      today: { claude: { costUsd: number }; byTier: Record<string, { calls: number; costUsd: number }> };
      claudeByDay: Record<string, number>;
    };
    expect(stats.today.claude.costUsd).toBe(2);
    expect(stats.today.byTier.claude).toEqual({ calls: 1, costUsd: 2 });
    expect(stats.claudeByDay[todayKey()]).toBe(2);
    const store = JSON.parse(readFileSync(usagePath, 'utf8')) as ClaudeUsageStore;
    expect(store.days[todayKey()]['claude-sonnet-5'].costUsd).toBe(2);
    expect(Object.keys(stats.claudeByDay)).toHaveLength(7);
    // budget.spentUsd stays deepseek-only: the claude cost never adds to it.
    expect(stats.budget.spentUsd).toBe(0.75);
  });
});
