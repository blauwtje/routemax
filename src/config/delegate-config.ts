import { constants, copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configSchema, formatIssues, type DelegateConfig, type Provider } from './config-schema';
import { migrateConfig } from './migrate-config';
import { liveConfigPath, v1BackupPath } from './routemax-paths';

export const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('../../config/routing.json', import.meta.url));

const expandHome = (path: string) => (path.startsWith('~/') ? join(homedir(), path.slice(2)) : path);
const isFileExists = (error: unknown) => (error as NodeJS.ErrnoException).code === 'EEXIST';

function expandProxyPaths(provider: Provider): Provider {
  const { repairProxy } = provider;
  if (!repairProxy) return provider;
  return { ...provider, repairProxy: { ...repairProxy, logPath: expandHome(repairProxy.logPath), telemetryPath: expandHome(repairProxy.telemetryPath) } };
}

function readValidConfig(path: string): { migrated: unknown; config: DelegateConfig } {
  const migrated = migrateConfig(JSON.parse(readFileSync(path, 'utf8')));
  const parsed = configSchema.safeParse(migrated);
  if (!parsed.success) throw new Error(`${path} is not a valid routemax config: ${formatIssues(parsed.error).join('; ')}`);
  return { migrated, config: parsed.data };
}

export function ensureLiveConfig(homeDir: string, seedPath = DEFAULT_CONFIG_PATH): string {
  const livePath = liveConfigPath(homeDir);
  if (existsSync(livePath)) return livePath;
  const { migrated } = readValidConfig(seedPath);
  const backupPath = v1BackupPath(homeDir);
  mkdirSync(dirname(backupPath), { recursive: true });
  try {
    copyFileSync(seedPath, backupPath, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!isFileExists(error)) throw error;
  }
  mkdirSync(dirname(livePath), { recursive: true });
  const tempPath = `${livePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(migrated, null, 2)}\n`);
  try {
    linkSync(tempPath, livePath);
  } catch (error) {
    if (!isFileExists(error)) throw error;
  } finally {
    unlinkSync(tempPath);
  }
  return livePath;
}

export const activeConfigPath = () => process.env.DEEPSEEK_DELEGATE_CONFIG ?? ensureLiveConfig(homedir());

export function loadConfig(path = activeConfigPath()): DelegateConfig {
  const { config } = readValidConfig(path);
  const providers = Object.fromEntries(Object.entries(config.providers).map(([id, provider]) => [id, expandProxyPaths(provider)]));
  return { ...config, providers };
}
