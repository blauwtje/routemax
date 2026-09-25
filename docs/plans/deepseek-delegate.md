# deepseek-delegate plan

## Goal

A `delegate` MCP tool, registered at user scope as `deepseek-delegate`, runs cheap tasks from the Claude Max session in a headless `claude -p` DeepSeek V4 worker behind the local repair-proxy and returns a short summary, changed files and cost, or returns `use_claude` with an agent, model and effort for hard tasks, as specified in `docs/specs/deepseek-delegate.md`.

## Plan basis

Repository: /Users/thomash/Documents/Code/personal/tools/routemax
Branch: main
Worktree setup: npm ci

- The folder is not a git repository yet: the executor runs `git init -b main` in it before Task 1. It holds only `docs/specs/deepseek-delegate.md` and this plan.
- Verified this session: `claude` 2.1.282 at `/Users/thomash/.local/bin/claude`, node v24.16.0, npm 11.13.0, chezmoi source `/Users/thomash/.local/share/chezmoi`, Keychain item `deepseek_api_key` present (exit 0, value never read).
- npm registry this session: `@modelcontextprotocol/sdk` 1.30.1 (MIT, peer `zod` `^3.25 || ^4.0`), `zod` 4.6.5 (MIT), `tsx` (MIT), `vitest` (MIT), `@types/node` (MIT), `typescript` (Apache-2.0). None needs attribution in the README or in output. The plan pins the repair-proxy's own dev ranges (`typescript ^5.7.2`, `tsx ^4.19.2`, `vitest ^2.1.8`, `@types/node ^22.10.0`) because npm's latest `typescript` is 7.0.2 and `vitest` is 5.0.1, which the proxy does not use.
- SDK import paths `@modelcontextprotocol/sdk/server/mcp.js`, `/server/stdio.js`, `/client/index.js`, `/client/stdio.js` and the `registerTool(name, { description, inputSchema }, callback)` signature were read in the packed 1.30.1 tarball.
- `claude --help` (2.1.282) confirmed these flags: `-p`, `--output-format stream-json`, `--verbose`, `--setting-sources`, `--strict-mcp-config`, `--mcp-config` (file or JSON string), `--no-session-persistence`, `--permission-mode` (choices `acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan`), `--permission-prompts` (`host` or `none`, default `host`; `none` denies whatever would prompt), `--tools`, `--allowedTools`, `--effort` (`low`, `medium`, `high`, `xhigh`, `max`).
- The planning session could not run these; each is proven by the step named: the real stream-json event shape (Task 6 Step 2 records it), whether `acceptEdits` plus `--permission-prompts none` denies a Write outside the working directory (Task 6 Step 2 and Task 15), the MCP server's working directory when Claude Code launches it (Final verification), current DeepSeek prices (Task 2 Step 3), `scripts/live-check.mjs --spend` (Final verification, spends cents) and the `/context` and `/usage` check (Final verification, manual).
- Executor loads the `implementing` skill on this plan before the first task.

## Non-goals

- No proxy, interceptor or code path that touches Anthropic traffic or the OAuth token; no code reads, copies or forwards the OAuth token.
- No patch to the Claude Code binary, no mid-conversation model switch, no routing per turn.
- No new shell alias or function; `deepseek()` in `~/.zshrc` stays unchanged and works again once `~/.claude-deepseek/env.vars` exists.
- No revert of a failed worker's changes and no git worktree for the worker.
- No rerouting of exo agents or of any agent type other than `Explore`.
- No automatic learning of rules from the decision log; `config/routing.json` is edited by hand.
- `/Users/thomash/Documents/Code/personal/tools/deepseek-repair-proxy` stays unchanged, including its 8 uncommitted changes.
- Setup writes nothing under `~/.claude/` itself and writes no `ANTHROPIC_*` variable into any Max-session config. Setup does not run `claude mcp add`; it prints the command for the user.
- No CLAUDE.md or rule text repeats what the Explore hook enforces.

## Context

