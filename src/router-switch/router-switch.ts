import { readFileSync, watchFile } from 'node:fs';
import { join } from 'node:path';
import { WATCH_INTERVAL_MS } from '../config/watch-config';

export const routerSwitchPath = (homeDir: string) => join(homeDir, '.local', 'state', 'deepseek-delegate', 'enabled');

export function isRouterEnabled(homeDir: string): boolean {
  try {
    return readFileSync(routerSwitchPath(homeDir), 'utf8').trim() !== 'off';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
}

export function watchRouterSwitch(homeDir: string, onChange: (enabled: boolean) => void): void {
  let enabled = isRouterEnabled(homeDir);
  watchFile(routerSwitchPath(homeDir), { interval: WATCH_INTERVAL_MS, persistent: false }, () => {
    let next: boolean;
    try {
      next = isRouterEnabled(homeDir);
    } catch (error) {
      process.stderr.write(`routemax: cannot read ${routerSwitchPath(homeDir)}, keeping the switch ${enabled ? 'on' : 'off'}. ${(error as Error).message}\n`);
      return;
    }
    if (next === enabled) return;
    enabled = next;
    onChange(next);
  });
}
