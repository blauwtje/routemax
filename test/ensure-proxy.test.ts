import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureProxy, isProxyHealthy } from '../src/proxy/ensure-proxy';
import { freePort } from './helpers/free-port';

const tempDir = () => mkdtempSync(join(tmpdir(), 'routemax-proxy-'));

describe('ensureProxy', () => {
  it('leaves a healthy proxy alone', async () => {
    const server = createServer((_request, response) => response.end('{"ok":true}')).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    const dir = tempDir();
    try {
      expect(await ensureProxy({ dir, logPath: join(dir, 'proxy.log'), telemetryPath: join(dir, 'telemetry.jsonl'), healthUrl: `http://127.0.0.1:${port}/healthz` })).toBe('running');
    } finally {
      server.close();
    }
  });

  it('starts a stopped proxy detached, points its telemetry at the delegate path, and leaves it running', async () => {
    const dir = tempDir();
    const port = await freePort();
    const pidFile = join(dir, 'proxy.pid');
    const telemetryFile = join(dir, 'telemetry-path.txt');
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(
      join(dir, 'node_modules', '.bin', 'tsx'),
      `#!/bin/sh\necho $$ > "${pidFile}"\necho "$TELEMETRY_PATH" > "${telemetryFile}"\nexec node -e "require('node:http').createServer((q, s) => s.end('{}')).listen(${port}, '127.0.0.1')"\n`,
      { mode: 0o755 },
    );
    const healthUrl = `http://127.0.0.1:${port}/healthz`;
    try {
      expect(await ensureProxy({ dir, logPath: join(dir, 'proxy.log'), telemetryPath: join(dir, 'telemetry.jsonl'), healthUrl })).toBe('started');
      expect(await isProxyHealthy(healthUrl)).toBe(true);
      expect(readFileSync(telemetryFile, 'utf8').trim()).toBe(join(dir, 'telemetry.jsonl'));
    } finally {
      process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGTERM');
    }
  });

  it('names the log when the proxy cannot start', async () => {
    const dir = tempDir();
    const port = await freePort();
    await expect(ensureProxy({ dir, logPath: join(dir, 'proxy.log'), telemetryPath: join(dir, 'telemetry.jsonl'), healthUrl: `http://127.0.0.1:${port}/healthz` })).rejects.toThrow(
      `deepseek-proxy did not start; see ${join(dir, 'proxy.log')}`,
    );
  });
});