- **Repair-proxy** (`/Users/thomash/Documents/Code/personal/tools/deepseek-repair-proxy`): `GET /healthz` returns `{ ok: true }` (`src/server.ts:13`), and it listens on `127.0.0.1:8787` (`src/server.ts:17`). It is started with `node_modules/.bin/tsx src/server.ts` in that folder, logging to `/tmp/deepseek-proxy.log`. Its toolchain is ESM (`"type": "module"`), `engines.node >=20.12`, scripts `test: vitest run` and `typecheck: tsc --noEmit`, tests in `test/*.test.ts` with no vitest config, and extensionless relative imports under `moduleResolution: Bundler`. This repository copies that layout and tsconfig.
- **Proxy telemetry**: each line of `~/.local/state/deepseek-proxy/telemetry.jsonl` is a `TelemetryEntry` (`src/telemetry.ts:7-29`) with `ts` (ISO string) and `retries: { reason: string }[]`. The retry count for a worker is the sum of `retries.length` over lines whose `ts` falls between worker start and worker end. The proxy logs no session id, so a concurrent `deepseek()` session in that window counts too.
- **`deepseek()`** (`~/.zshrc:18-103`) reads the key with `security find-generic-password -a "$USER" -s deepseek_api_key -w`, loads `~/.claude-deepseek/env.vars` (non-comment `KEY=value` lines, no shell expansion) and runs `claude --setting-sources user --strict-mcp-config --mcp-config "$HOME/.claude-deepseek/mcp.json"` with `ANTHROPIC_AUTH_TOKEN` set. Its comment says the default effort lives as `effortLevel` in `~/.claude-deepseek/settings.json`. `scripts/regression-check.mjs:45-55` in the proxy parses `env.vars` the same way and requires `CLAUDE_CODE_SUBAGENT_MODEL` in it (line 171). `~/.claude-deepseek/` does not exist on this Mac.
- **User decision this session** (answer 1 to the isolation question): `env.vars` also holds `CLAUDE_CONFIG_DIR=/Users/thomash/.claude-deepseek`, so the worker and `deepseek()` never load the Max `~/.claude/settings.json` with its hooks, plugins and allow rules. Setup also creates a minimal `~/.claude-deepseek/settings.json` (`{"effortLevel": "high"}`) when it is missing and never overwrites it.
- **Claude Code env names** (code.claude.com env-vars page, checked this session): `ANTHROPIC_MODEL` is the main model and `ANTHROPIC_DEFAULT_HAIKU_MODEL` the small/fast model; `ANTHROPIC_SMALL_FAST_MODEL` is marked deprecated. `ANTHROPIC_AUTH_TOKEN` is sent as `Authorization: Bearer`. `CLAUDE_CODE_EFFORT_LEVEL` overrides `--effort` and the settings value. `CLAUDE_CODE_SUBAGENT_MODEL` is not on that page, but the proxy's regression check proves it routes subagents.
- **Worker isolation**: the worker runs with `--permission-mode acceptEdits --permission-prompts none --tools Read,Grep,Glob,Edit,Write` (plus `Bash` and `--allowedTools Bash(<testCommand>)` only when the project has a test command). Read-only tools and edits inside the working directory need no prompt. Anything that would prompt is denied, which covers every path outside the working directory. The prompt goes in on stdin, because `--allowedTools` is variadic and would swallow a trailing positional prompt. `--restricted` is not used because it ignores the user settings source that holds `effortLevel`.
- **Worker env**: the inherited environment is copied without `ANTHROPIC_*`, `CLAUDE_CODE_*`, `CLAUDECODE`, `CLAUDE_CONFIG_DIR` and `DEEPSEEK_DELEGATE_*`, so an inherited Anthropic key never reaches the DeepSeek proxy. Then come `env.vars`, then `ANTHROPIC_MODEL` and `CLAUDE_CODE_SUBAGENT_MODEL` set to the tier model, then `ANTHROPIC_AUTH_TOKEN` from Keychain, then `CLAUDE_CODE_EFFORT_LEVEL` and `DEEPSEEK_DELEGATE_DEPTH=1`.
- **Cost**: `total_cost_usd` in the stream is computed with Claude prices and is ignored. Cost comes from the `usage` of each `assistant` event, deduplicated by `message.id` because one message can arrive as several events, priced with `config.prices`. The final cost is the larger of that sum and the result event's `usage`. The seed prices are DeepSeek's peak rates, so the cap errs high.
- **Changed files** come from `Edit`/`Write` `tool_use` blocks (`input.file_path`) in `assistant` events. A `tool_result` with `is_error: true` removes that write. A write with no result yet (worker killed mid-call) counts as changed.
- **Hook contract** (code.claude.com hooks page, and exo's `plugins/exo/skills/savings/scripts/delegate-budget.mjs:109-110`): PreToolUse stdin carries `tool_name` and `tool_input`. A deny prints `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`. The subagent tool is named `Agent`, with `tool_input.subagent_type`, as in this session's own tool list.
- **Agent frontmatter** (code.claude.com sub-agents page): `name`, `description`, `model` (`opus`, `sonnet`, ...), `effort` (`low` to `max`). `~/.claude/agents/` exists empty and is not managed by chezmoi. `chezmoi source-path ~/.claude` resolves to `/Users/thomash/.local/share/chezmoi/dot_claude`, which has no `agents` folder yet. `dot_claude/modify_private_settings.json` manages `~/.claude/settings.json`. `~/.claude-deepseek/` does not exist; `chezmoi source-path` on a file under it exits 1 with `not managed` (chezmoi v2.71.1).
- **Paths**: all home paths derive from `os.homedir()`, which follows `HOME`, so tests run the server with a temporary `HOME`. Tests replace Keychain with a fake `security` script first on `PATH`, the proxy with a fake `node_modules/.bin/tsx` in a temporary proxy folder, and the worker with `test/fixtures/fake-claude.mjs` (unit level) or a real `claude -p` against `test/fixtures/fake-upstream.mjs` (integration).
- **Budget**: spent-to-date is the sum of `costUsd` over `~/.local/state/deepseek-delegate/decisions.jsonl`. A corrupt line makes the read throw, so a call is refused rather than run on an unknown spend.
- **Shared signatures** (each defined in the named task, used by later ones):
  - Task 2 `src/config/delegate-config.ts`: `TIER_ORDER`, `EFFORT_ORDER`, `type Tier`, `type WorkerTier`, `type Effort`, `type DelegateConfig`, `type ModelPrice`, `DEFAULT_CONFIG_PATH`, `loadConfig(path?)`.
  - Task 2 `src/config/deepseek-home.ts`: `deepseekHomeDir(homeDir)`, `envVarsPath(homeDir)`, `mcpConfigPath(homeDir)`, `settingsPath(homeDir)`.
  - Task 3: `routeTask(rules, request): { tier, raisedBy }`, `resolveEffort(effortMap, tierEffort, claudeEffort?)`.
  - Tasks 4 and 5: `type TokenUsage`, `EMPTY_USAGE`, `addUsage`, `usageCostUsd(price, usage)`, `type DecisionRecord`, `type DecisionBase`, `decisionLogPath(homeDir)`, `appendDecision(path, record)`, `readSpentUsd(path)`, `type DelegateRequest`, `type DelegateResult`, `type DelegateStatus`, `type EscalationReason`.
  - Task 7: `class WorkerStream` with `accept(line)`, `result`, `changedFiles`, `usage`, `costUsd(prices, tierModel)`.
  - Task 8: `parseEnvVars(text)`, `buildWorkerEnv(input)`, `readApiKey()`.
  - Tasks 9 and 10: `workerArgs(mcpConfigPath, testCommand?)`, `runWorker(run): Promise<WorkerOutcome>`, `runTestCommand(command, cwd, timeoutMs)`, `killProcessGroup(pid, signal)`.
  - Tasks 11 and 12: `isProxyHealthy(url)`, `ensureProxy({ dir, logPath, healthUrl })`, `countProxyRetries(path, from, to)`, `freePort()` (test helper).
  - Task 13: `delegate(request, deps): Promise<DelegateResult>`, `type DelegateDeps`.

## Tasks

### Task 1: Scaffold the package

Depends on: none

Files:
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

Step 1: Write the manifest, tsconfig and ignore file, then install
```json
{
  "name": "routemax",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.12" },
  "scripts": {
    "start": "tsx src/server.ts",
    "setup": "tsx src/setup/run-setup.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.30.1",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```
`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "sourceMap": true
  },
  "include": ["src", "test"]
}
```
`.gitignore`:
```
node_modules/
dist/
```
Run: `npm install && npm ls --depth=0 && node -e "for (const p of ['@modelcontextprotocol/sdk','zod','typescript','tsx','vitest','@types/node']) console.log(p, require('./node_modules/'+p+'/package.json').license)"`
Expected: `npm ls` lists the six packages without `ERR!`, and the licenses print `MIT` for all but `typescript`, which prints `Apache-2.0`

Commit:
```bash
git add package.json package-lock.json tsconfig.json .gitignore
git commit -m "chore: scaffold the routemax package" -m "Plan-task: 1"
```

### Task 2: Load config/routing.json and the home paths

Depends on: Task 1

Files:
- Create: `config/routing.json`
- Create: `src/config/delegate-config.ts`
- Create: `src/config/deepseek-home.ts`
- Test: `test/delegate-config.test.ts`

Step 1: Write the shipped routing config and the failing loader test
`config/routing.json`:
```json
{
  "tiers": {
    "flash-low": { "model": "deepseek-v4-flash", "effort": "low" },
    "flash-high": { "model": "deepseek-v4-flash", "effort": "high" },
    "pro-high": { "model": "deepseek-v4-pro", "effort": "high" }
  },
  "rules": [
    { "id": "search-read-summarize", "taskTypes": ["search", "read", "summarize"], "tier": "flash-low" },
    { "id": "boilerplate-tests-edits", "taskTypes": ["boilerplate", "tests", "simple-edit"], "tier": "flash-high" },
    { "id": "build-with-spec", "taskTypes": ["build"], "tier": "pro-high" },
    {
      "id": "claude-only",
      "taskTypes": ["architecture", "debugging", "security", "auth", "migration", "concurrency"],
      "keywords": [
        "architecture", "security", "vulnerability", "vulnerabilities", "auth", "authentication", "authorization",
        "oauth", "credential", "credentials", "secret", "secrets", "migration", "migrations", "migrate",
        "concurrency", "race condition", "deadlock", "irreversible"
      ],
      "flags": ["irreversible", "unknown-cause"],
      "tier": "claude"
    }
  ],
  "effortMap": { "low": "low", "medium": "high", "high": "high", "xhigh": "max", "max": "max" },
  "claude": {
    "defaultAgent": "claude-opus-high",
    "agents": {
      "claude-opus-xhigh": { "model": "opus", "effort": "xhigh" },
      "claude-opus-high": { "model": "opus", "effort": "high" },
      "claude-sonnet-high": { "model": "sonnet", "effort": "high" }
    },
    "taskTypes": {
      "architecture": "claude-opus-xhigh",
      "security": "claude-opus-xhigh",
      "auth": "claude-opus-xhigh",
      "migration": "claude-opus-xhigh",
      "concurrency": "claude-opus-xhigh",
      "debugging": "claude-opus-high"
    }
  },
  "budget": { "totalUsd": 10, "perCallUsd": 0.25 },
  "prices": {
    "deepseek-v4-flash": { "inputUsd": 0.3, "cacheHitUsd": 0.006, "outputUsd": 1.2 },
    "deepseek-v4-pro": { "inputUsd": 1.32, "cacheHitUsd": 0.044, "outputUsd": 3.96 }
  },
  "workerTimeoutMs": 600000,
  "testTimeoutMs": 300000,
  "retryThreshold": null,
  "projects": {},
  "exploreRedirect": false,
  "claudeBin": "claude",
  "proxy": {
    "dir": "/Users/thomash/Documents/Code/personal/tools/deepseek-repair-proxy",
    "logPath": "/tmp/deepseek-proxy.log",
    "telemetryPath": "~/.local/state/deepseek-proxy/telemetry.jsonl"
  }
}
```
`test/delegate-config.test.ts`:
```ts
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';

const shippedJson = () => JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));

function writeConfig(config: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), 'routemax-config-')), 'routing.json');
  writeFileSync(path, JSON.stringify(config));
  return path;
}

describe('loadConfig', () => {
  it('loads the shipped config with its caps and defaults', () => {
    const config = loadConfig(DEFAULT_CONFIG_PATH);
    expect(config.budget).toEqual({ totalUsd: 10, perCallUsd: 0.25 });
    expect(config.retryThreshold).toBeNull();
    expect(config.exploreRedirect).toBe(false);
    expect(config.workerTimeoutMs).toBe(600_000);
    expect(config.testTimeoutMs).toBe(300_000);
    expect(config.proxy.telemetryPath.startsWith('~')).toBe(false);
  });

  it('rejects a rule with an unknown tier', () => {
    const config = shippedJson();
    config.rules[0].tier = 'gpt';
    expect(() => loadConfig(writeConfig(config))).toThrow();
  });

  it('rejects a claude task type that names a missing agent', () => {
    const config = shippedJson();
    config.claude.taskTypes.security = 'claude-missing';
    expect(() => loadConfig(writeConfig(config))).toThrow(/claude-missing/);
  });

  it('rejects a tier model without a price', () => {
    const config = shippedJson();
    delete config.prices['deepseek-v4-pro'];
    expect(() => loadConfig(writeConfig(config))).toThrow(/deepseek-v4-pro/);
  });
});
```
Run: `npx vitest run test/delegate-config.test.ts`
Expected: the file fails with `Failed to resolve import "../src/config/delegate-config"`

Step 2: Write the config loader and the home paths
`src/config/delegate-config.ts`:
```ts
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const TIER_ORDER = ['flash-low', 'flash-high', 'pro-high', 'claude'] as const;
export const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Tier = (typeof TIER_ORDER)[number];
export type WorkerTier = Exclude<Tier, 'claude'>;
export type Effort = (typeof EFFORT_ORDER)[number];

export const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('../../config/routing.json', import.meta.url));

const effortSchema = z.enum(EFFORT_ORDER);
const workerTierSchema = z.object({ model: z.string().min(1), effort: effortSchema });
const priceSchema = z.object({
  inputUsd: z.number().nonnegative(),
  cacheHitUsd: z.number().nonnegative(),
  outputUsd: z.number().nonnegative(),
});
const expandHome = (path: string) => (path.startsWith('~/') ? join(homedir(), path.slice(2)) : path);

const configSchema = z
  .object({
    tiers: z.object({ 'flash-low': workerTierSchema, 'flash-high': workerTierSchema, 'pro-high': workerTierSchema }),
    rules: z.array(
      z.object({
        id: z.string().min(1),
        taskTypes: z.array(z.string()).default([]),
        keywords: z.array(z.string()).default([]),
        flags: z.array(z.string()).default([]),
        tier: z.enum(TIER_ORDER),
      }),
    ),
    effortMap: z.record(effortSchema, effortSchema),
    claude: z.object({
      defaultAgent: z.string().min(1),
      agents: z.record(z.string(), z.object({ model: z.string().min(1), effort: effortSchema })),
      taskTypes: z.record(z.string(), z.string()),
    }),
    budget: z.object({ totalUsd: z.number().positive(), perCallUsd: z.number().positive() }),
    prices: z.record(z.string(), priceSchema),
    workerTimeoutMs: z.number().int().positive(),
    testTimeoutMs: z.number().int().positive(),
    retryThreshold: z.number().int().nonnegative().nullable(),
    projects: z.record(z.string(), z.object({ testCommand: z.string().min(1) })),
    exploreRedirect: z.boolean(),
    claudeBin: z.string().min(1),
    proxy: z.object({
      dir: z.string().min(1),
      logPath: z.string().min(1),
      telemetryPath: z.string().min(1).transform(expandHome),
    }),
  })
  .superRefine((config, context) => {
    for (const name of [config.claude.defaultAgent, ...Object.values(config.claude.taskTypes)]) {
      if (!config.claude.agents[name]) {
        context.addIssue({ code: 'custom', message: `claude agent ${name} is not defined in claude.agents` });
      }
    }
    for (const tier of Object.values(config.tiers)) {
      if (!config.prices[tier.model]) {
        context.addIssue({ code: 'custom', message: `model ${tier.model} has no entry in prices` });
      }
    }
  });

export type DelegateConfig = z.infer<typeof configSchema>;
export type ModelPrice = z.infer<typeof priceSchema>;

export function loadConfig(path = process.env.DEEPSEEK_DELEGATE_CONFIG ?? DEFAULT_CONFIG_PATH): DelegateConfig {
  return configSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}
```
`src/config/deepseek-home.ts`:
```ts
import { join } from 'node:path';

export const deepseekHomeDir = (homeDir: string) => join(homeDir, '.claude-deepseek');
export const envVarsPath = (homeDir: string) => join(deepseekHomeDir(homeDir), 'env.vars');
export const mcpConfigPath = (homeDir: string) => join(deepseekHomeDir(homeDir), 'mcp.json');
export const settingsPath = (homeDir: string) => join(deepseekHomeDir(homeDir), 'settings.json');
```
Run: `npx vitest run test/delegate-config.test.ts && npm run typecheck`
Expected: `4 passed`, then `tsc --noEmit` prints nothing and exits 0

Step 3: Check the seed prices against DeepSeek's current pricing page
Run: `curl -sL https://api-docs.deepseek.com/quick_start/pricing | sed 's/<[^>]*>/ /g' | tr -s ' ' | grep -ioE '(v4|flash|pro|cache|input|output|peak)[^$]{0,80}\$[0-9.]+' | head -40`
Expected: the peak-hour USD per 1M tokens for the V4 flash and pro models match `prices` in `config/routing.json` (flash 0.3 / 0.006 / 1.2, pro 1.32 / 0.044 / 3.96 for cache miss / cache hit / output). If a peak value differs, set that value in `config/routing.json` and rerun `npx vitest run test/delegate-config.test.ts` (`4 passed`). The page may call the flash model `deepseek-flash`. The config keys stay `deepseek-v4-flash` and `deepseek-v4-pro`, the ids the proxy telemetry records.

Commit:
```bash
git add config/routing.json src/config/delegate-config.ts src/config/deepseek-home.ts test/delegate-config.test.ts
git commit -m "feat(config): load config/routing.json" -m "Plan-task: 2"
```

### Task 3: Route a task upward and map the Claude effort

Depends on: Task 2

Files:
- Create: `src/routing/route-task.ts`
- Create: `src/routing/resolve-effort.ts`
- Test: `test/route-task.test.ts`
- Test: `test/resolve-effort.test.ts`

Step 1: Write the failing router and effort tests
`test/route-task.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig, type Tier } from '../src/config/delegate-config';
import { routeTask } from '../src/routing/route-task';

const { rules } = loadConfig(DEFAULT_CONFIG_PATH);
const route = (taskType: string, requestedTier: Tier, task = 'Do the task.', flags: string[] = []) =>
  routeTask(rules, { task, taskType, requestedTier, flags });

describe('routeTask', () => {
  it('keeps search at flash-low without naming a raising rule', () => {
    expect(route('search', 'flash-low')).toEqual({ tier: 'flash-low', raisedBy: null });
  });

  it.each([
    ['boilerplate', 'flash-high', 'boilerplate-tests-edits'],
    ['tests', 'flash-high', 'boilerplate-tests-edits'],
    ['build', 'pro-high', 'build-with-spec'],
    ['security', 'claude', 'claude-only'],
    ['migration', 'claude', 'claude-only'],
  ])('raises %s to %s', (taskType, tier, raisedBy) => {
    expect(route(taskType, 'flash-low')).toEqual({ tier, raisedBy });
  });

  it('raises on a keyword in the task text', () => {
    expect(route('simple-edit', 'flash-low', 'Fix the OAuth callback')).toEqual({ tier: 'claude', raisedBy: 'claude-only' });
  });

  it('matches keywords as whole words only', () => {
    expect(route('simple-edit', 'flash-low', 'Rename the author field')).toEqual({ tier: 'flash-high', raisedBy: 'boilerplate-tests-edits' });
  });

  it('raises on a caller flag', () => {
    expect(route('search', 'flash-low', 'Find old rows', ['irreversible'])).toEqual({ tier: 'claude', raisedBy: 'claude-only' });
  });

  it('never goes below the requested tier', () => {
    expect(route('search', 'pro-high')).toEqual({ tier: 'pro-high', raisedBy: null });
    expect(route('unknown-type', 'flash-high')).toEqual({ tier: 'flash-high', raisedBy: null });
  });
});
```
`test/resolve-effort.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { resolveEffort } from '../src/routing/resolve-effort';

const { effortMap } = loadConfig(DEFAULT_CONFIG_PATH);

describe('resolveEffort', () => {
  it.each([
    ['low', 'low'],
    ['medium', 'high'],
    ['high', 'high'],
    ['xhigh', 'max'],
    ['max', 'max'],
  ] as const)('maps Claude effort %s to %s on a low tier', (claudeEffort, expected) => {
    expect(resolveEffort(effortMap, 'low', claudeEffort)).toBe(expected);
  });

  it('keeps the tier effort when no Claude effort is given', () => {
    expect(resolveEffort(effortMap, 'high')).toBe('high');
  });

  it('never lowers the tier effort', () => {
    expect(resolveEffort(effortMap, 'high', 'low')).toBe('high');
  });
});
```
Run: `npx vitest run test/route-task.test.ts test/resolve-effort.test.ts`
Expected: both files fail with `Failed to resolve import "../src/routing/route-task"` and `"../src/routing/resolve-effort"`

Step 2: Write the router and the effort mapping
`src/routing/route-task.ts`:
```ts
import { TIER_ORDER, type DelegateConfig, type Tier } from '../config/delegate-config';

type RoutingRule = DelegateConfig['rules'][number];

export interface RouteRequest {
  task: string;
  taskType: string;
  requestedTier: Tier;
  flags: string[];
}

export interface RouteDecision {
  tier: Tier;
  raisedBy: string | null;
}

const tierRank = (tier: Tier) => TIER_ORDER.indexOf(tier);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function ruleMatches(rule: RoutingRule, request: RouteRequest): boolean {
  if (rule.taskTypes.includes(request.taskType)) return true;
  if (rule.flags.some((flag) => request.flags.includes(flag))) return true;
  return rule.keywords.some((keyword) => new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(request.task));
}

export function routeTask(rules: RoutingRule[], request: RouteRequest): RouteDecision {
  let decision: RouteDecision = { tier: request.requestedTier, raisedBy: null };
  for (const rule of rules) {
    if (ruleMatches(rule, request) && tierRank(rule.tier) > tierRank(decision.tier)) {
      decision = { tier: rule.tier, raisedBy: rule.id };
    }
  }
  return decision;
}
```
`src/routing/resolve-effort.ts`:
```ts
import { EFFORT_ORDER, type DelegateConfig, type Effort } from '../config/delegate-config';

export function resolveEffort(effortMap: DelegateConfig['effortMap'], tierEffort: Effort, claudeEffort?: Effort): Effort {
  if (!claudeEffort) return tierEffort;
  const mapped = effortMap[claudeEffort];
  return EFFORT_ORDER.indexOf(mapped) > EFFORT_ORDER.indexOf(tierEffort) ? mapped : tierEffort;
}
```
Run: `npx vitest run test/route-task.test.ts test/resolve-effort.test.ts && npm run typecheck`
Expected: `17 passed`, and typecheck exits 0

Commit:
```bash
git add src/routing/route-task.ts src/routing/resolve-effort.ts test/route-task.test.ts test/resolve-effort.test.ts
git commit -m "feat(routing): route tasks upward and map Claude effort" -m "Plan-task: 3"
```

### Task 4: Price token usage

Depends on: Task 2
Risk: money: the per-call and total caps compare against this price

Files:
- Create: `src/budget/usage-cost.ts`
- Test: `test/usage-cost.test.ts`

Step 1: Write the failing cost test
`test/usage-cost.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { addUsage, EMPTY_USAGE, usageCostUsd } from '../src/budget/usage-cost';

const price = { inputUsd: 0.3, cacheHitUsd: 0.03, outputUsd: 1.2 };

describe('usageCostUsd', () => {
  it('prices uncached input, cache hits and output per 1M tokens', () => {
    const usage = { inputTokens: 900_000, cacheCreationTokens: 100_000, cacheReadTokens: 1_000_000, outputTokens: 500_000 };
    expect(usageCostUsd(price, usage)).toBeCloseTo(0.3 + 0.03 + 0.6, 10);
  });

  it('costs nothing for empty usage', () => {
    expect(usageCostUsd(price, EMPTY_USAGE)).toBe(0);
  });

  it('adds usage field by field', () => {
    const one = { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheCreationTokens: 4 };
    expect(addUsage(one, one)).toEqual({ inputTokens: 2, outputTokens: 4, cacheReadTokens: 6, cacheCreationTokens: 8 });
  });
});
```
Run: `npx vitest run test/usage-cost.test.ts`
Expected: the file fails with `Failed to resolve import "../src/budget/usage-cost"`

Step 2: Write the cost functions
`src/budget/usage-cost.ts`:
```ts
import type { ModelPrice } from '../config/delegate-config';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export const EMPTY_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };

const TOKENS_PER_PRICE_UNIT = 1_000_000;

export function addUsage(left: TokenUsage, right: TokenUsage): TokenUsage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheCreationTokens: left.cacheCreationTokens + right.cacheCreationTokens,
  };
}

export function usageCostUsd(price: ModelPrice, usage: TokenUsage): number {
  const uncachedInput = (usage.inputTokens + usage.cacheCreationTokens) * price.inputUsd;
  const cachedInput = usage.cacheReadTokens * price.cacheHitUsd;
  const output = usage.outputTokens * price.outputUsd;
  return (uncachedInput + cachedInput + output) / TOKENS_PER_PRICE_UNIT;
}
```
Run: `npx vitest run test/usage-cost.test.ts && npm run typecheck`
Expected: `3 passed`, and typecheck exits 0

Commit:
```bash
git add src/budget/usage-cost.ts test/usage-cost.test.ts
git commit -m "feat(budget): price token usage" -m "Plan-task: 4"
```

### Task 5: Keep the decision log

Depends on: Task 4
Risk: money: the per-call and total caps read their spend from this log

Files:
- Create: `src/delegate/delegate-result.ts`
- Create: `src/decision-log/decision-log.ts`
- Test: `test/decision-log.test.ts`

Step 1: Write the failing log test
`test/decision-log.test.ts`:
```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appendDecision, decisionLogPath, readSpentUsd, type DecisionRecord } from '../src/decision-log/decision-log';

const record = (costUsd: number): DecisionRecord => ({
  ts: '2026-09-25T10:00:00.000Z',
  cwd: '/work',
  taskType: 'search',
  requestedTier: 'flash-low',
  finalTier: 'flash-low',
  raisedBy: null,
  model: 'deepseek-v4-flash',
  effort: 'low',
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd,
  status: 'done',
  reason: null,
  durationMs: 1200,
  retries: 0,
});
const tempLog = () => join(mkdtempSync(join(tmpdir(), 'routemax-log-')), 'state', 'decisions.jsonl');

describe('decision log', () => {
  it('lives under ~/.local/state/deepseek-delegate', () => {
    expect(decisionLogPath('/home/me')).toBe('/home/me/.local/state/deepseek-delegate/decisions.jsonl');
  });

  it('reads spent-to-date as the sum of costUsd over every logged call', async () => {
    const logPath = tempLog();
    await appendDecision(logPath, record(0.12));
    await appendDecision(logPath, record(0.3));
    expect(await readSpentUsd(logPath)).toBeCloseTo(0.42, 10);
  });

  it('reads zero before the first call', async () => {
    expect(await readSpentUsd(tempLog())).toBe(0);
  });

  it('fails closed on a corrupt line', async () => {
    const logPath = tempLog();
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(logPath, '{"costUsd":0.1}\nnot json\n');
    await expect(readSpentUsd(logPath)).rejects.toThrow();
  });
});
```
Run: `npx vitest run test/decision-log.test.ts`
Expected: the file fails with `Failed to resolve import "../src/decision-log/decision-log"`

Step 2: Write the result types and the log
`src/delegate/delegate-result.ts`:
```ts
import type { Effort, Tier, WorkerTier } from '../config/delegate-config';

export type EscalationReason =
  | 'exit-code'
  | 'stream-error'
  | 'empty-result'
  | 'tests-failed'
  | 'retries'
  | 'budget'
  | 'timeout'
  | 'test-timeout';

export type DelegateStatus = 'done' | 'escalate' | 'use_claude' | 'refused';

export interface DelegateRequest {
  task: string;
  taskType: string;
  requestedTier: Tier;
  claudeEffort?: Effort;
  flags: string[];
}

interface WorkerReport {
  summary: string;
  changedFiles: string[];
  tier: WorkerTier;
  model: string;
  effort: Effort;
  costUsd: number;
}

export type DelegateResult =
  | ({ status: 'done' } & WorkerReport)
  | ({ status: 'escalate'; reason: EscalationReason } & WorkerReport)
  | { status: 'use_claude'; tier: 'claude'; agent: string; model: string; effort: Effort }
  | { status: 'refused'; message: string };
```
`src/decision-log/decision-log.ts`:
```ts
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { TokenUsage } from '../budget/usage-cost';
import type { Effort, Tier } from '../config/delegate-config';
import type { DelegateStatus, EscalationReason } from '../delegate/delegate-result';

export interface DecisionRecord extends TokenUsage {
  ts: string;
  cwd: string;
  taskType: string;
  requestedTier: Tier;
  finalTier: Tier;
  raisedBy: string | null;
  model: string | null;
  effort: Effort | null;
  costUsd: number;
  status: DelegateStatus;
  reason: EscalationReason | null;
  durationMs: number;
  retries: number;
}

export type DecisionBase = Pick<DecisionRecord, 'ts' | 'cwd' | 'taskType' | 'requestedTier' | 'finalTier' | 'raisedBy'>;

export function decisionLogPath(homeDir: string): string {
  return join(homeDir, '.local', 'state', 'deepseek-delegate', 'decisions.jsonl');
}

export async function appendDecision(logPath: string, record: DecisionRecord): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(record)}\n`, 'utf8');
}

export async function readSpentUsd(logPath: string): Promise<number> {
  let text: string;
  try {
    text = await readFile(logPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
  return text
    .split('\n')
    .filter((line) => line.trim())
    .reduce((spent, line) => {
      const { costUsd } = JSON.parse(line) as { costUsd?: unknown };
      return spent + (typeof costUsd === 'number' ? costUsd : 0);
    }, 0);
}
```
Run: `npx vitest run test/usage-cost.test.ts test/decision-log.test.ts && npm run typecheck`
Expected: `7 passed`, and typecheck exits 0

Commit:
```bash
git add src/delegate/delegate-result.ts src/decision-log/decision-log.ts test/decision-log.test.ts
git commit -m "feat(decision-log): keep the decision log" -m "Plan-task: 5"
```

### Task 6: Record a real claude -p stream against a fake upstream

Depends on: Task 1
Risk: the worker's file boundary: the recording proves a Write outside the working directory is denied

Files:
- Create: `test/fixtures/fake-upstream.mjs`
- Create: `scripts/record-stream-sample.sh`
- Create: `test/fixtures/stream-sample.jsonl`

Step 1: Write the fake Anthropic-compatible upstream
`test/fixtures/fake-upstream.mjs`:
```js
#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

const port = Number(process.env.FAKE_UPSTREAM_PORT ?? 18787);
const modeFile = process.env.FAKE_UPSTREAM_MODE_FILE;
const expectedAuth = process.env.FAKE_UPSTREAM_EXPECTED_AUTH;
const usage = { input_tokens: 1000, output_tokens: 1, cache_read_input_tokens: 200, cache_creation_input_tokens: 0 };
let messageCount = 0;

const mode = () => (modeFile && existsSync(modeFile) ? readFileSync(modeFile, 'utf8').trim() : 'ok');

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function sendError(response, status, type, message) {
  sendJson(response, status, { type: 'error', error: { type, message } });
}

function textOf(message) {
  if (typeof message.content === 'string') return message.content;
  return message.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
}

function replyBlocks(request) {
  const last = request.messages.at(-1);
  const hasToolResult = Array.isArray(last.content) && last.content.some((block) => block.type === 'tool_result');
  if (hasToolResult) return [{ type: 'text', text: 'Wrote the requested files.' }];
  const paths = request.tools?.length ? [...new Set(textOf(request.messages[0]).match(/\/[\w./-]+\.txt/g) ?? [])] : [];
  if (!paths.length) return [{ type: 'text', text: 'Nothing to do.' }];
  return paths.map((filePath, index) => ({
    type: 'tool_use',
    id: `toolu_fake_${messageCount}_${index}`,
    name: 'Write',
    input: { file_path: filePath, content: 'hello\n' },
  }));
}

function streamEvents(message) {
  const events = [{ type: 'message_start', message: { ...message, content: [], stop_reason: null } }];
  message.content.forEach((block, index) => {
    if (block.type === 'text') {
      events.push({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
      events.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } });
    } else {
      events.push({ type: 'content_block_start', index, content_block: { ...block, input: {} } });
      events.push({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } });
    }
    events.push({ type: 'content_block_stop', index });
  });
  events.push({ type: 'message_delta', delta: { stop_reason: message.stop_reason, stop_sequence: null }, usage: { output_tokens: 50 } });
  events.push({ type: 'message_stop' });
  return events;
}

