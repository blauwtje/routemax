import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const HEALTH_TIMEOUT_MS = 1_000;
const START_WAIT_MS = 6_000;
const POLL_MS = 200;

export interface ProxyStart {
  dir: string;
  port: number;
  upstreamBaseUrl: string;
  logPath: string;
  // The proxy defaults its telemetry path to its own HOME; passing it keeps the proxy writing where the delegate reads retries.
  telemetryPath: string;
}

export const proxyUrl = (port: number) => `http://127.0.0.1:${port}`;

export async function isProxyHealthy(healthUrl: string): Promise<boolean> {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureProxy(start: ProxyStart): Promise<'running' | 'started'> {
  const healthUrl = `${proxyUrl(start.port)}/healthz`;
  if (await isProxyHealthy(healthUrl)) return 'running';
  const log = openSync(start.logPath, 'a');
  const proxy = spawn(join(start.dir, 'node_modules', '.bin', 'tsx'), ['src/server.ts'], {
    cwd: start.dir,
    env: { ...process.env, PORT: String(start.port), UPSTREAM_BASE_URL: start.upstreamBaseUrl, TELEMETRY_PATH: start.telemetryPath },
    detached: true,
    stdio: ['ignore', log, log],
  });
  closeSync(log);
  let spawnFailed = false;
  proxy.once('error', () => {
    spawnFailed = true;
  });
  proxy.unref();
  for (let waited = 0; waited < START_WAIT_MS && !spawnFailed; waited += POLL_MS) {
    await sleep(POLL_MS);
    if (await isProxyHealthy(healthUrl)) return 'started';
  }
  throw new Error(`deepseek-proxy did not start; see ${start.logPath}`);
}
