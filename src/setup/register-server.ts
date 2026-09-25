import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SERVER_NAME = 'deepseek-delegate';

export interface ServerRegistration {
  claudeBin: string;
  command: string;
  args: string[];
}

export type RegistrationState = 'missing' | 'current' | 'other';

export async function registrationState(registration: ServerRegistration): Promise<RegistrationState> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(registration.claudeBin, ['mcp', 'get', SERVER_NAME]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
    return 'missing';
  }
  const current = [registration.command, ...registration.args].every((part) => stdout.includes(part));
  return current ? 'current' : 'other';
}

export async function registerServer(registration: ServerRegistration): Promise<string> {
  const addArgs = ['mcp', 'add', '-s', 'user', SERVER_NAME, '--', registration.command, ...registration.args];
  let state: RegistrationState;
  try {
    state = await registrationState(registration);
  } catch {
    return `${registration.claudeBin} is not on PATH; nothing was registered. Run: claude ${addArgs.join(' ')}`;
  }
  if (state === 'current') return `${SERVER_NAME} is already registered.`;
  if (state === 'other') {
    return `${SERVER_NAME} is registered with another command; nothing was changed. Run claude mcp remove -s user ${SERVER_NAME}, then npm run setup again.`;
  }
  await execFileAsync(registration.claudeBin, addArgs);
  return `Registered ${SERVER_NAME} for every project. Restart Claude Code to load it.`;
}
