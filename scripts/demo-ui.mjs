#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEMO_HOME = '/tmp/routemax-demo';
const HOUR_MS = 3_600_000;

const isoHoursAgo = (hours) => new Date(Date.now() - hours * HOUR_MS).toISOString();

function decision(hoursAgo, fields) {
  return {
    ts: isoHoursAgo(hoursAgo),
    cwd: '/Users/demo/code/shop-api',
    taskType: 'tests',
    requestedTier: 'flash-low',
    finalTier: 'flash-low',
    raisedBy: null,
    provider: 'deepseek',
    model: 'deepseek-flash',
    effort: 'low',
    costUsd: 0.0021,
    status: 'done',
    reason: null,
    durationMs: 41_000,
    retries: 0,
    inputTokens: 18_000,
    outputTokens: 2_400,
    cacheReadTokens: 9_000,
    cacheCreationTokens: 0,
    ...fields,
  };
}

const { provider: _dropped, ...withoutProvider } = decision(30, { cwd: '/Users/demo/code/blog', taskType: 'search', costUsd: 0.0009 });

const decisions = [
  withoutProvider,
  decision(5, { cwd: '/tmp/routemax-provider-test-demo', taskType: 'provider-test', costUsd: 0.0004, durationMs: 6_000 }),
  decision(3, {
    taskType: 'boilerplate',
    requestedTier: 'flash-high',
    finalTier: 'pro-high',
    raisedBy: 'keyword',
    model: 'deepseek-v4-pro',
    effort: 'high',
    costUsd: 0.0187,
    status: 'escalate',
    reason: 'tests-failed',
    retries: 2,
  }),
  decision(1, { cwd: '/Users/demo/code/blog', taskType: 'search', finalTier: 'claude', provider: null, model: 'opus', effort: 'high', costUsd: 0, status: 'disabled', durationMs: 0 }),
  decision(0.5, {}),
];

const providerTests = {
  deepseek: { providerId: 'deepseek', model: 'deepseek-flash', passed: true, costUsd: 0.0004, testedAt: isoHoursAgo(5), detail: 'The worker answered and the check passed.' },
  openrouter: { providerId: 'openrouter', model: 'qwen3-coder', passed: false, costUsd: 0, testedAt: isoHoursAgo(4), detail: 'HTTP 401 from the provider: the key was refused.' },
};

rmSync(DEMO_HOME, { recursive: true, force: true });
const delegateState = join(DEMO_HOME, '.local', 'state', 'deepseek-delegate');
const routemaxState = join(DEMO_HOME, '.local', 'state', 'routemax');
mkdirSync(delegateState, { recursive: true });
mkdirSync(routemaxState, { recursive: true });
writeFileSync(join(delegateState, 'decisions.jsonl'), decisions.map((line) => JSON.stringify(line)).join('\n') + '\n');
writeFileSync(join(routemaxState, 'provider-tests.json'), JSON.stringify(providerTests, null, 2) + '\n');

console.log(`demo HOME: ${DEMO_HOME} (do not store a real key through this page)`);
const demoEnv = { ...process.env, HOME: DEMO_HOME };
delete demoEnv.DEEPSEEK_DELEGATE_CONFIG;
const child = spawn(process.execPath, [join(ROOT, 'bin', 'routemax.mjs'), 'ui'], { stdio: 'inherit', env: demoEnv });
child.on('exit', (code) => process.exit(code ?? 0));
