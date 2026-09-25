import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { runDoctorChecks, type DoctorDeps } from '../src/doctor/doctor-checks';
import { createDeepseekHome } from '../src/setup/create-deepseek-home';
import { serverRegistration } from '../src/setup/register-server';
import { fakeClaude } from './helpers/fake-claude';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SECRET = 'sk-doctor-DO-NOT-PRINT';

function doctorDeps(root: string, overrides: Partial<DoctorDeps> = {}): DoctorDeps {
  return {
    homeDir: join(root, 'home'),
    repoRoot: ROOT,
    config: loadConfig(DEFAULT_CONFIG_PATH),
    registration: { ...serverRegistration(ROOT), claudeBin: join(root, 'bin', 'claude') },
    readApiKey: async () => SECRET,
    ensureProxy: async () => 'running',
    ...overrides,
  };
}

describe('runDoctorChecks', () => {
  it('reports OK on every line after a complete setup', async () => {
    const root = mkdtempSync(join(tmpdir(), 'routemax-doctor-'));
    const home = join(root, 'home');
    await createDeepseekHome(home);
    mkdirSync(join(home, '.claude', 'agents'), { recursive: true });
    for (const name of readdirSync(join(ROOT, 'agents'))) copyFileSync(join(ROOT, 'agents', name), join(home, '.claude', 'agents', name));
    writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ env: { OTHER: '1' } }));
    const registration = serverRegistration(ROOT);
    fakeClaude(root, `Command: ${registration.command}\n  Args: ${registration.args.join(' ')}\n`);

    const checks = await runDoctorChecks(doctorDeps(root));

    expect(checks.filter((check) => !check.ok)).toEqual([]);
    expect(checks.map((check) => check.name)).toEqual(['env.vars', 'DeepSeek key', 'repair-proxy', 'MCP server', 'Claude agents', 'budget', 'Max settings']);
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
        ensureProxy: async () => {
          proxyStarted = true;
          return 'running';
        },
      }),
    );

    const byName = Object.fromEntries(checks.map((check) => [check.name, check]));
    expect(checks.every((check) => !check.ok)).toBe(true);
    expect(byName['env.vars'].message).toContain('npm run setup');
    expect(byName['DeepSeek key'].message).toContain('security add-generic-password -a "$USER" -s deepseek_api_key -w');
    expect(byName['repair-proxy'].message).toContain('env.vars');
    expect(proxyStarted).toBe(false);
    expect(byName['MCP server'].message).toContain('npm run setup');
    expect(byName['Claude agents'].message).toContain('claude-opus-high.md');
    expect(byName.budget.message).toContain('$9.90 of $10.00');
    expect(byName['Max settings'].message).toContain('ANTHROPIC_BASE_URL');
  });

  it('reports a proxy that does not start', async () => {
    const root = mkdtempSync(join(tmpdir(), 'routemax-doctor-'));
    await createDeepseekHome(join(root, 'home'));
    fakeClaude(root);
    const checks = await runDoctorChecks(doctorDeps(root, { ensureProxy: async () => Promise.reject(new Error('down')) }));
    expect(checks.find((check) => check.name === 'repair-proxy')).toMatchObject({ ok: false, message: expect.stringContaining('/tmp/deepseek-proxy.log') });
  });
});
