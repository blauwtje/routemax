import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { runDoctorChecks, type DoctorDeps } from '../src/doctor/doctor-checks';
import { routerSwitchPath } from '../src/router-switch/router-switch';
import { createDeepseekHome } from '../src/setup/create-deepseek-home';
import { serverRegistration } from '../src/setup/register-server';
import { fakeClaude, type McpGetEntry } from './helpers/fake-claude';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SECRET = 'sk-doctor-DO-NOT-PRINT';

function doctorDeps(root: string, overrides: Partial<DoctorDeps> = {}): DoctorDeps {
  return {
    homeDir: join(root, 'home'),
    repoRoot: ROOT,
    config: loadConfig(DEFAULT_CONFIG_PATH),
    registration: serverRegistration(ROOT, join(root, 'bin', 'claude')),
    readApiKey: async () => SECRET,
    ensureProxy: async () => 'running',
    commandOnPath: async () => true,
    ...overrides,
  };
}

const currentEntry = (overrides: Partial<McpGetEntry> = {}): McpGetEntry => {
  const { command, args } = serverRegistration(ROOT, 'claude');
  return { scope: 'user', connected: true, command, args, ...overrides };
};

describe('runDoctorChecks', () => {
  it('reports OK on every line after a complete setup', async () => {
    const root = mkdtempSync(join(tmpdir(), 'routemax-doctor-'));
    const home = join(root, 'home');
    await createDeepseekHome(home);
    mkdirSync(join(home, '.claude', 'agents'), { recursive: true });
    for (const name of readdirSync(join(ROOT, 'agents'))) copyFileSync(join(ROOT, 'agents', name), join(home, '.claude', 'agents', name));
    writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ env: { OTHER: '1' } }));
    fakeClaude(root, currentEntry());

    const checks = await runDoctorChecks(doctorDeps(root));

    expect(checks.filter((check) => !check.ok)).toEqual([]);
    expect(checks.map((check) => check.name)).toEqual(['router', 'routemax command', 'env.vars', 'DeepSeek key', 'repair-proxy', 'MCP server', 'Claude agents', 'budget', 'Max settings']);
    expect(JSON.stringify(checks)).not.toContain(SECRET);
  });

  it('says what to do on every line when nothing is set up', async () => {
    const root = mkdtempSync(join(tmpdir(), 'routemax-doctor-'));
    const home = join(root, 'home');
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'http://127.0.0.1:8787' } }));
    mkdirSync(join(home, '.local', 'state', 'deepseek-delegate'), { recursive: true });
    writeFileSync(decisionLogPath(home), `${JSON.stringify({ costUsd: 9.9 })}\n`);
    fakeClaude(root);
    let proxyStarted = false;

    const checks = await runDoctorChecks(
      doctorDeps(root, {
        readApiKey: async () => Promise.reject(new Error('no key')),
        commandOnPath: async () => false,
        ensureProxy: async () => {
          proxyStarted = true;
          return 'running';
        },
      }),
    );

    const byName = Object.fromEntries(checks.map((check) => [check.name, check]));
    expect(byName['routemax command'].message).toContain('npm link');
    expect(checks.filter((check) => check.name !== 'router').every((check) => !check.ok)).toBe(true);
    expect(byName['env.vars'].message).toContain('npm run setup');
    expect(byName['DeepSeek key'].message).toContain('security add-generic-password -a "$USER" -s deepseek_api_key -w');
    expect(byName['repair-proxy'].message).toContain('env.vars');
    expect(proxyStarted).toBe(false);
    expect(byName['MCP server'].message).toContain('npm run setup');
    expect(byName['Claude agents'].message).toContain('claude-opus-high.md');
    expect(byName.budget.message).toContain('$9.90 of $10.00');
    expect(byName['Max settings'].message).toContain('ANTHROPIC_BASE_URL');
  });

  it.each([
    ['one project only', currentEntry({ scope: 'local' }), 'claude mcp remove deepseek-delegate -s local'],
    ['a server that does not connect', currentEntry({ connected: false }), 'does not connect'],
    ['another command', currentEntry({ command: '/old/tsx' }), 'claude mcp remove deepseek-delegate -s user'],
  ])('reports a registration for %s', async (_case, entry, advice) => {
    const root = mkdtempSync(join(tmpdir(), 'routemax-doctor-'));
    fakeClaude(root, entry);
    const checks = await runDoctorChecks(doctorDeps(root));
    expect(checks.find((check) => check.name === 'MCP server')).toMatchObject({ ok: false, message: expect.stringContaining(advice) });
  });

  it('reports a proxy that does not start', async () => {
    const root = mkdtempSync(join(tmpdir(), 'routemax-doctor-'));
    await createDeepseekHome(join(root, 'home'));
    fakeClaude(root);
    const checks = await runDoctorChecks(doctorDeps(root, { ensureProxy: async () => Promise.reject(new Error('down')) }));
    expect(checks.find((check) => check.name === 'repair-proxy')).toMatchObject({ ok: false, message: expect.stringContaining('/tmp/deepseek-proxy.log') });
  });

  it('reports the router as off without asking for a fix', async () => {
    const root = mkdtempSync(join(tmpdir(), 'routemax-doctor-'));
    const deps = doctorDeps(root);
    mkdirSync(dirname(routerSwitchPath(deps.homeDir)), { recursive: true });
    writeFileSync(routerSwitchPath(deps.homeDir), 'off\n');
    const checks = await runDoctorChecks(deps);
    expect(checks.find((check) => check.name === 'router')).toMatchObject({ ok: true, message: expect.stringContaining('The router is off') });
  });
});
