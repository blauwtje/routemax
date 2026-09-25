import { mkdir, writeFile } from 'node:fs/promises';
import { deepseekHomeDir, envVarsPath, mcpConfigPath, settingsPath } from '../config/deepseek-home';

function envVarsContent(homeDir: string): string {
  return [
    '# Read by deepseek() in ~/.zshrc, the repair-proxy regression check and the deepseek-delegate worker. Holds no key.',
    'ANTHROPIC_BASE_URL=http://127.0.0.1:8787',
    'ANTHROPIC_MODEL=deepseek-v4-pro',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-flash',
    'CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro',
    `CLAUDE_CONFIG_DIR=${deepseekHomeDir(homeDir)}`,
    '',
  ].join('\n');
}

export async function createDeepseekHome(homeDir: string): Promise<string[]> {
  await mkdir(deepseekHomeDir(homeDir), { recursive: true });
  const files: [string, string][] = [
    [envVarsPath(homeDir), envVarsContent(homeDir)],
    [mcpConfigPath(homeDir), '{"mcpServers":{}}\n'],
    [settingsPath(homeDir), '{\n  "effortLevel": "high"\n}\n'],
  ];
  const created: string[] = [];
  for (const [path, content] of files) {
    try {
      await writeFile(path, content, { flag: 'wx' });
      created.push(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  return created;
}