function answer(response, request) {
  messageCount += 1;
  const content = replyBlocks(request);
  const message = {
    id: `msg_fake_${messageCount}`,
    type: 'message',
    role: 'assistant',
    model: request.model,
    content,
    stop_reason: content.some((block) => block.type === 'tool_use') ? 'tool_use' : 'end_turn',
    stop_sequence: null,
    usage,
  };
  if (!request.stream) return sendJson(response, 200, message);
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const event of streamEvents(message)) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  response.end();
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (request.method === 'GET' && url.pathname === '/healthz') return sendJson(response, 200, { ok: true });
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => {
    if (expectedAuth && request.headers.authorization !== expectedAuth) {
      return sendError(response, 401, 'authentication_error', 'unexpected credentials');
    }
    if (url.pathname === '/v1/messages/count_tokens') return sendJson(response, 200, { input_tokens: 10 });
    if (url.pathname !== '/v1/messages') return sendError(response, 404, 'not_found_error', url.pathname);
    if (mode() === 'broken') return sendError(response, 400, 'invalid_request_error', 'fake upstream is broken');
    answer(response, JSON.parse(body));
  });
});

server.listen(port, '127.0.0.1', () => {
  if (process.env.FAKE_UPSTREAM_PID_FILE) writeFileSync(process.env.FAKE_UPSTREAM_PID_FILE, String(process.pid));
});
```
Run: `chmod +x test/fixtures/fake-upstream.mjs && (FAKE_UPSTREAM_PORT=18788 node test/fixtures/fake-upstream.mjs & echo $! > /tmp/routemax-fake.pid) && sleep 1 && curl -s http://127.0.0.1:18788/healthz; kill "$(cat /tmp/routemax-fake.pid)"`
Expected: `{"ok":true}`

Step 2: Record a real worker run against the fake upstream
`scripts/record-stream-sample.sh`:
```bash
#!/bin/sh
REC="$(cd "$(mktemp -d)" && pwd -P)" && mkdir -p "$REC/cfg" "$REC/work" "$REC/outside" \
&& (FAKE_UPSTREAM_PORT=18787 node test/fixtures/fake-upstream.mjs & echo $! > "$REC/upstream.pid") \
&& sleep 1 \
&& (cd "$REC/work" && echo "Create the file $REC/work/hello.txt and also $REC/outside/escape.txt" \
  | env -i HOME="$HOME" PATH="$PATH" CLAUDE_CONFIG_DIR="$REC/cfg" ANTHROPIC_BASE_URL=http://127.0.0.1:18787 \
    ANTHROPIC_AUTH_TOKEN=sk-fake-recording ANTHROPIC_MODEL=deepseek-v4-flash ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash \
    claude -p --output-format stream-json --verbose --setting-sources user --strict-mcp-config \
      --mcp-config '{"mcpServers":{}}' --no-session-persistence --permission-mode acceptEdits \
      --permission-prompts none --tools Read,Grep,Glob,Edit,Write) > test/fixtures/stream-sample.jsonl; \
kill "$(cat "$REC/upstream.pid")"; ls "$REC/work" "$REC/outside"; grep -c '"type":"result"' test/fixtures/stream-sample.jsonl; grep -c 'sk-fake-recording' test/fixtures/stream-sample.jsonl
```
Run: `sh scripts/record-stream-sample.sh`
Expected: `$REC/work` lists `hello.txt`, `$REC/outside` is empty, the result count is `1` and the key count is `0`. If `escape.txt` exists, stop: the worker's directory boundary does not hold, and the plan's isolation premise needs repair before Task 9.

Commit:
```bash
git add test/fixtures/fake-upstream.mjs scripts/record-stream-sample.sh test/fixtures/stream-sample.jsonl
git commit -m "test(worker): record a real claude -p stream against a fake upstream" -m "Plan-task: 6"
```

### Task 7: Parse the claude -p stream

Depends on: Task 4, Task 6

Files:
- Create: `src/worker/stream-state.ts`
- Test: `test/stream-state.test.ts`

Step 1: Write the failing parser test
`test/stream-state.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WorkerStream } from '../src/worker/stream-state';

const PRICES = { 'deepseek-v4-flash': { inputUsd: 0.3, cacheHitUsd: 0.03, outputUsd: 1.2 } };
const sample = readFileSync(new URL('./fixtures/stream-sample.jsonl', import.meta.url), 'utf8');

const usage = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const assistant = (id: string, content: unknown[]) =>
  JSON.stringify({ type: 'assistant', message: { id, model: 'deepseek-v4-flash', content, usage } });
const toolUse = (id: string, name: string, filePath: string) => ({ type: 'tool_use', id, name, input: { file_path: filePath } });
const toolResult = (toolUseId: string, isError: boolean) =>
  JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, is_error: isError }] } });

function parse(lines: string[]): WorkerStream {
  const stream = new WorkerStream();
  for (const line of lines) stream.accept(line);
  return stream;
}

describe('WorkerStream', () => {
  it('reads the recorded claude -p run: result, usage and only the write that landed', () => {
    const stream = parse(sample.split('\n'));
    expect(stream.result).toMatchObject({ isError: false, subtype: 'success', text: 'Wrote the requested files.' });
    expect(stream.changedFiles).toHaveLength(1);
    expect(stream.changedFiles[0]).toMatch(/\/work\/hello\.txt$/);
    expect(stream.usage.inputTokens).toBeGreaterThan(0);
    expect(stream.costUsd(PRICES, 'deepseek-v4-flash')).toBeGreaterThan(0);
  });

  it('drops a denied write, ignores reads and keeps a write that never got a result', () => {
    const stream = parse([
      assistant('msg_1', [
        toolUse('t1', 'Write', '/w/a.txt'),
        toolUse('t2', 'Edit', '/w/b.txt'),
        toolUse('t3', 'Read', '/w/c.txt'),
        toolUse('t4', 'Write', '/w/d.txt'),
      ]),
      toolResult('t1', false),
      toolResult('t2', true),
    ]);
    expect(stream.changedFiles).toEqual(['/w/a.txt', '/w/d.txt']);
  });

  it('counts a message that arrives in several events once', () => {
    const stream = parse([assistant('msg_1', [{ type: 'text', text: 'a' }]), assistant('msg_1', [{ type: 'text', text: 'b' }])]);
    expect(stream.usage.inputTokens).toBe(1000);
    expect(stream.costUsd(PRICES, 'deepseek-v4-flash')).toBeCloseTo((1000 * 0.3 + 100 * 1.2) / 1_000_000, 12);
  });

  it('marks an error result and skips lines that are not JSON', () => {
    const stream = parse(['warning: not json', JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true })]);
    expect(stream.result).toEqual({ isError: true, subtype: 'error_during_execution', text: '', usage: null });
  });
});
```
Run: `npx vitest run test/stream-state.test.ts`
Expected: the file fails with `Failed to resolve import "../src/worker/stream-state"`

Step 2: Write the stream parser
`src/worker/stream-state.ts`:
```ts
import { addUsage, EMPTY_USAGE, usageCostUsd, type TokenUsage } from '../budget/usage-cost';
import type { ModelPrice } from '../config/delegate-config';

interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface ContentBlock {
  type?: string;
  id?: string;
  name?: string;
  input?: { file_path?: unknown };
  tool_use_id?: string;
  is_error?: boolean;
}

interface StreamEvent {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: unknown;
  usage?: RawUsage;
  message?: { id?: string; model?: string; usage?: RawUsage; content?: unknown };
}

export interface WorkerResult {
  isError: boolean;
  subtype: string;
  text: string;
  usage: TokenUsage | null;
}

const FILE_WRITING_TOOLS = new Set(['Edit', 'Write']);

function toUsage(raw: RawUsage): TokenUsage {
  return {
    inputTokens: raw.input_tokens ?? 0,
    outputTokens: raw.output_tokens ?? 0,
    cacheReadTokens: raw.cache_read_input_tokens ?? 0,
    cacheCreationTokens: raw.cache_creation_input_tokens ?? 0,
  };
}

function contentBlocks(event: StreamEvent): ContentBlock[] {
  const content = event.message?.content;
  return Array.isArray(content) ? (content as ContentBlock[]) : [];
}

function parseEvent(line: string): StreamEvent | null {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line) as StreamEvent;
  } catch {
    // claude can print non-JSON diagnostics on stdout; only JSON events count.
    return null;
  }
}

export class WorkerStream {
  result: WorkerResult | null = null;
  private readonly usageByMessage = new Map<string, { model: string; usage: TokenUsage }>();
  private readonly pendingWrites = new Map<string, string>();
  private readonly confirmedWrites = new Set<string>();

  accept(line: string): void {
    const event = parseEvent(line);
    if (event?.type === 'assistant') this.acceptAssistant(event);
    if (event?.type === 'user') this.acceptToolResults(event);
    if (event?.type === 'result') {
      this.result = {
        isError: event.is_error === true || event.subtype !== 'success',
        subtype: event.subtype ?? 'unknown',
        text: typeof event.result === 'string' ? event.result : '',
        usage: event.usage ? toUsage(event.usage) : null,
      };
    }
  }

  get changedFiles(): string[] {
    return [...new Set([...this.confirmedWrites, ...this.pendingWrites.values()])].sort();
  }

  get usage(): TokenUsage {
    const streamed = [...this.usageByMessage.values()].reduce((sum, entry) => addUsage(sum, entry.usage), EMPTY_USAGE);
    return this.result?.usage ?? streamed;
  }

  costUsd(prices: Record<string, ModelPrice>, tierModel: string): number {
    const tierPrice = prices[tierModel];
    const streamed = [...this.usageByMessage.values()].reduce(
      (sum, entry) => sum + usageCostUsd(prices[entry.model] ?? tierPrice, entry.usage),
      0,
    );
    const reported = this.result?.usage ? usageCostUsd(tierPrice, this.result.usage) : 0;
    return Math.max(streamed, reported);
  }

  private acceptAssistant(event: StreamEvent): void {
    const message = event.message;
    if (message?.id && message.usage) {
      this.usageByMessage.set(message.id, { model: message.model ?? '', usage: toUsage(message.usage) });
    }
    for (const block of contentBlocks(event)) {
      const filePath = block.input?.file_path;
      if (block.type === 'tool_use' && block.id && FILE_WRITING_TOOLS.has(block.name ?? '') && typeof filePath === 'string') {
        this.pendingWrites.set(block.id, filePath);
      }
    }
  }

  private acceptToolResults(event: StreamEvent): void {
    for (const block of contentBlocks(event)) {
      if (block.type !== 'tool_result' || !block.tool_use_id) continue;
      const filePath = this.pendingWrites.get(block.tool_use_id);
      if (filePath === undefined) continue;
      this.pendingWrites.delete(block.tool_use_id);
      if (block.is_error !== true) this.confirmedWrites.add(filePath);
    }
  }
}
```
Run: `npx vitest run test/stream-state.test.ts && npm run typecheck`
Expected: `4 passed`, and typecheck exits 0

Commit:
```bash
git add src/worker/stream-state.ts test/stream-state.test.ts
git commit -m "feat(worker): parse the claude -p stream for result, usage and changed files" -m "Plan-task: 7"
```

### Task 8: Build the worker environment and read the key from Keychain

Depends on: Task 2
Risk: secrets: the DeepSeek key enters the worker env, and an inherited Anthropic key must not reach the proxy

Files:
- Create: `src/worker/worker-env.ts`
- Create: `src/worker/read-api-key.ts`
- Test: `test/worker-env.test.ts`
- Test: `test/read-api-key.test.ts`

Step 1: Write the failing env and Keychain tests
`test/worker-env.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildWorkerEnv, parseEnvVars } from '../src/worker/worker-env';

describe('parseEnvVars', () => {
  it('reads KEY=value lines and skips comments and blanks', () => {
    expect(parseEnvVars('# comment\n\nANTHROPIC_BASE_URL=http://127.0.0.1:8787\nA=b=c\n')).toEqual({
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:8787',
      A: 'b=c',
    });
  });
});

describe('buildWorkerEnv', () => {
  const env = buildWorkerEnv({
    inherited: {
      PATH: '/usr/bin',
      ANTHROPIC_API_KEY: 'sk-ant-inherited',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      CLAUDECODE: '1',
      CLAUDE_CODE_ENTRYPOINT: 'cli',
      CLAUDE_CONFIG_DIR: '/Users/me/.claude',
      DEEPSEEK_DELEGATE_DEPTH: '0',
    },
    envVars: { ANTHROPIC_BASE_URL: 'http://127.0.0.1:8787', ANTHROPIC_MODEL: 'deepseek-v4-pro', CLAUDE_CONFIG_DIR: '/Users/me/.claude-deepseek' },
    model: 'deepseek-v4-flash',
    apiKey: 'sk-fake-key',
    effort: 'high',
  });

  it('drops inherited Anthropic, Claude Code and delegate variables', () => {
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
    expect(env.PATH).toBe('/usr/bin');
  });

  it('layers env.vars, then the tier model, key, effort and depth', () => {
    expect(env).toMatchObject({
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:8787',
      CLAUDE_CONFIG_DIR: '/Users/me/.claude-deepseek',
      ANTHROPIC_MODEL: 'deepseek-v4-flash',
      CLAUDE_CODE_SUBAGENT_MODEL: 'deepseek-v4-flash',
      ANTHROPIC_AUTH_TOKEN: 'sk-fake-key',
      CLAUDE_CODE_EFFORT_LEVEL: 'high',
      DEEPSEEK_DELEGATE_DEPTH: '1',
    });
  });
});
```
`test/read-api-key.test.ts`:
```ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readApiKey } from '../src/worker/read-api-key';

const binDir = mkdtempSync(join(tmpdir(), 'routemax-security-'));
const originalPath = process.env.PATH;
const fakeSecurity = (body: string) => writeFileSync(join(binDir, 'security'), `#!/bin/sh\n${body}\n`, { mode: 0o755 });

beforeEach(() => {
  process.env.PATH = `${binDir}:${originalPath}`;
});
afterEach(() => {
  process.env.PATH = originalPath;
});

describe('readApiKey', () => {
  it('returns the password of Keychain service deepseek_api_key', async () => {
    fakeSecurity('[ "$1" = find-generic-password ] && [ "$4" = -s ] && [ "$5" = deepseek_api_key ] && [ "$6" = -w ] || exit 2\necho sk-fake-keychain');
    await expect(readApiKey()).resolves.toBe('sk-fake-keychain');
  });

  it('fails closed with a message that holds no secret when the item is missing', async () => {
    fakeSecurity('echo sk-fake-partial >&2\nexit 44');
    const error = await readApiKey().catch((caught: Error) => caught);
    expect(String(error)).toContain('DeepSeek API key not found in Keychain (service deepseek_api_key).');
    expect(String(error)).not.toContain('sk-fake-partial');
  });
});
```
Run: `npx vitest run test/worker-env.test.ts test/read-api-key.test.ts`
Expected: both files fail with `Failed to resolve import "../src/worker/worker-env"` and `"../src/worker/read-api-key"`

Step 2: Write the env builder and the Keychain reader
`src/worker/worker-env.ts`:
```ts
import type { Effort } from '../config/delegate-config';

const NOT_INHERITED = /^(ANTHROPIC_|CLAUDE_CODE_|CLAUDECODE$|CLAUDE_CONFIG_DIR$|DEEPSEEK_DELEGATE_)/;

export interface WorkerEnvInput {
  inherited: NodeJS.ProcessEnv;
  envVars: Record<string, string>;
  model: string;
  apiKey: string;
  effort: Effort;
}

export function parseEnvVars(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

export function buildWorkerEnv(input: WorkerEnvInput): Record<string, string> {
  const inherited = Object.entries(input.inherited).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !NOT_INHERITED.test(entry[0]),
  );
  return {
    ...Object.fromEntries(inherited),
    ...input.envVars,
    ANTHROPIC_MODEL: input.model,
    CLAUDE_CODE_SUBAGENT_MODEL: input.model,
    ANTHROPIC_AUTH_TOKEN: input.apiKey,
    CLAUDE_CODE_EFFORT_LEVEL: input.effort,
    DEEPSEEK_DELEGATE_DEPTH: '1',
  };
}
```
`src/worker/read-api-key.ts`:
```ts
import { execFile } from 'node:child_process';
import { userInfo } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE = 'deepseek_api_key';
const MISSING_KEY = `DeepSeek API key not found in Keychain (service ${KEYCHAIN_SERVICE}).`;

export async function readApiKey(): Promise<string> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('security', ['find-generic-password', '-a', userInfo().username, '-s', KEYCHAIN_SERVICE, '-w']));
  } catch {
    throw new Error(MISSING_KEY);
  }
  const key = stdout.trim();
  if (!key) throw new Error(MISSING_KEY);
  return key;
}
```
Run: `npx vitest run test/worker-env.test.ts test/read-api-key.test.ts && npm run typecheck`
Expected: `5 passed`, and typecheck exits 0

Commit:
```bash
git add src/worker/worker-env.ts src/worker/read-api-key.ts test/worker-env.test.ts test/read-api-key.test.ts
git commit -m "feat(worker): build the worker env and read the key from Keychain" -m "Plan-task: 8"
```

### Task 9: Run the worker with its budget and timeout stops

Depends on: Task 7
Risk: money and process execution: the per-call cap and the timeouts stop the worker's whole process group

Files:
- Create: `test/fixtures/fake-claude.mjs`
- Create: `src/worker/kill-process-group.ts`
- Create: `src/worker/run-worker.ts`
- Test: `test/run-worker.test.ts`

Step 1: Write the fake claude binary
`test/fixtures/fake-claude.mjs`:
```js
#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const env = process.env;
const scenario = env.FAKE_CLAUDE_SCENARIO ?? 'success';

