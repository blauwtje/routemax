import { z } from 'zod';
import { readClaudeUsageStore } from '../claude-usage/claude-usage-store';
import { configSchema, effortSchema, formatIssues, TIER_ORDER } from '../config/config-schema';
import { readStoredConfig, restorePrevious, saveConfig, type StoreOutcome } from '../config/config-store';
import { loadConfig } from '../config/delegate-config';
import { claudeUsagePath, previousConfigPath, providerTestsPath } from '../config/routemax-paths';
import { syncChezmoi } from '../config/sync-chezmoi';
import { decisionLogPath } from '../decision-log/decision-log';
import type { DelegateDeps } from '../delegate/delegate';
import { runDoctorChecks, type DoctorDeps } from '../doctor/doctor-checks';
import { isRouterEnabled, setRouterEnabled } from '../router-switch/router-switch';
import { previewRoute } from '../routing/smart-route';
import { readApiKey } from '../worker/read-api-key';
import { keyIssues, storeApiKey } from '../worker/store-api-key';
import { decisionStats, readDecisions } from './decision-stats';
import { readProviderTests, recordProviderTest, testProvider } from './provider-test';
import type { ApiResponse, ApiRoute } from './ui-server';

export interface UiDeps {
  homeDir: string;
  configPath: string;
  chezmoiBin: string;
  doctorDeps: () => DoctorDeps;
  delegateDeps: () => DelegateDeps;
}

const switchBodySchema = z.object({ enabled: z.boolean() });
const saveBodySchema = z.object({ config: z.unknown(), baseHash: z.string() });
const restoreBodySchema = z.object({ baseHash: z.string() });
const keyBodySchema = z.object({ key: z.string() });
const planRequestSchema = z.object({
  task: z.string(),
  taskType: z.string(),
  requestedTier: z.enum(TIER_ORDER),
  claudeEffort: effortSchema.optional(),
  flags: z.array(z.string()).default([]),
});
const previewBodySchema = z.object({ config: z.unknown(), request: planRequestSchema });
const providerTestBodySchema = z.object({ model: z.string() });
const STORE_ERROR_STATUS = { stale: 409, invalid: 422, missing: 404 } as const;

export const invalid = (issues: string[]): ApiResponse => ({ status: 422, body: { error: 'invalid', issues } });
const ok = (body: unknown): ApiResponse => ({ status: 200, body });
const missing = (issues: string[]): ApiResponse => ({ status: 404, body: { error: 'missing', issues } });
const hasKey = (keychainService: string): Promise<boolean> => readApiKey(keychainService).then(() => true, () => false);

async function storeReply(deps: UiDeps, outcome: StoreOutcome): Promise<ApiResponse> {
  if (!outcome.ok) return { status: STORE_ERROR_STATUS[outcome.kind], body: { error: outcome.kind, issues: outcome.issues } };
  return ok({ hash: outcome.hash, chezmoi: await syncChezmoi(deps.configPath, deps.chezmoiBin) });
}

function switchRoutes(deps: UiDeps): ApiRoute[] {
  return [
    { method: 'GET', pattern: /^\/api\/switch$/, handle: async () => ok({ enabled: isRouterEnabled(deps.homeDir) }) },
    {
      method: 'PUT',
      pattern: /^\/api\/switch$/,
      handle: async ({ body }) => {
        const parsed = switchBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        setRouterEnabled(deps.homeDir, parsed.data.enabled);
        return ok({ enabled: parsed.data.enabled });
      },
    },
  ];
}

