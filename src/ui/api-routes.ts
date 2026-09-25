import { z } from 'zod';
import { formatIssues } from '../config/config-schema';
import { readStoredConfig, restorePrevious, saveConfig, type StoreOutcome } from '../config/config-store';
import { previousConfigPath } from '../config/routemax-paths';
import { syncChezmoi } from '../config/sync-chezmoi';
import { isRouterEnabled, setRouterEnabled } from '../router-switch/router-switch';
import type { ApiResponse, ApiRoute } from './ui-server';

export interface UiDeps {
  homeDir: string;
  configPath: string;
  chezmoiBin: string;
}

const switchBodySchema = z.object({ enabled: z.boolean() });
const saveBodySchema = z.object({ config: z.unknown(), baseHash: z.string() });
const restoreBodySchema = z.object({ baseHash: z.string() });
const STORE_ERROR_STATUS = { stale: 409, invalid: 422, missing: 404 } as const;

export const invalid = (issues: string[]): ApiResponse => ({ status: 422, body: { error: 'invalid', issues } });
const ok = (body: unknown): ApiResponse => ({ status: 200, body });

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

export function apiRoutes(deps: UiDeps): ApiRoute[] {
  return [...switchRoutes(deps), ...configRoutes(deps)];
}
