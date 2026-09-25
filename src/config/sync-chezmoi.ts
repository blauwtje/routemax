import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ChezmoiSync {
  state: 'synced' | 'no-chezmoi' | 'unmanaged' | 'template' | 'failed';
  message: string;
}

export async function syncChezmoi(targetPath: string, chezmoiBin = 'chezmoi'): Promise<ChezmoiSync> {
  let sourcePath: string;
  try {
    ({ stdout: sourcePath } = await execFileAsync(chezmoiBin, ['source-path', targetPath]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: 'no-chezmoi', message: 'chezmoi is not installed, so the chezmoi source was not updated.' };
    return { state: 'unmanaged', message: `chezmoi does not manage ${targetPath}. Add it once with: chezmoi add ${targetPath}` };
  }
  const source = sourcePath.trim();
  if (source.endsWith('.tmpl')) return { state: 'template', message: `The chezmoi source ${source} is a template, so it was not updated. Copy the change into it by hand.` };
  try {
    await execFileAsync(chezmoiBin, ['re-add', targetPath]);
    return { state: 'synced', message: `The chezmoi source ${source} matches the saved config.` };
  } catch {
    return { state: 'failed', message: `chezmoi re-add ${targetPath} failed. Run it by hand.` };
  }
}
