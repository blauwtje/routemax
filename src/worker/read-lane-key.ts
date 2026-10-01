import { readFileSync } from 'node:fs';
import { keysEnvPath } from '../config/routemax-paths';
import { parseEnvVars } from './worker-env';

export class MissingLaneKeyError extends Error {
  constructor(readonly variableName: string) {
    super(`Lane key ${variableName} is missing or empty in keys.env.`);
    this.name = 'MissingLaneKeyError';
  }
}

export function readLaneKey(homeDir: string, variableName: string): string {
  let text: string;
  try {
    text = readFileSync(keysEnvPath(homeDir), 'utf8');
  } catch {
    throw new MissingLaneKeyError(variableName);
  }
  const key = parseEnvVars(text)[variableName]?.trim();
  if (!key) throw new MissingLaneKeyError(variableName);
  return key;
}
