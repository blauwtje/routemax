# deepseek-delegate

## Goal

A `delegate` MCP tool, called from the normal Claude Max session, runs cheap tasks in a headless DeepSeek V4 worker behind the existing repair-proxy and returns a short summary, and for hard tasks it returns which Claude agent, model and effort the main session should use instead, without the main session's model, auth or context changing.

## Problem

Today every task in the Max session runs on Claude, including search, boilerplate and tests that DeepSeek Flash does for cents. The only DeepSeek route is a separate `deepseek()` terminal session, which splits the work, and that route is currently broken because `~/.claude-deepseek/` no longer exists on this Mac.

## Decisions

### Payment and dependencies

- **No new payment and no attribution (you, Q2).** The only paid service is the existing DeepSeek balance, spent within the cap below. No Anthropic API key and no other paid provider or subscription. Dependencies must be free and open source, and none may require attribution in the README or in the tool's output. Planned dependencies: `@modelcontextprotocol/sdk` and `zod` (runtime), plus `typescript`, `tsx`, `vitest` and `@types/node` (dev), the same toolchain the repair-proxy uses. Verify each license at install time.
- **Budget (you, Q4).** Hard cap of $10 total and $0.25 per call, set in config. Before a call starts, the tool refuses with a clear message when the total spent so far plus the per-call cap would exceed the total cap. During a call it adds up cost from the `usage` in each stream-json event. When a call passes $0.25, the tool stops the worker and returns `escalate` with reason `budget`. Spent-to-date is the sum of `costUsd` in the decision log, so there is one source of truth. Per-model prices (input, cache hit, output, per 1M tokens) live in config. The build checks them against DeepSeek's current pricing page.

### Main session

- **Main session untouched (you).** There is no proxy for Anthropic traffic, and no code reads, copies or forwards the OAuth token. Setup writes no `ANTHROPIC_*` variable into `~/.claude/settings.json` or any other Max-session config. The only changes on the Max side are one MCP server registration at user scope, the agent files and, optionally, one hook entry.
- **Route per task, never per turn (you).** Each `delegate` call is its own worker process and conversation.

### Location and setup

- **Location and name (code: `tools/routemax`, empty, next to `deepseek-repair-proxy`).** The code lives in `routemax/`. The MCP server and tool are registered as `deepseek-delegate` / `delegate`. It is TypeScript on stdio using the official MCP SDK.
- **Registration (exo).** User scope via `claude mcp add -s user`, so every project's Max session has it.
- **Recreate `~/.claude-deepseek/` (you, Q3).** A setup script creates `env.vars`, `mcp.json` (`{"mcpServers":{}}`) and `settings.json` only when they are missing, and never overwrites one. It then adds each of the three that chezmoi does not manage yet to the chezmoi source with `chezmoi add`, so the folder cannot be lost again. A file that names a key or token stays out of the chezmoi source, and when chezmoi is missing setup prints the `chezmoi add` command instead. `deepseek()` in `~/.zshrc`, `regression-check.mjs` and the worker all read this one source. `type deepseek` holds no routing values: it reads them from this file.
- **Contents of `env.vars` (you, Q7).** Only the defaults for `deepseek()`, reconstructed from proxy telemetry (`~/.local/state/deepseek-proxy/telemetry.jsonl`, 102 requests until 2026-08-15): `ANTHROPIC_BASE_URL=http://127.0.0.1:8787`, main model `deepseek-v4-pro`, small/fast (title) model `deepseek-v4-flash`, `CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro`. The build checks the exact variable names for the main and small/fast model against current Claude Code docs. The file holds no key.

### Worker

