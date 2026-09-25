import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { killProcessGroup } from './kill-process-group';
import { WorkerStream } from './stream-state';

export interface WorkerRun {
  claudeBin: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  prompt: string;
  timeoutMs: number;
  costLimitUsd: number;
  costOf: (stream: WorkerStream) => number;
}

export type WorkerStop = 'budget' | 'timeout';

export interface WorkerOutcome {
  exitCode: number | null;
  stoppedBy: WorkerStop | null;
  stream: WorkerStream;
  startedAt: Date;
  endedAt: Date;
}

const KILL_GRACE_MS = 5_000;
const WORKER_TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write'];

export function workerArgs(mcpConfigPath: string, testCommand: string | undefined): string[] {
  const tools = testCommand ? [...WORKER_TOOLS, 'Bash'] : WORKER_TOOLS;
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--setting-sources', 'user',
    '--strict-mcp-config',
    '--mcp-config', mcpConfigPath,
    '--no-session-persistence',
    '--permission-mode', 'acceptEdits',
    '--permission-prompts', 'none',
    '--tools', tools.join(','),
  ];
  return testCommand ? [...args, '--allowedTools', `Bash(${testCommand})`] : args;
}

export function runWorker(run: WorkerRun): Promise<WorkerOutcome> {
  const stream = new WorkerStream();
  const startedAt = new Date();
  const child = spawn(run.claudeBin, run.args, { cwd: run.cwd, env: run.env, stdio: ['pipe', 'pipe', 'ignore'], detached: true });
  let stoppedBy: WorkerStop | null = null;
  const stop = (reason: WorkerStop) => {
    if (stoppedBy) return;
    stoppedBy = reason;
    killProcessGroup(child.pid, 'SIGTERM');
    setTimeout(() => killProcessGroup(child.pid, 'SIGKILL'), KILL_GRACE_MS).unref();
  };
  const timer = setTimeout(() => stop('timeout'), run.timeoutMs);
  createInterface({ input: child.stdout }).on('line', (line) => {
    stream.accept(line);
    if (run.costOf(stream) > run.costLimitUsd) stop('budget');
  });
  // EPIPE when the worker exits before reading its prompt; the exit code reports that failure.
  child.stdin.on('error', () => {});
  child.stdin.end(run.prompt);
  return new Promise((resolve) => {
    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      resolve({ exitCode, stoppedBy, stream, startedAt, endedAt: new Date() });
    };
    child.once('error', () => finish(null));
    child.once('close', (exitCode) => finish(exitCode));
  });
}
