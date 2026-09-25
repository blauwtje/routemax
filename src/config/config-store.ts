import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { configIssues } from './config-schema';

export interface StoredConfig {
  config: unknown;
  hash: string;
  previousExists: boolean;
}

export type StoreOutcome = { ok: true; hash: string } | { ok: false; kind: 'stale' | 'invalid' | 'missing'; issues: string[] };

const STALE: StoreOutcome = { ok: false, kind: 'stale', issues: ['The config changed on disk since the page loaded. Reload the page.'] };

export const textHash = (text: string) => createHash('sha256').update(text).digest('hex');

function writeByRename(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, text);
  renameSync(temporaryPath, path);
}

export function readStoredConfig(configPath: string, previousPath: string): StoredConfig {
  const text = readFileSync(configPath, 'utf8');
  return { config: JSON.parse(text), hash: textHash(text), previousExists: existsSync(previousPath) };
}

export function saveConfig(configPath: string, previousPath: string, config: unknown, baseHash: string): StoreOutcome {
  const current = readFileSync(configPath, 'utf8');
  if (textHash(current) !== baseHash) return STALE;
  const issues = configIssues(config);
  if (issues.length > 0) return { ok: false, kind: 'invalid', issues };
  const text = `${JSON.stringify(config, null, 2)}\n`;
  writeByRename(previousPath, current);
  writeByRename(configPath, text);
  return { ok: true, hash: textHash(text) };
}

export function restorePrevious(configPath: string, previousPath: string, baseHash: string): StoreOutcome {
  if (!existsSync(previousPath)) return { ok: false, kind: 'missing', issues: ['There is no previous version to restore.'] };
  const current = readFileSync(configPath, 'utf8');
  if (textHash(current) !== baseHash) return STALE;
  const previous = readFileSync(previousPath, 'utf8');
  writeByRename(previousPath, current);
  writeByRename(configPath, previous);
  return { ok: true, hash: textHash(previous) };
}
