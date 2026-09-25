import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureProxy, isProxyHealthy, proxyUrl } from '../src/proxy/ensure-proxy';
import { freePort } from './helpers/free-port';

const UPSTREAM = 'https://upstream.example/anthropic';
const tempDir = () => mkdtempSync(join(tmpdir(), 'routemax-proxy-'));
const start = (dir: string, port: number) => ({ dir, port, upstreamBaseUrl: UPSTREAM, logPath: join(dir, 'proxy.log'), telemetryPath: join(dir, 'telemetry.jsonl') });

describe('ensureProxy', () => {
  it('leaves a healthy proxy alone', async () => {
    const server = createServer((_request, response) => response.end('{"ok":true}')).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    try {
      expect(await ensureProxy(start(tempDir(), port))).toBe('running');
    } finally {
      server.close();
    }
  });

  it('starts a stopped proxy detached on the provider port, upstream and telemetry path, and leaves it running', async () => {
    const dir = tempDir();
    const port = await freePort();
    const pidFile = join(dir, 'proxy.pid');
    const envFile = join(dir, 'proxy-env.txt');
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(
      join(dir, 'node_modules', '.bin', 'tsx'),
      `#!/bin/sh\necho $$ > "${pidFile}"\necho "$TELEMETRY_PATH $UPSTREAM_BASE_URL" > "${envFile}"\nexec node -e "require('node:http').createServer((q, s) => s.end('{}')).listen(Number(process.env.PORT), '127.0.0.1')"\n`,
      { mode: 0o755 },
    );
    try {
      expect(await ensureProxy(start(dir, port))).toBe('started');
      expect(await isProxyHealthy(`${proxyUrl(port)}/healthz`)).toBe(true);
      expect(readFileSync(envFile, 'utf8').trim()).toBe(`${join(dir, 'telemetry.jsonl')} ${UPSTREAM}`);
    } finally {
      process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGTERM');
    }
  });

  it('names the log when the proxy cannot start', async () => {
    const dir = tempDir();
    await expect(ensureProxy(start(dir, await freePort()))).rejects.toThrow(`deepseek-proxy did not start; see ${join(dir, 'proxy.log')}`);
  });
});