- **Per-call model override (you, Q7).** The worker environment is `env.vars`, then `ANTHROPIC_MODEL` and `CLAUDE_CODE_SUBAGENT_MODEL` both set to the tier's model (a flash task gets flash subagents too), then `ANTHROPIC_AUTH_TOKEN` read from Keychain service `deepseek_api_key` at spawn time, then the tier's effort.
- **Worker command (you, exo for the flags).** `claude -p --output-format stream-json --verbose --setting-sources user --strict-mcp-config --mcp-config ~/.claude-deepseek/mcp.json`, the same isolation flags as `deepseek()`, with `cwd` set to the main session's working directory. Never `--dangerously-skip-permissions`. The build checks flag behavior and the stream-json event shape against the installed Claude Code version.
- **Worker permissions (you, Q1).** Allowed tools are Read, Grep, Glob, Edit and Write, plus `Bash(<testCommand>)` only for the test command configured per project. Everything else is denied. The permission mode lets edits apply without a prompt, and the build picks the exact flag from current docs. The worker works only inside the working directory.
- **Worker timeout (you).** Config holds a wall-clock limit per worker, 10 minutes by default. When a worker runs longer, the tool stops it the same way the budget does and returns `escalate` with reason `timeout`.
- **Proxy lifecycle (exo).** Before spawning, the tool checks `http://127.0.0.1:8787/healthz`. When the proxy is down, it starts it the way `deepseek()` does (`node_modules/.bin/tsx src/server.ts` in the proxy folder, logging to `/tmp/deepseek-proxy.log`). The MCP server never stops the proxy, not even one it started itself, because several sessions share it. The proxy is started detached so it outlives the MCP server. The proxy stays on 127.0.0.1.
- **No recursion (you).** The worker loads only the empty `mcp.json` through `--strict-mcp-config`, so `delegate` is not available to it. As a second guard, the worker gets `DEEPSEEK_DELEGATE_DEPTH=1`, and the server and the hook refuse or no-op when it is ≥ 1.

### Routing and effort

- **Routing config (you, exo for the format).** Rules live in one JSON file in the repo (`config/routing.json`), which avoids a YAML dependency. Tiers in order: `flash-low` < `flash-high` < `pro-high` < `claude`. Each rule maps a task type plus signals (keywords in the task text, a flag from the caller such as `irreversible`) to a tier. Seed rules:
  - search, read and summarize go to `flash-low`
  - boilerplate, tests and simple edits go to `flash-high`
  - a larger build with a clear spec goes to `pro-high`
  - architecture, debugging without a known cause, security, auth, migrations, concurrency and anything irreversible go to `claude`
- **Only upward (you).** The caller passes `taskType`, `requestedTier` and optionally `claudeEffort`. The final tier is the higher of `requestedTier` and the highest matching rule. The router never goes below `requestedTier`.
- **Effort mapping (you, code: `deepseek-repair-proxy/src/telemetry.ts:57`).** The proxy forwards effort unchanged, and telemetry shows `high` and `max` reaching DeepSeek, so the mapping lives in delegate's config: `low`→`low`, `medium` and `high`→`high`, `xhigh` and `max`→`max`. The tier fixes the effort (`flash-low`→`low`, `flash-high` and `pro-high`→`high`), and a higher mapped `claudeEffort` from the caller raises it.

### Claude side

- **Claude tier result (you, exo for names).** A task in the `claude` tier starts no worker. The tool returns `status: "use_claude"` with an agent name, model and effort. The repo ships agent files (for example `claude-opus-xhigh`, `claude-opus-high`, `claude-sonnet-high`). Setup never writes into `~/.claude/` directly, because chezmoi manages it from the `dot_claude` source. Setup finds the source with `chezmoi source-path`, copies the agent files into its `agents` folder without overwriting existing ones, and runs `chezmoi apply` for those targets. When chezmoi is missing or the target is a template or otherwise not a plain file, setup changes nothing and prints which files to add where. Config maps each task type in the `claude` tier to one of them. These are agent files, not skill frontmatter, because of #84262.
- **Exo coexistence (code: `plugins/exo/agents/*.md`, `plugins/exo/hooks/hooks.json`).** Exo pins model and effort in agent frontmatter. Its only PreToolUse hook with a `*` matcher (`delegate-budget.mjs`) acts inside delegates only, so there is no conflict. Exo's agents are never rerouted.

### Escalation and results

- **Escalation (you).** The tool returns `status: "escalate"` with a reason, and never continues silently, when any of these happens:
  - the worker exits non-zero
  - the stream result reports an error
  - the final result text is empty
  - the configured test command fails when the server runs it after the worker (skipped when none is configured)
  - repair-proxy telemetry shows more retries than the retry threshold in config within the worker's time window, only when you have set that threshold (limit: a concurrent `deepseek()` session in that window counts too, because the proxy logs no session id)
  - the budget stops the worker
  - the worker timeout stops the worker
  - the test command runs longer than its own timeout in config (5 minutes by default), and the server stops it and returns reason `test-timeout`
