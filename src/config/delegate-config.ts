import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v1ConfigSchema, type DelegateConfig } from './config-schema';

export { EFFORT_ORDER, TIER_ORDER } from './config-schema';
export type { DelegateConfig, Effort, ModelPrice, Tier, WorkerTier } from './config-schema';

export const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('../../config/routing.json', import.meta.url));

const expandHome = (path: string) => (path.startsWith('~/') ? join(homedir(), path.slice(2)) : path);

export function loadConfig(path = process.env.DEEPSEEK_DELEGATE_CONFIG ?? DEFAULT_CONFIG_PATH): DelegateConfig {
  const config = v1ConfigSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  return { ...config, proxy: { ...config.proxy, telemetryPath: expandHome(config.proxy.telemetryPath) } };
}
