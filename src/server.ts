import { homedir } from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { EFFORT_ORDER, TIER_ORDER, formatIssues, type DelegateConfig } from './config/config-schema';
import { activeConfigPath, loadConfig } from './config/delegate-config';
import { watchConfig } from './config/watch-config';
import { delegate } from './delegate/delegate';
import type { DelegateRequest } from './delegate/delegate-result';
import { ensureProxy } from './proxy/ensure-proxy';
import { isRouterEnabled, watchRouterSwitch } from './router-switch/router-switch';
import { readApiKey } from './worker/read-api-key';

const TOOL_NAME = 'delegate';

const INSTRUCTIONS = [
  'Hand self-contained work to the delegate tool instead of doing it yourself: finding where something is defined or used across files, reading and summarizing files, writing tests or boilerplate, small edits, and builds with a clear spec.',
  'It runs on a cheap DeepSeek model in the current working directory and returns a short summary and the changed files; check those files before you rely on them.',
  'Do the work yourself when it needs this conversation, when one Grep or Read answers it, or when it changes architecture, security, auth, a migration or concurrency, debugs without a known cause or is irreversible (looking up or summarizing those topics is fine to delegate); delegate answers those with use_claude and names the agent to run.',
  'On escalate, read the reason, review the listed changed files (nothing is reverted) and finish the task yourself.',
].join(' ');

function taskTypesOf(current: DelegateConfig): string[] {
  return [...new Set(current.rules.flatMap((rule) => rule.taskTypes))];
}

function delegateInputShape(types: string[]) {
  return {
    task: z.string().min(1).describe('The complete task. The worker sees none of this conversation, so name the files, the goal and what done means.'),
    taskType: z
      .enum(types)
      .describe('The closest kind: search, read and summarize are read-only; boilerplate, tests and simple-edit are small changes; build is a larger change with a clear spec; the rest stays on Claude.'),
    requestedTier: z.enum(TIER_ORDER).default('flash-low').describe('Optional. The lowest tier to use; routing only raises it: flash-low < flash-high < pro-high < claude.'),
    claudeEffort: z.enum(EFFORT_ORDER).optional().describe('Optional. The effort this task would get on Claude; a higher value raises the worker effort.'),
    flags: z.array(z.string()).default([]).describe('Optional. irreversible or unknown-cause keep the task on Claude.'),
  };
}

async function runDelegate(input: DelegateRequest) {
  const result = await delegate(input, { config, homeDir: homedir(), cwd: process.cwd(), env: process.env, readApiKey, ensureProxy });
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], isError: result.status === 'refused' };
}

const configPath = activeConfigPath();
let config = loadConfig(configPath);
let taskTypes = taskTypesOf(config);

const server = new McpServer({ name: 'deepseek-delegate', version: '0.1.0' }, { instructions: INSTRUCTIONS });

const delegateTool = server.registerTool(
  TOOL_NAME,
  {
    description:
      'Run a self-contained task on a cheap DeepSeek worker in the current working directory. ' +
      'Good fits: "list every caller of parseConfig with file:line", "summarize what src/proxy does", "write vitest tests for src/budget/usage-cost.ts", "add a --json flag to the CLI: <spec>". ' +
      'Not for work that needs this conversation, a single quick Grep, or changes to architecture, security, auth, migrations or concurrency and unknown-cause debugging, which come back as use_claude; a search, read or summary about those topics stays on DeepSeek. ' +
      'Returns "done" with a summary, the changed files and the cost; "escalate" with a reason and the changed files, which are kept; "use_claude" with the agent to run through the Agent tool; "refused" when the budget or setup blocks the call.',
    inputSchema: delegateInputShape(taskTypes),
    _meta: { 'anthropic/alwaysLoad': true },
  },
  runDelegate,
);

watchConfig(configPath, (next) => {
  config = next;
  const nextTaskTypes = taskTypesOf(next);
  if (nextTaskTypes.join('\n') === taskTypes.join('\n')) return;
  taskTypes = nextTaskTypes;
  delegateTool.update({ paramsSchema: delegateInputShape(taskTypes) });
});

if (!isRouterEnabled(homedir())) delegateTool.disable();
watchRouterSwitch(homedir(), (enabled) => (enabled ? delegateTool.enable() : delegateTool.disable()));

server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== TOOL_NAME) {
    return { content: [{ type: 'text' as const, text: `Tool ${request.params.name} not found` }], isError: true };
  }
  const parsed = z.object(delegateInputShape(taskTypes)).safeParse(request.params.arguments ?? {});
  if (!parsed.success) return { content: [{ type: 'text' as const, text: formatIssues(parsed.error).join('\n') }], isError: true };
  return runDelegate(parsed.data);
});

await server.connect(new StdioServerTransport());
