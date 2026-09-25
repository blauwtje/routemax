import { spawn } from 'node:child_process';
import { userInfo } from 'node:os';

const UNSAFE_CHARACTER = /["\\\p{Cc}]/u;

export function keyIssues(key: string): string[] {
  if (key.length === 0 || UNSAFE_CHARACTER.test(key)) return ['key: The key is empty or holds a quote, a backslash or a control character.'];
  return [];
}

export async function storeApiKey(keychainService: string, key: string): Promise<void> {
  const account = userInfo().username;
  if (keyIssues(key).length > 0) throw new Error('The key is empty or holds a quote, a backslash or a control character.');
  if (UNSAFE_CHARACTER.test(keychainService) || UNSAFE_CHARACTER.test(account)) {
    throw new Error(`The Keychain service ${JSON.stringify(keychainService)} or the account name holds a quote, a backslash or a control character.`);
  }
  const command = `add-generic-password -U -a "${account}" -s "${keychainService}" -w "${key}"\n`;
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const child = spawn('security', ['-i'], { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', reject);
    child.on('close', resolve);
    child.stdin.on('error', reject);
    child.stdin.end(command);
  });
  if (exitCode !== 0) throw new Error(`security could not store the key for Keychain service ${keychainService} (exit code ${exitCode}).`);
}
