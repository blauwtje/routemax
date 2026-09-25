import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function addLiveConfigToChezmoi(configPath: string, chezmoiBin: string): Promise<string> {
  try {
    await execFileAsync(chezmoiBin, ['source-path', configPath]);
    return `${configPath} is already in the chezmoi source.`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return `chezmoi is missing; run chezmoi add ${configPath} to keep the config.`;
  }
  await execFileAsync(chezmoiBin, ['add', configPath]);
  return `Added ${configPath} to the chezmoi source.`;
}
