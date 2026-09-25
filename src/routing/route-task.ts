import { TIER_ORDER, type DelegateConfig, type Tier } from '../config/config-schema';

type RoutingRule = DelegateConfig['rules'][number];

export interface RouteRequest {
  task: string;
  taskType: string;
  requestedTier: Tier;
  flags: string[];
}

export interface RouteDecision {
  tier: Tier;
  raisedBy: string | null;
}

const tierRank = (tier: Tier) => TIER_ORDER.indexOf(tier);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function ruleMatches(rule: RoutingRule, request: RouteRequest): boolean {
  if (rule.taskTypes.includes(request.taskType)) return true;
  if (rule.flags.some((flag) => request.flags.includes(flag))) return true;
  if (rule.keywordExemptTaskTypes.includes(request.taskType)) return false;
  return rule.keywords.some((keyword) => new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(request.task));
}

export function routeTask(rules: RoutingRule[], request: RouteRequest): RouteDecision {
  let decision: RouteDecision = { tier: request.requestedTier, raisedBy: null };
  for (const rule of rules) {
    if (ruleMatches(rule, request) && tierRank(rule.tier) > tierRank(decision.tier)) {
      decision = { tier: rule.tier, raisedBy: rule.id };
    }
  }
  return decision;
}
