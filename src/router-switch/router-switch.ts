import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const routerSwitchPath = (homeDir: string) => join(homeDir, '.local', 'state', 'deepseek-delegate', 'enabled');

export function isRouterEnabled(homeDir: string): boolean {
  try {
    return readFileSync(routerSwitchPath(homeDir), 'utf8').trim() !== 'off';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
}
