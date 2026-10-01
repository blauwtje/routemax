import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DelegateConfig } from '../../src/config/config-schema';
import { keysEnvPath } from '../../src/config/routemax-paths';
import { DEFAULT_CONFIG_PATH } from '../../src/config/delegate-config';
import { migrateConfig } from '../../src/config/migrate-config';
import { decisionLogPath } from '../../src/decision-log/decision-log';
import { isProxyHealthy } from '../../src/proxy/ensure-proxy';
import { routerSwitchPath } from '../../src/router-switch/router-switch';
import { freePort } from '../helpers/free-port';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FAKE_UPSTREAM = join(ROOT, 'test/fixtures/fake-upstream.mjs');
const FAKE_KEY = 'sk-fake-DO-NOT-LEAK';
const CALL_TIMEOUT_MS = 180_000;

let home = '';
let work = '';
let outside = '';
let modeFile = '';
let pidFile = '';
let healthUrl = '';
let serverEnv: Record<string, string> = {};
const stderrChunks: string[] = [];
const resultTexts: string[] = [];

beforeAll(async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'routemax-stdio-')));
  home = join(root, 'home');
  work = join(root, 'work');
  outside = join(root, 'outside');
  modeFile = join(root, 'upstream-mode');
  pidFile = join(root, 'upstream.pid');
  for (const dir of [join(home, '.claude-deepseek'), work, outside, join(root, 'bin'), join(root, 'proxy', 'node_modules', '.bin')]) {
    mkdirSync(dir, { recursive: true });
  }
  const port = await freePort();
  healthUrl = `http://127.0.0.1:${port}/healthz`;
  const deepseekHome = join(home, '.claude-deepseek');
  writeFileSync(join(deepseekHome, 'env.vars'), `ANTHROPIC_BASE_URL=http://127.0.0.1:${port}\nCLAUDE_CONFIG_DIR=${deepseekHome}\nANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash\n`);
  writeFileSync(join(deepseekHome, 'mcp.json'), '{"mcpServers":{}}\n');
  writeFileSync(join(deepseekHome, 'settings.json'), '{}\n');
  mkdirSync(dirname(keysEnvPath(home)), { recursive: true });
  writeFileSync(keysEnvPath(home), `DEEPSEEK_API_KEY=${FAKE_KEY}\n`);
  writeFileSync(join(root, 'proxy', 'node_modules', '.bin', 'tsx'), `#!/bin/sh\nexec node "${FAKE_UPSTREAM}"\n`, { mode: 0o755 });
  const config = migrateConfig(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'))) as DelegateConfig;
  config.providers.deepseek.repairProxy = { port, logPath: join(root, 'proxy.log'), telemetryPath: join(root, 'telemetry.jsonl') };
  config.proxy = { dir: join(root, 'proxy') };
  config.workerTimeoutMs = 120_000;
  writeFileSync(join(root, 'routing.json'), JSON.stringify(config));
  serverEnv = {
    PATH: `${join(root, 'bin')}:${process.env.PATH}`,
    HOME: home,
    DEEPSEEK_DELEGATE_CONFIG: join(root, 'routing.json'),
    FAKE_UPSTREAM_PORT: String(port),
    FAKE_UPSTREAM_MODE_FILE: modeFile,
    FAKE_UPSTREAM_PID_FILE: pidFile,
    FAKE_UPSTREAM_EXPECTED_AUTH: `Bearer ${FAKE_KEY}`,
  };
});

afterAll(() => {
  if (existsSync(pidFile)) process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGTERM');
});

async function connect(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: join(ROOT, 'node_modules/.bin/tsx'),
    args: [join(ROOT, 'src/server.ts')],
    cwd: work,
    env: serverEnv,
    stderr: 'pipe',
  });
  transport.stderr?.on('data', (chunk) => stderrChunks.push(String(chunk)));
  const client = new Client({ name: 'routemax-integration', version: '0.1.0' });
  await client.connect(transport);
  return client;
}

async function callOn(client: Client, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await client.callTool({ name: 'delegate', arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS });
  const text = (response.content as { type: string; text: string }[])[0].text;
  resultTexts.push(text);
  return JSON.parse(text) as Record<string, unknown>;
}

async function callDelegate(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const client = await connect();
  try {
    return await callOn(client, args);
  } finally {
    await client.close();
  }
}

function nextToolListChange(client: Client): Promise<void> {
  return new Promise((resolve) => client.setNotificationHandler(ToolListChangedNotificationSchema, () => resolve()));
}

