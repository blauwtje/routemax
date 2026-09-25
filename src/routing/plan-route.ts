import type { DelegateConfig, Effort, WorkerTier } from '../config/config-schema';
import { fitEffort, resolveEffort } from './resolve-effort';
import { routeTask, type RouteRequest } from './route-task';

export interface PlanRequest extends RouteRequest {
  claudeEffort?: Effort;
}

export interface ClaudeRoutePlan {
  tier: 'claude';
  raisedBy: string | null;
  agent: string;
}

export interface WorkerRoutePlan {
  tier: WorkerTier;
  raisedBy: string | null;
  provider: string;
  model: string;
  effort: Effort;
}

export type RoutePlan = ClaudeRoutePlan | WorkerRoutePlan;

export function claudeAgentFor(config: DelegateConfig, taskType: string): string {
  return config.claude.taskTypes[taskType] ?? config.claude.defaultAgent;
}

export function planRoute(config: DelegateConfig, request: PlanRequest): RoutePlan {
  const { tier, raisedBy } = routeTask(config.rules, request);
  if (tier === 'claude') return { tier, raisedBy, agent: claudeAgentFor(config, request.taskType) };
  const workerTier = config.tiers[tier];
  const effort = resolveEffort(config.effortMap, workerTier.effort, request.claudeEffort);
  return { tier, raisedBy, provider: workerTier.provider, model: workerTier.model, effort: fitEffort(effort, config.providers[workerTier.provider].efforts) };
}