function configRoutes(deps: UiDeps): ApiRoute[] {
  const previousPath = previousConfigPath(deps.homeDir);
  return [
    { method: 'GET', pattern: /^\/api\/config$/, handle: async () => ok(readStoredConfig(deps.configPath, previousPath)) },
    {
      method: 'PUT',
      pattern: /^\/api\/config$/,
      handle: async ({ body }) => {
        const parsed = saveBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        return storeReply(deps, saveConfig(deps.configPath, previousPath, parsed.data.config, parsed.data.baseHash));
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/config\/restore$/,
      handle: async ({ body }) => {
        const parsed = restoreBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        return storeReply(deps, restorePrevious(deps.configPath, previousPath, parsed.data.baseHash));
      },
    },
  ];
}

function decisionRoutes(deps: UiDeps): ApiRoute[] {
  const logPath = decisionLogPath(deps.homeDir);
  return [
    { method: 'GET', pattern: /^\/api\/history$/, handle: async () => ok({ records: await readDecisions(logPath) }) },
    {
      method: 'GET',
      pattern: /^\/api\/stats$/,
      handle: async () => {
        const claudeDays = readClaudeUsageStore(claudeUsagePath(deps.homeDir)).days;
        return ok(decisionStats(await readDecisions(logPath), loadConfig(deps.configPath).budget.totalUsd, new Date(), claudeDays));
      },
    },
  ];
}

function doctorRoutes(deps: UiDeps): ApiRoute[] {
  return [{ method: 'GET', pattern: /^\/api\/doctor$/, handle: async () => ok({ checks: await runDoctorChecks(deps.doctorDeps()) }) }];
}

function keyRoutes(deps: UiDeps): ApiRoute[] {
  return [
    {
      method: 'GET',
      pattern: /^\/api\/keys$/,
      handle: async () => {
        const { providers } = loadConfig(deps.configPath);
        const keys = await Promise.all(Object.entries(providers).map(async ([id, provider]) => [id, { present: await hasKey(provider.keychainService) }] as const));
        return ok({ keys: Object.fromEntries(keys) });
      },
    },
    {
      method: 'PUT',
      pattern: /^\/api\/keys\/([^/]+)$/,
      handle: async ({ params: [providerId], body }) => {
        const { providers } = loadConfig(deps.configPath);
        if (!Object.hasOwn(providers, providerId)) return missing([`providers.${providerId}: no such provider`]);
        const parsed = keyBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        const issues = keyIssues(parsed.data.key);
        if (issues.length > 0) return invalid(issues);
        await storeApiKey(providers[providerId].keychainService, parsed.data.key);
        return ok({ present: await hasKey(providers[providerId].keychainService) });
      },
    },
  ];
}

function previewRoutes(): ApiRoute[] {
  return [
    {
      method: 'POST',
      pattern: /^\/api\/route-preview$/,
      handle: async ({ body }) => {
        const parsed = previewBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        const config = configSchema.safeParse(parsed.data.config);
        if (!config.success) return invalid(formatIssues(config.error));
        return ok(previewRoute(config.data, parsed.data.request));
      },
    },
  ];
}

function providerTestRoutes(deps: UiDeps): ApiRoute[] {
  const resultsPath = providerTestsPath(deps.homeDir);
  return [
    { method: 'GET', pattern: /^\/api\/provider-tests$/, handle: async () => ok(readProviderTests(resultsPath)) },
    {
      method: 'POST',
      pattern: /^\/api\/providers\/([^/]+)\/test$/,
      handle: async ({ params: [providerId], body }) => {
        const delegateDeps = deps.delegateDeps();
        const { providers } = delegateDeps.config;
        if (!Object.hasOwn(providers, providerId)) return missing([`providers.${providerId}: no such provider`]);
        const parsed = providerTestBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        const { model } = parsed.data;
        if (!Object.hasOwn(providers[providerId].models, model)) return invalid([`providers.${providerId}.models.${model}: no such model`]);
        const result = await testProvider(delegateDeps, providerId, model);
        recordProviderTest(resultsPath, result);
        return ok(result);
      },
    },
  ];
}

export function apiRoutes(deps: UiDeps): ApiRoute[] {
  return [...switchRoutes(deps), ...configRoutes(deps), ...decisionRoutes(deps), ...doctorRoutes(deps), ...keyRoutes(deps), ...previewRoutes(), ...providerTestRoutes(deps)];
}
