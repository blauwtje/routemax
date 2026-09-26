# Lean dashboard and smart routing

## Goal
The Providers, Routing and Settings pages open short, with each provider or rule as one row that opens an editor and rare settings under one Advanced fold. Every delegated task gets its model and effort from a smart router. The Overview shows Claude's API-equivalent cost in place of $0. Text on buttons and other controls cannot be selected.

## Decisions
- Smart routing: free scoring of the task text decides the confident cases, and only an unclear task gets a check by the cheapest DeepSeek model (the flash-low tier's provider and model). Rules that keep a task on Claude still win. Decided by the user.
- Page layout: short lists whose rows open a sheet or dialog to edit, with rarely used settings folded under one "Advanced" section per page. Nothing leaves the dashboard. Decided by the user.
- Claude cost: read Claude Code's session logs on this Mac and price them at Anthropic list rates, labelled "API-equivalent" and shown next to DeepSeek spend. Decided by the user.
- The check never sees a task a Claude-only rule matched, so auth, security, migration and irreversible tasks never go to DeepSeek. Decided by exo, from the rule order in `src/routing/route-task.ts`.

## Assumptions
- Scope is the Providers, Settings and Routing pages. The Overview only gets the Claude cost change. Rival reading: "routing overview" meant the Overview page too.
- Providers: one row per provider shows name, on/off, key status and last test result. The row opens a sheet holding fields, models, key and test, and the repair proxy and effort list sit under Advanced there.
- Routing opens on the tier ladder, the tier table, the smart routing switch and a "try a task" box. Rules, the effort map and the Claude agents editor go under Advanced, and rules become a table edited in a dialog.
- Settings opens on the budget. Timeouts, retries, the Claude command, the proxy folder, explore redirect and project commands go under Advanced.
- Smart routing also picks the Claude agent and effort for a task that ends on Claude. A Claude task-type mapping in the config still wins over it.
- Smart routing never lowers a task below the tier the caller requested, and a rule-raised tier stays the floor.
- If the check fails or times out (3 s), the score's result stands, and if smart routing is switched off, today's rules decide alone.
- The check's cost is added to that task's logged cost and counts against the DeepSeek budget.
- The "try a task" preview runs rules and scoring only and says when the paid check would run. It never spends money.
- Claude cost covers all Claude Code use on this Mac, not only tasks routemax handed back, and does not count against the DeepSeek budget.
- routemax keeps its own daily Claude totals, so history survives Claude's 30-day log cleanup.
- The config gains a smart routing section whose default is on, so an existing config file loads unchanged.
- The decision log gains how each task was routed and why. Older lines without those fields still load.
- Buttons, tabs, switches, menu items and nav links cannot have their text selected. Text in inputs and tables still can.
- The uncommitted v3 redesign is committed first on this branch as the starting point. `docs/plans/routemax-dashboard.md` and `.claude/skills/{redesign-skill,taste-skill}/` stay out of it.

## Acceptance
- A task whose text is clearly a lookup lands on flash-low at low effort without a paid check, and a clearly hard build lands on pro-high at high effort, in `test/score-task.test.ts` and `test/smart-route.test.ts`.
- An unclear task triggers exactly one check call, and a failed or slow check falls back to the score, in `test/check-task.test.ts` and `test/smart-route.test.ts`.
- A task a Claude-only rule matches never reaches the check, in `test/smart-route.test.ts`.
- A delegate call logs how it was routed and why, and adds the check cost to its cost, in `test/delegate.test.ts`.
- The route preview answers without a paid call and reports whether a check would run, in `test/route-preview-api.test.ts`.
- Duplicate streamed log lines count once, with the largest output kept, in `test/read-claude-usage.test.ts`.
- One-hour cache writes are priced at 2x input and five-minute writes at 1.25x, in `test/claude-prices.test.ts`.
- A day that vanished from the transcripts keeps its stored total, in `test/claude-usage-store.test.ts`.
- `/api/stats` reports a non-zero Claude cost for fixture transcripts while the budget's spent figure stays DeepSeek-only, in `test/stats-api.test.ts`.
- The whole app type-checks, the tests pass and the web build succeeds: the Success criterion.

## Manual checks
- Providers, Routing and Settings each fit their main content on one laptop screen before the Advanced fold.
- A provider row opens its sheet, and a rule row opens its dialog; saving from either works.
- The Overview shows a Claude cost labelled API-equivalent after a day of Claude Code use.
- Dragging across a button, tab or nav link selects no text.

## Visual direction
The existing identity stays: v3 "Night instrument" in `docs/design/direction.json` (Instrument Serif, Geist, Geist Mono, dark only). The ambition is structural (shorter pages, list plus sheet, one Advanced fold), not a new look. No variant choice is made. Each task with a `Design:` line runs design-ui as a bounded change against that direction.

## Plan basis
Repository: /Users/thomash/Documents/Code/personal/tools/routemax
Branch: feat/lean-dashboard-smart-routing
Worktree setup: npm install

## Success criterion
`npm run typecheck && npm test && npm run build:web` passes.

## Checkpoint
- Blocks first: Task 1 (the smart routing config every routing task reads) and Task 13 (the dialog, sheet and collapsible primitives every page task uses).
- Parallel: Tasks 1, 2, 3, 7, 8, 12 and 13 need no earlier task.
- Shared state: `src/ui/api-routes.ts` and `web/src/lib/api-types.ts` (Tasks 6 and 10, chained through 10 depending on 6).
- Smallest safe split: one module with its own test per server task, one page per web task.

## Tasks
### Task 1: feat(config): add a smart routing section that defaults to on
Depends on: none | Files: `src/config/config-schema.ts`, `config/routing.json`, `test/config-schema.test.ts` | Data: a `smartRouting: { enabled: boolean, checkTimeoutMs: number }` object on the v2 config schema with a zod default of `{ enabled: true, checkTimeoutMs: 3000 }`, so a config without it still parses | Proof: npx vitest run test/config-schema.test.ts

### Task 2: feat(routing): score a task's text for tier and effort
Depends on: none | Files: `src/routing/score-task.ts`, `test/score-task.test.ts` | Data: a pure function from task text and task type to a `{ tier, effort, confident: boolean, signals: string[] }` object, built from weighted signals (code presence, reasoning markers, named file count, text length, action verbs such as find/read/summarize versus build/implement/refactor) | Proof: npx vitest run test/score-task.test.ts

### Task 3: feat(routing): ask the cheapest DeepSeek model to classify an unclear task
Depends on: none | Files: `src/routing/check-task.ts`, `test/check-task.test.ts` | Data: an async function taking task text, a `{ baseUrl, apiKey, model, price }` target, a timeout and an injected fetch, posting one Anthropic-format `/v1/messages` request that asks for `{ tier, effort }` JSON and returning `{ tier, effort, costUsd }` or `null` on any error, timeout or invalid reply; read `../build-change/references/security.md` first, since the API key and task text leave the machine and the key must never be logged | Proof: npx vitest run test/check-task.test.ts

### Task 4: feat(routing): combine rules, score and check into one smart route
Depends on: 1, 2, 3 | Files: `src/routing/smart-route.ts`, `test/smart-route.test.ts` | Data: an async function returning the existing `RoutePlan` plus `{ routedBy: 'rules' | 'score' | 'check' | 'off', routeReason: string, checkCostUsd: number }`; order is rules first (a Claude-only match returns without a check), then the score, then the check only when the score is not confident and smart routing is on; the tier is the highest of requested, rule and smart tier, the worker effort passes through `fitEffort`, and a Claude result picks the configured agent whose effort is nearest the smart effort unless `claude.taskTypes` maps the task type | Proof: npx vitest run test/smart-route.test.ts

### Task 5: feat(delegate): route delegate calls through the smart router and log how
Depends on: 4 | Files: `src/delegate/delegate.ts`, `src/decision-log/decision-log.ts`, `test/delegate.test.ts`, `src/server.ts`, `src/ui/run-ui.ts`, `src/ui/provider-test.ts`, `test/provider-test.test.ts`, `test/integration/provider-test-http.test.ts` | Data: optional `routedBy` and `routeReason` fields on the decision record, with the check cost added to that record's `costUsd`; `DelegateDeps` gains an injected fetch, threaded through its two callers, and the provider test disables smart routing so it still exercises the pinned tier | Proof: npx vitest run test/delegate.test.ts

### Task 6: feat(ui): preview the smart route without the paid check
Depends on: 4 | Files: `src/routing/smart-route.ts`, `src/ui/api-routes.ts`, `web/src/lib/api-types.ts`, `test/route-preview-api.test.ts` | Data: the route-preview reply gains `routedBy`, `routeReason` and a `wouldCheck: boolean`, computed from rules and the score only | Proof: npx vitest run test/route-preview-api.test.ts

### Task 7: feat(claude-usage): read and dedupe Claude Code usage from session logs
Depends on: none | Files: `src/claude-usage/read-claude-usage.ts`, `test/read-claude-usage.test.ts`, `test/fixtures/claude-projects/demo/session-a.jsonl`, `test/fixtures/claude-projects/demo/session-b.jsonl` | Data: a `Map` keyed by `message.id` plus `requestId` across every `*.jsonl` under `$CLAUDE_CONFIG_DIR/projects`, `~/.claude/projects` and `~/.config/claude/projects`, keeping the line with the largest `output_tokens`, then rolled into `{ [day]: { [model]: usage } }` with 5-minute and 1-hour cache writes kept apart, cached in memory per file path, mtime and size; read `../build-change/references/security.md` first, because the transcripts hold private conversation: parse only ids, timestamp, model and usage, and never keep, return or log message content | Proof: npx vitest run test/read-claude-usage.test.ts

### Task 8: feat(claude-usage): price Claude usage at Anthropic list rates
Depends on: none | Files: `src/claude-usage/claude-prices.ts`, `test/claude-prices.test.ts` | Data: a bundled table keyed by model-name prefix with per-million-token input, output, cache read, 5-minute cache write (1.25x input) and 1-hour cache write (2x input) rates, taken from Anthropic's current pricing page through check-docs at build time; an unknown model yields a `null` cost that the caller counts as unpriced tokens | Proof: npx vitest run test/claude-prices.test.ts

### Task 9: feat(claude-usage): keep daily Claude totals beyond transcript cleanup
Depends on: 7, 8 | Files: `src/claude-usage/claude-usage-store.ts`, `src/config/routemax-paths.ts`, `test/claude-usage-store.test.ts` | Data: a JSON file at `~/.local/state/routemax/claude-usage.json` shaped `{ days: { [day]: { [model]: { usage, costUsd: number | null } } } }`, where days found in the transcripts overwrite stored ones and other days are kept, written atomically like `recordProviderTest` | Proof: npx vitest run test/claude-usage-store.test.ts

### Task 10: feat(stats): report Claude's API-equivalent cost beside DeepSeek spend
Depends on: 6, 9 | Files: `src/ui/decision-stats.ts`, `src/ui/api-routes.ts`, `web/src/lib/api-types.ts`, `test/decision-stats.test.ts`, `test/stats-api.test.ts` | Data: each period gains `claude: { costUsd, unpricedTokens, byModel }` and fills `byTier.claude.costUsd` from it, the reply gains `claudeByDay: Record<string, number>` for the last 7 days, and `budget.spentUsd` stays DeepSeek-only | Proof: npx vitest run test/stats-api.test.ts test/decision-stats.test.ts

### Task 11: feat(overview): show Claude's cost labelled API-equivalent
Depends on: 10 | Files: `web/src/features/overview/tier-breakdown.tsx`, `web/src/features/overview/overview-figures.tsx`, `web/src/features/overview/tier-stat-card.tsx`, `web/src/features/overview/use-daily-tier-spend.ts` | Data: the stats reply's `claude` and `claudeByDay` fields drive the Claude tier's figure and daily series, with an "API-equivalent" label on every Claude figure | Design: design-ui | Proof: npm run typecheck

### Task 12: fix(web): stop control text from being selected
Depends on: none | Files: `web/src/index.css` | Data: one base-layer rule setting `user-select: none` on `button`, `[role=button]`, `[role=tab]`, `[role=switch]`, `[role=menuitem]`, `summary` and nav links, leaving inputs and tables selectable | Proof: npm run build:web

### Task 13: feat(web): add dialog, sheet and collapsible primitives
Depends on: none | Files: `web/src/components/ui/dialog.tsx`, `web/src/components/ui/sheet.tsx`, `web/src/components/ui/collapsible.tsx` | Data: the shadcn base-nova components over the already installed `@base-ui/react`, added with the shadcn CLI and adding no npm dependency | Proof: npm run typecheck

### Task 14: feat(web): add one Advanced fold for rarely used settings
Depends on: 13 | Files: `web/src/components/advanced-section.tsx` | Data: a component over the collapsible primitive taking a title, a one-line summary of what it holds and children, closed by default and one level deep | Design: design-ui | Proof: npm run typecheck

### Task 15: feat(providers): list providers as rows that open an edit sheet
Depends on: 13, 14 | Files: `web/src/features/providers/providers-page.tsx`, `web/src/features/providers/provider-fields.tsx`, `web/src/features/providers/add-provider-form.tsx`, `web/src/features/providers/provider-row.tsx`, `web/src/features/providers/provider-sheet.tsx` | Data: one row per provider id from the existing form values showing name, on/off, key status and last test result; the sheet holds fields, models, key and test, with repair proxy and efforts under the Advanced fold; adding a provider opens in a dialog | Design: design-ui | Proof: npm run typecheck

### Task 16: feat(routing): open Routing on tiers, smart routing and a try-a-task box
Depends on: 1, 6, 14 | Files: `web/src/features/routing/routing-page.tsx`, `web/src/features/routing/route-preview.tsx`, `web/src/features/routing/tier-editor.tsx` | Data: the main view holds the tier ladder, the tier table, a smart routing switch bound to `smartRouting.enabled` and the preview showing `routedBy`, `routeReason` and `wouldCheck`; rules, the effort map and the Claude agents editor move under the Advanced fold | Design: design-ui | Proof: npm run typecheck

### Task 17: feat(routing): edit rules in a table with a dialog
Depends on: 13 | Files: `web/src/features/routing/rule-editor.tsx`, `web/src/features/routing/rule-dialog.tsx`, `web/src/features/routing/list-input.tsx` | Data: one table row per rule in the form's `rules` array showing id, what it matches and its tier; a row or "Add rule" opens the dialog editing one rule by index | Design: design-ui | Proof: npm run typecheck

### Task 18: feat(settings): open Settings on the budget with the rest under Advanced
Depends on: 14 | Files: `web/src/features/settings/settings-page.tsx`, `web/src/features/settings/project-commands.tsx` | Data: the budget fields stay on top, and timeouts, retry threshold, Claude command, proxy folder, explore redirect and project commands sit in one Advanced fold | Design: design-ui | Proof: npm run typecheck
