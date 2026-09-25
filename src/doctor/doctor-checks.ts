import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deepseekHomeDir, envVarsPath } from '../config/deepseek-home';
import type { DelegateConfig } from '../config/config-schema';
import { decisionLogPath, readSpentUsd } from '../decision-log/decision-log';
import type { ProxyStart } from '../proxy/ensure-proxy';
import { isRouterEnabled, routerSwitchPath } from '../router-switch/router-switch';
import { findAnthropicVariables } from '../setup/find-anthropic-variables';
import { checkRegistration, registrationProblem, type ServerRegistration } from '../setup/register-server';
import { parseEnvVars } from '../worker/worker-env';

export interface DoctorCheck {
  name: string;
  ok: boolean;
  message: string;
}

export interface DoctorDeps {
  homeDir: string;
  repoRoot: string;
  config: DelegateConfig;
  registration: ServerRegistration;
  readApiKey: (keychainService: string) => Promise<string>;
  ensureProxy: (start: ProxyStart) => Promise<'running' | 'started'>;
  commandOnPath: (name: string) => Promise<boolean>;
}

const RUN_SETUP = 'Run npm run setup.';
const pass = (name: string, message: string): DoctorCheck => ({ name, ok: true, message });
const fix = (name: string, message: string): DoctorCheck => ({ name, ok: false, message });

async function proxyBaseUrl(homeDir: string): Promise<string | null> {
  const text = await readFile(envVarsPath(homeDir), 'utf8').catch(() => null);
  if (text === null) return null;
  const envVars = parseEnvVars(text);
  const baseUrl = envVars.ANTHROPIC_BASE_URL ?? '';
  const onLoopback = URL.canParse(baseUrl) && new URL(baseUrl).hostname === '127.0.0.1';
  return onLoopback && envVars.CLAUDE_CONFIG_DIR === deepseekHomeDir(homeDir) ? baseUrl : null;
}

function checkEnvVars(baseUrl: string | null): DoctorCheck {
  if (baseUrl) return pass('env.vars', `The worker talks to the repair-proxy on ${baseUrl}.`);
  return fix('env.vars', `~/.claude-deepseek/env.vars is missing or does not point at the proxy on 127.0.0.1 and at ~/.claude-deepseek. ${RUN_SETUP}`);
}

async function checkApiKey(deps: DoctorDeps): Promise<DoctorCheck> {
  try {
    await deps.readApiKey(deps.config.providers.deepseek.keychainService);
    return pass('DeepSeek key', 'The DeepSeek key is in Keychain.');
  } catch {
    return fix('DeepSeek key', 'No DeepSeek key in Keychain. Store it once: security add-generic-password -a "$USER" -s deepseek_api_key -w');
  }
}

async function checkProxy(deps: DoctorDeps, baseUrl: string | null): Promise<DoctorCheck> {
  if (!baseUrl) return fix('repair-proxy', 'Not checked until env.vars is fixed.');
  const provider = deps.config.providers.deepseek;
  const repairProxy = provider?.repairProxy;
  if (!provider || !repairProxy) return fix('repair-proxy', 'providers.deepseek has no repairProxy in the routemax config.');
  try {
    const state = await deps.ensureProxy({ dir: deps.config.proxy.dir, port: repairProxy.port, upstreamBaseUrl: provider.baseUrl, logPath: repairProxy.logPath, telemetryPath: repairProxy.telemetryPath });
    return pass('repair-proxy', state === 'started' ? 'The repair-proxy was down and is started now.' : 'The repair-proxy answers.');
  } catch {
    return fix('repair-proxy', `The repair-proxy does not start; see ${repairProxy.logPath}.`);
  }
}

function checkRouter(homeDir: string): DoctorCheck {
  const path = routerSwitchPath(homeDir);
  try {
    if (isRouterEnabled(homeDir)) return pass('router', 'The router is on: delegate hands tasks to workers.');
    return pass('router', `The router is off: every delegate call goes to Claude. Switch it on on the routemax page or write on to ${path}.`);
  } catch (error) {
    return fix('router', `${path} cannot be read (${(error as Error).message}).`);
  }
}

async function checkRoutemaxCommand(deps: DoctorDeps): Promise<DoctorCheck> {
  if (await deps.commandOnPath('routemax')) return pass('routemax command', 'routemax is on PATH, so routemax ui works in every terminal.');
  return fix('routemax command', `routemax is not on PATH. Run npm link in ${deps.repoRoot}.`);
}

async function checkServer(registration: ServerRegistration): Promise<DoctorCheck> {
  try {
    const problem = registrationProblem(await checkRegistration(registration));
    if (!problem) return pass('MCP server', 'deepseek-delegate is registered for every project and connects.');
    return fix('MCP server', problem);
  } catch {
    return fix('MCP server', `${registration.claudeBin} is not on PATH, so the registration cannot be checked.`);
  }
}

async function checkAgents(deps: DoctorDeps): Promise<DoctorCheck> {
  const names = (await readdir(join(deps.repoRoot, 'agents'))).filter((name) => name.endsWith('.md')).sort();
  const missing = names.filter((name) => !existsSync(join(deps.homeDir, '.claude', 'agents', name)));
  if (!missing.length) return pass('Claude agents', `${names.length} Claude agents are in ~/.claude/agents.`);
  return fix('Claude agents', `Missing in ~/.claude/agents: ${missing.join(', ')}. ${RUN_SETUP}`);
}

async function checkBudget(deps: DoctorDeps): Promise<DoctorCheck> {
  const { totalUsd, perCallUsd } = deps.config.budget;
  const spentUsd = await readSpentUsd(decisionLogPath(deps.homeDir));
  const spent = `$${spentUsd.toFixed(2)} of $${totalUsd.toFixed(2)} spent`;
  if (spentUsd + perCallUsd <= totalUsd) return pass('budget', `${spent}.`);
  return fix('budget', `${spent}; the next call could pass the cap. Raise budget.totalUsd in ~/.config/routemax/config.json.`);
}

async function checkMaxSettings(homeDir: string): Promise<DoctorCheck> {
  const found = await findAnthropicVariables(join(homeDir, '.claude', 'settings.json'));
  if (!found.length) return pass('Max settings', '~/.claude/settings.json holds no ANTHROPIC_ variable.');
  return fix('Max settings', `~/.claude/settings.json holds ${found.join(', ')}. Remove them from its chezmoi source so the Max session keeps its own model and login.`);
}

export async function runDoctorChecks(deps: DoctorDeps): Promise<DoctorCheck[]> {
  const baseUrl = await proxyBaseUrl(deps.homeDir);
  return [
    checkRouter(deps.homeDir),
    await checkRoutemaxCommand(deps),
    checkEnvVars(baseUrl),
    await checkApiKey(deps),
    await checkProxy(deps, baseUrl),
    await checkServer(deps.registration),
    await checkAgents(deps),
    await checkBudget(deps),
    await checkMaxSettings(deps.homeDir),
  ];
}
