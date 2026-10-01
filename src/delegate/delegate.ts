import { readFile } from 'node:fs/promises';
import { EMPTY_USAGE } from '../budget/usage-cost';
import { envVarsPath, mcpConfigPath } from '../config/deepseek-home';
import type { DelegateConfig, Effort, Provider } from '../config/config-schema';
import { appendDecision, decisionLogPath, readSpentUsd, type DecisionBase, type DecisionRecord } from '../decision-log/decision-log';
import { countProxyRetries } from '../proxy/count-proxy-retries';
import { proxyUrl, type ProxyStart } from '../proxy/ensure-proxy';
import { isRouterEnabled } from '../router-switch/router-switch';
import { priceFactor } from '../routing/peak';
import { claudeAgentFor } from '../routing/plan-route';
import { fitEffort } from '../routing/resolve-effort';
import { selectLane, type LaneSelection } from '../routing/select-lane';
import { smartRoute, type SmartRoutePlan } from '../routing/smart-route';
import { MissingLaneKeyError } from '../worker/read-lane-key';
import { runTestCommand, type TestOutcome } from '../worker/run-test-command';
import { runWorker, workerArgs, type WorkerOutcome } from '../worker/run-worker';
import { buildWorkerEnv, parseEnvVars } from '../worker/worker-env';
import type { ClaudeHandoff, DelegateRequest, DelegateResult, EscalationReason } from './delegate-result';

export interface DelegateDeps {
  config: DelegateConfig;
  homeDir: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  readLaneKey: (homeDir: string, variableName: string) => string;
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
  const plan = await smartRoute(deps.config, request, { readLaneKey: (variableName) => deps.readLaneKey(deps.homeDir, variableName), fetchImpl: deps.fetchImpl });
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
  return runWorkerTask(request, plan, base, deps, startedAt);
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

interface LaneAttempt {
  lane: string;
  model: string;
  effort: Effort;
  priceFactor: number;
}

interface LaneRun {
  plan: WorkerPlan;
  base: DecisionBase;
  startedAt: number;
  // Null when lane selection threw: the run then takes today's path and logs today's line.
  selection: LaneSelection | null;
  taskEffort: Effort;
}

type WorkerPlan = Exclude<SmartRoutePlan, { tier: 'claude' }>;

type AttemptResult =
  | { kind: 'result'; result: DelegateResult; errorText: string }
  | { kind: 'missing-key' }
  | { kind: 'not-started'; message: string };

const FALLBACK_ERROR = /429|rate limit|overloaded|connection refused|401/i;

async function runWorkerTask(request: DelegateRequest, plan: WorkerPlan, base: DecisionBase, deps: DelegateDeps, startedAt: number): Promise<DelegateResult> {
  const { config } = deps;
  const now = new Date(startedAt);
  let selection: LaneSelection | null = null;
  let taskEffort: Effort = config.tiers[plan.tier].effort;
  try {
    selection = selectLane(config, plan.tier, request.taskType, now);
    taskEffort = config.taskEfforts[request.taskType] ?? taskEffort;
  } catch {
    // Fail open: a broken lane selection must not stop the task; today's plan runs instead.
    selection = null;
  }
  const first: LaneAttempt = selection ?? { lane: plan.provider, model: plan.model, effort: plan.effort, priceFactor: 1 };
  const run: LaneRun = { plan, base, startedAt, selection, taskEffort };
  const outcome = await attemptLane(request, run, first, null, deps, plan.checkCostUsd);
  const fallback = safeFallbackAttempt(config, first, outcome, now);
  if (!fallback) return finish(request, run, outcome, deps);
  const checkCostUsd = outcome.kind === 'result' ? 0 : plan.checkCostUsd;
  return finish(request, run, await attemptLane(request, run, fallback, first.lane, deps, checkCostUsd), deps);
}

async function finish(request: DelegateRequest, run: LaneRun, outcome: AttemptResult, deps: DelegateDeps): Promise<DelegateResult> {
  if (outcome.kind === 'result') return outcome.result;
  if (outcome.kind === 'missing-key') return handOffForMissingKey(request, run, deps);
  return refuse(decisionLogPath(deps.homeDir), run.base, outcome.message, run.startedAt);
}

// Fail open: an error while picking the fallback lane keeps the first attempt's outcome.
function safeFallbackAttempt(config: DelegateConfig, first: LaneAttempt, outcome: AttemptResult, now: Date): LaneAttempt | null {
  try {
    return fallbackAttempt(config, first, outcome, now);
  } catch {
    return null;
  }
}

// GLM takes over only before the DeepSeek worker changed a file: a missing key, a
// failure before start, or a worker that stopped on a rate-limit, overload,
// connection or auth error without changing anything.
function fallbackAttempt(config: DelegateConfig, first: LaneAttempt, outcome: AttemptResult, now: Date): LaneAttempt | null {
  const fallback = config.lanes.fallback;
  if (!fallback || fallback.provider === first.lane) return null;
  if (outcome.kind === 'result' && !isRetryableFailure(outcome)) return null;
  const provider = config.providers[fallback.provider];
  return { lane: fallback.provider, model: fallback.model, effort: fitEffort(first.effort, provider.efforts), priceFactor: priceFactor(provider.peak, now) };
}

function isRetryableFailure(outcome: Extract<AttemptResult, { kind: 'result' }>): boolean {
  const { result } = outcome;
  if (result.status !== 'escalate') return false;
  if (result.reason !== 'exit-code' && result.reason !== 'stream-error') return false;
  return result.changedFiles.length === 0 && FALLBACK_ERROR.test(outcome.errorText);
}

async function attemptLane(
  request: DelegateRequest,
  run: LaneRun,
  attempt: LaneAttempt,
  fallbackFrom: string | null,
  deps: DelegateDeps,
  checkCostUsd: number,
): Promise<AttemptResult> {
  const { config } = deps;
  const { model, effort, priceFactor: factor } = attempt;
  const provider = config.providers[attempt.lane];
  const logPath = decisionLogPath(deps.homeDir);
  let apiKey: string;
  try {
    apiKey = laneKey(deps, attempt.lane, provider);
  } catch (error) {
    if (error instanceof MissingLaneKeyError) return { kind: 'missing-key' };
    return { kind: 'not-started', message: (error as Error).message };
  }
  let env: Record<string, string>;
  try {
    env = await workerEnvironment(deps, provider, model, effort, apiKey);
  } catch (error) {
    return { kind: 'not-started', message: (error as Error).message };
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
    costOf: (stream) => stream.costUsd(provider.models, model) * factor,
  });
  const workerReason = workerEscalation(outcome);
  const testOutcome = workerReason === null && testCommand ? await runTestCommand(testCommand, deps.cwd, config.testTimeoutMs) : null;
  const retries = provider.repairProxy ? await countProxyRetries(provider.repairProxy.telemetryPath, outcome.startedAt, outcome.endedAt) : 0;
  const reason = workerReason ?? testEscalation(testOutcome) ?? retryEscalation(retries, config.retryThreshold);
  const costUsd = outcome.stream.costUsd(provider.models, model) * factor;
  const status = reason ? 'escalate' : 'done';
  const laneFields = laneLogFields(run, attempt, fallbackFrom);
  await appendDecision(logPath, { ...run.base, provider: attempt.lane, ...laneFields, ...outcome.stream.usage, model, effort, costUsd: costUsd + checkCostUsd, status, reason, durationMs: Date.now() - run.startedAt, retries });
  const report = { summary: truncate(outcome.stream.result?.text ?? '', SUMMARY_LIMIT), changedFiles: outcome.stream.changedFiles, tier: run.plan.tier, model, effort, costUsd };
  const result: DelegateResult = reason ? { status: 'escalate', reason, ...report } : { status: 'done', ...report };
  return { kind: 'result', result, errorText: outcome.stream.result?.text ?? '' };
}