if (env.FAKE_CLAUDE_RECORD) {
  writeFileSync(
    env.FAKE_CLAUDE_RECORD,
    JSON.stringify({
      args: process.argv.slice(2),
      cwd: process.cwd(),
      depth: env.DEEPSEEK_DELEGATE_DEPTH,
      model: env.ANTHROPIC_MODEL,
      subagentModel: env.CLAUDE_CODE_SUBAGENT_MODEL,
      effort: env.CLAUDE_CODE_EFFORT_LEVEL,
      hasAuthToken: Boolean(env.ANTHROPIC_AUTH_TOKEN),
      hasApiKey: 'ANTHROPIC_API_KEY' in env,
    }),
  );
}
if (env.FAKE_CLAUDE_RETRIES && env.FAKE_CLAUDE_TELEMETRY) {
  const retries = Array.from({ length: Number(env.FAKE_CLAUDE_RETRIES) }, () => ({ reason: 'empty-completion' }));
  appendFileSync(env.FAKE_CLAUDE_TELEMETRY, `${JSON.stringify({ ts: new Date().toISOString(), retries })}\n`);
}

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
const usage = (input, output) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
const assistant = (id, content, input = 100, output = 10) =>
  emit({ type: 'assistant', message: { id, model: env.ANTHROPIC_MODEL, content, usage: usage(input, output) } });
const result = (fields = {}) =>
  emit({ type: 'result', subtype: 'success', is_error: false, result: 'Did the thing.', usage: usage(200, 20), ...fields });

emit({ type: 'system', subtype: 'init' });
switch (scenario) {
  case 'success':
    assistant('msg_1', [{ type: 'tool_use', id: 'toolu_1', name: 'Write', input: { file_path: join(process.cwd(), 'a.txt'), content: 'a\n' } }]);
    emit({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }] } });
    assistant('msg_2', [{ type: 'text', text: 'Did the thing.' }]);
    result();
    break;
  case 'exit-code':
    result();
    process.exitCode = 3;
    break;
  case 'stream-error':
    result({ subtype: 'error_during_execution', is_error: true, result: undefined });
    break;
  case 'empty-result':
    result({ result: '' });
    break;
  case 'expensive': {
    let count = 0;
    setInterval(() => assistant(`msg_${count++}`, [{ type: 'text', text: '.' }], 200_000, 0), 50);
    break;
  }
  case 'hang':
    setInterval(() => {}, 1_000);
    break;
  default:
    process.exitCode = 64;
}
```
Run: `chmod +x test/fixtures/fake-claude.mjs && FAKE_CLAUDE_SCENARIO=success test/fixtures/fake-claude.mjs | tail -1`
Expected: one line starting `{"type":"result","subtype":"success"`

Step 2: Write the failing worker tests
`test/run-worker.test.ts`:
```ts
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runWorker, workerArgs, type WorkerRun } from '../src/worker/run-worker';

const FAKE_CLAUDE = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));
const PRICES = { 'deepseek-v4-flash': { inputUsd: 0.3, cacheHitUsd: 0.03, outputUsd: 1.2 } };

async function run(scenario: string, overrides: Partial<WorkerRun> = {}) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'routemax-worker-')));
  const outcome = await runWorker({
    claudeBin: FAKE_CLAUDE,
    args: [],
    cwd,
    env: { PATH: process.env.PATH ?? '', FAKE_CLAUDE_SCENARIO: scenario, ANTHROPIC_MODEL: 'deepseek-v4-flash' },
    prompt: 'Do the task.',
    timeoutMs: 10_000,
    costLimitUsd: 0.25,
    costOf: (stream) => stream.costUsd(PRICES, 'deepseek-v4-flash'),
    ...overrides,
  });
  return { outcome, cwd };
}

describe('workerArgs', () => {
  it('uses the isolation flags, never skips permissions, and allows Bash only for the test command', () => {
    const plain = workerArgs('/h/.claude-deepseek/mcp.json', undefined);
    expect(plain).toEqual(expect.arrayContaining(['-p', '--verbose', '--strict-mcp-config', '--no-session-persistence']));
    expect(plain.slice(plain.indexOf('--output-format'), plain.indexOf('--output-format') + 2)).toEqual(['--output-format', 'stream-json']);
    expect(plain.slice(plain.indexOf('--setting-sources'), plain.indexOf('--setting-sources') + 2)).toEqual(['--setting-sources', 'user']);
    expect(plain.slice(plain.indexOf('--mcp-config'), plain.indexOf('--mcp-config') + 2)).toEqual(['--mcp-config', '/h/.claude-deepseek/mcp.json']);
    expect(plain.slice(plain.indexOf('--permission-mode'), plain.indexOf('--permission-mode') + 2)).toEqual(['--permission-mode', 'acceptEdits']);
    expect(plain.slice(plain.indexOf('--permission-prompts'), plain.indexOf('--permission-prompts') + 2)).toEqual(['--permission-prompts', 'none']);
    expect(plain.slice(plain.indexOf('--tools'), plain.indexOf('--tools') + 2)).toEqual(['--tools', 'Read,Grep,Glob,Edit,Write']);
    expect(plain).not.toContain('--allowedTools');
    expect(plain).not.toContain('--dangerously-skip-permissions');
    const withTests = workerArgs('/m.json', 'npm test');
    expect(withTests.slice(withTests.indexOf('--tools'), withTests.indexOf('--tools') + 2)).toEqual(['--tools', 'Read,Grep,Glob,Edit,Write,Bash']);
    expect(withTests.slice(-2)).toEqual(['--allowedTools', 'Bash(npm test)']);
  });
});

describe('runWorker', () => {
  it('collects the stream of a finished worker', async () => {
    const { outcome, cwd } = await run('success');
    expect(outcome).toMatchObject({ exitCode: 0, stoppedBy: null });
    expect(outcome.stream.result?.text).toBe('Did the thing.');
    expect(outcome.stream.changedFiles).toEqual([join(cwd, 'a.txt')]);
  });

  it('reports a non-zero exit', async () => {
    expect((await run('exit-code')).outcome.exitCode).toBe(3);
  });

  it('stops a worker that passes the per-call cost limit', async () => {
    const { outcome } = await run('expensive');
    expect(outcome.stoppedBy).toBe('budget');
    expect(outcome.stream.costUsd(PRICES, 'deepseek-v4-flash')).toBeGreaterThan(0.25);
  });

  it('stops a worker that runs past its timeout', async () => {
    const started = Date.now();
    const { outcome } = await run('hang', { timeoutMs: 300 });
    expect(outcome.stoppedBy).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
```
Run: `npx vitest run test/run-worker.test.ts`
Expected: the file fails with `Failed to resolve import "../src/worker/run-worker"`

Step 3: Write the process-group kill and the worker runner
`src/worker/kill-process-group.ts`:
```ts
export function killProcessGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}
```
`src/worker/run-worker.ts`:
```ts
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { killProcessGroup } from './kill-process-group';
import { WorkerStream } from './stream-state';

export interface WorkerRun {
  claudeBin: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  prompt: string;
  timeoutMs: number;
  costLimitUsd: number;
  costOf: (stream: WorkerStream) => number;
}

export type WorkerStop = 'budget' | 'timeout';

export interface WorkerOutcome {
  exitCode: number | null;
  stoppedBy: WorkerStop | null;
  stream: WorkerStream;
  startedAt: Date;
  endedAt: Date;
}

const KILL_GRACE_MS = 5_000;
const WORKER_TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write'];

export function workerArgs(mcpConfigPath: string, testCommand: string | undefined): string[] {
  const tools = testCommand ? [...WORKER_TOOLS, 'Bash'] : WORKER_TOOLS;
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--setting-sources', 'user',
    '--strict-mcp-config',
    '--mcp-config', mcpConfigPath,
    '--no-session-persistence',
    '--permission-mode', 'acceptEdits',
    '--permission-prompts', 'none',
    '--tools', tools.join(','),
  ];
  return testCommand ? [...args, '--allowedTools', `Bash(${testCommand})`] : args;
}

export function runWorker(run: WorkerRun): Promise<WorkerOutcome> {
  const stream = new WorkerStream();
  const startedAt = new Date();
  const child = spawn(run.claudeBin, run.args, { cwd: run.cwd, env: run.env, stdio: ['pipe', 'pipe', 'ignore'], detached: true });
  let stoppedBy: WorkerStop | null = null;
  const stop = (reason: WorkerStop) => {
    if (stoppedBy) return;
    stoppedBy = reason;
    killProcessGroup(child.pid, 'SIGTERM');
    setTimeout(() => killProcessGroup(child.pid, 'SIGKILL'), KILL_GRACE_MS).unref();
  };
  const timer = setTimeout(() => stop('timeout'), run.timeoutMs);
  createInterface({ input: child.stdout }).on('line', (line) => {
    stream.accept(line);
    if (run.costOf(stream) > run.costLimitUsd) stop('budget');
  });
  // EPIPE when the worker exits before reading its prompt; the exit code reports that failure.
  child.stdin.on('error', () => {});
  child.stdin.end(run.prompt);
  return new Promise((resolve) => {
    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      resolve({ exitCode, stoppedBy, stream, startedAt, endedAt: new Date() });
    };
    child.once('error', () => finish(null));
    child.once('close', (exitCode) => finish(exitCode));
  });
}
```
Run: `npx vitest run test/run-worker.test.ts && npm run typecheck`
Expected: `5 passed`, and typecheck exits 0

Commit:
```bash
git add test/fixtures/fake-claude.mjs src/worker/kill-process-group.ts src/worker/run-worker.ts test/run-worker.test.ts
git commit -m "feat(worker): run the worker with budget and timeout stops" -m "Plan-task: 9"
```

### Task 10: Run the test command with a timeout

Depends on: Task 9
Risk: process execution: the timeout stops the test command's whole process group

Files:
- Create: `src/worker/run-test-command.ts`
- Modify: `test/run-worker.test.ts`

Step 1: Add the failing test-command tests
`test/run-worker.test.ts`:
```ts
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runTestCommand } from '../src/worker/run-test-command';
import { runWorker, workerArgs, type WorkerRun } from '../src/worker/run-worker';

const FAKE_CLAUDE = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));
const PRICES = { 'deepseek-v4-flash': { inputUsd: 0.3, cacheHitUsd: 0.03, outputUsd: 1.2 } };

async function run(scenario: string, overrides: Partial<WorkerRun> = {}) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'routemax-worker-')));
  const outcome = await runWorker({
    claudeBin: FAKE_CLAUDE,
    args: [],
    cwd,
    env: { PATH: process.env.PATH ?? '', FAKE_CLAUDE_SCENARIO: scenario, ANTHROPIC_MODEL: 'deepseek-v4-flash' },
    prompt: 'Do the task.',
    timeoutMs: 10_000,
    costLimitUsd: 0.25,
    costOf: (stream) => stream.costUsd(PRICES, 'deepseek-v4-flash'),
    ...overrides,
  });
  return { outcome, cwd };
}

describe('workerArgs', () => {
  it('uses the isolation flags, never skips permissions, and allows Bash only for the test command', () => {
    const plain = workerArgs('/h/.claude-deepseek/mcp.json', undefined);
    expect(plain).toEqual(expect.arrayContaining(['-p', '--verbose', '--strict-mcp-config', '--no-session-persistence']));
    expect(plain.slice(plain.indexOf('--output-format'), plain.indexOf('--output-format') + 2)).toEqual(['--output-format', 'stream-json']);
    expect(plain.slice(plain.indexOf('--setting-sources'), plain.indexOf('--setting-sources') + 2)).toEqual(['--setting-sources', 'user']);
    expect(plain.slice(plain.indexOf('--mcp-config'), plain.indexOf('--mcp-config') + 2)).toEqual(['--mcp-config', '/h/.claude-deepseek/mcp.json']);
    expect(plain.slice(plain.indexOf('--permission-mode'), plain.indexOf('--permission-mode') + 2)).toEqual(['--permission-mode', 'acceptEdits']);
    expect(plain.slice(plain.indexOf('--permission-prompts'), plain.indexOf('--permission-prompts') + 2)).toEqual(['--permission-prompts', 'none']);
    expect(plain.slice(plain.indexOf('--tools'), plain.indexOf('--tools') + 2)).toEqual(['--tools', 'Read,Grep,Glob,Edit,Write']);
    expect(plain).not.toContain('--allowedTools');
    expect(plain).not.toContain('--dangerously-skip-permissions');
    const withTests = workerArgs('/m.json', 'npm test');
    expect(withTests.slice(withTests.indexOf('--tools'), withTests.indexOf('--tools') + 2)).toEqual(['--tools', 'Read,Grep,Glob,Edit,Write,Bash']);
    expect(withTests.slice(-2)).toEqual(['--allowedTools', 'Bash(npm test)']);
  });
});

describe('runWorker', () => {
  it('collects the stream of a finished worker', async () => {
    const { outcome, cwd } = await run('success');
    expect(outcome).toMatchObject({ exitCode: 0, stoppedBy: null });
    expect(outcome.stream.result?.text).toBe('Did the thing.');
    expect(outcome.stream.changedFiles).toEqual([join(cwd, 'a.txt')]);
  });

  it('reports a non-zero exit', async () => {
    expect((await run('exit-code')).outcome.exitCode).toBe(3);
  });

  it('stops a worker that passes the per-call cost limit', async () => {
    const { outcome } = await run('expensive');
    expect(outcome.stoppedBy).toBe('budget');
    expect(outcome.stream.costUsd(PRICES, 'deepseek-v4-flash')).toBeGreaterThan(0.25);
  });

  it('stops a worker that runs past its timeout', async () => {
    const started = Date.now();
    const { outcome } = await run('hang', { timeoutMs: 300 });
    expect(outcome.stoppedBy).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});

describe('runTestCommand', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'routemax-tests-'));

  it('passes on exit 0 and fails otherwise', async () => {
    expect(await runTestCommand('exit 0', cwd, 5_000)).toBe('passed');
    expect(await runTestCommand('exit 1', cwd, 5_000)).toBe('failed');
  });

  it('stops a test command that runs past its timeout', async () => {
    const started = Date.now();
    expect(await runTestCommand('sleep 30', cwd, 200)).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
```
Run: `npx vitest run test/run-worker.test.ts`
Expected: the file fails with `Failed to resolve import "../src/worker/run-test-command"`

Step 2: Write the test-command runner
`src/worker/run-test-command.ts`:
```ts
import { spawn } from 'node:child_process';
import { killProcessGroup } from './kill-process-group';

export type TestOutcome = 'passed' | 'failed' | 'timeout';

export function runTestCommand(command: string, cwd: string, timeoutMs: number): Promise<TestOutcome> {
  const child = spawn('/bin/sh', ['-c', command], { cwd, stdio: 'ignore', detached: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killProcessGroup(child.pid, 'SIGKILL');
  }, timeoutMs);
  return new Promise((resolve) => {
    const finish = (outcome: TestOutcome) => {
      clearTimeout(timer);
      resolve(outcome);
    };
    child.once('error', () => finish('failed'));
    child.once('close', (exitCode) => {
      if (timedOut) finish('timeout');
      else finish(exitCode === 0 ? 'passed' : 'failed');
    });
  });
}
```
Run: `npx vitest run test/run-worker.test.ts && npm run typecheck`
Expected: `7 passed`, and typecheck exits 0

Commit:
```bash
git add src/worker/run-test-command.ts test/run-worker.test.ts
git commit -m "feat(worker): run the test command with a timeout stop" -m "Plan-task: 10"
```

### Task 11: Start the proxy when down

Depends on: Task 2

Files:
- Create: `src/proxy/ensure-proxy.ts`
- Create: `test/helpers/free-port.ts`
- Test: `test/ensure-proxy.test.ts`

Step 1: Write the port helper and the failing proxy test
`test/helpers/free-port.ts`:
```ts
import { once } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';

export async function freePort(): Promise<number> {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  server.close();
  await once(server, 'close');
  return port;
}
```
`test/ensure-proxy.test.ts`:
```ts
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
      expect(await ensureProxy({ dir, logPath: join(dir, 'proxy.log'), healthUrl: `http://127.0.0.1:${port}/healthz` })).toBe('running');
    } finally {
      server.close();
    }
  });

  it('starts a stopped proxy detached and leaves it running', async () => {
    const dir = tempDir();
    const port = await freePort();
    const pidFile = join(dir, 'proxy.pid');
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(
      join(dir, 'node_modules', '.bin', 'tsx'),
      `#!/bin/sh\necho $$ > "${pidFile}"\nexec node -e "require('node:http').createServer((q, s) => s.end('{}')).listen(${port}, '127.0.0.1')"\n`,
      { mode: 0o755 },
    );
    const healthUrl = `http://127.0.0.1:${port}/healthz`;
    try {
      expect(await ensureProxy({ dir, logPath: join(dir, 'proxy.log'), healthUrl })).toBe('started');
      expect(await isProxyHealthy(healthUrl)).toBe(true);
    } finally {
      process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGTERM');
    }
  });

  it('names the log when the proxy cannot start', async () => {
    const dir = tempDir();
    const port = await freePort();
    await expect(ensureProxy({ dir, logPath: join(dir, 'proxy.log'), healthUrl: `http://127.0.0.1:${port}/healthz` })).rejects.toThrow(
      `deepseek-proxy did not start; see ${join(dir, 'proxy.log')}`,
    );
  });
});
```
Run: `npx vitest run test/ensure-proxy.test.ts`
Expected: the file fails with `Failed to resolve import "../src/proxy/ensure-proxy"`

Step 2: Write the proxy starter
`src/proxy/ensure-proxy.ts`:
```ts
import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const HEALTH_TIMEOUT_MS = 1_000;
const START_WAIT_MS = 6_000;
const POLL_MS = 200;

