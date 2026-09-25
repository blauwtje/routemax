import { z } from 'zod';
import { formatIssues } from '../config/config-schema';
import { isRouterEnabled, setRouterEnabled } from '../router-switch/router-switch';
import type { ApiResponse, ApiRoute } from './ui-server';

export interface UiDeps {
  homeDir: string;
}

const switchBodySchema = z.object({ enabled: z.boolean() });

export const invalid = (issues: string[]): ApiResponse => ({ status: 422, body: { error: 'invalid', issues } });

export function apiRoutes(deps: UiDeps): ApiRoute[] {
  return [
    { method: 'GET', pattern: /^\/api\/switch$/, handle: async () => ({ status: 200, body: { enabled: isRouterEnabled(deps.homeDir) } }) },
    {
      method: 'PUT',
      pattern: /^\/api\/switch$/,
      handle: async ({ body }) => {
        const parsed = switchBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        setRouterEnabled(deps.homeDir, parsed.data.enabled);
        return { status: 200, body: { enabled: parsed.data.enabled } };
      },
    },
  ];
}
