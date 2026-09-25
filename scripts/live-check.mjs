#!/usr/bin/env node
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

if (!process.argv.includes('--spend')) {
  console.log('live-check spends DeepSeek credit (a few cents). Run it with --spend.');
  process.exit(0);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'routemax-live-'));
writeFileSync(join(work, 'notes.txt'), 'The launch code word is heron.\n');
const brokenConfig = join(work, 'broken-routing.json');
const shipped = JSON.parse(readFileSync(join(root, 'config/routing.json'), 'utf8'));
writeFileSync(brokenConfig, JSON.stringify({ ...shipped, claudeBin: '/usr/bin/false' }));

async function callDelegate(args, configPath) {
  const env = configPath ? { ...process.env, DEEPSEEK_DELEGATE_CONFIG: configPath } : { ...process.env };
  const transport = new StdioClientTransport({ command: join(root, 'node_modules/.bin/tsx'), args: [join(root, 'src/server.ts')], cwd: work, env });
  const client = new Client({ name: 'routemax-live-check', version: '0.1.0' });
  await client.connect(transport);
  try {
    const response = await client.callTool({ name: 'delegate', arguments: args }, undefined, { timeout: 660_000 });
    return JSON.parse(response.content[0].text);
  } finally {
    await client.close();
  }
}

const checks = [
  ['search comes back as flash-low', { task: 'Which code word does notes.txt name? Answer in one line.', taskType: 'search', requestedTier: 'flash-low' }, null, (r) => r.status === 'done' && r.tier === 'flash-low'],
  ['build comes back as flash-high', { task: 'Create greet.mjs exporting a function greet(name) that returns the string "Hello, " followed by name and "!".', taskType: 'boilerplate', requestedTier: 'flash-low' }, null, (r) => r.status === 'done' && r.tier === 'flash-high'],
  ['security comes back as use_claude', { task: 'Review how the session token is stored for vulnerabilities.', taskType: 'security', requestedTier: 'flash-low' }, null, (r) => r.status === 'use_claude'],
  ['a forced-broken worker gives escalate', { task: 'Summarize notes.txt.', taskType: 'summarize', requestedTier: 'flash-low' }, brokenConfig, (r) => r.status === 'escalate'],
];

let totalCostUsd = 0;
let failed = 0;
for (const [name, args, configPath, passes] of checks) {
  const result = await callDelegate(args, configPath);
  totalCostUsd += typeof result.costUsd === 'number' ? result.costUsd : 0;
  const ok = passes(result);
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: status=${result.status} tier=${result.tier ?? '-'} reason=${result.reason ?? '-'}`);
}
console.log(`total cost: $${totalCostUsd.toFixed(4)}`);
process.exitCode = failed ? 1 : 0;
