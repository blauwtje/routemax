import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig, type DelegateConfig } from '../src/config/delegate-config';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { delegate, type DelegateDeps } from '../src/delegate/delegate';
import type { DelegateRequest } from '../src/delegate/delegate-result';

const FAKE_CLAUDE = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));
const FAKE_KEY = 'sk-fake-DO-NOT-LEAK';
beforeAll(() => chmodSync(FAKE_CLAUDE, 0o755));

interface HarnessOptions {
  scenario?: string;
  config?: Partial<DelegateConfig>;
  env?: Record<string, string>;
  testCommand?: string;
  baseUrl?: string;
  readApiKey?: () => Promise<string>;
}

function harness(options: HarnessOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'routemax-delegate-'));
  const home = join(root, 'home');
  const cwd = join(root, 'work');
  mkdirSync(join(home, '.claude-deepseek'), { recursive: true });
  mkdirSync(cwd);
  writeFileSync(join(home, '.claude-deepseek', 'env.vars'), `ANTHROPIC_BASE_URL=${options.baseUrl ?? 'http://127.0.0.1:8787'}\nANTHROPIC_MODEL=deepseek-v4-pro\n`);
  writeFileSync(join(home, '.claude-deepseek', 'mcp.json'), '{"mcpServers":{}}\n');
  const recordPath = join(root, 'record.json');
  const telemetryPath = join(root, 'telemetry.jsonl');
  const shipped = loadConfig(DEFAULT_CONFIG_PATH);
  const config: DelegateConfig = {
    ...shipped,
    claudeBin: FAKE_CLAUDE,
    proxy: { ...shipped.proxy, telemetryPath },
    projects: options.testCommand ? { [cwd]: { testCommand: options.testCommand } } : {},
    ...options.config,
  };
  const env = {
    PATH: process.env.PATH ?? '',
    ANTHROPIC_API_KEY: 'sk-ant-inherited',
    FAKE_CLAUDE_SCENARIO: options.scenario ?? 'success',
    FAKE_CLAUDE_RECORD: recordPath,
    FAKE_CLAUDE_TELEMETRY: telemetryPath,
    ...options.env,
  };
  const deps: DelegateDeps = {
    config,
    homeDir: home,
    cwd,
    env,
    readApiKey: options.readApiKey ?? (async () => FAKE_KEY),
    ensureProxy: async () => 'running',
  };
  return { deps, home, cwd, recordPath };
}

const request = (overrides: Partial<DelegateRequest> = {}): DelegateRequest => ({
  task: 'Add a greeting file.',
  taskType: 'boilerplate',
  requestedTier: 'flash-low',
  flags: [],
  ...overrides,
});
const logLines = (home: string) =>
  readFileSync(decisionLogPath(home), 'utf8').trim().split('\n').map((line) => JSON.parse(line));

describe('delegate', () => {
  it('runs a flash-high worker and returns summary, changed files, tier, model, effort and cost', async () => {
    const { deps, cwd, recordPath, home } = harness();
    const result = await delegate(request(), deps);
    expect(result).toMatchObject({
      status: 'done',
      summary: 'Did the thing.',
      changedFiles: [join(realpathSync(cwd), 'a.txt')],
      tier: 'flash-high',
      model: 'deepseek-v4-flash',
      effort: 'high',
    });
    expect(result.status === 'done' && result.costUsd).toBeGreaterThan(0);
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    expect(record).toMatchObject({
      depth: '1',
      model: 'deepseek-v4-flash',
      subagentModel: 'deepseek-v4-flash',
      effort: 'high',
      hasAuthToken: true,
      hasApiKey: false,
      cwd: realpathSync(cwd),
    });
    expect(record.args).not.toContain('--dangerously-skip-permissions');
    expect(logLines(home)[0]).toMatchObject({ taskType: 'boilerplate', requestedTier: 'flash-low', finalTier: 'flash-high', raisedBy: 'boilerplate-tests-edits', status: 'done', reason: null, retries: 0 });
  });

  it('raises the worker effort for a higher Claude effort', async () => {
    const { deps } = harness();
    expect(await delegate(request({ taskType: 'search', claudeEffort: 'xhigh' }), deps)).toMatchObject({ tier: 'flash-low', effort: 'max' });
  });

  it('returns use_claude for a claude-tier task without starting a worker', async () => {
    const { deps, recordPath, home } = harness();
    const result = await delegate(request({ taskType: 'security' }), deps);
    expect(result).toEqual({ status: 'use_claude', tier: 'claude', agent: 'claude-opus-xhigh', model: 'opus', effort: 'xhigh' });
    expect(existsSync(recordPath)).toBe(false);
    expect(logLines(home)[0]).toMatchObject({ status: 'use_claude', costUsd: 0 });
  });
});
