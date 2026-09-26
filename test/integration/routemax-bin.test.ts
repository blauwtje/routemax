import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { pageHeaders, uiCall } from '../helpers/ui-client';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BIN = join(ROOT, 'bin', 'routemax.mjs');
const URL_LINE = /routemax ui: (http:\/\/127\.0\.0\.1:(\d+)\/#token=(\S+))/;

const children: ChildProcess[] = [];

function startBin(args: string[], distDir: string): { child: ChildProcess; output: () => string } {
  const root = mkdtempSync(join(tmpdir(), 'routemax-bin-'));
  mkdirSync(join(root, 'bin'));
  writeFileSync(join(root, 'bin', 'security'), '#!/bin/sh\nexit 44\n', { mode: 0o755 });
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: join(root, 'home'), PATH: `${join(root, 'bin')}:${process.env.PATH}`, ROUTEMAX_UI_DIST: distDir, ROUTEMAX_NO_OPEN: '1' };
  delete env.DEEPSEEK_DELEGATE_CONFIG;
  const child = spawn(process.execPath, [BIN, ...args], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let text = '';
  child.stdout?.on('data', (chunk) => (text += String(chunk)));
  child.stderr?.on('data', (chunk) => (text += String(chunk)));
  return { child, output: () => text };
}

async function waitForUrl(output: () => string): Promise<RegExpMatchArray> {
  for (let waited = 0; waited < 20_000; waited += 100) {
    const match = output().match(URL_LINE);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`routemax ui printed no URL:\n${output()}`);
}

const exitCodeOf = (child: ChildProcess) => new Promise<number | null>((resolve) => child.once('exit', resolve));

afterEach(() => {
  for (const child of children.splice(0)) child.kill('SIGKILL');
});

describe('routemax ui', () => {
  it('serves the page and every section from another folder, and stops on Ctrl-C', async () => {
    const distDir = mkdtempSync(join(tmpdir(), 'routemax-dist-'));
    writeFileSync(join(distDir, 'index.html'), '<!doctype html><title>routemax test page</title>\n');
    const { child, output } = startBin(['ui'], distDir);
    const [, , portText, token] = await waitForUrl(output);
    const port = Number(portText);
    expect((await uiCall(port, 'GET', '/', { host: `127.0.0.1:${port}` })).text).toContain('routemax test page');
    for (const path of ['/api/config', '/api/switch', '/api/stats', '/api/history', '/api/keys', '/api/provider-tests']) {
      expect((await uiCall(port, 'GET', path, pageHeaders(port, token))).status, path).toBe(200);
    }
    expect((await uiCall(port, 'GET', '/api/config', pageHeaders(port, token))).json()).toMatchObject({ config: { version: 2 } });
    const exited = exitCodeOf(child);
    child.kill('SIGINT');
    expect(await exited).toBe(0);
  }, 30_000);

  it('says to run npm run setup when the page is not built', async () => {
    const { child, output } = startBin(['ui'], mkdtempSync(join(tmpdir(), 'routemax-empty-dist-')));
    expect(await exitCodeOf(child)).toBe(1);
    expect(output()).toContain('npm run setup');
  }, 30_000);

  it('prints the usage for an unknown command', async () => {
    const { child, output } = startBin(['nope'], ROOT);
    expect(await exitCodeOf(child)).toBe(2);
    expect(output()).toContain('Usage: routemax ui');
  }, 30_000);
});
