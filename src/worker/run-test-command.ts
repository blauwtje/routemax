import { spawn } from 'node:child_process';
import { killProcessGroup } from './kill-process-group';

export type TestOutcome = 'passed' | 'failed' | 'timeout';

export function runTestCommand(command: string, cwd: string, timeoutMs: number): Promise<TestOutcome> {
  const child = spawn('/bin/sh', ['-c', command], { cwd, stdio: 'ignore', detached: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killProcessGroup(child.pid, 'SIGKILL');
  }, timeoutMs);
  return new Promise((resolve) => {
    const finish = (outcome: TestOutcome) => {
      clearTimeout(timer);
      resolve(outcome);
    };
    child.once('error', () => finish('failed'));
    child.once('close', (exitCode) => {
      if (timedOut) finish('timeout');
      else finish(exitCode === 0 ? 'passed' : 'failed');
    });
  });
}
