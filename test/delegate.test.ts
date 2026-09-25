import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DelegateConfig } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { delegate, type DelegateDeps } from '../src/delegate/delegate';
import type { DelegateRequest } from '../src/delegate/delegate-result';
import type { ProxyStart } from '../src/proxy/ensure-proxy';
import { routerSwitchPath } from '../src/router-switch/router-switch';

const FAKE_CLAUDE = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));
const FAKE_KEY = 'sk-fake-DO-NOT-LEAK';
beforeAll(() => chmodSync(FAKE_CLAUDE, 0o755));

interface HarnessOptions {
  scenario?: string;
  config?: Partial<DelegateConfig>;
  env?: Record<string, string>;
  testCommand?: string;
  ensureProxy?: DelegateDeps['ensureProxy'];
  readApiKey?: () => Promise<string>;
}

function harness(options: HarnessOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'routemax-delegate-'));
  const home = join(root, 'home');
  const cwd = join(root, 'work');
  mkdirSync(join(home, '.claude-deepseek'), { recursive: true });
  mkdirSync(cwd);
  writeFileSync(join(home, '.claude-deepseek', 'env.vars'), 'ANTHROPIC_BASE_URL=http://127.0.0.1:8787\nANTHROPIC_MODEL=deepseek-v4-pro\n');
  writeFileSync(join(home, '.claude-deepseek', 'mcp.json'), '{"mcpServers":{}}\n');
  const recordPath = join(root, 'record.json');
  const telemetryPath = join(root, 'telemetry.jsonl');
  const shipped = loadConfig(DEFAULT_CONFIG_PATH);
  const config: DelegateConfig = {
    ...shipped,
    claudeBin: FAKE_CLAUDE,
    providers: {
      ...shipped.providers,
      deepseek: { ...shipped.providers.deepseek, repairProxy: { port: 8787, logPath: join(root, 'proxy.log'), telemetryPath } },
    },
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
    ensureProxy: options.ensureProxy ?? (async () => 'running'),
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

function writeSwitch(home: string, state: 'on' | 'off'): void {
  mkdirSync(dirname(routerSwitchPath(home)), { recursive: true });
  writeFileSync(routerSwitchPath(home), `${state}\n`);
}

describe('delegate', () => {
  it('runs a flash-high worker and returns summary, changed files, tier, model, effort and cost', async () => {
    const { deps, cwd, recordPath, home } = harness();
    const result = await delegate(request(), deps);
    expect(result).toMatchObject({
      status: 'done',
      summary: 'Did the thing.',
      changedFiles: [join(realpathSync(cwd), 'a.txt')],
      tier: 'flash-high',
      model: 'deepseek-flash',
      effort: 'high',
    });
    expect(result.status === 'done' && result.costUsd).toBeGreaterThan(0);
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    expect(record).toMatchObject({
      depth: '1',
      model: 'deepseek-flash',
      subagentModel: 'deepseek-flash',
      effort: 'high',
      hasAuthToken: true,
      hasApiKey: true,
      cwd: realpathSync(cwd),
    });
    expect(record.args).not.toContain('--dangerously-skip-permissions');
    expect(logLines(home)[0]).toMatchObject({ taskType: 'boilerplate', requestedTier: 'flash-low', finalTier: 'flash-high', raisedBy: 'boilerplate-tests-edits', provider: 'deepseek', status: 'done', reason: null, retries: 0 });
  });

  it('raises the worker effort for a higher Claude effort', async () => {
    const { deps } = harness();
    expect(await delegate(request({ taskType: 'search', claudeEffort: 'xhigh' }), deps)).toMatchObject({ tier: 'flash-low', effort: 'max' });
  });

  it('lowers the worker effort to one the provider accepts', async () => {
    const { deps } = harness();
    const { deepseek } = deps.config.providers;
    deps.config = { ...deps.config, providers: { ...deps.config.providers, deepseek: { ...deepseek, efforts: ['low', 'high'] } } };
    expect(await delegate(request({ taskType: 'search', claudeEffort: 'xhigh' }), deps)).toMatchObject({ tier: 'flash-low', effort: 'high' });
  });

  it('returns use_claude for a claude-tier task without starting a worker', async () => {
    const { deps, recordPath, home } = harness();
    const result = await delegate(request({ taskType: 'security' }), deps);
    expect(result).toEqual({
      status: 'use_claude',
      tier: 'claude',
      agent: 'claude-opus-xhigh',
      model: 'opus',
      effort: 'xhigh',
      next: 'Do this task yourself through the Agent tool with subagent_type "claude-opus-xhigh" (opus, effort xhigh), passing the full task.',
    });
    expect(existsSync(recordPath)).toBe(false);
    expect(logLines(home)[0]).toMatchObject({ status: 'use_claude', costUsd: 0, provider: null });
  });

  it('hands a worker task to the mapped Claude agent without a worker and logs it as disabled while the switch is off', async () => {
    const { deps, recordPath, home } = harness();
    writeSwitch(home, 'off');
    const result = await delegate(request({ taskType: 'search' }), deps);
    expect(result).toEqual({
      status: 'use_claude',
      tier: 'claude',
      agent: 'claude-opus-high',
      model: 'opus',
      effort: 'high',
      next: 'Do this task yourself through the Agent tool with subagent_type "claude-opus-high" (opus, effort high), passing the full task.',
      reason: 'disabled',
    });
    expect(existsSync(recordPath)).toBe(false);
    expect(logLines(home)).toHaveLength(1);
    expect(logLines(home)[0]).toMatchObject({ taskType: 'search', finalTier: 'claude', raisedBy: null, provider: null, model: 'opus', effort: 'high', status: 'disabled', reason: null, costUsd: 0, retries: 0 });
  });

  it('runs a worker again once the switch file says on', async () => {
    const { deps, recordPath, home } = harness();
    writeSwitch(home, 'on');
    const result = await delegate(request(), deps);
    expect(result.status).toBe('done');
    expect(existsSync(recordPath)).toBe(true);
  });

  it('refuses inside a worker (recursion guard)', async () => {
    const { deps, recordPath } = harness({ env: { DEEPSEEK_DELEGATE_DEPTH: '1' } });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'refused' });
    expect(existsSync(recordPath)).toBe(false);
  });

  it('refuses before the call when spent-to-date from the log plus the per-call cap passes the total', async () => {
    const { deps, home, recordPath } = harness();
    mkdirSync(dirname(decisionLogPath(home)), { recursive: true });
    writeFileSync(decisionLogPath(home), `${JSON.stringify({ costUsd: 9.8 })}\n`);
    const result = await delegate(request(), deps);
    expect(result.status === 'refused' && result.message).toMatch(/Budget cap reached: \$9\.80 of \$10\.00/);
    expect(existsSync(recordPath)).toBe(false);
  });

  it('stops a call that passes $0.25 and escalates with reason budget', async () => {
    const { deps, home } = harness({ scenario: 'expensive' });
    const result = await delegate(request(), deps);
    expect(result).toMatchObject({ status: 'escalate', reason: 'budget' });
    expect(logLines(home)[0].costUsd).toBeGreaterThan(0.25);
  });

  it('escalates with reason timeout', async () => {
    const { deps } = harness({ scenario: 'hang', config: { workerTimeoutMs: 300 } });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'escalate', reason: 'timeout' });
  });

  it.each([
    ['exit-code', 'exit-code'],
    ['stream-error', 'stream-error'],
    ['empty-result', 'empty-result'],
  ])('escalates the %s scenario with reason %s', async (scenario, reason) => {
    const { deps } = harness({ scenario });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'escalate', reason });
  });

  it('runs the project test command after the worker and escalates when it fails, listing changed files', async () => {
    const { deps, cwd, recordPath } = harness({ testCommand: 'exit 1' });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'escalate', reason: 'tests-failed', changedFiles: [join(realpathSync(cwd), 'a.txt')] });
    expect(JSON.parse(readFileSync(recordPath, 'utf8')).args).toContain('Bash(exit 1)');
  });

  it('passes when the test command passes', async () => {
    const { deps } = harness({ testCommand: 'exit 0' });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done' });
  });

  it('escalates with reason test-timeout when the test command runs too long', async () => {
    const { deps } = harness({ testCommand: 'sleep 30', config: { testTimeoutMs: 200 } });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'escalate', reason: 'test-timeout' });
  });

  it('logs retries without escalating while the threshold is unset', async () => {
    const { deps, home } = harness({ env: { FAKE_CLAUDE_RETRIES: '3' } });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done' });
    expect(logLines(home)[0]).toMatchObject({ status: 'done', retries: 3 });
  });

  it('escalates with reason retries once the threshold is set and passed', async () => {
    const { deps } = harness({ env: { FAKE_CLAUDE_RETRIES: '3' }, config: { retryThreshold: 2 } });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'escalate', reason: 'retries' });
  });

  it('keeps the key out of the decision log and the result', async () => {
    const { deps, home } = harness();
    const result = await delegate(request(), deps);
    expect(readFileSync(decisionLogPath(home), 'utf8')).not.toContain(FAKE_KEY);
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });

  it('fails closed without starting a worker when the key lookup fails', async () => {
    const { deps, recordPath } = harness({
      readApiKey: async () => {
        throw new Error('DeepSeek API key not found in Keychain (service deepseek_api_key).');
      },
    });
    expect(await delegate(request(), deps)).toEqual({ status: 'refused', message: 'DeepSeek API key not found in Keychain (service deepseek_api_key).' });
    expect(existsSync(recordPath)).toBe(false);
  });

  it("starts the provider's repair-proxy with its port and upstream", async () => {
    const starts: ProxyStart[] = [];
    const { deps } = harness({ ensureProxy: async (start) => starts.push(start) });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done' });
    expect(starts).toEqual([expect.objectContaining({ port: 8787, upstreamBaseUrl: 'https://api.deepseek.com/anthropic' })]);
  });

  it('starts no proxy and still runs for a provider without a repair-proxy', async () => {
    const starts: ProxyStart[] = [];
    const { deps } = harness({ ensureProxy: async (start) => starts.push(start) });
    const { deepseek } = deps.config.providers;
    deps.config = { ...deps.config, providers: { ...deps.config.providers, deepseek: { ...deepseek, repairProxy: null } } };
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done' });
    expect(starts).toEqual([]);
  });
});
