import type { Effort, Tier, WorkerTier } from '../config/config-schema';

export type EscalationReason =
  | 'exit-code'
  | 'stream-error'
  | 'empty-result'
  | 'tests-failed'
  | 'retries'
  | 'budget'
  | 'timeout'
  | 'test-timeout';

export type DelegateStatus = 'done' | 'escalate' | 'use_claude' | 'refused';

export interface DelegateRequest {
  task: string;
  taskType: string;
  requestedTier: Tier;
  claudeEffort?: Effort;
  flags: string[];
}

interface WorkerReport {
  summary: string;
  changedFiles: string[];
  tier: WorkerTier;
  model: string;
  effort: Effort;
  costUsd: number;
}

export type DelegateResult =
  | ({ status: 'done' } & WorkerReport)
  | ({ status: 'escalate'; reason: EscalationReason } & WorkerReport)
  | { status: 'use_claude'; tier: 'claude'; agent: string; model: string; effort: Effort; next: string }
  | { status: 'refused'; message: string };