- **Retries logged, not escalated, by default (you).** The retry threshold is unset in the shipped config. Until you set it, the retry count only goes into the decision log and never causes `escalate`.
- **Failed worker leaves its changes (you, Q5).** Nothing is reverted. `escalate` lists every changed file so the main session can continue or revert.
- **Changed files (exo).** Collected from the `file_path` of Edit/Write tool calls in the stream, so it also works outside git.
- **Result shape (you).** A successful call returns `status: "done"`, a summary of at most about 1,500 characters from the worker's final message, the changed files, tier, model, effort and cost. It never returns a transcript.
- **Decision log (you, exo for the path).** Each call appends one JSONL line to `~/.local/state/deepseek-delegate/decisions.jsonl` with:
  - timestamp and working directory
  - task type, requested tier, final tier and the rule that raised it
  - model, effort, input, output and cache tokens, and `costUsd`
  - status, reason and duration
  - the retry count from repair-proxy telemetry in the worker's time window

  The line never holds the API key, auth headers or env contents.

### Hook

- **Explore redirect hook (you, Q6).** An optional PreToolUse hook on the Agent tool, off by default through a switch in `config/routing.json`. When on, it acts only on `subagent_type: "Explore"`. It denies the call with a message telling the session to call `delegate` with `taskType: "search"` instead. It never touches exo agents or other types, and it does nothing when `DEEPSEEK_DELEGATE_DEPTH` ≥ 1. The build checks the hook's input and deny-output format against current Claude Code docs. No CLAUDE.md or rule text repeats what this hook enforces.

### Repair-proxy

- **Changed only when needed (you).** The plan changes nothing in it. If a change becomes necessary, it comes with tests and leaves its 8 uncommitted changes as they are.

## Out of scope

- A proxy, an interceptor or any code path that touches Anthropic traffic or the OAuth token.
- Patching the Claude Code binary.
- Switching models mid-conversation, or routing per turn.
- New shell aliases or functions. `deepseek()` stays as it is and works again once `env.vars` exists.
- Reverting a failed worker's changes, or running the worker in a git worktree.
- Rerouting exo's agents or any agent type other than Explore.
- Automatic learning of rules from the log. You adjust `config/routing.json` by hand.

## Acceptance

1. `npm test` and `npm run typecheck` pass. The tests cover:
   - router: rules match, the tier only goes up, never below `requestedTier`
   - effort mapping for all five Claude levels
   - budget: pre-call refusal, a mid-call stop at $0.25, and spent-to-date read from the log
   - escalation: each of the eight reasons, including `timeout` and `test-timeout`
   - retries: with the threshold unset they are logged and cause no `escalate`
   - the proxy: the MCP server never stops it, also not one it started
   - setup: no write under `~/.claude/`, only in the chezmoi source, and a printed instruction when chezmoi is missing
   - the recursion guard
   - the hook: off by default, only Explore, no-op at depth ≥ 1
2. An integration test runs the MCP server over stdio, calls `delegate`, and lets the worker talk to a fake Anthropic-compatible upstream. It checks that the summary, changed files and cost come back, and that a broken upstream gives `escalate`.
3. `scripts/live-check.mjs` is opt-in: it only runs with an explicit flag because it spends cents. It shows that a search task comes back as `flash-low`, a build task as `flash-high` and a security task as `use_claude`, and that a forced-broken worker gives `escalate`. It prints the total cost.
4. After setup, `~/.claude/settings.json` holds no `ANTHROPIC_*` variable (checked by the setup script and a test). After one `delegate` run in a Max session, `/context` still shows the 1M window and `/usage` still shows the usage meters (manual check).
5. The API key does not appear in the decision log, the stderr of the MCP server or any test output (a test greps for a fake key).
6. The README has setup in at most 5 steps, a section on editing `config/routing.json`, and no credits or attribution section.

## Proof

- The highest automated seam is the stdio MCP server driven like Claude Code drives it, with a real `claude -p` worker against a fake upstream. It runs acceptance 1, 2 and 5.
- The live seam is `scripts/live-check.mjs` against the real proxy and DeepSeek. It runs acceptance 3.
- The Max session itself runs acceptance 4 by hand.
