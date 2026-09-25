import { homedir } from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { EFFORT_ORDER, TIER_ORDER, loadConfig } from './config/delegate-config';
import { delegate } from './delegate/delegate';
import { ensureProxy } from './proxy/ensure-proxy';
import { readApiKey } from './worker/read-api-key';

const config = loadConfig();
const server = new McpServer({ name: 'deepseek-delegate', version: '0.1.0' });

server.registerTool(
  'delegate',
  {
    description:
      'Run a cheap task (search, read, summarize, boilerplate, tests, simple edits, a build with a clear spec) in a DeepSeek worker in the current working directory. ' +
      'Returns status "done" with a short summary, the changed files and the cost; "escalate" with a reason and the changed files when the worker failed (nothing is reverted); ' +
      '"use_claude" with the agent, model and effort to use when the task belongs on Claude; "refused" when the budget or setup blocks the call.',
    inputSchema: {
      task: z.string().min(1).describe('The complete, self-contained task. The worker sees none of this conversation.'),
      taskType: z
        .string()
        .min(1)
        .describe('One of: search, read, summarize, boilerplate, tests, simple-edit, build, architecture, debugging, security, auth, migration, concurrency.'),
      requestedTier: z.enum(TIER_ORDER).describe('The lowest tier to use. Routing only raises it: flash-low < flash-high < pro-high < claude.'),
      claudeEffort: z.enum(EFFORT_ORDER).optional().describe('The effort this task would get on Claude. A higher value raises the worker effort.'),
      flags: z.array(z.string()).default([]).describe('Signals such as irreversible or unknown-cause that keep the task on Claude.'),
    },
  },
  async (input) => {
    const result = await delegate(input, {
      config,
      homeDir: homedir(),
      cwd: process.cwd(),
      env: process.env,
      readApiKey,
      ensureProxy: (healthUrl) => ensureProxy({ dir: config.proxy.dir, logPath: config.proxy.logPath, healthUrl }),
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], isError: result.status === 'refused' };
  },
);

await server.connect(new StdioServerTransport());
