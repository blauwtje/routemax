import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { addDeepseekHomeToChezmoi } from '../src/setup/add-deepseek-home-to-chezmoi';
import { createDeepseekHome } from '../src/setup/create-deepseek-home';
import { findAnthropicVariables } from '../src/setup/find-anthropic-variables';
import { installAgents } from '../src/setup/install-agents';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO_AGENTS = join(ROOT, 'agents');
const AGENT_FILES = ['claude-opus-high.md', 'claude-opus-xhigh.md', 'claude-sonnet-high.md'];

function fakeChezmoi(root: string) {
  const source = join(root, 'chezmoi');
  const applyLog = join(root, 'apply.log');
  const addLog = join(root, 'add.log');
  mkdirSync(join(source, 'dot_claude'), { recursive: true });
  const bin = join(root, 'bin', 'chezmoi');
  mkdirSync(join(root, 'bin'));
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'case "$1" in',
      '  source-path) case "$2" in',
      `      */.claude) echo "${source}/dot_claude" ;;`,
      `      *) test -e "${source}/dot_claude-deepseek/$(basename "$2")" || exit 1 ;;`,
      '    esac ;;',
      `  apply) shift; echo "$@" >> "${applyLog}" ;;`,
      `  add) shift; mkdir -p "${source}/dot_claude-deepseek"; for path in "$@"; do touch "${source}/dot_claude-deepseek/$(basename "$path")"; done; echo "$@" >> "${addLog}" ;;`,
      '  *) exit 1 ;;',
      'esac',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
  return { bin, source, applyLog, addLog };
}
const tempRoot = () => mkdtempSync(join(tmpdir(), 'routemax-setup-'));

describe('createDeepseekHome', () => {
  it('creates env.vars, mcp.json and settings.json, then never overwrites them', async () => {
    const home = tempRoot();
    const created = await createDeepseekHome(home);
    expect(created).toHaveLength(3);
    const envVars = readFileSync(join(home, '.claude-deepseek', 'env.vars'), 'utf8');
    expect(envVars).toContain('ANTHROPIC_BASE_URL=http://127.0.0.1:8787\n');
    expect(envVars).toContain('ANTHROPIC_MODEL=deepseek-v4-pro\n');
    expect(envVars).toContain('ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-flash\n');
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

describe('addDeepseekHomeToChezmoi', () => {
  it('adds the created files to the chezmoi source once', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    const chezmoi = fakeChezmoi(root);
    const created = await createDeepseekHome(home);
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(report.added).toEqual(created);
    expect(readdirSync(join(chezmoi.source, 'dot_claude-deepseek')).sort()).toEqual(['env.vars', 'mcp.json', 'settings.json']);
    const again = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(again.added).toEqual([]);
    expect(readFileSync(chezmoi.addLog, 'utf8').trim().split('\n')).toHaveLength(1);
  });

  it('does not add a file that holds a key or token', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    const chezmoi = fakeChezmoi(root);
    await createDeepseekHome(home);
    const envVars = join(home, '.claude-deepseek', 'env.vars');
    writeFileSync(envVars, 'DEEPSEEK_API_KEY=sk-test\n');
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(report.added).not.toContain(envVars);
    expect(report.messages.join('\n')).toContain(envVars);
    expect(readdirSync(join(chezmoi.source, 'dot_claude-deepseek')).sort()).toEqual(['mcp.json', 'settings.json']);
  });

  it('changes nothing and prints the chezmoi add command when chezmoi is missing', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    await createDeepseekHome(home);
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: join(root, 'no-chezmoi') });
    expect(report.added).toEqual([]);
    expect(report.messages.join('\n')).toContain(`chezmoi add ${join(home, '.claude-deepseek', 'env.vars')}`);
  });
});

