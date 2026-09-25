import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { envVarsPath, mcpConfigPath, settingsPath } from '../config/deepseek-home';

const execFileAsync = promisify(execFile);
// The chezmoi source may be pushed to a remote, so a file naming a key or token stays out of it.
const SECRET_PATTERN = /KEY|TOKEN|SECRET/;

export interface DeepseekHomeSync {
  homeDir: string;
  chezmoiBin: string;
}

export interface DeepseekHomeSyncReport {
  added: string[];
  messages: string[];
}

async function isManagedByChezmoi(chezmoiBin: string, path: string): Promise<boolean> {
  try {
    await execFileAsync(chezmoiBin, ['source-path', path]);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
    return false;
  }
}

export async function addDeepseekHomeToChezmoi(sync: DeepseekHomeSync): Promise<DeepseekHomeSyncReport> {
  const paths = [envVarsPath(sync.homeDir), mcpConfigPath(sync.homeDir), settingsPath(sync.homeDir)].filter((path) => existsSync(path));
  const unmanaged: string[] = [];
  try {
    for (const path of paths) {
      if (!(await isManagedByChezmoi(sync.chezmoiBin, path))) unmanaged.push(path);
    }
  } catch {
    return { added: [], messages: [`chezmoi is missing; nothing was added. Run chezmoi add ${paths.join(' ')} to keep these files.`] };
  }
  const added: string[] = [];
  const messages: string[] = [];
  for (const path of unmanaged) {
    const content = await readFile(path, 'utf8');
    if (SECRET_PATTERN.test(content)) messages.push(`${path} names a key or token, so it was not added to the chezmoi source.`);
    else added.push(path);
  }
  if (!added.length) return { added, messages };
  await execFileAsync(sync.chezmoiBin, ['add', ...added]);
  return { added, messages: [...messages, `Added ${added.join(', ')} to the chezmoi source.`] };
}
