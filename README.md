# routemax

`deepseek-delegate` is an MCP server for the Claude Max session. Its one tool, `delegate`, runs a cheap task in a headless DeepSeek worker (`claude -p` behind the local repair-proxy) and returns a short summary, the changed files and the cost. The Max session's model, login and context stay as they are.

## Install

1. Store the DeepSeek key in Keychain once: `security add-generic-password -a "$USER" -s deepseek_api_key -w`
2. Run `npm run setup`, then restart Claude Code.
3. Run `npm run doctor`. Every line should start with `OK`; a `FIX` line says what to do.

Setup installs the dependencies, creates `~/.claude-deepseek/` and adds its files to your chezmoi source, adds the Claude agent files through chezmoi, and registers the server for every project. Running it again changes nothing that is already in place.

The server's instructions tell the Max session to hand search, summaries, tests, small edits and specified builds to `delegate`, so you do not have to ask for it.

## Details

### Calling delegate

| Input | Meaning |
|---|---|
| `task` | The complete task. The worker sees none of the conversation. |
| `taskType` | `search`, `read`, `summarize`, `boilerplate`, `tests`, `simple-edit`, `build`, `architecture`, `debugging`, `security`, `auth`, `migration` or `concurrency`. |
| `requestedTier` | Optional, default `flash-low`. The lowest tier to use: `flash-low` < `flash-high` < `pro-high` < `claude`. Routing only raises it. |
| `claudeEffort` | Optional. The effort the task would get on Claude; a higher value raises the worker effort. |
| `flags` | Optional. `irreversible` or `unknown-cause` keep the task on Claude. |

The result has a `status`:

- `done`: a summary, the changed files, tier, model, effort and cost.
- `escalate`: the same fields plus `reason`, one of `exit-code`, `stream-error`, `empty-result`, `tests-failed`, `retries`, `budget`, `timeout` or `test-timeout`. Nothing is reverted.
- `use_claude`: the agent, model and effort to use instead, and `next`, the Agent call to make.
- `refused`: the budget cap or a missing setup step blocks the call.

Each call appends one line to `~/.local/state/deepseek-delegate/decisions.jsonl`. The sum of its `costUsd` is the spend counted against the cap.

### config/routing.json

The server reads the file when it starts. After an edit, reconnect the server with `/mcp` or restart Claude Code.

- `tiers`: the DeepSeek model and effort of `flash-low`, `flash-high` and `pro-high`.
- `rules`: each rule has an `id`, a `tier`, and any of `taskTypes`, `keywords` (whole words in the task text), `keywordExemptTaskTypes` (task types the keywords never raise) and `flags`. A task goes to the highest tier among its matching rules, and never below `requestedTier`.
- `effortMap`: how a caller's `claudeEffort` maps to a worker effort.
- `claude`: the agents a `claude`-tier task may name, which task type gets which agent, and `defaultAgent` for the rest. The agent files live in `agents/`.
- `budget`: `totalUsd` caps all spend and `perCallUsd` stops a single call.
- `prices`: USD per 1M tokens per model. Keep them in line with DeepSeek's pricing page.
- `workerTimeoutMs` and `testTimeoutMs`: wall-clock limits for the worker and the test command.
- `retryThreshold`: `null` only logs repair-proxy retries. A number escalates a call with more retries than that.
- `projects`: a test command per absolute project path, for example `{ "/Users/me/code/app": { "testCommand": "npm test" } }`. The worker may run exactly that command, and the server runs it after the worker.
- `exploreRedirect`: the switch for the optional hook below.
- `proxy`: the repair-proxy folder, its log file and its telemetry file. A proxy that `delegate` or `npm run doctor` starts writes its telemetry to this path.

### Optional: send Explore to delegate

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

### Checks

- `npm test` and `npm run typecheck`.
- `node scripts/live-check.mjs --spend` runs four live calls against the real proxy and DeepSeek and prints the total cost. It spends a few cents.
