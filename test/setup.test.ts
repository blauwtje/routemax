import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDeepseekHome } from '../src/setup/create-deepseek-home';

const tempRoot = () => mkdtempSync(join(tmpdir(), 'routemax-setup-'));

describe('createDeepseekHome', () => {
  it('creates env.vars, mcp.json and settings.json, then never overwrites them', async () => {
    const home = tempRoot();
    const created = await createDeepseekHome(home);
    expect(created).toHaveLength(3);
    const envVars = readFileSync(join(home, '.claude-deepseek', 'env.vars'), 'utf8');
    expect(envVars).toContain('ANTHROPIC_BASE_URL=http://127.0.0.1:8787\n');
    expect(envVars).toContain('ANTHROPIC_MODEL=deepseek-v4-pro\n');
    expect(envVars).toContain('ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash\n');
    expect(envVars).toContain('CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro\n');
    expect(envVars).toContain(`CLAUDE_CONFIG_DIR=${join(home, '.claude-deepseek')}\n`);
    expect(envVars).not.toMatch(/KEY|TOKEN/);
    expect(JSON.parse(readFileSync(join(home, '.claude-deepseek', 'mcp.json'), 'utf8'))).toEqual({ mcpServers: {} });
    expect(JSON.parse(readFileSync(join(home, '.claude-deepseek', 'settings.json'), 'utf8'))).toEqual({ effortLevel: 'high' });
    writeFileSync(join(home, '.claude-deepseek', 'env.vars'), 'EDITED=1\n');
    expect(await createDeepseekHome(home)).toEqual([]);
    expect(readFileSync(join(home, '.claude-deepseek', 'env.vars'), 'utf8')).toBe('EDITED=1\n');
  });
});
