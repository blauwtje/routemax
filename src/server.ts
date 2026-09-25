import { homedir } from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { EFFORT_ORDER, TIER_ORDER, loadConfig } from './config/delegate-config';
import { delegate } from './delegate/delegate';
import { ensureProxy } from './proxy/ensure-proxy';
import { readApiKey } from './worker/read-api-key';

const config = loadConfig();
const taskTypes = [...new Set(config.rules.flatMap((rule) => rule.taskTypes))];

const INSTRUCTIONS = [
  'Hand self-contained work to the delegate tool instead of doing it yourself: finding where something is defined or used across files, reading and summarizing files, writing tests or boilerplate, small edits, and builds with a clear spec.',
  'It runs on a cheap DeepSeek model in the current working directory and returns a short summary and the changed files; check those files before you rely on them.',
  'Do the work yourself when it needs this conversation, when one Grep or Read answers it, or when it is architecture, security, auth, a migration, concurrency, debugging without a known cause or irreversible; delegate answers those with use_claude and names the agent to run.',
  'On escalate, read the reason, review the listed changed files (nothing is reverted) and finish the task yourself.',
].join(' ');

const server = new McpServer({ name: 'deepseek-delegate', version: '0.1.0' }, { instructions: INSTRUCTIONS });

server.registerTool(
  'delegate',
  {
    description:
      'Run a self-contained task on a cheap DeepSeek worker in the current working directory. ' +
      'Good fits: "list every caller of parseConfig with file:line", "summarize what src/proxy does", "write vitest tests for src/budget/usage-cost.ts", "add a --json flag to the CLI: <spec>". ' +
      'Not for work that needs this conversation, a single quick Grep, or architecture, security, auth, migration, concurrency and unknown-cause debugging, which come back as use_claude. ' +
      'Returns "done" with a summary, the changed files and the cost; "escalate" with a reason and the changed files, which are kept; "use_claude" with the agent to run through the Agent tool; "refused" when the budget or setup blocks the call.',
    inputSchema: {
      task: z.string().min(1).describe('The complete task. The worker sees none of this conversation, so name the files, the goal and what done means.'),
      taskType: z
        .enum(taskTypes)
        .describe('The closest kind: search, read and summarize are read-only; boilerplate, tests and simple-edit are small changes; build is a larger change with a clear spec; the rest stays on Claude.'),
      requestedTier: z.enum(TIER_ORDER).default('flash-low').describe('Optional. The lowest tier to use; routing only raises it: flash-low < flash-high < pro-high < claude.'),
      claudeEffort: z.enum(EFFORT_ORDER).optional().describe('Optional. The effort this task would get on Claude; a higher value raises the worker effort.'),
      flags: z.array(z.string()).default([]).describe('Optional. irreversible or unknown-cause keep the task on Claude.'),
    },
    _meta: { 'anthropic/alwaysLoad': true },
  },
  async (input) => {
    const result = await delegate(input, {
      config,
      homeDir: homedir(),
      cwd: process.cwd(),
      env: process.env,
      readApiKey,
      ensureProxy: (healthUrl) => ensureProxy({ dir: config.proxy.dir, logPath: config.proxy.logPath, telemetryPath: config.proxy.telemetryPath, healthUrl }),
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], isError: result.status === 'refused' };
  },
);

await server.connect(new StdioServerTransport());
