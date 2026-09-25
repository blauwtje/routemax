import { watchFile } from 'node:fs';
import type { DelegateConfig } from './config-schema';
import { loadConfig } from './delegate-config';

export const WATCH_INTERVAL_MS = 500;

export function watchConfig(path: string, onReload: (config: DelegateConfig) => void): void {
  watchFile(path, { interval: WATCH_INTERVAL_MS, persistent: false }, () => {
    let config: DelegateConfig;
    try {
      config = loadConfig(path);
    } catch (error) {
      process.stderr.write(`routemax: ${path} is invalid, keeping the previous config. ${(error as Error).message}\n`);
      return;
    }
    onReload(config);
  });
}
