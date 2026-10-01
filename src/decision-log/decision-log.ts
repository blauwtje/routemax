import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { TokenUsage } from '../budget/usage-cost';
import type { Effort, Tier } from '../config/config-schema';
import type { DelegateStatus, EscalationReason } from '../delegate/delegate-result';

export type DecisionStatus = DelegateStatus | 'disabled';

export interface DecisionRecord extends TokenUsage {
  ts: string;
  cwd: string;
  taskType: string;
  requestedTier: Tier;
  finalTier: Tier;
  raisedBy: string | null;
  provider: string | null;
  routedBy?: string;
  routeReason?: string;
  lane?: string;
  peak?: boolean;
  fallbackFrom?: string | null;
  taskEffort?: Effort;
  model: string | null;
  effort: Effort | null;
  costUsd: number;
  status: DecisionStatus;
  reason: EscalationReason | null;
  durationMs: number;
  retries: number;
}

export type DecisionBase = Pick<DecisionRecord, 'ts' | 'cwd' | 'taskType' | 'requestedTier' | 'finalTier' | 'raisedBy' | 'provider' | 'routedBy' | 'routeReason'>;

export function decisionLogPath(homeDir: string): string {
  return join(homeDir, '.local', 'state', 'deepseek-delegate', 'decisions.jsonl');
}

export async function appendDecision(logPath: string, record: DecisionRecord): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(record)}\n`, 'utf8');
}

export async function readSpentUsd(logPath: string): Promise<number> {
  let text: string;
  try {
    text = await readFile(logPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
  return text
    .split('\n')
    .filter((line) => line.trim())
    .reduce((spent, line) => {
      const { costUsd } = JSON.parse(line) as { costUsd?: unknown };
      return spent + (typeof costUsd === 'number' ? costUsd : 0);
    }, 0);
}
