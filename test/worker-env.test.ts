import { describe, expect, it } from 'vitest';
import { buildWorkerEnv, parseEnvVars } from '../src/worker/worker-env';

describe('parseEnvVars', () => {
  it('reads KEY=value lines and skips comments and blanks', () => {
    expect(parseEnvVars('# comment\n\nANTHROPIC_BASE_URL=http://127.0.0.1:8787\nA=b=c\n')).toEqual({
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:8787',
      A: 'b=c',
    });
  });
});

describe('buildWorkerEnv', () => {
  const env = buildWorkerEnv({
    inherited: {
      PATH: '/usr/bin',
      ANTHROPIC_API_KEY: 'sk-ant-inherited',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      CLAUDECODE: '1',
      CLAUDE_CODE_ENTRYPOINT: 'cli',
      CLAUDE_CONFIG_DIR: '/Users/me/.claude',
      DEEPSEEK_DELEGATE_DEPTH: '0',
    },
    envVars: { ANTHROPIC_BASE_URL: 'http://127.0.0.1:8787', ANTHROPIC_MODEL: 'deepseek-v4-pro', CLAUDE_CONFIG_DIR: '/Users/me/.claude-deepseek' },
    baseUrl: 'https://openrouter.ai/api',
    model: 'deepseek-v4-flash',
    apiKey: 'sk-fake-key',
    effort: 'high',
  });

  it('drops inherited Claude Code and delegate variables and empties the inherited API key', () => {
    expect(env.ANTHROPIC_API_KEY).toBe('');
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
    expect(env.PATH).toBe('/usr/bin');
  });

  it('layers env.vars, then the provider URL, tier model, key, effort and depth', () => {
    expect(env).toMatchObject({
      ANTHROPIC_BASE_URL: 'https://openrouter.ai/api',
      CLAUDE_CONFIG_DIR: '/Users/me/.claude-deepseek',
      ANTHROPIC_MODEL: 'deepseek-v4-flash',
      CLAUDE_CODE_SUBAGENT_MODEL: 'deepseek-v4-flash',
      ANTHROPIC_AUTH_TOKEN: 'sk-fake-key',
      CLAUDE_CODE_EFFORT_LEVEL: 'high',
      DEEPSEEK_DELEGATE_DEPTH: '1',
    });
  });
});
