import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { DelegateConfig } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { delegate, type DelegateDeps } from '../src/delegate/delegate';
import type { DelegateRequest } from '../src/delegate/delegate-result';
import type { ProxyStart } from '../src/proxy/ensure-proxy';
import { routerSwitchPath } from '../src/router-switch/router-switch';
import { selectLane } from '../src/routing/select-lane';
import { keysEnvPath } from '../src/config/routemax-paths';
import { readLaneKey } from '../src/worker/read-lane-key';

vi.mock('../src/routing/select-lane', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/routing/select-lane')>();
  return { ...actual, selectLane: vi.fn(actual.selectLane) };
});

const FAKE_CLAUDE = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));
const FAKE_KEY = 'sk-fake-DO-NOT-LEAK';
beforeAll(() => chmodSync(FAKE_CLAUDE, 0o755));

interface HarnessOptions {
  scenario?: string;
  config?: Partial<DelegateConfig>;
  env?: Record<string, string>;
  testCommand?: string;
  ensureProxy?: DelegateDeps['ensureProxy'];
  readLaneKey?: DelegateDeps['readLaneKey'];
  withFallback?: boolean;
  fetchImpl?: DelegateDeps['fetchImpl'];
}

const throwingFetch: DelegateDeps['fetchImpl'] = () => {
  throw new Error('fetchImpl should not be called while smart routing is off');
};

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
      deepseek: { ...shipped.providers.deepseek, keyVariable: 'DEEPSEEK_API_KEY', repairProxy: { port: 8787, logPath: join(root, 'proxy.log'), telemetryPath } },
      'zai-glm': {
        ...shipped.providers.deepseek,
        name: 'Z.ai',
        baseUrl: 'https://api.z.ai/api/anthropic',
        keyVariable: 'ZAI_API_KEY',
        models: { 'GLM-5.3': { inputUsd: 0, cacheHitUsd: 0, outputUsd: 0 } },
        repairProxy: null,
      },
    },
    projects: options.testCommand ? { [cwd]: { testCommand: options.testCommand } } : {},
    smartRouting: { ...shipped.smartRouting, enabled: false },
    ...(options.withFallback ? { lanes: { fallback: { provider: 'zai-glm', model: 'GLM-5.3' }, preferGlmAtPeak: false } } : {}),
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
    readLaneKey: options.readLaneKey ?? (() => FAKE_KEY),
    ensureProxy: options.ensureProxy ?? (async () => 'running'),
    fetchImpl: options.fetchImpl ?? throwingFetch,
  };
  return { deps, home, cwd, root, recordPath };
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
    expect(logLines(home)[0]).toMatchObject({ taskType: 'boilerplate', requestedTier: 'flash-low', finalTier: 'flash-high', raisedBy: 'boilerplate-tests-edits', provider: 'deepseek', status: 'done', reason: null, retries: 0, routedBy: 'off', routeReason: 'smart routing is off' });
  });

  it('folds the check cost into the logged costUsd for a task the check classifies', async () => {
    const responseBody = {
      content: [{ type: 'text', text: '{"tier":"flash-low","effort":"low"}' }],
      usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    };
    const { deps, home } = harness({
      config: { smartRouting: { enabled: true, checkTimeoutMs: 3000 } },
      fetchImpl: (async () => new Response(JSON.stringify(responseBody), { status: 200 })) as DelegateDeps['fetchImpl'],
    });
    const result = await delegate(request({ task: 'do the thing', taskType: 'other' }), deps);
    const record = logLines(home)[0];
    expect(record.routedBy).toBe('check');
    expect(typeof record.routeReason).toBe('string');
    expect(result.status === 'done' && record.costUsd).toBeGreaterThan(result.status === 'done' ? result.costUsd : Infinity);
  });

  it("attributes a Claude hand-off after a paid check to the check's provider", async () => {
    const responseBody = {
      content: [{ type: 'text', text: '{"tier":"claude","effort":"high"}' }],
      usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    };
    const { deps, home, recordPath } = harness({
      config: { smartRouting: { enabled: true, checkTimeoutMs: 3000 } },
      fetchImpl: (async () => new Response(JSON.stringify(responseBody), { status: 200 })) as DelegateDeps['fetchImpl'],
    });
    const result = await delegate(request({ task: 'do the thing', taskType: 'other' }), deps);
    expect(result.status).toBe('use_claude');
    expect(existsSync(recordPath)).toBe(false);
    const record = logLines(home)[0];
    expect(record).toMatchObject({ status: 'use_claude', finalTier: 'claude', routedBy: 'check', provider: deps.config.tiers['flash-low'].provider });
    expect(record.costUsd).toBeGreaterThan(0);
  });

  it("keeps the worker effort when Claude's own effort is higher", async () => {
    const { deps } = harness();
    expect(await delegate(request({ taskType: 'search', claudeEffort: 'xhigh' }), deps)).toMatchObject({ tier: 'flash-low', effort: 'high' });
  });

  it('takes the worker effort from the task type and logs lane, peak and task effort', async () => {
    const { deps, home, recordPath } = harness({ config: { taskEfforts: { search: 'max' } } });
    expect(await delegate(request({ taskType: 'search' }), deps)).toMatchObject({ tier: 'flash-low', effort: 'max' });
    expect(JSON.parse(readFileSync(recordPath, 'utf8')).effort).toBe('max');
    expect(logLines(home)[0]).toMatchObject({ lane: 'deepseek', provider: 'deepseek', peak: false, fallbackFrom: null, taskEffort: 'max', effort: 'max' });
  });

  it('lowers the worker effort to one the provider accepts', async () => {
    const { deps } = harness({ config: { taskEfforts: { search: 'max' } } });
    const { deepseek } = deps.config.providers;
    deps.config = { ...deps.config, providers: { ...deps.config.providers, deepseek: { ...deepseek, efforts: ['low', 'high'] } } };
    expect(await delegate(request({ taskType: 'search' }), deps)).toMatchObject({ tier: 'flash-low', effort: 'high' });
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

  it('fails closed without starting a worker when the key read breaks for another reason', async () => {
    const { deps, recordPath } = harness({
      readLaneKey: () => {
        throw new Error('keys.env could not be parsed.');
      },
    });
    expect(await delegate(request(), deps)).toEqual({ status: 'refused', message: 'keys.env could not be parsed.' });
    expect(existsSync(recordPath)).toBe(false);
  });

  it('hands the task to Claude like the off switch when keys.env is missing', async () => {
    const { deps, home, recordPath } = harness({ readLaneKey, withFallback: true });
    expect(existsSync(keysEnvPath(home))).toBe(false);
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
    expect(logLines(home)[0]).toMatchObject({ finalTier: 'claude', provider: null, model: 'opus', status: 'disabled', reason: null, routeReason: 'missing key', costUsd: 0 });
  });

  it('runs on the fallback lane when the DeepSeek key is missing', async () => {
    const { deps, home, recordPath } = harness({ readLaneKey, withFallback: true });
    mkdirSync(dirname(keysEnvPath(home)), { recursive: true });
    writeFileSync(keysEnvPath(home), `ZAI_API_KEY=${FAKE_KEY}\n`);
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done', model: 'GLM-5.3', costUsd: 0 });
    expect(JSON.parse(readFileSync(recordPath, 'utf8')).model).toBe('GLM-5.3');
    expect(logLines(home)).toEqual([expect.objectContaining({ lane: 'zai-glm', provider: 'zai-glm', fallbackFrom: 'deepseek', status: 'done' })]);
  });

  it('runs on the fallback lane when the DeepSeek proxy cannot start', async () => {
    const { deps, home } = harness({
      withFallback: true,
      ensureProxy: async () => {
        throw new Error('proxy did not start');
      },
    });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done', model: 'GLM-5.3' });
    expect(logLines(home)).toEqual([expect.objectContaining({ lane: 'zai-glm', fallbackFrom: 'deepseek' })]);
  });

  it('reruns once on the fallback lane after a 429 that changed no file', async () => {
    const { deps, home, root, recordPath } = harness({ withFallback: true });
    const rateLimited = join(root, 'rate-limited-claude.sh');
    writeFileSync(rateLimited, [
      '#!/bin/sh',
      'if [ "$ANTHROPIC_MODEL" = "deepseek-flash" ]; then',
      `  echo '{"type":"result","subtype":"error_during_execution","is_error":true,"result":"API Error: 429 rate limit reached","usage":{"input_tokens":0,"output_tokens":0,"cache_read_input_tokens":0,"cache_creation_input_tokens":0}}'`,
      '  exit 1',
      'fi',
      `exec "${FAKE_CLAUDE}" "$@"`,
      '',
    ].join('\n'));
    chmodSync(rateLimited, 0o755);
    deps.config = { ...deps.config, claudeBin: rateLimited };
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done', model: 'GLM-5.3' });
    expect(JSON.parse(readFileSync(recordPath, 'utf8')).model).toBe('GLM-5.3');
    expect(logLines(home)).toEqual([
      expect.objectContaining({ lane: 'deepseek', fallbackFrom: null, status: 'escalate' }),
      expect.objectContaining({ lane: 'zai-glm', fallbackFrom: 'deepseek', status: 'done' }),
    ]);
  });

  it('escalates without the fallback when the failed DeepSeek run already changed a file', async () => {
    const { deps, home } = harness({ withFallback: true, testCommand: 'exit 1' });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'escalate', reason: 'tests-failed', model: 'deepseek-flash' });
    expect(logLines(home)).toHaveLength(1);
  });

  it('runs on today\'s plan with today\'s log line when lane selection throws', async () => {
    vi.mocked(selectLane).mockImplementationOnce(() => {
      throw new Error('lane selection broke');
    });
    const { deps, home, recordPath } = harness({ config: { taskEfforts: { boilerplate: 'max' } } });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done', tier: 'flash-high', model: 'deepseek-flash', effort: 'high' });
    expect(JSON.parse(readFileSync(recordPath, 'utf8'))).toMatchObject({ model: 'deepseek-flash', subagentModel: 'deepseek-flash', effort: 'high', hasAuthToken: true });
    const record = logLines(home)[0];
    expect(record).toMatchObject({ provider: 'deepseek', model: 'deepseek-flash', effort: 'high', status: 'done' });
    for (const field of ['lane', 'peak', 'fallbackFrom', 'taskEffort']) expect(record).not.toHaveProperty(field);
  });

  it('multiplies the cost and the per-call limit by the peak price factor', async () => {
    const peak = { windowsUtc: [[1, 4], [6, 10]] as [number, number][], weekdaysOnly: true, priceFactor: 2 };
    const costAt = async (iso: string) => {
      const { deps, home } = harness();
      const { deepseek } = deps.config.providers;
      deps.config = { ...deps.config, providers: { ...deps.config.providers, deepseek: { ...deepseek, peak } } };
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(iso));
      try {
        const result = await delegate(request(), deps);
        return { cost: result.status === 'done' ? result.costUsd : NaN, record: logLines(home)[0] };
      } finally {
        vi.useRealTimers();
      }
    };
    const offPeak = await costAt('2026-09-30T12:00:00Z');
    const atPeak = await costAt('2026-09-30T07:00:00Z');
    expect(offPeak.record.peak).toBe(false);
    expect(atPeak.record.peak).toBe(true);
    expect(atPeak.cost).toBeCloseTo(offPeak.cost * 2, 10);
    expect(atPeak.record.costUsd).toBeCloseTo(offPeak.record.costUsd * 2, 10);
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