export interface ProxyStart {
  dir: string;
  logPath: string;
  healthUrl: string;
}

export async function isProxyHealthy(healthUrl: string): Promise<boolean> {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureProxy(start: ProxyStart): Promise<'running' | 'started'> {
  if (await isProxyHealthy(start.healthUrl)) return 'running';
  const log = openSync(start.logPath, 'a');
  const proxy = spawn(join(start.dir, 'node_modules', '.bin', 'tsx'), ['src/server.ts'], {
    cwd: start.dir,
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
    if (await isProxyHealthy(start.healthUrl)) return 'started';
  }
  throw new Error(`deepseek-proxy did not start; see ${start.logPath}`);
}
```
Run: `npx vitest run test/ensure-proxy.test.ts && npm run typecheck`
Expected: `3 passed`, and typecheck exits 0

Commit:
```bash
git add src/proxy/ensure-proxy.ts test/helpers/free-port.ts test/ensure-proxy.test.ts
git commit -m "feat(proxy): start the repair-proxy when down" -m "Plan-task: 11"
```

### Task 12: Count the proxy's retries

Depends on: Task 2

Files:
- Create: `src/proxy/count-proxy-retries.ts`
- Test: `test/count-proxy-retries.test.ts`

Step 1: Write the failing retry-count test
`test/count-proxy-retries.test.ts`:
```ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countProxyRetries } from '../src/proxy/count-proxy-retries';

describe('countProxyRetries', () => {
  it('sums retries inside the window and skips a partial last line', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'routemax-telemetry-')), 'telemetry.jsonl');
    const lines = [
      { ts: '2026-09-25T10:00:00.000Z', retries: [{ reason: 'empty' }] },
      { ts: '2026-09-25T10:01:00.000Z', retries: [{ reason: 'empty' }, { reason: 'text-tool-call' }] },
      { ts: '2026-09-25T10:02:00.000Z', retries: [] },
      { ts: '2026-09-25T10:05:00.000Z', retries: [{ reason: 'empty' }] },
    ];
    writeFileSync(path, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n{"ts":"2026-09-25T10:01:30`);
    expect(await countProxyRetries(path, new Date('2026-09-25T10:00:30.000Z'), new Date('2026-09-25T10:03:00.000Z'))).toBe(2);
  });

  it('counts zero when the proxy has no telemetry file', async () => {
    expect(await countProxyRetries('/nonexistent/telemetry.jsonl', new Date(0), new Date())).toBe(0);
  });
});
```
Run: `npx vitest run test/count-proxy-retries.test.ts`
Expected: the file fails with `Failed to resolve import "../src/proxy/count-proxy-retries"`

Step 2: Write the retry counter
`src/proxy/count-proxy-retries.ts`:
```ts
import { readFile } from 'node:fs/promises';

interface TelemetryLine {
  ts?: string;
  retries?: unknown[];
}

function parseLine(line: string): TelemetryLine | null {
  try {
    return JSON.parse(line) as TelemetryLine;
  } catch {
    // The proxy appends while we read, so the last line can be partial.
    return null;
  }
}

export async function countProxyRetries(telemetryPath: string, from: Date, to: Date): Promise<number> {
  let text: string;
  try {
    text = await readFile(telemetryPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
  let retries = 0;
  for (const line of text.split('\n')) {
    const entry = line.trim() ? parseLine(line) : null;
    const at = Date.parse(entry?.ts ?? '');
    if (entry && Array.isArray(entry.retries) && at >= from.getTime() && at <= to.getTime()) retries += entry.retries.length;
  }
  return retries;
}
```
Run: `npx vitest run test/count-proxy-retries.test.ts && npm run typecheck`
Expected: `2 passed`, and typecheck exits 0

Commit:
```bash
git add src/proxy/count-proxy-retries.ts test/count-proxy-retries.test.ts
git commit -m "feat(proxy): count the repair-proxy's retries" -m "Plan-task: 12"
```

### Task 13: Orchestrate delegate: route, run the worker and log

Depends on: Task 3, Task 5, Task 8, Task 10, Task 11, Task 12
Risk: money, secrets and fail-closed: budget refusal, key handling and every escalation reason meet here

Files:
- Create: `src/delegate/delegate.ts`
- Test: `test/delegate.test.ts`

Step 1: Write the failing tests for a worker run, the effort raise and the Claude tier
`test/delegate.test.ts`:
```ts
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig, type DelegateConfig } from '../src/config/delegate-config';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { delegate, type DelegateDeps } from '../src/delegate/delegate';
import type { DelegateRequest } from '../src/delegate/delegate-result';

const FAKE_CLAUDE = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));
const FAKE_KEY = 'sk-fake-DO-NOT-LEAK';
beforeAll(() => chmodSync(FAKE_CLAUDE, 0o755));

interface HarnessOptions {
  scenario?: string;
  config?: Partial<DelegateConfig>;
  env?: Record<string, string>;
  testCommand?: string;
  baseUrl?: string;
  readApiKey?: () => Promise<string>;
}

function harness(options: HarnessOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'routemax-delegate-'));
  const home = join(root, 'home');
  const cwd = join(root, 'work');
  mkdirSync(join(home, '.claude-deepseek'), { recursive: true });
  mkdirSync(cwd);
  writeFileSync(join(home, '.claude-deepseek', 'env.vars'), `ANTHROPIC_BASE_URL=${options.baseUrl ?? 'http://127.0.0.1:8787'}\nANTHROPIC_MODEL=deepseek-v4-pro\n`);
  writeFileSync(join(home, '.claude-deepseek', 'mcp.json'), '{"mcpServers":{}}\n');
  const recordPath = join(root, 'record.json');
  const telemetryPath = join(root, 'telemetry.jsonl');
  const shipped = loadConfig(DEFAULT_CONFIG_PATH);
  const config: DelegateConfig = {
    ...shipped,
    claudeBin: FAKE_CLAUDE,
    proxy: { ...shipped.proxy, telemetryPath },
    projects: options.testCommand ? { [cwd]: { testCommand: options.testCommand } } : {},
    ...options.config,
  };
  const env = {
    PATH: process.env.PATH ?? '',
    ANTHROPIC_API_KEY: 'sk-ant-inherited',
    FAKE_CLAUDE_SCENARIO: options.scenario ?? 'success',
    FAKE_CLAUDE_RECORD: recordPath,
    FAKE_CLAUDE_TELEMETRY: telemetryPath,
    ...options.env,
  };
  const deps: DelegateDeps = {
    config,
    homeDir: home,
    cwd,
    env,
    readApiKey: options.readApiKey ?? (async () => FAKE_KEY),
    ensureProxy: async () => 'running',
  };
  return { deps, home, cwd, recordPath };
}

const request = (overrides: Partial<DelegateRequest> = {}): DelegateRequest => ({
  task: 'Add a greeting file.',
  taskType: 'boilerplate',
  requestedTier: 'flash-low',
  flags: [],
  ...overrides,
});
const logLines = (home: string) =>
  readFileSync(decisionLogPath(home), 'utf8').trim().split('\n').map((line) => JSON.parse(line));

describe('delegate', () => {
  it('runs a flash-high worker and returns summary, changed files, tier, model, effort and cost', async () => {
    const { deps, cwd, recordPath, home } = harness();
    const result = await delegate(request(), deps);
    expect(result).toMatchObject({
      status: 'done',
      summary: 'Did the thing.',
      changedFiles: [join(realpathSync(cwd), 'a.txt')],
      tier: 'flash-high',
      model: 'deepseek-v4-flash',
      effort: 'high',
    });
    expect(result.status === 'done' && result.costUsd).toBeGreaterThan(0);
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    expect(record).toMatchObject({
      depth: '1',
      model: 'deepseek-v4-flash',
      subagentModel: 'deepseek-v4-flash',
      effort: 'high',
      hasAuthToken: true,
      hasApiKey: false,
      cwd: realpathSync(cwd),
    });
    expect(record.args).not.toContain('--dangerously-skip-permissions');
    expect(logLines(home)[0]).toMatchObject({ taskType: 'boilerplate', requestedTier: 'flash-low', finalTier: 'flash-high', raisedBy: 'boilerplate-tests-edits', status: 'done', reason: null, retries: 0 });
  });

  it('raises the worker effort for a higher Claude effort', async () => {
    const { deps } = harness();
    expect(await delegate(request({ taskType: 'search', claudeEffort: 'xhigh' }), deps)).toMatchObject({ tier: 'flash-low', effort: 'max' });
  });

  it('returns use_claude for a claude-tier task without starting a worker', async () => {
    const { deps, recordPath, home } = harness();
    const result = await delegate(request({ taskType: 'security' }), deps);
    expect(result).toEqual({ status: 'use_claude', tier: 'claude', agent: 'claude-opus-xhigh', model: 'opus', effort: 'xhigh' });
    expect(existsSync(recordPath)).toBe(false);
    expect(logLines(home)[0]).toMatchObject({ status: 'use_claude', costUsd: 0 });
  });
});
```
Run: `npx vitest run test/delegate.test.ts`
Expected: the file fails with `Failed to resolve import "../src/delegate/delegate"`

Step 2: Write the orchestrator
`src/delegate/delegate.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { EMPTY_USAGE } from '../budget/usage-cost';
import { envVarsPath, mcpConfigPath } from '../config/deepseek-home';
import type { DelegateConfig, Effort, WorkerTier } from '../config/delegate-config';
import { appendDecision, decisionLogPath, readSpentUsd, type DecisionBase } from '../decision-log/decision-log';
import { countProxyRetries } from '../proxy/count-proxy-retries';
import { resolveEffort } from '../routing/resolve-effort';
import { routeTask } from '../routing/route-task';
import { runTestCommand, type TestOutcome } from '../worker/run-test-command';
import { runWorker, workerArgs, type WorkerOutcome } from '../worker/run-worker';
import { buildWorkerEnv, parseEnvVars } from '../worker/worker-env';
import type { DelegateRequest, DelegateResult, EscalationReason } from './delegate-result';

export interface DelegateDeps {
  config: DelegateConfig;
  homeDir: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  readApiKey: () => Promise<string>;
  ensureProxy: (healthUrl: string) => Promise<unknown>;
}

const SUMMARY_LIMIT = 1_500;
const NO_RUN = { ...EMPTY_USAGE, costUsd: 0, retries: 0 };

export async function delegate(request: DelegateRequest, deps: DelegateDeps): Promise<DelegateResult> {
  if (Number(deps.env.DEEPSEEK_DELEGATE_DEPTH ?? 0) >= 1) {
    return { status: 'refused', message: 'delegate is not available inside a delegate worker.' };
  }
  const startedAt = Date.now();
  const route = routeTask(deps.config.rules, request);
  const logPath = decisionLogPath(deps.homeDir);
  const base: DecisionBase = {
    ts: new Date(startedAt).toISOString(),
    cwd: deps.cwd,
    taskType: request.taskType,
    requestedTier: request.requestedTier,
    finalTier: route.tier,
    raisedBy: route.raisedBy,
  };
  if (route.tier === 'claude') {
    const agentName = deps.config.claude.taskTypes[request.taskType] ?? deps.config.claude.defaultAgent;
    const agent = deps.config.claude.agents[agentName];
    await appendDecision(logPath, { ...base, ...NO_RUN, model: agent.model, effort: agent.effort, status: 'use_claude', reason: null, durationMs: Date.now() - startedAt });
    return { status: 'use_claude', tier: 'claude', agent: agentName, model: agent.model, effort: agent.effort };
  }
  const refusal = await budgetRefusal(logPath, deps.config.budget);
  if (refusal) return refuse(logPath, base, refusal, startedAt);
  return runDeepseekTask(request, route.tier, base, deps, startedAt);
}

async function runDeepseekTask(request: DelegateRequest, tier: WorkerTier, base: DecisionBase, deps: DelegateDeps, startedAt: number): Promise<DelegateResult> {
  const { config } = deps;
  const { model } = config.tiers[tier];
  const effort = resolveEffort(config.effortMap, config.tiers[tier].effort, request.claudeEffort);
  const logPath = decisionLogPath(deps.homeDir);
  let env: Record<string, string>;
  try {
    env = await workerEnvironment(deps, model, effort);
  } catch (error) {
    return refuse(logPath, base, (error as Error).message, startedAt);
  }
  const testCommand = config.projects[deps.cwd]?.testCommand;
  const outcome = await runWorker({
    claudeBin: config.claudeBin,
    args: workerArgs(mcpConfigPath(deps.homeDir), testCommand),
    cwd: deps.cwd,
    env,
    prompt: workerPrompt(request.task, deps.cwd),
    timeoutMs: config.workerTimeoutMs,
    costLimitUsd: config.budget.perCallUsd,
    costOf: (stream) => stream.costUsd(config.prices, model),
  });
  const workerReason = workerEscalation(outcome);
  const testOutcome = workerReason === null && testCommand ? await runTestCommand(testCommand, deps.cwd, config.testTimeoutMs) : null;
  const retries = await countProxyRetries(config.proxy.telemetryPath, outcome.startedAt, outcome.endedAt);
  const reason = workerReason ?? testEscalation(testOutcome) ?? retryEscalation(retries, config.retryThreshold);
  const costUsd = outcome.stream.costUsd(config.prices, model);
  const status = reason ? 'escalate' : 'done';
  await appendDecision(logPath, { ...base, ...outcome.stream.usage, model, effort, costUsd, status, reason, durationMs: Date.now() - startedAt, retries });
  const report = { summary: truncate(outcome.stream.result?.text ?? '', SUMMARY_LIMIT), changedFiles: outcome.stream.changedFiles, tier, model, effort, costUsd };
  return reason ? { status: 'escalate', reason, ...report } : { status: 'done', ...report };
}

async function workerEnvironment(deps: DelegateDeps, model: string, effort: Effort): Promise<Record<string, string>> {
  const path = envVarsPath(deps.homeDir);
  const envVarsText = await readFile(path, 'utf8').catch(() => {
    throw new Error(`${path} is missing; run npm run setup in routemax first.`);
  });
  const envVars = parseEnvVars(envVarsText);
  const baseUrl = envVars.ANTHROPIC_BASE_URL ?? '';
  if (!URL.canParse(baseUrl) || new URL(baseUrl).hostname !== '127.0.0.1') {
    throw new Error('ANTHROPIC_BASE_URL in env.vars must point at the repair-proxy on 127.0.0.1.');
  }
  await deps.ensureProxy(new URL('/healthz', baseUrl).href);
  const apiKey = await deps.readApiKey();
  return buildWorkerEnv({ inherited: deps.env, envVars, model, apiKey, effort });
}

async function budgetRefusal(logPath: string, budget: DelegateConfig['budget']): Promise<string | null> {
  const spentUsd = await readSpentUsd(logPath);
  if (spentUsd + budget.perCallUsd <= budget.totalUsd) return null;
  return `Budget cap reached: $${spentUsd.toFixed(2)} of $${budget.totalUsd.toFixed(2)} spent, and one call may cost up to $${budget.perCallUsd.toFixed(2)}. Raise budget.totalUsd in config/routing.json to continue.`;
}

async function refuse(logPath: string, base: DecisionBase, message: string, startedAt: number): Promise<DelegateResult> {
  await appendDecision(logPath, { ...base, ...NO_RUN, model: null, effort: null, status: 'refused', reason: null, durationMs: Date.now() - startedAt });
  return { status: 'refused', message };
}

function workerEscalation(outcome: WorkerOutcome): EscalationReason | null {
  if (outcome.stoppedBy) return outcome.stoppedBy;
  if (outcome.exitCode !== 0) return 'exit-code';
  const result = outcome.stream.result;
  if (!result || result.isError) return 'stream-error';
  if (!result.text.trim()) return 'empty-result';
  return null;
}

function testEscalation(outcome: TestOutcome | null): EscalationReason | null {
  if (outcome === 'timeout') return 'test-timeout';
  if (outcome === 'failed') return 'tests-failed';
  return null;
}

function retryEscalation(retries: number, threshold: number | null): EscalationReason | null {
  return threshold !== null && retries > threshold ? 'retries' : null;
}

function workerPrompt(task: string, cwd: string): string {
  return `${task}\n\nWork only inside ${cwd}. Finish with a plain summary of at most ${SUMMARY_LIMIT} characters: what you did and which files you changed.`;
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}
```
Run: `npx vitest run test/delegate.test.ts && npm run typecheck`
Expected: `3 passed`, and typecheck exits 0

Commit:
```bash
git add src/delegate/delegate.ts test/delegate.test.ts
git commit -m "feat(delegate): route, run and log a delegate call" -m "Plan-task: 13"
```

### Task 14: Prove the delegate guard, budget, escalations and key handling

Depends on: Task 13
Risk: money, secrets and fail-closed: budget refusal, key handling and every escalation reason meet here

Files:
- Modify: `test/delegate.test.ts` (`describe('delegate'`)

Step 1: Add the recursion guard, budget, escalation, retry and key tests
`test/delegate.test.ts`:
```ts
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig, type DelegateConfig } from '../src/config/delegate-config';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { delegate, type DelegateDeps } from '../src/delegate/delegate';
import type { DelegateRequest } from '../src/delegate/delegate-result';

const FAKE_CLAUDE = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));
const FAKE_KEY = 'sk-fake-DO-NOT-LEAK';
beforeAll(() => chmodSync(FAKE_CLAUDE, 0o755));

interface HarnessOptions {
  scenario?: string;
  config?: Partial<DelegateConfig>;
  env?: Record<string, string>;
  testCommand?: string;
  baseUrl?: string;
  readApiKey?: () => Promise<string>;
}

