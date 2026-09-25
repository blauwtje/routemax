import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SERVER_NAME = 'deepseek-delegate';
// Labels `claude mcp get` prints (Claude Code 2.1.282); it exits 0 whether or not the server connects.
const USER_SCOPE = /^\s*Scope:\s*User config\b/m;
const CONNECTED = /^\s*Status:\s*\S*\s*Connected\s*$/m;
const REMOVE_COMMAND = /^To remove this server, run: (.+)$/m;

export interface ServerRegistration {
  claudeBin: string;
  command: string;
  args: string[];
}

export function serverRegistration(repoRoot: string, claudeBin: string): ServerRegistration {
  return { claudeBin, command: join(repoRoot, 'node_modules/.bin/tsx'), args: [join(repoRoot, 'src/server.ts')] };
}

export type RegistrationState = 'missing' | 'current' | 'other-command' | 'other-scope' | 'not-connected';

export interface RegistrationCheck {
  state: RegistrationState;
  // The remove command `claude mcp get` prints, which names the scope the registration lives in.
  removeCommand: string;
}

export async function checkRegistration(registration: ServerRegistration): Promise<RegistrationCheck> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(registration.claudeBin, ['mcp', 'get', SERVER_NAME]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
    return { state: 'missing', removeCommand: '' };
  }
  const removeCommand = REMOVE_COMMAND.exec(stdout)?.[1] ?? `${registration.claudeBin} mcp remove ${SERVER_NAME}`;
  const sameCommand = [registration.command, ...registration.args].every((part) => stdout.includes(part));
  if (!sameCommand) return { state: 'other-command', removeCommand };
  if (!USER_SCOPE.test(stdout)) return { state: 'other-scope', removeCommand };
  if (!CONNECTED.test(stdout)) return { state: 'not-connected', removeCommand };
  return { state: 'current', removeCommand };
}

export function registrationProblem(check: RegistrationCheck): string | null {
  switch (check.state) {
    case 'current':
      return null;
    case 'missing':
      return `${SERVER_NAME} is not registered. Run npm run setup.`;
    case 'other-command':
      return `${SERVER_NAME} is registered with another command. Run ${check.removeCommand}, then npm run setup again.`;
    case 'other-scope':
      return `${SERVER_NAME} is registered for one project only, not for every project. Run ${check.removeCommand}, then npm run setup again.`;
    case 'not-connected':
      return `${SERVER_NAME} is registered but does not connect. Run claude mcp get ${SERVER_NAME} to see the issue.`;
  }
}

export interface RegistrationReport {
  ok: boolean;
  message: string;
}

export async function registerServer(registration: ServerRegistration): Promise<RegistrationReport> {
  const addArgs = ['mcp', 'add', '-s', 'user', SERVER_NAME, '--', registration.command, ...registration.args];
  let before: RegistrationCheck;
  try {
    before = await checkRegistration(registration);
  } catch {
    return { ok: false, message: `${registration.claudeBin} is not on PATH; nothing was registered. Run: ${registration.claudeBin} ${addArgs.join(' ')}` };
  }
  if (before.state === 'current') return { ok: true, message: `${SERVER_NAME} is already registered.` };
  if (before.state !== 'missing') return { ok: false, message: registrationProblem(before) ?? '' };
  await execFileAsync(registration.claudeBin, addArgs);
  const after = registrationProblem(await checkRegistration(registration));
  if (after) return { ok: false, message: after };
  return { ok: true, message: `Registered ${SERVER_NAME} for every project. Restart Claude Code to load it.` };
}
