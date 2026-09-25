import { readFile } from 'node:fs/promises';
import { EMPTY_USAGE } from '../budget/usage-cost';
import { envVarsPath, mcpConfigPath } from '../config/deepseek-home';
import type { DelegateConfig, Effort, WorkerTier } from '../config/config-schema';
import { appendDecision, decisionLogPath, readSpentUsd, type DecisionBase } from '../decision-log/decision-log';
import { countProxyRetries } from '../proxy/count-proxy-retries';
import { resolveEffort } from '../routing/resolve-effort';
import { routeTask } from '../routing/route-task';
import { runTestCommand, type TestOutcome } from '../worker/run-test-command';
import { runWorker, workerArgs, type WorkerOutcome } from '../worker/run-worker';
import { buildWorkerEnv, parseEnvVars } from '../worker/worker-env';
import type { DelegateRequest, DelegateResult, EscalationReason } from './delegate-result';

export interface DelegateDeps {
  config: DelegateConfig;
  homeDir: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  readApiKey: () => Promise<string>;
  ensureProxy: (healthUrl: string) => Promise<unknown>;
}

const SUMMARY_LIMIT = 1_500;
const NO_RUN = { ...EMPTY_USAGE, costUsd: 0, retries: 0 };

export async function delegate(request: DelegateRequest, deps: DelegateDeps): Promise<DelegateResult> {
  if (Number(deps.env.DEEPSEEK_DELEGATE_DEPTH ?? 0) >= 1) {
    return { status: 'refused', message: 'delegate is not available inside a delegate worker.' };
  }
  const startedAt = Date.now();
  const route = routeTask(deps.config.rules, request);
  const logPath = decisionLogPath(deps.homeDir);
  const base: DecisionBase = {
    ts: new Date(startedAt).toISOString(),
    cwd: deps.cwd,
    taskType: request.taskType,
    requestedTier: request.requestedTier,
    finalTier: route.tier,
    raisedBy: route.raisedBy,
  };
  if (route.tier === 'claude') {
    const agentName = deps.config.claude.taskTypes[request.taskType] ?? deps.config.claude.defaultAgent;
    const agent = deps.config.claude.agents[agentName];
    await appendDecision(logPath, { ...base, ...NO_RUN, model: agent.model, effort: agent.effort, status: 'use_claude', reason: null, durationMs: Date.now() - startedAt });
    const next = `Do this task yourself through the Agent tool with subagent_type "${agentName}" (${agent.model}, effort ${agent.effort}), passing the full task.`;
    return { status: 'use_claude', tier: 'claude', agent: agentName, model: agent.model, effort: agent.effort, next };
  }
  const refusal = await budgetRefusal(logPath, deps.config.budget);
  if (refusal) return refuse(logPath, base, refusal, startedAt);
  return runDeepseekTask(request, route.tier, base, deps, startedAt);
}

async function runDeepseekTask(request: DelegateRequest, tier: WorkerTier, base: DecisionBase, deps: DelegateDeps, startedAt: number): Promise<DelegateResult> {
  const { config } = deps;
  const { model } = config.tiers[tier];
  const effort = resolveEffort(config.effortMap, config.tiers[tier].effort, request.claudeEffort);
  const logPath = decisionLogPath(deps.homeDir);
  let env: Record<string, string>;
  try {
    env = await workerEnvironment(deps, model, effort);
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
    costOf: (stream) => stream.costUsd(config.prices, model),
  });
  const workerReason = workerEscalation(outcome);
  const testOutcome = workerReason === null && testCommand ? await runTestCommand(testCommand, deps.cwd, config.testTimeoutMs) : null;
  const retries = await countProxyRetries(config.proxy.telemetryPath, outcome.startedAt, outcome.endedAt);
  const reason = workerReason ?? testEscalation(testOutcome) ?? retryEscalation(retries, config.retryThreshold);
  const costUsd = outcome.stream.costUsd(config.prices, model);
  const status = reason ? 'escalate' : 'done';
  await appendDecision(logPath, { ...base, ...outcome.stream.usage, model, effort, costUsd, status, reason, durationMs: Date.now() - startedAt, retries });
  const report = { summary: truncate(outcome.stream.result?.text ?? '', SUMMARY_LIMIT), changedFiles: outcome.stream.changedFiles, tier, model, effort, costUsd };
  return reason ? { status: 'escalate', reason, ...report } : { status: 'done', ...report };
}

async function workerEnvironment(deps: DelegateDeps, model: string, effort: Effort): Promise<Record<string, string>> {
  const path = envVarsPath(deps.homeDir);
  const envVarsText = await readFile(path, 'utf8').catch(() => {
    throw new Error(`${path} is missing; run npm run setup in routemax first.`);
  });
  const envVars = parseEnvVars(envVarsText);
  const baseUrl = envVars.ANTHROPIC_BASE_URL ?? '';
  if (!URL.canParse(baseUrl) || new URL(baseUrl).hostname !== '127.0.0.1') {
    throw new Error('ANTHROPIC_BASE_URL in env.vars must point at the repair-proxy on 127.0.0.1.');
  }
  await deps.ensureProxy(new URL('/healthz', baseUrl).href);
  const apiKey = await deps.readApiKey();
  return buildWorkerEnv({ inherited: deps.env, envVars, model, apiKey, effort });
}

async function budgetRefusal(logPath: string, budget: DelegateConfig['budget']): Promise<string | null> {
  const spentUsd = await readSpentUsd(logPath);
  if (spentUsd + budget.perCallUsd <= budget.totalUsd) return null;
  return `Budget cap reached: $${spentUsd.toFixed(2)} of $${budget.totalUsd.toFixed(2)} spent, and one call may cost up to $${budget.perCallUsd.toFixed(2)}. Raise budget.totalUsd in config/routing.json to continue.`;
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
