import type { Effort } from '../config/config-schema';

const NOT_INHERITED = /^(ANTHROPIC_|CLAUDE_CODE_|CLAUDECODE$|CLAUDE_CONFIG_DIR$|DEEPSEEK_DELEGATE_)/;

export interface WorkerEnvInput {
  inherited: NodeJS.ProcessEnv;
  envVars: Record<string, string>;
  baseUrl: string;
  model: string;
  apiKey: string;
  effort: Effort;
}

export function parseEnvVars(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

export function buildWorkerEnv(input: WorkerEnvInput): Record<string, string> {
  if (input.model.startsWith('claude-')) {
    throw new Error(`Worker lane model must not be a Claude model: ${input.model}`);
  }
  const inherited = Object.entries(input.inherited).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !NOT_INHERITED.test(entry[0]),
  );
  return {
    ...Object.fromEntries(inherited),
    ...input.envVars,
    ANTHROPIC_DEFAULT_OPUS_MODEL: input.model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: input.model,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: input.model,
    ANTHROPIC_SMALL_FAST_MODEL: input.model,
    ANTHROPIC_BASE_URL: input.baseUrl,
    ANTHROPIC_MODEL: input.model,
    CLAUDE_CODE_SUBAGENT_MODEL: input.model,
    ANTHROPIC_AUTH_TOKEN: input.apiKey,
    ANTHROPIC_API_KEY: '',
    CLAUDE_CODE_EFFORT_LEVEL: input.effort,
    DEEPSEEK_DELEGATE_DEPTH: '1',
  };
}