async function waitFor(condition: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe('delegate over stdio', () => {
  it('runs a real claude -p worker against the fake upstream and returns summary, changed files and cost', async () => {
    const result = await callDelegate({
      task: `Create the file ${work}/hello.txt and also ${outside}/escape.txt`,
      taskType: 'boilerplate',
      requestedTier: 'flash-low',
    });
    expect(result).toMatchObject({ status: 'done', tier: 'flash-high', changedFiles: [join(work, 'hello.txt')] });
    expect(String(result.summary).length).toBeGreaterThan(0);
    expect(Number(result.costUsd)).toBeGreaterThan(0);
    expect(existsSync(join(work, 'hello.txt'))).toBe(true);
    expect(existsSync(join(outside, 'escape.txt'))).toBe(false);
  }, CALL_TIMEOUT_MS);

  it('leaves the proxy it started running after the MCP server exits', async () => {
    expect(await isProxyHealthy(healthUrl)).toBe(true);
  });

  it('escalates when the upstream is broken', async () => {
    writeFileSync(modeFile, 'broken');
    const result = await callDelegate({ task: 'Summarize the README.', taskType: 'summarize', requestedTier: 'flash-low' });
    expect(result.status).toBe('escalate');
    expect(['exit-code', 'stream-error', 'empty-result']).toContain(result.reason);
  }, CALL_TIMEOUT_MS);

  it('keeps the API key out of the decision log, the server stderr and every result', () => {
    const log = readFileSync(decisionLogPath(home), 'utf8');
    expect(log.trim().split('\n')).toHaveLength(2);
    expect(log).not.toContain(FAKE_KEY);
    expect(stderrChunks.join('')).not.toContain(FAKE_KEY);
    expect(resultTexts.join('')).not.toContain(FAKE_KEY);
  });
});

describe('delegate tool surface', () => {
  it('tells the session when to delegate and keeps the tool out of tool-search deferral', async () => {
    const client = await connect();
    try {
      expect(client.getInstructions()).toMatch(/delegate/);
      const { tools } = await client.listTools();
      const tool = tools.find((candidate) => candidate.name === 'delegate');
      expect(tool?._meta).toMatchObject({ 'anthropic/alwaysLoad': true });
      expect(tool?.inputSchema.required).toEqual(['task', 'taskType']);
      const taskType = (tool?.inputSchema.properties as Record<string, { enum?: string[] }>).taskType;
      expect(taskType.enum).toEqual(expect.arrayContaining(['search', 'boilerplate', 'build', 'security', 'debugging']));
    } finally {
      await client.close();
    }
  });

  it('routes a call without requestedTier and names the Agent call for a Claude task', async () => {
    const result = await callDelegate({ task: 'Review the session cookie flags.', taskType: 'security' });
    expect(result).toMatchObject({ status: 'use_claude', agent: 'claude-opus-xhigh' });
    expect(String(result.next)).toContain('subagent_type "claude-opus-xhigh"');
  });

  it('rejects a task type outside the routing rules', async () => {
    const client = await connect();
    try {
      const response = await client.callTool({ name: 'delegate', arguments: { task: 'Do it.', taskType: 'refactor', requestedTier: 'flash-low' } });
      expect(response.isError).toBe(true);
    } finally {
      await client.close();
    }
  });
});

describe('live config in an open session', () => {
  it('routes the next call with a saved routing change and keeps the config when the file turns invalid', async () => {
    const configPath = serverEnv.DEEPSEEK_DELEGATE_CONFIG;
    const original = readFileSync(configPath, 'utf8');
    const security = { task: 'Review the session cookie flags.', taskType: 'security' };
    const client = await connect();
    try {
      expect(await callOn(client, security)).toMatchObject({ status: 'use_claude', agent: 'claude-opus-xhigh' });
      const changed = JSON.parse(original) as DelegateConfig;
      changed.rules = [{ id: 'refactor-on-claude', taskTypes: ['refactor'], keywords: [], keywordExemptTaskTypes: [], flags: [], tier: 'claude' }, ...changed.rules];
      changed.claude.taskTypes.security = 'claude-sonnet-high';
      const schemaChanged = nextToolListChange(client);
      writeFileSync(configPath, JSON.stringify(changed));
      await schemaChanged;
      expect(await callOn(client, { task: 'Rename a helper.', taskType: 'refactor' })).toMatchObject({ status: 'use_claude', tier: 'claude' });
      expect(await callOn(client, security)).toMatchObject({ agent: 'claude-sonnet-high' });
      writeFileSync(configPath, '{ not json');
      await waitFor(() => stderrChunks.join('').includes('keeping the previous config'));
      expect(await callOn(client, security)).toMatchObject({ agent: 'claude-sonnet-high' });
    } finally {
      writeFileSync(configPath, original);
      await client.close();
    }
  }, 30_000);
});

describe('switch in an open session', () => {
  const toolNames = async (client: Client) => (await client.listTools()).tools.map((tool) => tool.name);

  it('drops delegate while off, answers a stale call with use_claude, and brings it back when on', async () => {
    const switchPath = routerSwitchPath(home);
    mkdirSync(dirname(switchPath), { recursive: true });
    const summarize = { task: 'Summarize the README.', taskType: 'summarize' };
    const client = await connect();
    try {
      const dropped = nextToolListChange(client);
      writeFileSync(switchPath, 'off\n');
      await dropped;
      expect(await toolNames(client)).not.toContain('delegate');
      expect(await callOn(client, summarize)).toMatchObject({ status: 'use_claude', agent: 'claude-opus-high', reason: 'disabled' });
      const startedOff = await connect();
      try {
        expect(await toolNames(startedOff)).not.toContain('delegate');
      } finally {
        await startedOff.close();
      }
      const restored = nextToolListChange(client);
      writeFileSync(switchPath, 'on\n');
      await restored;
      expect(await toolNames(client)).toContain('delegate');
      const security = await callOn(client, { task: 'Review the session cookie flags.', taskType: 'security' });
      expect(security.status).toBe('use_claude');
      expect(security.reason).toBeUndefined();
    } finally {
      writeFileSync(switchPath, 'on\n');
      await client.close();
    }
  }, 30_000);
});
