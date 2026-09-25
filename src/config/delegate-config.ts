import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configSchema, formatIssues, type DelegateConfig, type Provider } from './config-schema';
import { migrateConfig } from './migrate-config';

export const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('../../config/routing.json', import.meta.url));

const expandHome = (path: string) => (path.startsWith('~/') ? join(homedir(), path.slice(2)) : path);

function expandProxyPaths(provider: Provider): Provider {
  const { repairProxy } = provider;
  if (!repairProxy) return provider;
  return { ...provider, repairProxy: { ...repairProxy, logPath: expandHome(repairProxy.logPath), telemetryPath: expandHome(repairProxy.telemetryPath) } };
}

export function loadConfig(path = process.env.DEEPSEEK_DELEGATE_CONFIG ?? DEFAULT_CONFIG_PATH): DelegateConfig {
  const parsed = configSchema.safeParse(migrateConfig(JSON.parse(readFileSync(path, 'utf8'))));
  if (!parsed.success) throw new Error(`${path} is not a valid routemax config: ${formatIssues(parsed.error).join('; ')}`);
  const providers = Object.fromEntries(Object.entries(parsed.data.providers).map(([id, provider]) => [id, expandProxyPaths(provider)]));
  return { ...parsed.data, providers };
}