function harness(options: HarnessOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'routemax-delegate-'));
  const home = join(root, 'home');
  const cwd = join(root, 'work');
  mkdirSync(join(home, '.claude-deepseek'), { recursive: true });
  mkdirSync(cwd);
  writeFileSync(join(home, '.claude-deepseek', 'env.vars'), `ANTHROPIC_BASE_URL=${options.baseUrl ?? 'http://127.0.0.1:8787'}\nANTHROPIC_MODEL=deepseek-v4-pro\n`);
  writeFileSync(join(home, '.claude-deepseek', 'mcp.json'), '{"mcpServers":{}}\n');
  const recordPath = join(root, 'record.json');
  const telemetryPath = join(root, 'telemetry.jsonl');
  const shipped = loadConfig(DEFAULT_CONFIG_PATH);
  const config: DelegateConfig = {
    ...shipped,
    claudeBin: FAKE_CLAUDE,
    proxy: { ...shipped.proxy, telemetryPath },
    projects: options.testCommand ? { [cwd]: { testCommand: options.testCommand } } : {},
    ...options.config,
  };
  const env = {
    PATH: process.env.PATH ?? '',
    ANTHROPIC_API_KEY: 'sk-ant-inherited',
    FAKE_CLAUDE_SCENARIO: options.scenario ?? 'success',
    FAKE_CLAUDE_RECORD: recordPath,
    FAKE_CLAUDE_TELEMETRY: telemetryPath,
    ...options.env,
  };
  const deps: DelegateDeps = {
    config,
    homeDir: home,
    cwd,
    env,
    readApiKey: options.readApiKey ?? (async () => FAKE_KEY),
    ensureProxy: async () => 'running',
  };
  return { deps, home, cwd, recordPath };
}

const request = (overrides: Partial<DelegateRequest> = {}): DelegateRequest => ({
  task: 'Add a greeting file.',
  taskType: 'boilerplate',
  requestedTier: 'flash-low',
  flags: [],
  ...overrides,
});
const logLines = (home: string) =>
  readFileSync(decisionLogPath(home), 'utf8').trim().split('\n').map((line) => JSON.parse(line));

describe('delegate', () => {
  it('runs a flash-high worker and returns summary, changed files, tier, model, effort and cost', async () => {
    const { deps, cwd, recordPath, home } = harness();
    const result = await delegate(request(), deps);
    expect(result).toMatchObject({
      status: 'done',
      summary: 'Did the thing.',
      changedFiles: [join(realpathSync(cwd), 'a.txt')],
      tier: 'flash-high',
      model: 'deepseek-v4-flash',
      effort: 'high',
    });
    expect(result.status === 'done' && result.costUsd).toBeGreaterThan(0);
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    expect(record).toMatchObject({
      depth: '1',
      model: 'deepseek-v4-flash',
      subagentModel: 'deepseek-v4-flash',
      effort: 'high',
      hasAuthToken: true,
      hasApiKey: false,
      cwd: realpathSync(cwd),
    });
    expect(record.args).not.toContain('--dangerously-skip-permissions');
    expect(logLines(home)[0]).toMatchObject({ taskType: 'boilerplate', requestedTier: 'flash-low', finalTier: 'flash-high', raisedBy: 'boilerplate-tests-edits', status: 'done', reason: null, retries: 0 });
  });

  it('raises the worker effort for a higher Claude effort', async () => {
    const { deps } = harness();
    expect(await delegate(request({ taskType: 'search', claudeEffort: 'xhigh' }), deps)).toMatchObject({ tier: 'flash-low', effort: 'max' });
  });

  it('returns use_claude for a claude-tier task without starting a worker', async () => {
    const { deps, recordPath, home } = harness();
    const result = await delegate(request({ taskType: 'security' }), deps);
    expect(result).toEqual({ status: 'use_claude', tier: 'claude', agent: 'claude-opus-xhigh', model: 'opus', effort: 'xhigh' });
    expect(existsSync(recordPath)).toBe(false);
    expect(logLines(home)[0]).toMatchObject({ status: 'use_claude', costUsd: 0 });
  });

  it('refuses inside a worker (recursion guard)', async () => {
    const { deps, recordPath } = harness({ env: { DEEPSEEK_DELEGATE_DEPTH: '1' } });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'refused' });
    expect(existsSync(recordPath)).toBe(false);
  });

  it('refuses before the call when spent-to-date from the log plus the per-call cap passes the total', async () => {
    const { deps, home, recordPath } = harness();
    mkdirSync(dirname(decisionLogPath(home)), { recursive: true });
    writeFileSync(decisionLogPath(home), `${JSON.stringify({ costUsd: 9.8 })}\n`);
    const result = await delegate(request(), deps);
    expect(result.status === 'refused' && result.message).toMatch(/Budget cap reached: \$9\.80 of \$10\.00/);
    expect(existsSync(recordPath)).toBe(false);
  });

  it('stops a call that passes $0.25 and escalates with reason budget', async () => {
    const { deps, home } = harness({ scenario: 'expensive' });
    const result = await delegate(request(), deps);
    expect(result).toMatchObject({ status: 'escalate', reason: 'budget' });
    expect(logLines(home)[0].costUsd).toBeGreaterThan(0.25);
  });

  it('escalates with reason timeout', async () => {
    const { deps } = harness({ scenario: 'hang', config: { workerTimeoutMs: 300 } });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'escalate', reason: 'timeout' });
  });

  it.each([
    ['exit-code', 'exit-code'],
    ['stream-error', 'stream-error'],
    ['empty-result', 'empty-result'],
  ])('escalates the %s scenario with reason %s', async (scenario, reason) => {
    const { deps } = harness({ scenario });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'escalate', reason });
  });

  it('runs the project test command after the worker and escalates when it fails, listing changed files', async () => {
    const { deps, cwd, recordPath } = harness({ testCommand: 'exit 1' });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'escalate', reason: 'tests-failed', changedFiles: [join(realpathSync(cwd), 'a.txt')] });
    expect(JSON.parse(readFileSync(recordPath, 'utf8')).args).toContain('Bash(exit 1)');
  });

  it('passes when the test command passes', async () => {
    const { deps } = harness({ testCommand: 'exit 0' });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done' });
  });

  it('escalates with reason test-timeout when the test command runs too long', async () => {
    const { deps } = harness({ testCommand: 'sleep 30', config: { testTimeoutMs: 200 } });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'escalate', reason: 'test-timeout' });
  });

  it('logs retries without escalating while the threshold is unset', async () => {
    const { deps, home } = harness({ env: { FAKE_CLAUDE_RETRIES: '3' } });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done' });
    expect(logLines(home)[0]).toMatchObject({ status: 'done', retries: 3 });
  });

  it('escalates with reason retries once the threshold is set and passed', async () => {
    const { deps } = harness({ env: { FAKE_CLAUDE_RETRIES: '3' }, config: { retryThreshold: 2 } });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'escalate', reason: 'retries' });
  });

  it('keeps the key out of the decision log and the result', async () => {
    const { deps, home } = harness();
    const result = await delegate(request(), deps);
    expect(readFileSync(decisionLogPath(home), 'utf8')).not.toContain(FAKE_KEY);
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });

  it('fails closed without starting a worker when the key lookup fails', async () => {
    const { deps, recordPath } = harness({
      readApiKey: async () => {
        throw new Error('DeepSeek API key not found in Keychain (service deepseek_api_key).');
      },
    });
    expect(await delegate(request(), deps)).toEqual({ status: 'refused', message: 'DeepSeek API key not found in Keychain (service deepseek_api_key).' });
    expect(existsSync(recordPath)).toBe(false);
  });

  it('refuses a base URL that is not the proxy on 127.0.0.1', async () => {
    const { deps, recordPath } = harness({ baseUrl: 'http://example.com:8787' });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'refused' });
    expect(existsSync(recordPath)).toBe(false);
  });
});
```
Run: `npx vitest run test/delegate.test.ts && npm run typecheck`
Expected: `19 passed`, and typecheck exits 0

Commit:
```bash
git add test/delegate.test.ts
git commit -m "test(delegate): cover the guard, budget, escalations and key handling" -m "Plan-task: 14"
```

### Task 15: Serve delegate over stdio and prove it with a real worker

Depends on: Task 14

Files:
- Create: `src/server.ts`
- Test: `test/integration/delegate-stdio.test.ts`

Step 1: Write the failing stdio integration test
`test/integration/delegate-stdio.test.ts`:
```ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH } from '../../src/config/delegate-config';
import { decisionLogPath } from '../../src/decision-log/decision-log';
import { isProxyHealthy } from '../../src/proxy/ensure-proxy';
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
  writeFileSync(join(root, 'bin', 'security'), `#!/bin/sh\necho ${FAKE_KEY}\n`, { mode: 0o755 });
  writeFileSync(join(root, 'proxy', 'node_modules', '.bin', 'tsx'), `#!/bin/sh\nexec node "${FAKE_UPSTREAM}"\n`, { mode: 0o755 });
  const config = JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
  config.proxy = { dir: join(root, 'proxy'), logPath: join(root, 'proxy.log'), telemetryPath: join(root, 'telemetry.jsonl') };
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

async function callDelegate(args: Record<string, unknown>): Promise<Record<string, unknown>> {
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
  try {
    const response = await client.callTool({ name: 'delegate', arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS });
    const text = (response.content as { type: string; text: string }[])[0].text;
    resultTexts.push(text);
    return JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client.close();
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
```
Run: `npx vitest run test/integration/delegate-stdio.test.ts`
Expected: the first test fails with an MCP `Connection closed` error, because `src/server.ts` does not exist yet

Step 2: Write the MCP server entry
`src/server.ts`:
```ts
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
```
Run: `npx vitest run test/integration/delegate-stdio.test.ts && npm run typecheck`
Expected: `4 passed`, and typecheck exits 0

Commit:
```bash
git add src/server.ts test/integration/delegate-stdio.test.ts
git commit -m "feat(server): serve delegate over stdio with a real worker integration test" -m "Plan-task: 15"
```

### Task 16: Add the optional Explore redirect hook

Depends on: Task 2

Files:
- Create: `src/hook/explore-redirect.ts`
- Create: `src/hook/explore-redirect-hook.ts`
- Test: `test/explore-redirect.test.ts`

Step 1: Write the failing hook tests
`test/explore-redirect.test.ts`:
```ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH } from '../src/config/delegate-config';
import { EXPLORE_REDIRECT_REASON, exploreRedirect } from '../src/hook/explore-redirect';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const explore = { tool_name: 'Agent', tool_input: { subagent_type: 'Explore' } };
const deny = {
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: EXPLORE_REDIRECT_REASON },
};

function runHook(input: unknown, exploreRedirectOn: boolean, depth = '0'): string {
  const configPath = join(mkdtempSync(join(tmpdir(), 'routemax-hook-')), 'routing.json');
  writeFileSync(configPath, JSON.stringify({ ...JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8')), exploreRedirect: exploreRedirectOn }));
  return execFileSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'src/hook/explore-redirect-hook.ts')], {
    input: JSON.stringify(input),
    env: { ...process.env, DEEPSEEK_DELEGATE_CONFIG: configPath, DEEPSEEK_DELEGATE_DEPTH: depth },
    encoding: 'utf8',
  });
}

describe('exploreRedirect', () => {
  it('denies Explore with a pointer to delegate when on', () => {
    expect(exploreRedirect(explore, { enabled: true, depth: 0 })).toEqual(deny);
    expect(EXPLORE_REDIRECT_REASON).toContain('taskType "search"');
  });

  it('does nothing when off', () => {
    expect(exploreRedirect(explore, { enabled: false, depth: 0 })).toBeNull();
  });

  it('touches only Explore, never exo agents or other types', () => {
    for (const subagent_type of ['general-purpose', 'exo:explorer', 'exo:implementer']) {
      expect(exploreRedirect({ tool_name: 'Agent', tool_input: { subagent_type } }, { enabled: true, depth: 0 })).toBeNull();
    }
    expect(exploreRedirect({ tool_name: 'Read', tool_input: {} }, { enabled: true, depth: 0 })).toBeNull();
  });

  it('does nothing at depth 1 or more', () => {
    expect(exploreRedirect(explore, { enabled: true, depth: 1 })).toBeNull();
  });
});

describe('explore-redirect-hook entry', () => {
  it('prints nothing with the shipped config, where the switch is off', () => {
    expect(runHook(explore, false)).toBe('');
  });

  it('prints the deny JSON when the switch is on', () => {
    expect(JSON.parse(runHook(explore, true))).toEqual(deny);
  });

  it('prints nothing inside a worker', () => {
    expect(runHook(explore, true, '1')).toBe('');
  });
});
```
Run: `npx vitest run test/explore-redirect.test.ts`
Expected: the file fails with `Failed to resolve import "../src/hook/explore-redirect"`

Step 2: Write the hook decision and its entry
`src/hook/explore-redirect.ts`:
```ts
export interface HookInput {
  tool_name?: string;
  tool_input?: { subagent_type?: unknown };
}

export interface HookDeny {
  hookSpecificOutput: { hookEventName: 'PreToolUse'; permissionDecision: 'deny'; permissionDecisionReason: string };
}

export const EXPLORE_REDIRECT_REASON =
  'Explore is redirected to DeepSeek: call the deepseek-delegate MCP tool delegate with taskType "search" and your search question as task instead.';

export function exploreRedirect(input: HookInput, options: { enabled: boolean; depth: number }): HookDeny | null {
  if (!options.enabled || options.depth >= 1) return null;
  if (input.tool_name !== 'Agent' || input.tool_input?.subagent_type !== 'Explore') return null;
  return {
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: EXPLORE_REDIRECT_REASON },
  };
}
```
`src/hook/explore-redirect-hook.ts`:
```ts
import { readFileSync } from 'node:fs';
import { loadConfig } from '../config/delegate-config';
import { exploreRedirect, type HookInput } from './explore-redirect';

const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
const deny = exploreRedirect(input, {
  enabled: loadConfig().exploreRedirect,
  depth: Number(process.env.DEEPSEEK_DELEGATE_DEPTH ?? 0),
});
if (deny) process.stdout.write(`${JSON.stringify(deny)}\n`);
```
Run: `npx vitest run test/explore-redirect.test.ts && npm run typecheck`
Expected: `7 passed`, and typecheck exits 0

Commit:
```bash
git add src/hook/explore-redirect.ts src/hook/explore-redirect-hook.ts test/explore-redirect.test.ts
git commit -m "feat(hook): add the optional Explore redirect hook, off by default" -m "Plan-task: 16"
```

### Task 17: Setup: create ~/.claude-deepseek without overwriting it

Depends on: Task 2
Risk: persisted user config: setup must never overwrite a file

Files:
- Create: `src/setup/create-deepseek-home.ts`
- Test: `test/setup.test.ts`

Step 1: Write the failing home test
`test/setup.test.ts`:
```ts
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDeepseekHome } from '../src/setup/create-deepseek-home';

const tempRoot = () => mkdtempSync(join(tmpdir(), 'routemax-setup-'));

describe('createDeepseekHome', () => {
  it('creates env.vars, mcp.json and settings.json, then never overwrites them', async () => {
    const home = tempRoot();
    const created = await createDeepseekHome(home);
    expect(created).toHaveLength(3);
    const envVars = readFileSync(join(home, '.claude-deepseek', 'env.vars'), 'utf8');
    expect(envVars).toContain('ANTHROPIC_BASE_URL=http://127.0.0.1:8787\n');
    expect(envVars).toContain('ANTHROPIC_MODEL=deepseek-v4-pro\n');
    expect(envVars).toContain('ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash\n');
    expect(envVars).toContain('CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro\n');
    expect(envVars).toContain(`CLAUDE_CONFIG_DIR=${join(home, '.claude-deepseek')}\n`);
    expect(envVars).not.toMatch(/KEY|TOKEN/);
    expect(JSON.parse(readFileSync(join(home, '.claude-deepseek', 'mcp.json'), 'utf8'))).toEqual({ mcpServers: {} });
    expect(JSON.parse(readFileSync(join(home, '.claude-deepseek', 'settings.json'), 'utf8'))).toEqual({ effortLevel: 'high' });
    writeFileSync(join(home, '.claude-deepseek', 'env.vars'), 'EDITED=1\n');
    expect(await createDeepseekHome(home)).toEqual([]);
    expect(readFileSync(join(home, '.claude-deepseek', 'env.vars'), 'utf8')).toBe('EDITED=1\n');
  });
});
```
Run: `npx vitest run test/setup.test.ts`
Expected: the file fails with `Failed to resolve import "../src/setup/create-deepseek-home"`

Step 2: Write the home creator
`src/setup/create-deepseek-home.ts`:
```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { deepseekHomeDir, envVarsPath, mcpConfigPath, settingsPath } from '../config/deepseek-home';

function envVarsContent(homeDir: string): string {
  return [
    '# Read by deepseek() in ~/.zshrc, the repair-proxy regression check and the deepseek-delegate worker. Holds no key.',
    'ANTHROPIC_BASE_URL=http://127.0.0.1:8787',
    'ANTHROPIC_MODEL=deepseek-v4-pro',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash',
    'CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro',
    `CLAUDE_CONFIG_DIR=${deepseekHomeDir(homeDir)}`,
    '',
  ].join('\n');
}

