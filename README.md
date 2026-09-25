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
