import { readFile } from 'node:fs/promises';
import { EMPTY_USAGE } from '../budget/usage-cost';
import { envVarsPath, mcpConfigPath } from '../config/deepseek-home';
import type { DelegateConfig, Effort, Provider } from '../config/config-schema';
import { appendDecision, decisionLogPath, readSpentUsd, type DecisionBase } from '../decision-log/decision-log';
import { countProxyRetries } from '../proxy/count-proxy-retries';
import { proxyUrl, type ProxyStart } from '../proxy/ensure-proxy';
import { isRouterEnabled } from '../router-switch/router-switch';
import { claudeAgentFor } from '../routing/plan-route';
import { smartRoute, type SmartRoutePlan } from '../routing/smart-route';
import { runTestCommand, type TestOutcome } from '../worker/run-test-command';
import { runWorker, workerArgs, type WorkerOutcome } from '../worker/run-worker';
import { buildWorkerEnv, parseEnvVars } from '../worker/worker-env';
import type { ClaudeHandoff, DelegateRequest, DelegateResult, EscalationReason } from './delegate-result';

export interface DelegateDeps {
  config: DelegateConfig;
  homeDir: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  readApiKey: (keychainService: string) => Promise<string>;
  ensureProxy: (start: ProxyStart) => Promise<unknown>;
  fetchImpl: typeof fetch;
}

const SUMMARY_LIMIT = 1_500;
const NO_RUN = { ...EMPTY_USAGE, costUsd: 0, retries: 0 };

export async function delegate(request: DelegateRequest, deps: DelegateDeps): Promise<DelegateResult> {
  if (Number(deps.env.DEEPSEEK_DELEGATE_DEPTH ?? 0) >= 1) {
    return { status: 'refused', message: 'delegate is not available inside a delegate worker.' };
  }
  const startedAt = Date.now();
  if (!isRouterEnabled(deps.homeDir)) return handOffWhileDisabled(request, deps, startedAt);
  const plan = await smartRoute(deps.config, request, { readApiKey: deps.readApiKey, fetchImpl: deps.fetchImpl });
  const logPath = decisionLogPath(deps.homeDir);
  const base: DecisionBase = {
    ts: new Date(startedAt).toISOString(),
    cwd: deps.cwd,
    taskType: request.taskType,
    requestedTier: request.requestedTier,
    finalTier: plan.tier,
    raisedBy: plan.raisedBy,
    provider: decisionProvider(deps.config, plan),
    routedBy: plan.routedBy,
    routeReason: plan.routeReason,
  };
  if (plan.tier === 'claude') {
    const handoff = claudeHandoff(deps.config, plan.agent);
    await appendDecision(logPath, { ...base, ...NO_RUN, model: handoff.model, effort: handoff.effort, status: 'use_claude', reason: null, durationMs: Date.now() - startedAt, costUsd: plan.checkCostUsd });
    return handoff;
  }
  const refusal = await budgetRefusal(logPath, deps.config.budget);
  if (refusal) return refuse(logPath, base, refusal, startedAt);
  return runDeepseekTask(request, plan, base, deps, startedAt);
}

// A Claude hand-off after a paid check still spent money on the check's provider;
// naming it keeps per-provider spend equal to total spend.
function decisionProvider(config: DelegateConfig, plan: SmartRoutePlan): string | null {
  if (plan.tier !== 'claude') return plan.provider;
  return plan.checkCostUsd > 0 ? config.tiers['flash-low'].provider : null;
}

function claudeHandoff(config: DelegateConfig, agentName: string): ClaudeHandoff {
  const agent = config.claude.agents[agentName];
  const next = `Do this task yourself through the Agent tool with subagent_type "${agentName}" (${agent.model}, effort ${agent.effort}), passing the full task.`;
  return { status: 'use_claude', tier: 'claude', agent: agentName, model: agent.model, effort: agent.effort, next };
}

async function handOffWhileDisabled(request: DelegateRequest, deps: DelegateDeps, startedAt: number): Promise<ClaudeHandoff> {
  const handoff = claudeHandoff(deps.config, claudeAgentFor(deps.config, request.taskType));
  const base: DecisionBase = {
    ts: new Date(startedAt).toISOString(),
    cwd: deps.cwd,
    taskType: request.taskType,
    requestedTier: request.requestedTier,
    finalTier: 'claude',
    raisedBy: null,
    provider: null,
  };
  await appendDecision(decisionLogPath(deps.homeDir), { ...base, ...NO_RUN, model: handoff.model, effort: handoff.effort, status: 'disabled', reason: null, durationMs: Date.now() - startedAt });
  return { ...handoff, reason: 'disabled' };
}