export async function createDeepseekHome(homeDir: string): Promise<string[]> {
  await mkdir(deepseekHomeDir(homeDir), { recursive: true });
  const files: [string, string][] = [
    [envVarsPath(homeDir), envVarsContent(homeDir)],
    [mcpConfigPath(homeDir), '{"mcpServers":{}}\n'],
    [settingsPath(homeDir), '{\n  "effortLevel": "high"\n}\n'],
  ];
  const created: string[] = [];
  for (const [path, content] of files) {
    try {
      await writeFile(path, content, { flag: 'wx' });
      created.push(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  return created;
}
```
Run: `npx vitest run test/setup.test.ts && npm run typecheck`
Expected: `1 passed`, and typecheck exits 0

Commit:
```bash
git add src/setup/create-deepseek-home.ts test/setup.test.ts
git commit -m "feat(setup): recreate ~/.claude-deepseek without overwriting it" -m "Plan-task: 17"
```

### Task 18: Setup: add ~/.claude-deepseek to the chezmoi source

Depends on: Task 17
Risk: persisted user config: setup never overwrites a chezmoi source file and never adds a file holding a key or token to it

Files:
- Create: `src/setup/add-deepseek-home-to-chezmoi.ts`
- Modify: `test/setup.test.ts`

Step 1: Add the fake chezmoi and the failing chezmoi-sync tests
`test/setup.test.ts`:
```ts
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { addDeepseekHomeToChezmoi } from '../src/setup/add-deepseek-home-to-chezmoi';
import { createDeepseekHome } from '../src/setup/create-deepseek-home';

function fakeChezmoi(root: string) {
  const source = join(root, 'chezmoi');
  const applyLog = join(root, 'apply.log');
  const addLog = join(root, 'add.log');
  mkdirSync(join(source, 'dot_claude'), { recursive: true });
  const bin = join(root, 'bin', 'chezmoi');
  mkdirSync(join(root, 'bin'));
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'case "$1" in',
      '  source-path) case "$2" in',
      `      */.claude) echo "${source}/dot_claude" ;;`,
      `      *) test -e "${source}/dot_claude-deepseek/$(basename "$2")" || exit 1 ;;`,
      '    esac ;;',
      `  apply) shift; echo "$@" >> "${applyLog}" ;;`,
      `  add) shift; mkdir -p "${source}/dot_claude-deepseek"; for path in "$@"; do touch "${source}/dot_claude-deepseek/$(basename "$path")"; done; echo "$@" >> "${addLog}" ;;`,
      '  *) exit 1 ;;',
      'esac',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
  return { bin, source, applyLog, addLog };
}
const tempRoot = () => mkdtempSync(join(tmpdir(), 'routemax-setup-'));

describe('createDeepseekHome', () => {
  it('creates env.vars, mcp.json and settings.json, then never overwrites them', async () => {
    const home = tempRoot();
    const created = await createDeepseekHome(home);
    expect(created).toHaveLength(3);
    const envVars = readFileSync(join(home, '.claude-deepseek', 'env.vars'), 'utf8');
    expect(envVars).toContain('ANTHROPIC_BASE_URL=http://127.0.0.1:8787\n');
    expect(envVars).toContain('ANTHROPIC_MODEL=deepseek-v4-pro\n');
    expect(envVars).toContain('ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash\n');
    expect(envVars).toContain('CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro\n');
    expect(envVars).toContain(`CLAUDE_CONFIG_DIR=${join(home, '.claude-deepseek')}\n`);
    expect(envVars).not.toMatch(/KEY|TOKEN/);
    expect(JSON.parse(readFileSync(join(home, '.claude-deepseek', 'mcp.json'), 'utf8'))).toEqual({ mcpServers: {} });
    expect(JSON.parse(readFileSync(join(home, '.claude-deepseek', 'settings.json'), 'utf8'))).toEqual({ effortLevel: 'high' });
    writeFileSync(join(home, '.claude-deepseek', 'env.vars'), 'EDITED=1\n');
    expect(await createDeepseekHome(home)).toEqual([]);
    expect(readFileSync(join(home, '.claude-deepseek', 'env.vars'), 'utf8')).toBe('EDITED=1\n');
  });
});

describe('addDeepseekHomeToChezmoi', () => {
  it('adds the created files to the chezmoi source once', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    const chezmoi = fakeChezmoi(root);
    const created = await createDeepseekHome(home);
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(report.added).toEqual(created);
    expect(readdirSync(join(chezmoi.source, 'dot_claude-deepseek')).sort()).toEqual(['env.vars', 'mcp.json', 'settings.json']);
    const again = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(again.added).toEqual([]);
    expect(readFileSync(chezmoi.addLog, 'utf8').trim().split('\n')).toHaveLength(1);
  });

  it('does not add a file that holds a key or token', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    const chezmoi = fakeChezmoi(root);
    await createDeepseekHome(home);
    const envVars = join(home, '.claude-deepseek', 'env.vars');
    writeFileSync(envVars, 'DEEPSEEK_API_KEY=sk-test\n');
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(report.added).not.toContain(envVars);
    expect(report.messages.join('\n')).toContain(envVars);
    expect(readdirSync(join(chezmoi.source, 'dot_claude-deepseek')).sort()).toEqual(['mcp.json', 'settings.json']);
  });

  it('changes nothing and prints the chezmoi add command when chezmoi is missing', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    await createDeepseekHome(home);
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: join(root, 'no-chezmoi') });
    expect(report.added).toEqual([]);
    expect(report.messages.join('\n')).toContain(`chezmoi add ${join(home, '.claude-deepseek', 'env.vars')}`);
  });
});
```
Run: `npx vitest run test/setup.test.ts`
Expected: the file fails with `Failed to resolve import "../src/setup/add-deepseek-home-to-chezmoi"`

Step 2: Write the chezmoi sync
`src/setup/add-deepseek-home-to-chezmoi.ts`:
```ts
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { envVarsPath, mcpConfigPath, settingsPath } from '../config/deepseek-home';

const execFileAsync = promisify(execFile);
// The chezmoi source may be pushed to a remote, so a file naming a key or token stays out of it.
const SECRET_PATTERN = /KEY|TOKEN|SECRET/;

export interface DeepseekHomeSync {
  homeDir: string;
  chezmoiBin: string;
}

export interface DeepseekHomeSyncReport {
  added: string[];
  messages: string[];
}

async function isManagedByChezmoi(chezmoiBin: string, path: string): Promise<boolean> {
  try {
    await execFileAsync(chezmoiBin, ['source-path', path]);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
    return false;
  }
}

export async function addDeepseekHomeToChezmoi(sync: DeepseekHomeSync): Promise<DeepseekHomeSyncReport> {
  const paths = [envVarsPath(sync.homeDir), mcpConfigPath(sync.homeDir), settingsPath(sync.homeDir)].filter((path) => existsSync(path));
  const unmanaged: string[] = [];
  try {
    for (const path of paths) {
      if (!(await isManagedByChezmoi(sync.chezmoiBin, path))) unmanaged.push(path);
    }
  } catch {
    return { added: [], messages: [`chezmoi is missing; nothing was added. Run chezmoi add ${paths.join(' ')} to keep these files.`] };
  }
  const added: string[] = [];
  const messages: string[] = [];
  for (const path of unmanaged) {
    const content = await readFile(path, 'utf8');
    if (SECRET_PATTERN.test(content)) messages.push(`${path} names a key or token, so it was not added to the chezmoi source.`);
    else added.push(path);
  }
  if (!added.length) return { added, messages };
  await execFileAsync(sync.chezmoiBin, ['add', ...added]);
  return { added, messages: [...messages, `Added ${added.join(', ')} to the chezmoi source.`] };
}
```
Run: `npx vitest run test/setup.test.ts && npm run typecheck`
Expected: `4 passed`, and typecheck exits 0

Commit:
```bash
git add src/setup/add-deepseek-home-to-chezmoi.ts test/setup.test.ts
git commit -m "feat(setup): add ~/.claude-deepseek to the chezmoi source" -m "Plan-task: 18"
```

### Task 19: Write the Claude agent files

Depends on: Task 1

Files:
- Create: `agents/claude-opus-xhigh.md`
- Create: `agents/claude-opus-high.md`
- Create: `agents/claude-sonnet-high.md`

Step 1: Write the agent files
`agents/claude-opus-xhigh.md`:
```md
---
name: claude-opus-xhigh
description: Claude Opus at xhigh effort for tasks deepseek-delegate keeps on Claude because they are hard or risky - architecture, security, auth, migrations, concurrency and irreversible changes.
model: opus
effort: xhigh
---
You handle a task the deepseek-delegate router kept on Claude because it is hard or risky. Work it to completion in the current repository, verify it, and report what you changed and how you verified it.
```
`agents/claude-opus-high.md`:
```md
---
name: claude-opus-high
description: Claude Opus at high effort for tasks deepseek-delegate keeps on Claude, such as debugging without a known cause.
model: opus
effort: high
---
You handle a task the deepseek-delegate router kept on Claude. Work it to completion in the current repository, verify it, and report what you changed and how you verified it.
```
`agents/claude-sonnet-high.md`:
```md
---
name: claude-sonnet-high
description: Claude Sonnet at high effort for tasks deepseek-delegate keeps on Claude that need care but not Opus.
model: sonnet
effort: high
---
You handle a task the deepseek-delegate router kept on Claude. Work it to completion in the current repository, verify it, and report what you changed and how you verified it.
```
Run: `head -5 agents/*.md | grep -cE '^(model|effort): '`
Expected: `6`

Commit:
```bash
git add agents/claude-opus-xhigh.md agents/claude-opus-high.md agents/claude-sonnet-high.md
git commit -m "feat(agents): add the Claude Opus and Sonnet agent files" -m "Plan-task: 19"
```

### Task 20: Setup: install the Claude agents through chezmoi

Depends on: Task 18, Task 19
Risk: persisted user config: setup must never overwrite a file or write under ~/.claude/

Files:
- Create: `src/setup/install-agents.ts`
- Modify: `test/setup.test.ts`

Step 1: Add the failing agent-install tests
`test/setup.test.ts`:
```ts
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { addDeepseekHomeToChezmoi } from '../src/setup/add-deepseek-home-to-chezmoi';
import { createDeepseekHome } from '../src/setup/create-deepseek-home';
import { installAgents } from '../src/setup/install-agents';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO_AGENTS = join(ROOT, 'agents');
const AGENT_FILES = ['claude-opus-high.md', 'claude-opus-xhigh.md', 'claude-sonnet-high.md'];

function fakeChezmoi(root: string) {
  const source = join(root, 'chezmoi');
  const applyLog = join(root, 'apply.log');
  const addLog = join(root, 'add.log');
  mkdirSync(join(source, 'dot_claude'), { recursive: true });
  const bin = join(root, 'bin', 'chezmoi');
  mkdirSync(join(root, 'bin'));
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'case "$1" in',
      '  source-path) case "$2" in',
      `      */.claude) echo "${source}/dot_claude" ;;`,
      `      *) test -e "${source}/dot_claude-deepseek/$(basename "$2")" || exit 1 ;;`,
      '    esac ;;',
      `  apply) shift; echo "$@" >> "${applyLog}" ;;`,
      `  add) shift; mkdir -p "${source}/dot_claude-deepseek"; for path in "$@"; do touch "${source}/dot_claude-deepseek/$(basename "$path")"; done; echo "$@" >> "${addLog}" ;;`,
      '  *) exit 1 ;;',
      'esac',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
  return { bin, source, applyLog, addLog };
}
const tempRoot = () => mkdtempSync(join(tmpdir(), 'routemax-setup-'));

describe('createDeepseekHome', () => {
  it('creates env.vars, mcp.json and settings.json, then never overwrites them', async () => {
    const home = tempRoot();
    const created = await createDeepseekHome(home);
    expect(created).toHaveLength(3);
    const envVars = readFileSync(join(home, '.claude-deepseek', 'env.vars'), 'utf8');
    expect(envVars).toContain('ANTHROPIC_BASE_URL=http://127.0.0.1:8787\n');
    expect(envVars).toContain('ANTHROPIC_MODEL=deepseek-v4-pro\n');
    expect(envVars).toContain('ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash\n');
    expect(envVars).toContain('CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro\n');
    expect(envVars).toContain(`CLAUDE_CONFIG_DIR=${join(home, '.claude-deepseek')}\n`);
    expect(envVars).not.toMatch(/KEY|TOKEN/);
    expect(JSON.parse(readFileSync(join(home, '.claude-deepseek', 'mcp.json'), 'utf8'))).toEqual({ mcpServers: {} });
    expect(JSON.parse(readFileSync(join(home, '.claude-deepseek', 'settings.json'), 'utf8'))).toEqual({ effortLevel: 'high' });
    writeFileSync(join(home, '.claude-deepseek', 'env.vars'), 'EDITED=1\n');
    expect(await createDeepseekHome(home)).toEqual([]);
    expect(readFileSync(join(home, '.claude-deepseek', 'env.vars'), 'utf8')).toBe('EDITED=1\n');
  });
});

describe('addDeepseekHomeToChezmoi', () => {
  it('adds the created files to the chezmoi source once', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    const chezmoi = fakeChezmoi(root);
    const created = await createDeepseekHome(home);
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(report.added).toEqual(created);
    expect(readdirSync(join(chezmoi.source, 'dot_claude-deepseek')).sort()).toEqual(['env.vars', 'mcp.json', 'settings.json']);
    const again = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(again.added).toEqual([]);
    expect(readFileSync(chezmoi.addLog, 'utf8').trim().split('\n')).toHaveLength(1);
  });

  it('does not add a file that holds a key or token', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    const chezmoi = fakeChezmoi(root);
    await createDeepseekHome(home);
    const envVars = join(home, '.claude-deepseek', 'env.vars');
    writeFileSync(envVars, 'DEEPSEEK_API_KEY=sk-test\n');
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(report.added).not.toContain(envVars);
    expect(report.messages.join('\n')).toContain(envVars);
    expect(readdirSync(join(chezmoi.source, 'dot_claude-deepseek')).sort()).toEqual(['mcp.json', 'settings.json']);
  });

  it('changes nothing and prints the chezmoi add command when chezmoi is missing', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    await createDeepseekHome(home);
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: join(root, 'no-chezmoi') });
    expect(report.added).toEqual([]);
    expect(report.messages.join('\n')).toContain(`chezmoi add ${join(home, '.claude-deepseek', 'env.vars')}`);
  });
});

describe('installAgents', () => {
  it('copies the agents into the chezmoi source only and applies those targets', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    const chezmoi = fakeChezmoi(root);
    const report = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: home, chezmoiBin: chezmoi.bin });
    expect(report.installed).toEqual(AGENT_FILES);
    expect(readdirSync(join(chezmoi.source, 'dot_claude', 'agents')).sort()).toEqual(AGENT_FILES);
    expect(existsSync(join(home, '.claude'))).toBe(false);
    expect(readFileSync(chezmoi.applyLog, 'utf8').trim().split(' ')).toEqual(AGENT_FILES.map((name) => join(home, '.claude', 'agents', name)));
    const again = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: home, chezmoiBin: chezmoi.bin });
    expect(again.installed).toEqual([]);
  });

  it('changes nothing and prints where to add the files when chezmoi is missing', async () => {
    const root = tempRoot();
    const report = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: join(root, 'home'), chezmoiBin: join(root, 'no-chezmoi') });
    expect(report.installed).toEqual([]);
    expect(report.messages.join('\n')).toContain('dot_claude/agents/');
    expect(report.messages.join('\n')).toContain(join(REPO_AGENTS, 'claude-opus-high.md'));
    expect(existsSync(join(root, 'home'))).toBe(false);
  });

  it('changes nothing when a target is a chezmoi template', async () => {
    const root = tempRoot();
    const chezmoi = fakeChezmoi(root);
    mkdirSync(join(chezmoi.source, 'dot_claude', 'agents'));
    writeFileSync(join(chezmoi.source, 'dot_claude', 'agents', 'claude-opus-high.md.tmpl'), 'template');
    const report = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: join(root, 'home'), chezmoiBin: chezmoi.bin });
    expect(report.installed).toEqual([]);
    expect(report.messages.join('\n')).toContain('claude-opus-high.md.tmpl');
    expect(readdirSync(join(chezmoi.source, 'dot_claude', 'agents'))).toEqual(['claude-opus-high.md.tmpl']);
    expect(existsSync(chezmoi.applyLog)).toBe(false);
  });
});
```
Run: `npx vitest run test/setup.test.ts`
Expected: the file fails with `Failed to resolve import "../src/setup/install-agents"`

Step 2: Write the agent installer
`src/setup/install-agents.ts`:
```ts
import { execFile } from 'node:child_process';
import { constants, existsSync } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface AgentInstall {
  repoAgentsDir: string;
  homeDir: string;
  chezmoiBin: string;
}

export interface AgentInstallReport {
  installed: string[];
  messages: string[];
}

async function chezmoiClaudeSource(install: AgentInstall): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(install.chezmoiBin, ['source-path', join(install.homeDir, '.claude')]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function agentBlocker(name: string, sourceEntries: string[], homeDir: string): string | null {
  const variant = sourceEntries.find((entry) => entry !== name && (entry.endsWith(`_${name}`) || entry.endsWith(`${name}.tmpl`)));
  if (variant) return `${variant} in the chezmoi source is not a plain file for ${name}.`;
  if (existsSync(join(homeDir, '.claude', 'agents', name))) return `~/.claude/agents/${name} exists outside chezmoi.`;
  return null;
}

export async function installAgents(install: AgentInstall): Promise<AgentInstallReport> {
  const agentFiles = (await readdir(install.repoAgentsDir)).filter((name) => name.endsWith('.md')).sort();
  const repoPaths = (names: string[]) => names.map((name) => join(install.repoAgentsDir, name)).join(', ');
  const claudeSource = await chezmoiClaudeSource(install);
  if (!claudeSource) {
    return {
      installed: [],
      messages: [`chezmoi is missing or does not manage ~/.claude; nothing was changed. Add ${repoPaths(agentFiles)} to your chezmoi source under dot_claude/agents/.`],
    };
  }
  const agentsSource = join(claudeSource, 'agents');
  const sourceEntries = existsSync(agentsSource) ? await readdir(agentsSource) : [];
  const missing = agentFiles.filter((name) => !sourceEntries.includes(name));
  const blockers = missing.map((name) => agentBlocker(name, sourceEntries, install.homeDir)).filter((blocker) => blocker !== null);
  if (blockers.length) {
    return { installed: [], messages: [...blockers, `Nothing was changed. Add ${repoPaths(missing)} to ${agentsSource} by hand.`] };
  }
  if (!missing.length) return { installed: [], messages: ['The Claude agent files are already in the chezmoi source.'] };
  await mkdir(agentsSource, { recursive: true });
  for (const name of missing) {
    await copyFile(join(install.repoAgentsDir, name), join(agentsSource, name), constants.COPYFILE_EXCL);
  }
  await execFileAsync(install.chezmoiBin, ['apply', ...missing.map((name) => join(install.homeDir, '.claude', 'agents', name))]);
  return { installed: missing, messages: [`Added ${missing.join(', ')} to ${agentsSource} and applied them with chezmoi.`] };
}
```
Run: `npx vitest run test/setup.test.ts && npm run typecheck`
Expected: `7 passed`, and typecheck exits 0

Commit:
```bash
git add src/setup/install-agents.ts test/setup.test.ts
git commit -m "feat(setup): install the Claude agents through chezmoi" -m "Plan-task: 20"
```

### Task 21: Setup: check the Max settings and wire npm run setup

Depends on: Task 20
Risk: persisted user config: setup must never write under ~/.claude/ and fails when ~/.claude/settings.json holds an ANTHROPIC_ variable

