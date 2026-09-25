import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

export async function commandOnPath(name: string, pathVariable = process.env.PATH ?? ''): Promise<boolean> {
  for (const dir of pathVariable.split(delimiter).filter(Boolean)) {
    try {
      await access(join(dir, name), constants.X_OK);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}