async function runDeepseekTask(request: DelegateRequest, plan: Exclude<SmartRoutePlan, { tier: 'claude' }>, base: DecisionBase, deps: DelegateDeps, startedAt: number): Promise<DelegateResult> {
  const { config } = deps;
  const { tier, model, effort } = plan;
  const provider = config.providers[plan.provider];
  const logPath = decisionLogPath(deps.homeDir);
  let env: Record<string, string>;
  try {
    env = await workerEnvironment(deps, provider, model, effort);
  } catch (error) {
    return refuse(logPath, base, (error as Error).message, startedAt);
  }
  const testCommand = config.projects[deps.cwd]?.testCommand;
  const outcome = await runWorker({
    claudeBin: config.claudeBin,
    args: workerArgs(mcpConfigPath(deps.homeDir), testCommand),
    cwd: deps.cwd,
    env,
    prompt: workerPrompt(request.task, deps.cwd),
    timeoutMs: config.workerTimeoutMs,
    costLimitUsd: config.budget.perCallUsd,
    costOf: (stream) => stream.costUsd(provider.models, model),
  });
  const workerReason = workerEscalation(outcome);
  const testOutcome = workerReason === null && testCommand ? await runTestCommand(testCommand, deps.cwd, config.testTimeoutMs) : null;
  const retries = provider.repairProxy ? await countProxyRetries(provider.repairProxy.telemetryPath, outcome.startedAt, outcome.endedAt) : 0;
  const reason = workerReason ?? testEscalation(testOutcome) ?? retryEscalation(retries, config.retryThreshold);
  const costUsd = outcome.stream.costUsd(provider.models, model);
  const status = reason ? 'escalate' : 'done';
  await appendDecision(logPath, { ...base, ...outcome.stream.usage, model, effort, costUsd: costUsd + plan.checkCostUsd, status, reason, durationMs: Date.now() - startedAt, retries });
  const report = { summary: truncate(outcome.stream.result?.text ?? '', SUMMARY_LIMIT), changedFiles: outcome.stream.changedFiles, tier, model, effort, costUsd };
  return reason ? { status: 'escalate', reason, ...report } : { status: 'done', ...report };
}

async function workerEnvironment(deps: DelegateDeps, provider: Provider, model: string, effort: Effort): Promise<Record<string, string>> {
  const path = envVarsPath(deps.homeDir);
  const envVarsText = await readFile(path, 'utf8').catch(() => {
    throw new Error(`${path} is missing; run npm run setup in routemax first.`);
  });
  const { repairProxy } = provider;
  if (repairProxy) {
    await deps.ensureProxy({ dir: deps.config.proxy.dir, port: repairProxy.port, upstreamBaseUrl: provider.baseUrl, logPath: repairProxy.logPath, telemetryPath: repairProxy.telemetryPath });
  }
  const baseUrl = repairProxy ? proxyUrl(repairProxy.port) : provider.baseUrl;
  const apiKey = await deps.readApiKey(provider.keychainService ?? '');
  return buildWorkerEnv({ inherited: deps.env, envVars: parseEnvVars(envVarsText), baseUrl, model, apiKey, effort });
}

async function budgetRefusal(logPath: string, budget: DelegateConfig['budget']): Promise<string | null> {
  const spentUsd = await readSpentUsd(logPath);
  if (spentUsd + budget.perCallUsd <= budget.totalUsd) return null;
  return `Budget cap reached: $${spentUsd.toFixed(2)} of $${budget.totalUsd.toFixed(2)} spent, and one call may cost up to $${budget.perCallUsd.toFixed(2)}. Raise budget.totalUsd in ~/.config/routemax/config.json to continue.`;
}

async function refuse(logPath: string, base: DecisionBase, message: string, startedAt: number): Promise<DelegateResult> {
  await appendDecision(logPath, { ...base, ...NO_RUN, model: null, effort: null, status: 'refused', reason: null, durationMs: Date.now() - startedAt });
  return { status: 'refused', message };
}

function workerEscalation(outcome: WorkerOutcome): EscalationReason | null {
  if (outcome.stoppedBy) return outcome.stoppedBy;
  if (outcome.exitCode !== 0) return 'exit-code';
  const result = outcome.stream.result;
  if (!result || result.isError) return 'stream-error';
  if (!result.text.trim()) return 'empty-result';
  return null;
}

function testEscalation(outcome: TestOutcome | null): EscalationReason | null {
  if (outcome === 'timeout') return 'test-timeout';
  if (outcome === 'failed') return 'tests-failed';
  return null;
}

function retryEscalation(retries: number, threshold: number | null): EscalationReason | null {
  return threshold !== null && retries > threshold ? 'retries' : null;
}

function workerPrompt(task: string, cwd: string): string {
  return `${task}\n\nWork only inside ${cwd}. Finish with a plain summary of at most ${SUMMARY_LIMIT} characters: what you did and which files you changed.`;
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}
