import type { DelegateConfig, Effort, Tier } from '../../../src/config/config-schema';
import type { PlanRequest, RoutePlan } from '../../../src/routing/plan-route';
import type { RoutePreview } from '../../../src/routing/smart-route';

export type { DelegateConfig, PlanRequest, RoutePlan, RoutePreview };

export interface SwitchResponse {
  enabled: boolean;
}

export interface ConfigResponse {
  config: DelegateConfig;
  hash: string;
  previousExists: boolean;
}

export type ChezmoiState = 'synced' | 'no-chezmoi' | 'unmanaged' | 'template' | 'failed';

export interface SaveResponse {
  hash: string;
  chezmoi: { state: ChezmoiState; message: string };
}

export interface CallsAndCost {
  calls: number;
  costUsd: number;
}

export interface PeriodStats extends CallsAndCost {
  byTier: Record<string, CallsAndCost>;
  byModel: Record<string, CallsAndCost>;
  escalations: Record<string, number>;
}

export interface StatsResponse {
  budget: { totalUsd: number; spentUsd: number; leftUsd: number };
  spendByProvider: Record<string, number>;
  today: PeriodStats;
  week: PeriodStats;
}

export type DecisionStatus = 'done' | 'escalate' | 'use_claude' | 'refused' | 'disabled';

export interface DecisionRecord {
  ts: string;
  cwd: string;
  taskType: string;
  requestedTier: Tier;
  finalTier: Tier;
  raisedBy: string | null;
  provider: string | null;
  model: string | null;
  effort: Effort | null;
  costUsd: number;
  status: DecisionStatus;
  reason: string | null;
  durationMs: number;
  retries: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface HistoryResponse {
  records: DecisionRecord[];
}

export interface DoctorCheck {
  name: string;
  ok: boolean;
  message: string;
}

export interface DoctorResponse {
  checks: DoctorCheck[];
}

export interface KeysResponse {
  keys: Record<string, { present: boolean }>;
}

export interface ProviderTestResult {
  providerId: string;
  model: string;
  passed: boolean;
  costUsd: number;
  testedAt: string;
  detail: string;
}

export type ProviderTestsResponse = Record<string, ProviderTestResult>;