describe('installAgents', () => {
  it('copies the agents into the chezmoi source only and applies those targets', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    const chezmoi = fakeChezmoi(root);
    const report = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: home, chezmoiBin: chezmoi.bin });
    expect(report.installed).toEqual(AGENT_FILES);
    expect(readdirSync(join(chezmoi.source, 'dot_claude', 'agents')).sort()).toEqual(AGENT_FILES);
    expect(existsSync(join(home, '.claude'))).toBe(false);
    expect(readFileSync(chezmoi.applyLog, 'utf8').trim().split(' ')).toEqual(AGENT_FILES.map((name) => join(home, '.claude', 'agents', name)));
    const again = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: home, chezmoiBin: chezmoi.bin });
    expect(again.installed).toEqual([]);
  });

  it('changes nothing and prints where to add the files when chezmoi is missing', async () => {
    const root = tempRoot();
    const report = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: join(root, 'home'), chezmoiBin: join(root, 'no-chezmoi') });
    expect(report.installed).toEqual([]);
    expect(report.messages.join('\n')).toContain('dot_claude/agents/');
    expect(report.messages.join('\n')).toContain(join(REPO_AGENTS, 'claude-opus-high.md'));
    expect(existsSync(join(root, 'home'))).toBe(false);
  });

  it('changes nothing when a target is a chezmoi template', async () => {
    const root = tempRoot();
    const chezmoi = fakeChezmoi(root);
    mkdirSync(join(chezmoi.source, 'dot_claude', 'agents'));
    writeFileSync(join(chezmoi.source, 'dot_claude', 'agents', 'claude-opus-high.md.tmpl'), 'template');
    const report = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: join(root, 'home'), chezmoiBin: chezmoi.bin });
    expect(report.installed).toEqual([]);
    expect(report.messages.join('\n')).toContain('claude-opus-high.md.tmpl');
    expect(readdirSync(join(chezmoi.source, 'dot_claude', 'agents'))).toEqual(['claude-opus-high.md.tmpl']);
    expect(existsSync(chezmoi.applyLog)).toBe(false);
  });
});

describe('findAnthropicVariables', () => {
  it('names every ANTHROPIC_ variable in the Max settings file', async () => {
    const path = join(tempRoot(), 'settings.json');
    writeFileSync(path, JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'http://127.0.0.1:8787', OTHER: '1' } }));
    expect(await findAnthropicVariables(path)).toEqual(['ANTHROPIC_BASE_URL']);
    writeFileSync(path, JSON.stringify({ env: { OTHER: '1' } }));
    expect(await findAnthropicVariables(path)).toEqual([]);
    expect(await findAnthropicVariables(join(tempRoot(), 'missing.json'))).toEqual([]);
  });
});

describe('npm run setup', () => {
  const runSetup = (home: string, pathPrefix: string) =>
    spawnSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'src/setup/run-setup.ts')], {
      env: { ...process.env, HOME: home, PATH: `${pathPrefix}:${process.env.PATH}` },
      encoding: 'utf8',
    });

  it('writes nothing under ~/.claude/, leaves no ANTHROPIC_ variable there, and prints the registration command', () => {
    const root = tempRoot();
    const home = join(root, 'home');
    mkdirSync(home);
    const chezmoi = fakeChezmoi(root);
    const run = runSetup(home, join(root, 'bin'));
    expect(run.status).toBe(0);
    expect(existsSync(join(home, '.claude'))).toBe(false);
    expect(existsSync(join(chezmoi.source, 'dot_claude', 'agents', 'claude-opus-high.md'))).toBe(true);
    expect(readFileSync(chezmoi.addLog, 'utf8')).toContain(join(home, '.claude-deepseek', 'env.vars'));
    expect(run.stdout).toContain('claude mcp add -s user deepseek-delegate -- ');
  });

  it('fails when ~/.claude/settings.json holds an ANTHROPIC_ variable', () => {
    const root = tempRoot();
    const home = join(root, 'home');
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ env: { ANTHROPIC_MODEL: 'deepseek-v4-pro' } }));
    fakeChezmoi(root);
    const run = runSetup(home, join(root, 'bin'));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('ANTHROPIC_MODEL');
  });
});