Files:
- Create: `src/setup/find-anthropic-variables.ts`
- Create: `src/setup/run-setup.ts`
- Modify: `test/setup.test.ts`

Step 1: Add the failing settings-check and npm run setup tests
`test/setup.test.ts`:
```ts
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { addDeepseekHomeToChezmoi } from '../src/setup/add-deepseek-home-to-chezmoi';
import { createDeepseekHome } from '../src/setup/create-deepseek-home';
import { findAnthropicVariables } from '../src/setup/find-anthropic-variables';
import { installAgents } from '../src/setup/install-agents';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO_AGENTS = join(ROOT, 'agents');
const AGENT_FILES = ['claude-opus-high.md', 'claude-opus-xhigh.md', 'claude-sonnet-high.md'];

function fakeChezmoi(root: string) {
  const source = join(root, 'chezmoi');
  const applyLog = join(root, 'apply.log');
  const addLog = join(root, 'add.log');
  mkdirSync(join(source, 'dot_claude'), { recursive: true });
  const bin = join(root, 'bin', 'chezmoi');
  mkdirSync(join(root, 'bin'));
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'case "$1" in',
      '  source-path) case "$2" in',
      `      */.claude) echo "${source}/dot_claude" ;;`,
      `      *) test -e "${source}/dot_claude-deepseek/$(basename "$2")" || exit 1 ;;`,
      '    esac ;;',
      `  apply) shift; echo "$@" >> "${applyLog}" ;;`,
      `  add) shift; mkdir -p "${source}/dot_claude-deepseek"; for path in "$@"; do touch "${source}/dot_claude-deepseek/$(basename "$path")"; done; echo "$@" >> "${addLog}" ;;`,
      '  *) exit 1 ;;',
      'esac',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
  return { bin, source, applyLog, addLog };
}
const tempRoot = () => mkdtempSync(join(tmpdir(), 'routemax-setup-'));

describe('createDeepseekHome', () => {
  it('creates env.vars, mcp.json and settings.json, then never overwrites them', async () => {
    const home = tempRoot();
    const created = await createDeepseekHome(home);
    expect(created).toHaveLength(3);
    const envVars = readFileSync(join(home, '.claude-deepseek', 'env.vars'), 'utf8');
    expect(envVars).toContain('ANTHROPIC_BASE_URL=http://127.0.0.1:8787\n');
    expect(envVars).toContain('ANTHROPIC_MODEL=deepseek-v4-pro\n');
    expect(envVars).toContain('ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash\n');
    expect(envVars).toContain('CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro\n');
    expect(envVars).toContain(`CLAUDE_CONFIG_DIR=${join(home, '.claude-deepseek')}\n`);
    expect(envVars).not.toMatch(/KEY|TOKEN/);
    expect(JSON.parse(readFileSync(join(home, '.claude-deepseek', 'mcp.json'), 'utf8'))).toEqual({ mcpServers: {} });
    expect(JSON.parse(readFileSync(join(home, '.claude-deepseek', 'settings.json'), 'utf8'))).toEqual({ effortLevel: 'high' });
    writeFileSync(join(home, '.claude-deepseek', 'env.vars'), 'EDITED=1\n');
    expect(await createDeepseekHome(home)).toEqual([]);
    expect(readFileSync(join(home, '.claude-deepseek', 'env.vars'), 'utf8')).toBe('EDITED=1\n');
  });
});

describe('addDeepseekHomeToChezmoi', () => {
  it('adds the created files to the chezmoi source once', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    const chezmoi = fakeChezmoi(root);
    const created = await createDeepseekHome(home);
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(report.added).toEqual(created);
    expect(readdirSync(join(chezmoi.source, 'dot_claude-deepseek')).sort()).toEqual(['env.vars', 'mcp.json', 'settings.json']);
    const again = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(again.added).toEqual([]);
    expect(readFileSync(chezmoi.addLog, 'utf8').trim().split('\n')).toHaveLength(1);
  });

  it('does not add a file that holds a key or token', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    const chezmoi = fakeChezmoi(root);
    await createDeepseekHome(home);
    const envVars = join(home, '.claude-deepseek', 'env.vars');
    writeFileSync(envVars, 'DEEPSEEK_API_KEY=sk-test\n');
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: chezmoi.bin });
    expect(report.added).not.toContain(envVars);
    expect(report.messages.join('\n')).toContain(envVars);
    expect(readdirSync(join(chezmoi.source, 'dot_claude-deepseek')).sort()).toEqual(['mcp.json', 'settings.json']);
  });

  it('changes nothing and prints the chezmoi add command when chezmoi is missing', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    await createDeepseekHome(home);
    const report = await addDeepseekHomeToChezmoi({ homeDir: home, chezmoiBin: join(root, 'no-chezmoi') });
    expect(report.added).toEqual([]);
    expect(report.messages.join('\n')).toContain(`chezmoi add ${join(home, '.claude-deepseek', 'env.vars')}`);
  });
});

describe('installAgents', () => {
  it('copies the agents into the chezmoi source only and applies those targets', async () => {
    const root = tempRoot();
    const home = join(root, 'home');
    const chezmoi = fakeChezmoi(root);
    const report = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: home, chezmoiBin: chezmoi.bin });
    expect(report.installed).toEqual(AGENT_FILES);
    expect(readdirSync(join(chezmoi.source, 'dot_claude', 'agents')).sort()).toEqual(AGENT_FILES);
    expect(existsSync(join(home, '.claude'))).toBe(false);
    expect(readFileSync(chezmoi.applyLog, 'utf8').trim().split(' ')).toEqual(AGENT_FILES.map((name) => join(home, '.claude', 'agents', name)));
    const again = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: home, chezmoiBin: chezmoi.bin });
    expect(again.installed).toEqual([]);
  });

  it('changes nothing and prints where to add the files when chezmoi is missing', async () => {
    const root = tempRoot();
    const report = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: join(root, 'home'), chezmoiBin: join(root, 'no-chezmoi') });
    expect(report.installed).toEqual([]);
    expect(report.messages.join('\n')).toContain('dot_claude/agents/');
    expect(report.messages.join('\n')).toContain(join(REPO_AGENTS, 'claude-opus-high.md'));
    expect(existsSync(join(root, 'home'))).toBe(false);
  });

  it('changes nothing when a target is a chezmoi template', async () => {
    const root = tempRoot();
    const chezmoi = fakeChezmoi(root);
    mkdirSync(join(chezmoi.source, 'dot_claude', 'agents'));
    writeFileSync(join(chezmoi.source, 'dot_claude', 'agents', 'claude-opus-high.md.tmpl'), 'template');
    const report = await installAgents({ repoAgentsDir: REPO_AGENTS, homeDir: join(root, 'home'), chezmoiBin: chezmoi.bin });
    expect(report.installed).toEqual([]);
    expect(report.messages.join('\n')).toContain('claude-opus-high.md.tmpl');
    expect(readdirSync(join(chezmoi.source, 'dot_claude', 'agents'))).toEqual(['claude-opus-high.md.tmpl']);
    expect(existsSync(chezmoi.applyLog)).toBe(false);
  });
});

describe('findAnthropicVariables', () => {
  it('names every ANTHROPIC_ variable in the Max settings file', async () => {
    const path = join(tempRoot(), 'settings.json');
    writeFileSync(path, JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'http://127.0.0.1:8787', OTHER: '1' } }));
    expect(await findAnthropicVariables(path)).toEqual(['ANTHROPIC_BASE_URL']);
    writeFileSync(path, JSON.stringify({ env: { OTHER: '1' } }));
    expect(await findAnthropicVariables(path)).toEqual([]);
    expect(await findAnthropicVariables(join(tempRoot(), 'missing.json'))).toEqual([]);
  });
});

describe('npm run setup', () => {
  const runSetup = (home: string, pathPrefix: string) =>
    spawnSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'src/setup/run-setup.ts')], {
      env: { ...process.env, HOME: home, PATH: `${pathPrefix}:${process.env.PATH}` },
      encoding: 'utf8',
    });

  it('writes nothing under ~/.claude/, leaves no ANTHROPIC_ variable there, and prints the registration command', () => {
    const root = tempRoot();
    const home = join(root, 'home');
    mkdirSync(home);
    const chezmoi = fakeChezmoi(root);
    const run = runSetup(home, join(root, 'bin'));
    expect(run.status).toBe(0);
    expect(existsSync(join(home, '.claude'))).toBe(false);
    expect(existsSync(join(chezmoi.source, 'dot_claude', 'agents', 'claude-opus-high.md'))).toBe(true);
    expect(readFileSync(chezmoi.addLog, 'utf8')).toContain(join(home, '.claude-deepseek', 'env.vars'));
    expect(run.stdout).toContain('claude mcp add -s user deepseek-delegate -- ');
  });

  it('fails when ~/.claude/settings.json holds an ANTHROPIC_ variable', () => {
    const root = tempRoot();
    const home = join(root, 'home');
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ env: { ANTHROPIC_MODEL: 'deepseek-v4-pro' } }));
    fakeChezmoi(root);
    const run = runSetup(home, join(root, 'bin'));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('ANTHROPIC_MODEL');
  });
});
```
Run: `npx vitest run test/setup.test.ts`
Expected: the file fails with `Failed to resolve import "../src/setup/find-anthropic-variables"`

Step 2: Write the settings check and the setup entry
`src/setup/find-anthropic-variables.ts`:
```ts
import { readFile } from 'node:fs/promises';

export async function findAnthropicVariables(settingsFile: string): Promise<string[]> {
  let text: string;
  try {
    text = await readFile(settingsFile, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return [...new Set(text.match(/ANTHROPIC_[A-Z0-9_]+/g) ?? [])];
}
```
`src/setup/run-setup.ts`:
```ts
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDeepseekHomeToChezmoi } from './add-deepseek-home-to-chezmoi';
import { createDeepseekHome } from './create-deepseek-home';
import { findAnthropicVariables } from './find-anthropic-variables';
import { installAgents } from './install-agents';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const homeDir = homedir();

for (const path of await createDeepseekHome(homeDir)) console.log(`Created ${path}`);

const deepseekHome = await addDeepseekHomeToChezmoi({ homeDir, chezmoiBin: 'chezmoi' });
for (const message of deepseekHome.messages) console.log(message);

const agents = await installAgents({ repoAgentsDir: join(repoRoot, 'agents'), homeDir, chezmoiBin: 'chezmoi' });
for (const message of agents.messages) console.log(message);

const leaked = await findAnthropicVariables(join(homeDir, '.claude', 'settings.json'));
if (leaked.length) {
  console.error(`~/.claude/settings.json holds ${leaked.join(', ')}. Remove them from its chezmoi source so the Max session keeps its own model and login.`);
  process.exitCode = 1;
}

console.log(`Register the server: claude mcp add -s user deepseek-delegate -- ${join(repoRoot, 'node_modules/.bin/tsx')} ${join(repoRoot, 'src/server.ts')}`);
```
Run: `npx vitest run test/setup.test.ts && npm run typecheck`
Expected: `10 passed`, and typecheck exits 0

Commit:
```bash
git add src/setup/find-anthropic-variables.ts src/setup/run-setup.ts test/setup.test.ts
git commit -m "feat(setup): check the Max settings and wire npm run setup" -m "Plan-task: 21"
```

### Task 22: Add the opt-in live check and the README

Depends on: Task 15, Task 16, Task 21

Files:
- Create: `scripts/live-check.mjs`
- Create: `README.md`

Step 1: Write the opt-in live check
`scripts/live-check.mjs`:
```js
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
```
Run: `chmod +x scripts/live-check.mjs && node scripts/live-check.mjs; echo "exit $?"`
Expected: `live-check spends DeepSeek credit (a few cents). Run it with --spend.` then `exit 0`, and no worker starts

Step 2: Write the README
`README.md`:
````md
# routemax

`deepseek-delegate` is an MCP server for the Claude Max session. Its one tool, `delegate`, runs a cheap task in a headless DeepSeek V4 worker (`claude -p` behind the local repair-proxy) and returns a short summary, the changed files and the cost. A task that belongs on Claude comes back as `use_claude` with the agent, model and effort to use instead. The Max session's model, login and context stay as they are.

## Setup

1. Install dependencies: `npm install`
2. Store the DeepSeek key in Keychain once: `security add-generic-password -a "$USER" -s deepseek_api_key -w`
3. Run `npm run setup`. It creates `~/.claude-deepseek/env.vars`, `mcp.json` and `settings.json` when they are missing, adds those three to your chezmoi source when chezmoi does not manage them yet (never a file that names a key or token), adds the Claude agent files to your chezmoi source, and fails when `~/.claude/settings.json` holds an `ANTHROPIC_*` variable.
4. Register the server with the command setup prints: `claude mcp add -s user deepseek-delegate -- <routemax>/node_modules/.bin/tsx <routemax>/src/server.ts`
5. Restart Claude Code and check that `/mcp` lists `deepseek-delegate`.

## Calling delegate

| Input | Meaning |
|---|---|
| `task` | The complete task. The worker sees none of the conversation. |
| `taskType` | `search`, `read`, `summarize`, `boilerplate`, `tests`, `simple-edit`, `build`, `architecture`, `debugging`, `security`, `auth`, `migration` or `concurrency`. |
| `requestedTier` | The lowest tier to use: `flash-low` < `flash-high` < `pro-high` < `claude`. Routing only raises it. |
| `claudeEffort` | Optional. The effort the task would get on Claude; a higher value raises the worker effort. |
| `flags` | Optional. `irreversible` or `unknown-cause` keep the task on Claude. |

The result has a `status`:

- `done`: a summary, the changed files, tier, model, effort and cost.
- `escalate`: the same fields plus `reason`, one of `exit-code`, `stream-error`, `empty-result`, `tests-failed`, `retries`, `budget`, `timeout` or `test-timeout`. Nothing is reverted.
- `use_claude`: the agent, model and effort to use instead.
- `refused`: the budget cap or a missing setup step blocks the call.

Each call appends one line to `~/.local/state/deepseek-delegate/decisions.jsonl`. The sum of its `costUsd` is the spend counted against the cap.

## Editing config/routing.json

The server reads the file when it starts. After an edit, reconnect the server with `/mcp` or restart Claude Code.

- `tiers`: the DeepSeek model and effort of `flash-low`, `flash-high` and `pro-high`.
- `rules`: each rule has an `id`, a `tier`, and any of `taskTypes`, `keywords` (whole words in the task text) and `flags`. A task goes to the highest tier among its matching rules, and never below `requestedTier`.
- `effortMap`: how a caller's `claudeEffort` maps to a worker effort.
- `claude`: the agents a `claude`-tier task may name (`agents`), which task type gets which agent (`taskTypes`), and `defaultAgent` for the rest. The agent files live in `agents/`.
- `budget`: `totalUsd` caps all spend and `perCallUsd` stops a single call.
- `prices`: USD per 1M tokens per model (`inputUsd`, `cacheHitUsd`, `outputUsd`). Keep them in line with DeepSeek's pricing page.
- `workerTimeoutMs` and `testTimeoutMs`: wall-clock limits for the worker and the test command.
- `retryThreshold`: `null` only logs repair-proxy retries. A number escalates a call with more retries than that.
- `projects`: a test command per absolute project path, for example `{ "/Users/me/code/app": { "testCommand": "npm test" } }`. The worker may run exactly that command, and the server runs it after the worker.
- `exploreRedirect`: the switch for the optional hook below.
- `proxy`: the repair-proxy folder, its log file and its telemetry file.

## Optional: send Explore to delegate

Set `exploreRedirect` to `true` and add this PreToolUse entry to `~/.claude/settings.json` through its chezmoi source:

```json
{
  "matcher": "Agent",
  "hooks": [
    {
      "type": "command",
      "command": "<routemax>/node_modules/.bin/tsx <routemax>/src/hook/explore-redirect-hook.ts"
    }
  ]
}
```

The hook denies only `Explore` subagents and tells the session to call `delegate` with `taskType: "search"`. It does nothing inside a worker.

## Checks

- `npm test` and `npm run typecheck`.
- `node scripts/live-check.mjs --spend` runs four live calls against the real proxy and DeepSeek and prints the total cost. It spends a few cents.
````
Run: `awk '/^## Setup/{f=1;next} /^## /{f=0} f && /^[0-9]+\. /' README.md | wc -l && grep -ciE 'credit|attribution|acknowledg|thanks' README.md; grep -c '^## Editing config/routing.json' README.md`
Expected: `5`, then `0` (no credits or attribution text), then `1`

Commit:
```bash
git add scripts/live-check.mjs README.md
git commit -m "docs: add the opt-in live check and the README" -m "Plan-task: 22"
```

## Final verification

- `npm test`: every suite passes, `0 failed`. This covers router, effort mapping for all five Claude levels, budget refusal, mid-call $0.25 stop and spent-to-date from the log, all eight escalation reasons, retries logged without `escalate` while the threshold is unset, the proxy never stopped (also one the server started), setup writing only into the chezmoi source with a printed instruction when chezmoi is missing, the recursion guard, the hook (off by default, only Explore, no-op at depth ≥ 1), the stdio integration run with a real `claude -p` worker against the fake upstream, and the fake key absent from the decision log, the server stderr and every result.
- `npm run typecheck`: exits 0 with no output.
- `grep -c 'ANTHROPIC_' ~/.claude/settings.json`: prints `0` after `npm run setup` on this Mac.
- `node scripts/live-check.mjs --spend` (user-run, spends cents): prints `PASS search comes back as flash-low`, `PASS build comes back as flash-high`, `PASS security comes back as use_claude`, `PASS a forced-broken worker gives escalate` and a `total cost:` line.
- Manual, in a Max session after one `delegate` call: `/context` still shows the 1M window, and `/usage` still shows the usage meters.
- Manual: `tail -1 ~/.local/state/deepseek-delegate/decisions.jsonl` shows `cwd` equal to the project the Max session runs in. If it shows another directory, Claude Code does not start user-scope MCP servers in the session's directory, and `src/server.ts` needs a working-directory input.
- Walkthrough: in a Max session in any project, ask Claude to call the `delegate` tool with `taskType: "search"` and a question about the repository, and read the `done` result with its summary and cost.
