import { EFFORT_ORDER, TIER_ORDER, type DelegateConfig, type Effort, type Tier, type WorkerTier } from '../config/config-schema';
import { checkTask } from './check-task';
import type { ClaudeRoutePlan, PlanRequest, RoutePlan, WorkerRoutePlan } from './plan-route';
import { fitEffort, resolveEffort } from './resolve-effort';
import { routeTask } from './route-task';
import { scoreTask } from './score-task';

export type RoutedBy = 'rules' | 'score' | 'check' | 'off';

export type SmartRoutePlan = RoutePlan & {
  routedBy: RoutedBy;
  routeReason: string;
  checkCostUsd: number;
};

export type RoutePreview = RoutePlan & {
  routedBy: Exclude<RoutedBy, 'check'>;
  routeReason: string;
  wouldCheck: boolean;
};

export interface SmartRouteDeps {
  readLaneKey: (variableName: string) => string;
  fetchImpl: typeof fetch;
}

const tierRank = (tier: Tier) => TIER_ORDER.indexOf(tier);
const effortRank = (effort: Effort) => EFFORT_ORDER.indexOf(effort);

function highestTier(left: Tier, right: Tier): Tier {
  return tierRank(right) > tierRank(left) ? right : left;
}

// Picks the claude.agents entry closest in effort to the smart effort, since a smart
// result carries an effort but no agent name; falls back to defaultAgent when there is
// no smart effort yet (a rule sent the task straight to Claude before any scoring ran).
function nearestAgent(config: DelegateConfig, smartEffort: Effort | null): string {
  if (!smartEffort) return config.claude.defaultAgent;
  const target = effortRank(smartEffort);
  let closest = config.claude.defaultAgent;
  let closestDistance = Infinity;
  for (const [name, agent] of Object.entries(config.claude.agents)) {
    const distance = Math.abs(effortRank(agent.effort) - target);
    if (distance < closestDistance) {
      closest = name;
      closestDistance = distance;
    }
  }
  return closest;
}

function claudePlan(config: DelegateConfig, request: PlanRequest, raisedBy: string | null, smartEffort: Effort | null): ClaudeRoutePlan {
  const mapped = config.claude.taskTypes[request.taskType];
  return { tier: 'claude', raisedBy, agent: mapped ?? nearestAgent(config, smartEffort) };
}

function workerPlan(
  config: DelegateConfig,
  request: PlanRequest,
  raisedBy: string | null,
  tier: WorkerTier,
  smartEffort: Effort | null,
): WorkerRoutePlan {
  const workerTier = config.tiers[tier];
  const baseEffort = smartEffort ?? workerTier.effort;
  const effort = resolveEffort(config.effortMap, baseEffort, request.claudeEffort);
  return {
    tier,
    raisedBy,
    provider: workerTier.provider,
    model: workerTier.model,
    effort: fitEffort(effort, config.providers[workerTier.provider].efforts),
  };
}

// Combines the existing rule, score and check stages into one decision: a Claude-only
// rule wins outright, an unclear task past that gets the free score, and only a score
// the scorer is not confident about spends a cheap DeepSeek call to check.
export async function smartRoute(config: DelegateConfig, request: PlanRequest, deps: SmartRouteDeps): Promise<SmartRoutePlan> {
  const ruleDecision = routeTask(config.rules, request);
  if (ruleDecision.tier === 'claude') {
    return {
      ...claudePlan(config, request, ruleDecision.raisedBy, null),
      routedBy: 'rules',
      routeReason: ruleDecision.raisedBy ? `rule ${ruleDecision.raisedBy} keeps the task on Claude` : 'the requested tier is already Claude',
      checkCostUsd: 0,
    };
  }

  if (!config.smartRouting.enabled) {
    return {
      ...workerPlan(config, request, ruleDecision.raisedBy, ruleDecision.tier, null),
      routedBy: 'off',
      routeReason: 'smart routing is off',
      checkCostUsd: 0,
    };
  }

  const score = scoreTask(request.task, request.taskType);
  let smartTier: Tier = score.tier;
  let smartEffort: Effort = score.effort;
  let routedBy: RoutedBy = 'score';
  let routeReason = score.signals.length > 0 ? `score signals: ${score.signals.join(', ')}` : 'score found no strong signal';
  let checkCostUsd = 0;

  if (!score.confident) {
    const flashLow = config.tiers['flash-low'];
    const provider = config.providers[flashLow.provider];
    let checkResult: Awaited<ReturnType<typeof checkTask>> = null;
    let checkError: string | null = null;
    try {
      if (!provider.keyVariable) throw new Error(`provider ${flashLow.provider} names no key variable`);
      const apiKey = deps.readLaneKey(provider.keyVariable);
      checkResult = await checkTask(
        request.task,
        { baseUrl: provider.baseUrl, apiKey, model: flashLow.model, price: provider.models[flashLow.model] },
        config.smartRouting.checkTimeoutMs,
        deps.fetchImpl,
      );
    } catch (error) {
      // A missing key or a failed check must not fail the task: the score's result stands.
      checkError = (error as Error).message;
    }
    if (checkResult) {
      smartTier = checkResult.tier;
      smartEffort = checkResult.effort;
      checkCostUsd = checkResult.costUsd;
      routedBy = 'check';
      routeReason = `check classified the task as ${checkResult.tier}/${checkResult.effort}`;
    } else if (checkError) {
      routeReason = `score was not confident and the check could not run: ${checkError}`;
    } else {
      routeReason = 'score was not confident and the check gave no answer';
    }
  }

  const finalTier = highestTier(highestTier(request.requestedTier, ruleDecision.tier), smartTier);
  const raisedBy = finalTier === ruleDecision.tier ? ruleDecision.raisedBy : null;

  if (finalTier === 'claude') {
    return { ...claudePlan(config, request, raisedBy, smartEffort), routedBy, routeReason, checkCostUsd };
  }
  return { ...workerPlan(config, request, raisedBy, finalTier, smartEffort), routedBy, routeReason, checkCostUsd };
}

// Same rule and score stages as smartRoute, but never spends the paid check call: an
// unconfident score is reported as wouldCheck instead of being resolved.
export function previewRoute(config: DelegateConfig, request: PlanRequest): RoutePreview {
  const ruleDecision = routeTask(config.rules, request);
  if (ruleDecision.tier === 'claude') {
    return {
      ...claudePlan(config, request, ruleDecision.raisedBy, null),
      routedBy: 'rules',
      routeReason: ruleDecision.raisedBy ? `rule ${ruleDecision.raisedBy} keeps the task on Claude` : 'the requested tier is already Claude',
      wouldCheck: false,
    };
  }

  if (!config.smartRouting.enabled) {
    return {
      ...workerPlan(config, request, ruleDecision.raisedBy, ruleDecision.tier, null),
      routedBy: 'off',
      routeReason: 'smart routing is off',
      wouldCheck: false,
    };
  }

  const score = scoreTask(request.task, request.taskType);
  const routeReason = score.signals.length > 0 ? `score signals: ${score.signals.join(', ')}` : 'score found no strong signal';
  const finalTier = highestTier(highestTier(request.requestedTier, ruleDecision.tier), score.tier);
  const raisedBy = finalTier === ruleDecision.tier ? ruleDecision.raisedBy : null;

  const plan = finalTier === 'claude'
    ? claudePlan(config, request, raisedBy, score.effort)
    : workerPlan(config, request, raisedBy, finalTier, score.effort);

  return { ...plan, routedBy: 'score', routeReason, wouldCheck: !score.confident };
}
