import { execFile } from 'node:child_process';
import { userInfo } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE = 'deepseek_api_key';
const MISSING_KEY = `DeepSeek API key not found in Keychain (service ${KEYCHAIN_SERVICE}).`;

export async function readApiKey(): Promise<string> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('security', ['find-generic-password', '-a', userInfo().username, '-s', KEYCHAIN_SERVICE, '-w']));
  } catch {
    throw new Error(MISSING_KEY);
  }
  const key = stdout.trim();
  if (!key) throw new Error(MISSING_KEY);
  return key;
}
