import { execFile } from 'node:child_process';
import { userInfo } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function readApiKey(keychainService: string): Promise<string> {
  const missingKey = `API key not found in Keychain (service ${keychainService}).`;
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('security', ['find-generic-password', '-a', userInfo().username, '-s', keychainService, '-w']));
  } catch {
    throw new Error(missingKey);
  }
  const key = stdout.trim();
  if (!key) throw new Error(missingKey);
  return key;
}