function laneLogFields(run: LaneRun, attempt: LaneAttempt, fallbackFrom: string | null): Partial<DecisionRecord> {
  if (!run.selection && !fallbackFrom) return {};
  return { lane: attempt.lane, peak: run.selection?.peak ?? false, fallbackFrom, taskEffort: run.taskEffort };
}

function laneKey(deps: DelegateDeps, laneId: string, provider: Provider): string {
  if (!provider.keyVariable) throw new MissingLaneKeyError(`${laneId}.keyVariable`);
  return deps.readLaneKey(deps.homeDir, provider.keyVariable);
}

// A lane with no key in keys.env hands the task to Claude exactly like the off switch.
async function handOffForMissingKey(request: DelegateRequest, run: LaneRun, deps: DelegateDeps): Promise<ClaudeHandoff> {
  const handoff = claudeHandoff(deps.config, claudeAgentFor(deps.config, request.taskType));
  const base: DecisionBase = { ...run.base, finalTier: 'claude', raisedBy: null, provider: null, routeReason: 'missing key' };
  await appendDecision(decisionLogPath(deps.homeDir), { ...base, ...NO_RUN, model: handoff.model, effort: handoff.effort, status: 'disabled', reason: null, durationMs: Date.now() - run.startedAt, costUsd: run.plan.checkCostUsd });
  return { ...handoff, reason: 'disabled' };
}

async function workerEnvironment(deps: DelegateDeps, provider: Provider, model: string, effort: Effort, apiKey: string): Promise<Record<string, string>> {
  const path = envVarsPath(deps.homeDir);
  const envVarsText = await readFile(path, 'utf8').catch(() => {
    throw new Error(`${path} is missing; run npm run setup in routemax first.`);
  });
  const { repairProxy } = provider;
  if (repairProxy) {
    await deps.ensureProxy({ dir: deps.config.proxy.dir, port: repairProxy.port, upstreamBaseUrl: provider.baseUrl, logPath: repairProxy.logPath, telemetryPath: repairProxy.telemetryPath });
  }
  const baseUrl = repairProxy ? proxyUrl(repairProxy.port) : provider.baseUrl;
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
