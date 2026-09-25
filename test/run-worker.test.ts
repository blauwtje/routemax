import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runWorker, workerArgs, type WorkerRun } from '../src/worker/run-worker';

const FAKE_CLAUDE = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));
const PRICES = { 'deepseek-v4-flash': { inputUsd: 0.3, cacheHitUsd: 0.03, outputUsd: 1.2 } };

async function run(scenario: string, overrides: Partial<WorkerRun> = {}) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'routemax-worker-')));
  const outcome = await runWorker({
    claudeBin: FAKE_CLAUDE,
    args: [],
    cwd,
    env: { PATH: process.env.PATH ?? '', FAKE_CLAUDE_SCENARIO: scenario, ANTHROPIC_MODEL: 'deepseek-v4-flash' },
    prompt: 'Do the task.',
    timeoutMs: 10_000,
    costLimitUsd: 0.25,
    costOf: (stream) => stream.costUsd(PRICES, 'deepseek-v4-flash'),
    ...overrides,
  });
  return { outcome, cwd };
}

describe('workerArgs', () => {
  it('uses the isolation flags, never skips permissions, and allows Bash only for the test command', () => {
    const plain = workerArgs('/h/.claude-deepseek/mcp.json', undefined);
    expect(plain).toEqual(expect.arrayContaining(['-p', '--verbose', '--strict-mcp-config', '--no-session-persistence']));
    expect(plain.slice(plain.indexOf('--output-format'), plain.indexOf('--output-format') + 2)).toEqual(['--output-format', 'stream-json']);
    expect(plain.slice(plain.indexOf('--setting-sources'), plain.indexOf('--setting-sources') + 2)).toEqual(['--setting-sources', 'user']);
    expect(plain.slice(plain.indexOf('--mcp-config'), plain.indexOf('--mcp-config') + 2)).toEqual(['--mcp-config', '/h/.claude-deepseek/mcp.json']);
    expect(plain.slice(plain.indexOf('--permission-mode'), plain.indexOf('--permission-mode') + 2)).toEqual(['--permission-mode', 'acceptEdits']);
    expect(plain.slice(plain.indexOf('--permission-prompts'), plain.indexOf('--permission-prompts') + 2)).toEqual(['--permission-prompts', 'none']);
    expect(plain.slice(plain.indexOf('--tools'), plain.indexOf('--tools') + 2)).toEqual(['--tools', 'Read,Grep,Glob,Edit,Write']);
    expect(plain).not.toContain('--allowedTools');
    expect(plain).not.toContain('--dangerously-skip-permissions');
    const withTests = workerArgs('/m.json', 'npm test');
    expect(withTests.slice(withTests.indexOf('--tools'), withTests.indexOf('--tools') + 2)).toEqual(['--tools', 'Read,Grep,Glob,Edit,Write,Bash']);
    expect(withTests.slice(-2)).toEqual(['--allowedTools', 'Bash(npm test)']);
  });
});

describe('runWorker', () => {
  it('collects the stream of a finished worker', async () => {
    const { outcome, cwd } = await run('success');
    expect(outcome).toMatchObject({ exitCode: 0, stoppedBy: null });
    expect(outcome.stream.result?.text).toBe('Did the thing.');
    expect(outcome.stream.changedFiles).toEqual([join(cwd, 'a.txt')]);
  });

  it('reports a non-zero exit', async () => {
    expect((await run('exit-code')).outcome.exitCode).toBe(3);
  });

  it('stops a worker that passes the per-call cost limit', async () => {
    const { outcome } = await run('expensive');
    expect(outcome.stoppedBy).toBe('budget');
    expect(outcome.stream.costUsd(PRICES, 'deepseek-v4-flash')).toBeGreaterThan(0.25);
  });

  it('stops a worker that runs past its timeout', async () => {
    const started = Date.now();
    const { outcome } = await run('hang', { timeoutMs: 300 });
    expect(outcome.stoppedBy).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
