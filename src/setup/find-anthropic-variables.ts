import { readFile } from 'node:fs/promises';

export async function findAnthropicVariables(settingsFile: string): Promise<string[]> {
  let text: string;
  try {
    text = await readFile(settingsFile, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return [...new Set(text.match(/ANTHROPIC_[A-Z0-9_]+/g) ?? [])];
}
