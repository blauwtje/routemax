# Plan: routemax dashboard

## Goal

`routemax ui` opens a local page that shows what the router does, switches `delegate` on and off in open Claude sessions without a restart, and edits every setting including multiple providers, as specified in `docs/specs/routemax-dashboard.md`.

## Plan basis

Repository: /Users/thomash/Documents/Code/personal/tools/routemax
Branch: main
Worktree setup: `npm ci --no-audit --no-fund`

- Planned against `8eb94c7` on `main`. Dirty state: only untracked `docs/` (the spec, this plan, and the earlier `deepseek-delegate` spec and plan).
- Versions read this session: node v24.16.0, Claude Code 2.1.282, chezmoi 2.71.1 at `/opt/homebrew/bin/chezmoi`; `package.json` pins `zod ^4.6.5`, `@modelcontextprotocol/sdk ^1.30.1`, `vitest ^2.1.8`, `typescript ^5.7.2`, `tsx ^4.19.2`; `package-lock.json` exists; no vitest config file; `tsconfig.json` includes `src` and `test`, `moduleResolution` `Bundler`, lib `ES2023`, no DOM.
- Not run by the planning session: every `Run:` line in this plan. `z.url()` (zod 4 top-level string format) was not checked against the installed zod; if `npm run typecheck` rejects it in Task 2, use `z.string().url()` in that one line.
- Executor loads the `run-plan` skill on this plan before the first task.

## Non-goals

- `config/routing.json` (the seed) stays version 1 and byte-for-byte unchanged.
- The `delegate` tool input (`task`, `taskType`, `requestedTier`, `claudeEffort`, `flags`) and the tier set `flash-low` < `flash-high` < `pro-high` < `claude` do not change; no tier is added, removed or renamed.
- The repair-proxy's code (`deepseek-repair-proxy/`) does not change.
- The page is not reachable from another machine and has no login beyond the per-start token.
- Nothing commits or pushes the chezmoi source.
- Agent file contents are not edited; the page only maps task types to existing agents.
- No per-provider budget cap: one total cap, spend shown per provider.
- No history charts beyond today and this week.
- No Radix variant of the components.
- Nothing touches the Max session's settings, model or auth (`~/.claude/settings.json`).

## Context

### Current behavior (read at `8eb94c7`)

- `src/config/delegate-config.ts` holds `TIER_ORDER`, `EFFORT_ORDER`, the types `Tier`, `WorkerTier`, `Effort`, `DelegateConfig`, `ModelPrice`, the zod v1 schema, `DEFAULT_CONFIG_PATH` (`config/routing.json`) and `loadConfig(path = process.env.DEEPSEEK_DELEGATE_CONFIG ?? DEFAULT_CONFIG_PATH)`. The v1 shape: `tiers.<tier> = { model, effort }`, a top-level `prices` map by model, `proxy = { dir, logPath, telemetryPath }`; `telemetryPath` has `~/` expanded by a zod transform.
- Ten files import only types or constants from `delegate-config`: `src/delegate/delegate.ts`, `src/delegate/delegate-result.ts`, `src/routing/route-task.ts`, `src/routing/resolve-effort.ts`, `src/decision-log/decision-log.ts`, `src/doctor/doctor-checks.ts`, `src/worker/stream-state.ts`, `src/worker/worker-env.ts`, `src/budget/usage-cost.ts`, plus `src/server.ts` (which also imports `loadConfig`). `loadConfig()` with no argument is called by `src/server.ts:10`, `src/doctor/run-doctor.ts:10`, `src/setup/run-setup.ts:22` and `src/hook/explore-redirect-hook.ts:7`.
- Tests load the seed through `loadConfig(DEFAULT_CONFIG_PATH)` (`test/route-task.test.ts`, `test/resolve-effort.test.ts`, `test/doctor.test.ts`, `test/delegate.test.ts`, `test/delegate-config.test.ts`) or write a copy of the v1 seed and pass it through `DEEPSEEK_DELEGATE_CONFIG` (`test/explore-redirect.test.ts`, `test/setup.test.ts`, `test/integration/delegate-stdio.test.ts`, `scripts/live-check.mjs`). Because `loadConfig` migrates a version-less file in memory (Task 2), all of them keep working without edits except where a task below lists them.
- `src/delegate/delegate.ts` `runDeepseekTask` reads `config.tiers[tier].model`, prices through `stream.costUsd(config.prices, model)` (lines 73 and 79) and retries through `countProxyRetries(config.proxy.telemetryPath, ...)` (line 77). `workerEnvironment` (lines 86-99) takes `ANTHROPIC_BASE_URL` from `~/.claude-deepseek/env.vars`, requires host `127.0.0.1`, calls `deps.ensureProxy(healthUrl)`, then `deps.readApiKey()`.
- `src/server.ts:48` and `src/doctor/run-doctor.ts:18` call `ensureProxy({ dir: config.proxy.dir, logPath: config.proxy.logPath, telemetryPath: config.proxy.telemetryPath, healthUrl })`. `src/doctor/doctor-checks.ts` `checkProxy` names `deps.config.proxy.logPath` in its failure text.
- `budgetRefusal` in `src/delegate/delegate.ts` and `checkBudget` in `src/doctor/doctor-checks.ts` tell the user to raise `budget.totalUsd` in `config/routing.json`; no test asserts that text.
- Conventions: ESM (`"type": "module"`), relative imports without extension, vitest tests under `test/` named `<unit>.test.ts`, one test file run with `npm test -- test/<name>.test.ts`; path helpers are small exported arrow functions taking `homeDir` (`src/config/deepseek-home.ts`); errors are thrown as `Error` with a plain sentence naming the file or field.

### Decisions

- Live config: `~/.config/routemax/config.json`, version 2. `loadConfig()` without an explicit path and without `DEEPSEEK_DELEGATE_CONFIG` creates it once from the seed (Task 3), so whichever of server, doctor, hook, setup or UI runs first writes it. The seed's original bytes are copied to `~/.local/state/routemax/backups/routing.v1.json` with an exclusive copy that never overwrites.
- `loadConfig` migrates any version-less file in memory (Task 2): tests and `DEEPSEEK_DELEGATE_CONFIG` files may stay version 1.
- Shared pure module `src/config/config-schema.ts` imports only `zod`, so the frontend (Phase 6) can import the same schema. `~/` expansion happens in `src/config/delegate-config.ts`, not in the schema, because `node:os` is not available in the browser.
- `config-schema.ts` holds both persisted formats: `v1ConfigSchema` (read only by `src/config/migrate-config.ts`) and the version 2 `configSchema`. Both extend `sharedFieldsSchema`, so each shared field is defined once.
- Task sizing: Tasks 1-4 move the schema and its import sites four files at a time, so `delegate-config.ts` re-exports the constants and types between Task 1 and Task 7, which deletes that re-export. Task 5 moves the building of the proxy start options out of `src/server.ts` and `src/doctor/run-doctor.ts` so that the version 2 switch does not touch them. Task 7 still changes six files, above the four-file guideline, because the `DelegateConfig` type, the loader, both readers of `prices`/`proxy` (`delegate.ts`, `doctor-checks.ts`) and the two tests that build a config must change in one commit for `npm run typecheck` and `npm test` to stay green.
- The OpenRouter preset lists all five efforts: which efforts OpenRouter's Anthropic endpoint accepts was not confirmed; the owner edits the list on the page and the provider test (Phase 5) shows whether calls pass.
- Off switch (owner's decision): when off, `delegate` is disabled with the SDK's `RegisteredTool.disable()` so it leaves `tools/list`, and the server replaces the CallTool handler through `server.server.setRequestHandler(CallToolRequestSchema, ...)` so a call from a session that did not refresh still gets `use_claude` with `reason: "disabled"` instead of the SDK error `Tool delegate disabled`. That handler validates input with `z.object(shape)` of the same `inputSchema` shape object passed to `registerTool`; no hand-written checks.
- Save uses a sha256 stale check of the file text the page loaded; the switch file is watched with `fs.watchFile`.
- Doctor shape (this plan's proposal, not the owner's decision): `checkEnvVars` and `checkProxy` move from the single `env.vars` proxy URL to one check per enabled provider (key present, proxy answering when `repairProxy` is set).

### Data migration

Persisted format change from the version 1 `config/routing.json` to version 2 at a new path.

| Deployed version | Reads old | Reads new | Writes old | Writes new |
|---|---|---|---|---|
| Old application | required (unchanged seed) | reject (never reads the new path) | reject (never wrote) | reject |
| New application | required (in-memory migrate) | required | reject | required |

Rollback: old code keeps reading the unchanged `config/routing.json`, so reverting the branch needs no data step; edits made on the page since then live only in `~/.config/routemax/config.json` and `backups/`, which old code ignores.

### Shared signatures after Phase 1

- `src/config/config-schema.ts` exports `TIER_ORDER`, `EFFORT_ORDER`, `Tier`, `WorkerTier`, `Effort`, `effortSchema`, `modelPriceSchema`, `sharedFieldsSchema`, `v1ConfigSchema`, `configSchema`, `DelegateConfig`, `Provider`, `RepairProxy`, `ModelPrice`, `formatIssues(error: z.ZodError): string[]`, `configIssues(input: unknown): string[]` (each issue as `<dotted.path>: <message>`).
- `DelegateDeps.ensureProxy` (`src/delegate/delegate.ts`) and `DoctorDeps.ensureProxy` (`src/doctor/doctor-checks.ts`) take the exported `ProxyStart` from `src/proxy/ensure-proxy.ts` (`{ dir, logPath, telemetryPath, healthUrl }`); `src/server.ts` and `src/doctor/run-doctor.ts` pass `ensureProxy` itself. The test fakes in `test/doctor.test.ts` (lines 21, 63, 97) and `test/delegate.test.ts:56` ignore the argument, so they need no change.
- `DelegateConfig` (version 2): `version: 2`, `providers: Record<string, Provider>`, `tiers: Record<WorkerTier, { provider, model, effort }>`, `proxy: { dir }`, plus the unchanged `rules`, `effortMap`, `claude`, `budget`, `workerTimeoutMs`, `testTimeoutMs`, `retryThreshold`, `projects`, `exploreRedirect`, `claudeBin`. `Provider = { name, baseUrl, keychainService, models: Record<string, ModelPrice>, efforts: Effort[], enabled, repairProxy: RepairProxy | null }`, `RepairProxy = { port, logPath, telemetryPath }`.
- `src/config/migrate-config.ts` exports `migrateConfig(raw: unknown): unknown`: a value with a `version` key passes through unchanged; a version-less value is parsed as version 1 and converted.
- `src/config/delegate-config.ts` exports `DEFAULT_CONFIG_PATH`, `loadConfig(path?)` (returns `DelegateConfig` with `~/` expanded in every `repairProxy.logPath` and `telemetryPath`), `ensureLiveConfig(homeDir, seedPath = DEFAULT_CONFIG_PATH): string`.
- `src/config/routemax-paths.ts` exports `liveConfigPath(homeDir)`, `backupsDir(homeDir)`, `v1BackupPath(homeDir)`.
- Interim until Phase 2: `workerEnvironment` still takes the proxy URL from `env.vars` and refuses a tier whose provider has no `repairProxy`; Phase 2 (Task 12) replaces it. Interim until Phase 4: the doctor's `checkProxy` and `checkApiKey` check `providers.deepseek` only.

### Phase 2 notes

- The repair-proxy (`/Users/thomash/Documents/Code/personal/tools/deepseek-repair-proxy/src/config.ts:14-35`) reads `PORT` (default 8787), `UPSTREAM_BASE_URL` (default `https://api.deepseek.com/anthropic`, trailing slashes stripped) and `TELEMETRY_PATH`. `ensureProxy` passes all three from the provider (Task 11), so the migrated DeepSeek provider starts the same proxy as today.
- `ProxyStart` after Task 11: `{ dir, port, upstreamBaseUrl, logPath, telemetryPath }`; the health URL is derived as `http://127.0.0.1:<port>/healthz` through the exported `proxyUrl(port)`.
- `~/.claude-deepseek/env.vars` keeps supplying `CLAUDE_CONFIG_DIR` and the other worker variables; after Task 12 its `ANTHROPIC_BASE_URL` is overridden by the provider's URL, and it is still read by the `deepseek()` shell function, which this plan does not change.
- `test/integration/delegate-stdio.test.ts` wrote a version 1 config whose migrated proxy port is 8787; Task 10 writes a version 2 config with `repairProxy.port` set to the fake upstream's free port, because from Task 11 on the proxy health check uses that port.
- `test/fixtures/fake-claude.mjs` records `hasApiKey: 'ANTHROPIC_API_KEY' in env`. From Task 12 the worker gets `ANTHROPIC_API_KEY` set to the empty string (OpenRouter's Claude Code guide requires it), so `test/delegate.test.ts` expects `hasApiKey: true`; `test/worker-env.test.ts` proves the value is `''` and that the inherited `sk-ant-inherited` is gone.
- `src/routing/plan-route.ts` (Task 14) imports only `config-schema` and the routing modules, so the page's routing test field (Phase 5) calls the same `planRoute` as `delegate` (acceptance 9).
- Every decision log line gets `provider` (Task 15): the tier's provider id for worker calls, `null` for `use_claude` and the recursion refusal. Readers that sum spend per provider (Phase 5) count a line without `provider` as `deepseek`.

### Phase 3 notes

- The switch file is `~/.local/state/deepseek-delegate/enabled` (`routerSwitchPath(homeDir)` in `src/router-switch/router-switch.ts`, Task 17), beside `decisions.jsonl` (`src/decision-log/decision-log.ts` `decisionLogPath`). `isRouterEnabled` returns `false` only when the trimmed text is `off`; a missing file means on; any other read error is thrown.
- `delegate()` reads the switch file itself on every call (Task 17), so the switch decides a call even in a session whose tool list never refreshed. A call while off starts no worker and writes one decision log line with `status: 'disabled'` (a log-only status, `DecisionStatus = DelegateStatus | 'disabled'` in `src/decision-log/decision-log.ts`), `costUsd: 0`, `provider: null` and `finalTier: 'claude'`, so it shows in History (owner's decision); it returns the use_claude handoff for `claudeAgentFor(config, taskType)` plus `reason: 'disabled'`. `claudeAgentFor` (extracted from `planRoute`) and `claudeHandoff` (extracted from `delegate`) come first in Task 16, a behavior-preserving refactor, so both paths read one mapping rule and build one handoff.
- SDK facts read in `node_modules/@modelcontextprotocol/sdk` 1.30.1 (`dist/esm/server/mcp.js`): `RegisteredTool.disable()`/`enable()`/`update({ paramsSchema })` set the field and call `sendToolListChanged()`, which sends `notifications/tools/list_changed` only while connected; `registerTool` registers `tools: { listChanged: true }`; the SDK's own CallTool handler throws `Tool delegate disabled` for a disabled tool (lines 106-107); `Protocol.setRequestHandler` (`dist/esm/shared/protocol.js:886`) overwrites an existing handler without asserting, so `server.server.setRequestHandler(CallToolRequestSchema, ...)` after `registerTool` replaces the SDK handler (Task 19).
- Both watchers use `fs.watchFile` with `WATCH_INTERVAL_MS = 500` (`src/config/watch-config.ts`, Task 18) and `persistent: false`, so the stdio server still exits when its client goes away, and a save by rename (Phase 5) is still seen because `watchFile` polls the path.
- `src/config/delegate-config.ts` exports `activeConfigPath()` (Task 18): `DEEPSEEK_DELEGATE_CONFIG`, else the live path from `ensureLiveConfig(homedir())`. `loadConfig()` defaults to it, and the server watches the same path. Phase 5's UI server reads and writes that path too.
- The replaced CallTool handler validates arguments with `z.object(delegateInputShape(taskTypes))`, the same shape function `registerTool` and `update({ paramsSchema })` receive, and reports a failure as `isError: true` with `formatIssues` lines, as the SDK did.

### Phase 4 notes

- The doctor's `router` line reads `isRouterEnabled` (Task 17) and is `OK` both on and off (spec: off is `OK`, not `FIX`); only an unreadable switch file is a `FIX`. The test `says what to do on every line when nothing is set up` therefore excludes `router` from its every-line-fails assertion.
- `routemax command` uses an injected `DoctorDeps.commandOnPath` (real one: `src/doctor/command-on-path.ts`, which scans `PATH` for an executable with `X_OK`), so tests never depend on the machine's `PATH`. The `bin` arrives in Phase 5 and setup runs `npm link` in Phase 8, so on a machine without a manual `npm link` the real `npm run doctor` shows this line as `FIX` (exit code 1) until then; no Phase 4 `Run:` calls `npm run doctor`.
- Since Task 12 the worker's `ANTHROPIC_BASE_URL` comes from the provider, not `env.vars`, so `checkEnvVars` checks only that `env.vars` exists and points `CLAUDE_CONFIG_DIR` at `~/.claude-deepseek`, which `workerEnvironment` still needs. `proxyBaseUrl` loses its last caller and is deleted.
- Per-provider lines are named `<provider.name> key` and `<provider.name> repair-proxy`, one pair per enabled provider in `providers` order; a disabled provider gets no line, a provider without `repairProxy` gets only the key line. The migrated DeepSeek provider's lines read `DeepSeek key` (unchanged) and `DeepSeek repair-proxy` (was `repair-proxy`). A proxy line stays `Not checked until env.vars is fixed.` while `env.vars` fails, as before.

### Phase 5 notes

- Files live in `src/ui/` (the HTTP side) and `src/config/` (config store, chezmoi sync). The server binds `127.0.0.1` only, on port 0 (the OS picks a free port), with a token from `randomBytes(32).toString('base64url')` per start; the page URL is `http://127.0.0.1:<port>/#token=<token>`.
- Guard (`src/ui/request-guard.ts`, Task 24): every request needs `Host` `127.0.0.1:<port>` or `localhost:<port>`; every `/api/` request also needs header `x-routemax-token` equal to the token; every non-GET/HEAD request also needs `Origin` equal to `http://<Host>` and `Content-Type` `application/json`. Anything else gets 403 with an empty body. Static files (`/`, `/assets/*`) need only the `Host` check, because a browser navigation cannot send a header and the token sits in the fragment, which the browser never sends; static files hold no config or log data.
- Static files come from `web/dist` (Phase 6 must build the Vite app there); a path without an extension falls back to `index.html`; a path that resolves outside the root is 404 (Task 25).
- Config store (Task 26): `GET` returns the live file's parsed JSON plus `hash` = sha256 hex of the file text; a save sends `{ config, baseHash }`; a stale `baseHash` is refused without writing; the previous text goes to `~/.local/state/routemax/backups/config.prev.json` (`previousConfigPath(homeDir)`); writes go to `<path>.<pid>.tmp` then `rename`. Restore swaps the live file and `config.prev.json`, so a second restore undoes the first. The MCP server sees the rename because `fs.watchFile` polls the path (Phase 3 notes).
- Chezmoi (Task 27): `syncChezmoi(targetPath, chezmoiBin)` returns `{ state: 'synced' | 'no-chezmoi' | 'unmanaged' | 'template' | 'failed', message }`; only `synced` ran `chezmoi re-add`; the other states carry the sentence the page shows. It never commits or pushes.
- API contract for Phases 6-7 (JSON bodies; errors are `{ error: <kind>, issues: string[] }` with 403 empty, 409 `stale`, 422 `invalid`, 404 `missing`):
  - `GET /api/config` -> `{ config, hash, previousExists }`; `PUT /api/config` `{ config, baseHash }` -> `{ hash, chezmoi }`; `POST /api/config/restore` `{ baseHash }` -> `{ hash, chezmoi }`.
  - `GET /api/switch` -> `{ enabled }`; `PUT /api/switch` `{ enabled }` -> `{ enabled }` (writes `on`/`off` to `routerSwitchPath`).
  - `GET /api/stats` -> `{ budget: { totalUsd, spentUsd, leftUsd }, spendByProvider: Record<providerId, number>, today: PeriodStats, week: PeriodStats }`, `PeriodStats = { calls, costUsd, byTier: Record<tier, { calls, costUsd }>, byModel: Record<model, { calls, costUsd }>, escalations: Record<reason, number> }`; a line without `provider` counts as `deepseek`; the week runs Monday to Sunday in local time.
  - `GET /api/history` -> `{ records: DecisionRecord[] }`, every line of `decisions.jsonl` including `status: "disabled"` lines (cost 0, Task 17) and `provider-test` lines, `provider` defaulted to `deepseek` when missing.
  - `GET /api/doctor` -> `{ checks: DoctorCheck[] }` built with the same deps as `src/doctor/run-doctor.ts`.
  - `GET /api/keys` -> `{ keys: Record<providerId, { present: boolean }> }`; `PUT /api/keys/<providerId>` `{ key }` -> `{ present: true }`; the key is written through `security -i` on stdin and is refused when it holds `"`, `\` or a control character; it never appears in a response, log line or error.
  - `POST /api/route-preview` `{ config, request: PlanRequest }` -> `RoutePlan` from `planRoute` (Task 14), or 422 when `config` fails `configIssues`; it runs no worker.
  - `POST /api/providers/<providerId>/test` `{ model }` -> `ProviderTestResult = { providerId, model, passed, costUsd, testedAt, detail }`; `GET /api/provider-tests` -> `Record<providerId, ProviderTestResult>` from `~/.local/state/routemax/provider-tests.json`. The test calls `delegate()` with `taskType: 'provider-test'` in a temporary folder, so it is logged and counts against the budget; while the switch is off it fails with the detail that the router is off.
- The `routemax` bin (`bin/routemax.mjs`, Task 38) loads the TypeScript sources with `tsImport` from `tsx/esm/api`, tsx 4.23.15 (checked in `node_modules/tsx`).
- `UiDeps.delegateDeps: () => DelegateDeps` is a factory like `doctorDeps`, called per provider test; `test/helpers/ui-deps.ts` gives the other API tests one that fails loudly (Task 37).
- `src/ui/api-routes.ts` has a `missing` helper that answers 404 `{ error: "missing", issues }`; the keys and provider test routes use it for an unknown provider (Tasks 34, 37).
- Provider ids from the URL are checked with `Object.hasOwn(config.providers, id)`, so `__proto__` or `constructor` is 404, not a prototype lookup.
- Not confirmed: whether `security -i` exits non-zero when its inner command fails; the `PUT /api/keys/<providerId>` route therefore reports `present` from a fresh `readApiKey` lookup after the write, not from the exit code (Task 34).

### Phase 6 notes

- The frontend is an npm workspace, `web/` (`"workspaces": ["web"]` in the root `package.json`), with one root `package-lock.json`; `zod ^4.6.5` is declared in both so one copy is hoisted and `src/config/config-schema.ts` (imports only `zod`) can be imported by the page. Build: `npm run build:web` runs `tsc --noEmit && vite build` in `web/` into `web/dist`; the root `typecheck` also runs the web typecheck (Task 43).
- Versions read from the npm registry on 2026-09-25 and checked by a scratch build in `/tmp` (outside the repository): vite 8.3.1, @vitejs/plugin-react 6.1.1, tailwindcss and @tailwindcss/vite 4.3.3, react 19.3.0, shadcn 4.21.0, skills 1.7.0, @base-ui/react 1.8.0, lucide-react 1.48.0.
- `shadcn@4.21.0 init --base base --preset nova --yes` on that scratch project added exactly `@base-ui/react`, `@fontsource-variable/geist`, `class-variance-authority`, `cn`, `lucide-react`, `shadcn`, `tw-animate-css`, wrote `components.json` (`"style": "base-nova"`, aliases `@/components`, `@/components/ui`, `@/lib/utils`, `@/lib`, `@/hooks`, `iconLibrary` `lucide`), `src/lib/utils.ts` (`export { cn } from "cn"`) and a 129-line `src/index.css` with the theme variables; without `--preset` it stops on an interactive preset prompt. `shadcn add button` then worked without new dependencies.
- Skills: `skills@1.7.0 add <repo> --skill <names> --agent claude-code --copy --yes` was checked for `shadcn/ui` and landed in `./.claude/skills/shadcn/` with a root `skills-lock.json`; `claude-code` is the agent id in `skills add --help`. The spec's names map to the repos' real names: `react-best-practices` is `vercel-react-best-practices`, `composition-patterns` is `vercel-composition-patterns`.
- Not confirmed: that `npm install`, run by the shadcn CLI inside `web/`, writes to the root lock file rather than a `web/package-lock.json` (Task 40 declares every init dependency up front so the CLI has nothing to add, and Task 42 stops on drift otherwise); that the two multi-skill `skills add` calls behave like the checked single-skill call.
- For Phase 7: the shell replaces `web/src/app.tsx` and keeps `web/src/main.tsx` as the entry that only captures the token and renders; pages call the API through `api` from `web/src/lib/browser-api.ts` and catch `ApiError` (`status`, `kind`, `issues`) from `web/src/lib/api-client.ts`; theme tokens live in `web/src/index.css` as shadcn's `:root` and `.dark` variables (the design task replaces the default neutral values); components go to `web/src/components/ui` via `npx shadcn@4.21.0 add <name>` from `web/`; one component per kebab-case file, feature code under `web/src/features/<page>/`. No router library is installed: the static server's fallback to `index.html` (Task 25) allows path-based sections if the shell wants them. Charts (`shadcn add chart`, Recharts), TanStack Table, react-hook-form and `@hookform/resolvers` are added by the Phase 7 task that first uses each.

### Phase 7 notes

- Task 47 Step 1 records the owner's pick in `## Visual direction`; no page task starts while that line still says `pending`.
- `scripts/demo-ui.mjs` isolates the files under `HOME` only. The Keychain is not under `HOME`, so the demo is never used to submit the key form, and a provider test there would run a real worker call with the owner's key: the page walkthroughs read `provider-tests.json` and never press a test button.
- The TanStack Table v9 `initialState` option name is unconfirmed; History passes the records newest first and starts unsorted instead.
- The OpenRouter tier warning (acceptance 10) appears only once an `openrouter` provider is enabled with a model, because the demo's migrated config seeds `openrouter` disabled with no models (Task 6 migration); Routing then warns from the demo's failed `openrouter` test.
- Config pages share `useConfigForm` (Task 52): one react-hook-form instance per page over the whole config, `configSchema` as resolver, save with the loaded hash. Record keys that can hold dots (model names, agent names, project paths) are edited through a `Controller` over the whole record, never registered by key.

### Phase outline

1. Config version 2: schema, migration, loader, live path, backups.
2. Providers in the worker path: worker env, key lookup, proxy per provider, effort fallback, `provider` in the decision log.
3. MCP server: on/off switch and live config reload.
4. Doctor: router on/off, `routemax` on `PATH`, per-provider key and proxy checks.
5. UI HTTP server: `routemax` bin, token, `Host` and `Origin` guard, static files, API.
6. Frontend scaffold and project-local skills.
7. Pages (`Design:` tasks).
8. Setup, README, manual acceptance 3.

## Visual direction

Design skill: design-ui

Direction: Rustig en strak (calm and tight), frozen in Task 47 as `docs/design/direction.json`: dark night-slate ground (L 0.17, hue 220), one teal accent `oklch(0.76 0.12 175)`, Nunito headings over Inter body with tabular numbers, a teal-filled switch band at the top of Overview, soft shadowed cards with icon chips and large numbers, charts in teal steps, compact history rows with tinted status badges. The owner's steer on the first sketches asked for charts, icon cards, a real history table with status badges, dark shown by default and one accent; the page still follows the system theme.

Evidence: the spec asks for its own identity, not default shadcn: own color, type and density chosen through the better-* skills (Task 39), calm and readable at a glance. Phase 6's `base-nova` preset and the Geist font are the template the pick replaces, not the direction.

Fixed choices an executor may not change: light and dark follow the system through `prefers-color-scheme` (shadcn's `@custom-variant dark (&:is(.dark *))` and `.dark { … }` block become a media query), with no theme toggle; every page fits 1280 px wide without horizontal scroll; tokens live only in `web/src/index.css`; copy is plain English as the tasks write it; the router switch is the first and largest control on Overview; History shows the raw statuses `done`, `escalate`, `use_claude`, `refused` and `disabled`; no UI library beyond shadcn on Base UI, shadcn chart (Recharts), TanStack Table, react-hook-form and Lucide.

## Tasks

### Phase 1: Config version 2

### Task 1: Move the config schema into a browser-safe module

Depends on: none

Files:
- Create: `src/config/config-schema.ts`
- Modify: `src/config/delegate-config.ts` (whole file)

Step 1: Create `src/config/config-schema.ts` with the unchanged version 1 rules, split into shared fields and the version 1 extension, minus the `~/` transform
```ts
import { z } from 'zod';

export const TIER_ORDER = ['flash-low', 'flash-high', 'pro-high', 'claude'] as const;
export const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Tier = (typeof TIER_ORDER)[number];
export type WorkerTier = Exclude<Tier, 'claude'>;
export type Effort = (typeof EFFORT_ORDER)[number];

export const effortSchema = z.enum(EFFORT_ORDER);
export const modelPriceSchema = z.object({
  inputUsd: z.number().nonnegative(),
  cacheHitUsd: z.number().nonnegative(),
  outputUsd: z.number().nonnegative(),
});

export const sharedFieldsSchema = z.object({
  rules: z.array(
    z.object({
      id: z.string().min(1),
      taskTypes: z.array(z.string()).default([]),
      keywords: z.array(z.string()).default([]),
      keywordExemptTaskTypes: z.array(z.string()).default([]),
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
  workerTimeoutMs: z.number().int().positive(),
  testTimeoutMs: z.number().int().positive(),
  retryThreshold: z.number().int().nonnegative().nullable(),
  projects: z.record(z.string(), z.object({ testCommand: z.string().min(1) })),
  exploreRedirect: z.boolean(),
  claudeBin: z.string().min(1),
});

const v1TierSchema = z.object({ model: z.string().min(1), effort: effortSchema });

export const v1ConfigSchema = sharedFieldsSchema
  .extend({
    tiers: z.object({ 'flash-low': v1TierSchema, 'flash-high': v1TierSchema, 'pro-high': v1TierSchema }),
    prices: z.record(z.string(), modelPriceSchema),
    proxy: z.object({ dir: z.string().min(1), logPath: z.string().min(1), telemetryPath: z.string().min(1) }),
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

export type DelegateConfig = z.infer<typeof v1ConfigSchema>;
export type ModelPrice = z.infer<typeof modelPriceSchema>;
```
Run: `npx tsc --noEmit src/config/config-schema.ts --module esnext --moduleResolution bundler --target es2023 --strict --skipLibCheck`
Expected: no output, exit code 0

Step 2: Reduce `src/config/delegate-config.ts` to the loader, expanding `~/` after parsing and re-exporting the moved names until Task 4 has moved every import site
```ts
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v1ConfigSchema, type DelegateConfig } from './config-schema';

export { EFFORT_ORDER, TIER_ORDER } from './config-schema';
export type { DelegateConfig, Effort, ModelPrice, Tier, WorkerTier } from './config-schema';

export const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('../../config/routing.json', import.meta.url));

const expandHome = (path: string) => (path.startsWith('~/') ? join(homedir(), path.slice(2)) : path);

export function loadConfig(path = process.env.DEEPSEEK_DELEGATE_CONFIG ?? DEFAULT_CONFIG_PATH): DelegateConfig {
  const config = v1ConfigSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  return { ...config, proxy: { ...config.proxy, telemetryPath: expandHome(config.proxy.telemetryPath) } };
}
```
Run: `npm run typecheck && npm test`
Expected: `tsc` prints nothing; vitest ends with every test file passed and `0 failed`

Commit:
```bash
git add src/config/config-schema.ts src/config/delegate-config.ts
git commit -m "refactor(config): move the config schema into a browser-safe module" -m "Plan-task: 1"
```

### Task 2: Import the schema names from config-schema in delegate and routing

Depends on: Task 1

Files:
- Modify: `src/delegate/delegate.ts` (import, line 4)
- Modify: `src/delegate/delegate-result.ts` (import, line 1)
- Modify: `src/routing/route-task.ts` (import, line 1)
- Modify: `src/routing/resolve-effort.ts` (import, line 1)

Step 1: Point the four imports at `config-schema`
```bash
sed -i '' "s#from '../config/delegate-config'#from '../config/config-schema'#" \
  src/delegate/delegate.ts src/delegate/delegate-result.ts src/routing/route-task.ts src/routing/resolve-effort.ts
```
Run: `grep -n "config/delegate-config'" src/delegate/delegate.ts src/delegate/delegate-result.ts src/routing/route-task.ts src/routing/resolve-effort.ts; npm run typecheck && npm test`
Expected: grep prints nothing; `tsc` prints nothing; vitest `0 failed`

Commit:
```bash
git add src/delegate/delegate.ts src/delegate/delegate-result.ts src/routing/route-task.ts src/routing/resolve-effort.ts
git commit -m "refactor(config): import schema names from config-schema in delegate and routing" -m "Plan-task: 2"
```

### Task 3: Import the schema names from config-schema in log, doctor and worker

Depends on: Task 1

Files:
- Modify: `src/decision-log/decision-log.ts` (import, line 1)
- Modify: `src/doctor/doctor-checks.ts` (import, line 5)
- Modify: `src/worker/stream-state.ts` (import, line 2)
- Modify: `src/worker/worker-env.ts` (import, line 1)

Step 1: Point the four imports at `config-schema`
```bash
sed -i '' "s#from '../config/delegate-config'#from '../config/config-schema'#" \
  src/decision-log/decision-log.ts src/doctor/doctor-checks.ts src/worker/stream-state.ts src/worker/worker-env.ts
```
Run: `grep -n "config/delegate-config'" src/decision-log/decision-log.ts src/doctor/doctor-checks.ts src/worker/stream-state.ts src/worker/worker-env.ts; npm run typecheck && npm test`
Expected: grep prints nothing; `tsc` prints nothing; vitest `0 failed`

Commit:
```bash
git add src/decision-log/decision-log.ts src/doctor/doctor-checks.ts src/worker/stream-state.ts src/worker/worker-env.ts
git commit -m "refactor(config): import schema names from config-schema in log, doctor and worker" -m "Plan-task: 3"
```

### Task 4: Import the schema names from config-schema in the server, budget and tests

Depends on: Task 1

Files:
- Modify: `src/budget/usage-cost.ts` (import, line 1)
- Modify: `src/server.ts` (imports, line 5)
- Modify: `test/route-task.test.ts` (import, line 2)
- Modify: `test/delegate.test.ts` (import, line 6)

Step 1: Move the remaining imports

In `src/budget/usage-cost.ts`, line 1 becomes:
```ts
import type { ModelPrice } from '../config/config-schema';
```
In `src/server.ts`, line 5 becomes:
```ts
import { EFFORT_ORDER, TIER_ORDER } from './config/config-schema';
import { loadConfig } from './config/delegate-config';
```
In `test/route-task.test.ts`, line 2 becomes:
```ts
import type { Tier } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
```
In `test/delegate.test.ts`, line 6 becomes:
```ts
import type { DelegateConfig } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
```
Run: `grep -rn "config/delegate-config'" src test scripts | grep -v "loadConfig\|DEFAULT_CONFIG_PATH"; npm run typecheck && npm test`
Expected: grep prints nothing (no file uses the re-exports any more); `tsc` prints nothing; vitest `0 failed`

Commit:
```bash
git add src/budget/usage-cost.ts src/server.ts test/route-task.test.ts test/delegate.test.ts
git commit -m "refactor(config): import schema names from config-schema in the server, budget and tests" -m "Plan-task: 4"
```

### Task 5: Build the proxy start options where the proxy is needed

Depends on: Task 2, Task 3, Task 4

Files:
- Modify: `src/delegate/delegate.ts` (imports, `DelegateDeps`, `workerEnvironment`)
- Modify: `src/server.ts` (`ensureProxy` dependency, line 48)
- Modify: `src/doctor/doctor-checks.ts` (imports, `DoctorDeps`, `checkProxy`)
- Modify: `src/doctor/run-doctor.ts` (`ensureProxy` dependency, line 18)

Step 1: Let `delegate` pass a `ProxyStart` to `deps.ensureProxy`

`src/delegate/delegate.ts`: add after the `countProxyRetries` import (line 6):
```ts
import type { ProxyStart } from '../proxy/ensure-proxy';
```
`DelegateDeps` (whole interface):
```ts
export interface DelegateDeps {
  config: DelegateConfig;
  homeDir: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  readApiKey: () => Promise<string>;
  ensureProxy: (start: ProxyStart) => Promise<unknown>;
}
```
`workerEnvironment` (whole function):
```ts
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
  const { proxy } = deps.config;
  await deps.ensureProxy({ dir: proxy.dir, logPath: proxy.logPath, telemetryPath: proxy.telemetryPath, healthUrl: new URL('/healthz', baseUrl).href });
  const apiKey = await deps.readApiKey();
  return buildWorkerEnv({ inherited: deps.env, envVars, model, apiKey, effort });
}
```
`src/server.ts`, line 48 becomes:
```ts
      ensureProxy,
```
Run: `npm test -- test/delegate.test.ts test/integration/delegate-stdio.test.ts`
Expected: both files pass, `0 failed`

Step 2: Let the doctor pass a `ProxyStart` to `deps.ensureProxy`

`src/doctor/doctor-checks.ts`: add after the `decision-log` import (line 6):
```ts
import type { ProxyStart } from '../proxy/ensure-proxy';
```
`DoctorDeps` (whole interface):
```ts
export interface DoctorDeps {
  homeDir: string;
  repoRoot: string;
  config: DelegateConfig;
  registration: ServerRegistration;
  readApiKey: () => Promise<string>;
  ensureProxy: (start: ProxyStart) => Promise<'running' | 'started'>;
}
```
`checkProxy` (whole function):
```ts
async function checkProxy(deps: DoctorDeps, baseUrl: string | null): Promise<DoctorCheck> {
  if (!baseUrl) return fix('repair-proxy', 'Not checked until env.vars is fixed.');
  const { proxy } = deps.config;
  try {
    const state = await deps.ensureProxy({ dir: proxy.dir, logPath: proxy.logPath, telemetryPath: proxy.telemetryPath, healthUrl: new URL('/healthz', baseUrl).href });
    return pass('repair-proxy', state === 'started' ? 'The repair-proxy was down and is started now.' : 'The repair-proxy answers.');
  } catch {
    return fix('repair-proxy', `The repair-proxy does not start; see ${proxy.logPath}.`);
  }
}
```
`src/doctor/run-doctor.ts`, line 18 becomes:
```ts
  ensureProxy,
```
Run: `npm run typecheck && npm test`
Expected: `tsc` prints nothing; vitest `0 failed`, including `test/doctor.test.ts` `reports a proxy that does not start` (message contains `/tmp/deepseek-proxy.log`)

Commit:
```bash
git add src/delegate/delegate.ts src/server.ts src/doctor/doctor-checks.ts src/doctor/run-doctor.ts
git commit -m "refactor(proxy): build the proxy start options where the proxy is needed" -m "Plan-task: 5"
```

### Task 6: Add the version 2 schema and the version 1 migration

Depends on: Task 1
Risk: persisted config format (version 1 to version 2)

Files:
- Create: `src/config/migrate-config.ts`
- Modify: `src/config/config-schema.ts` (append the version 2 block)
- Test: `test/migrate-config.test.ts`
- Test: `test/config-schema.test.ts`

Step 1: Write the failing migration and validation tests

`test/migrate-config.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EFFORT_ORDER, configSchema } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH } from '../src/config/delegate-config';
import { migrateConfig } from '../src/config/migrate-config';

const seed = () => JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
const migrated = () => configSchema.parse(migrateConfig(seed()));

describe('migrateConfig', () => {
  it('marks the result as version 2', () => {
    expect(migrated().version).toBe(2);
  });

  it('keeps every shared value unchanged', () => {
    const v1 = seed();
    const v2 = migrated();
    expect(v2.rules).toEqual(v1.rules.map((rule: object) => ({ taskTypes: [], keywords: [], keywordExemptTaskTypes: [], flags: [], ...rule })));
    for (const key of ['effortMap', 'claude', 'budget', 'workerTimeoutMs', 'testTimeoutMs', 'retryThreshold', 'projects', 'exploreRedirect', 'claudeBin'] as const) {
      expect(v2[key]).toEqual(v1[key]);
    }
    expect(v2.proxy).toEqual({ dir: v1.proxy.dir });
  });

  it('points every tier at the deepseek provider with its model and effort', () => {
    const v1 = seed();
    const v2 = migrated();
    for (const tier of ['flash-low', 'flash-high', 'pro-high'] as const) {
      expect(v2.tiers[tier]).toEqual({ provider: 'deepseek', model: v1.tiers[tier].model, effort: v1.tiers[tier].effort });
    }
  });

  it('moves the prices and proxy paths into the deepseek provider', () => {
    const v1 = seed();
    expect(migrated().providers.deepseek).toEqual({
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/anthropic',
      keychainService: 'deepseek_api_key',
      models: v1.prices,
      efforts: [...EFFORT_ORDER],
      enabled: true,
      repairProxy: { port: 8787, logPath: v1.proxy.logPath, telemetryPath: v1.proxy.telemetryPath },
    });
  });

  it('adds OpenRouter as a disabled preset without models', () => {
    expect(migrated().providers.openrouter).toEqual({
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api',
      keychainService: 'openrouter_api_key',
      models: {},
      efforts: [...EFFORT_ORDER],
      enabled: false,
      repairProxy: null,
    });
  });

  it('returns a version 2 config unchanged', () => {
    const once = migrateConfig(seed());
    expect(migrateConfig(structuredClone(once))).toEqual(once);
  });

  it('leaves its input untouched', () => {
    const v1 = seed();
    const copy = structuredClone(v1);
    migrateConfig(v1);
    expect(v1).toEqual(copy);
  });

  it('names the field of an invalid version 1 file', () => {
    const v1 = seed();
    v1.rules[0].tier = 'gpt';
    expect(() => migrateConfig(v1)).toThrow(/rules\.0\.tier/);
  });
});
```

`test/config-schema.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configIssues, configSchema, type Effort, type ModelPrice } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH } from '../src/config/delegate-config';
import { migrateConfig } from '../src/config/migrate-config';

const validConfig = () => configSchema.parse(migrateConfig(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'))));

describe('configIssues', () => {
  it('accepts the migrated seed', () => {
    expect(configIssues(validConfig())).toEqual([]);
  });

  it('names the tier field when a tier points at an unknown provider', () => {
    const config = validConfig();
    config.tiers['flash-low'].provider = 'missing';
    expect(configIssues(config)).toEqual(['tiers.flash-low.provider: provider missing does not exist']);
  });

  it('names the tier field when a tier points at a disabled provider', () => {
    const config = validConfig();
    config.providers.openrouter.models['openai/gpt-5'] = { inputUsd: 1, cacheHitUsd: 0.1, outputUsd: 4 };
    config.tiers['flash-low'] = { provider: 'openrouter', model: 'openai/gpt-5', effort: 'low' };
    expect(configIssues(config)).toEqual(['tiers.flash-low.provider: provider openrouter is disabled']);
  });

  it('names the tier model when its provider has no such model', () => {
    const config = validConfig();
    config.tiers['pro-high'].model = 'deepseek-missing';
    expect(configIssues(config)).toEqual(['tiers.pro-high.model: model deepseek-missing has no entry in providers.deepseek.models']);
  });

  it('names the price field when a model price is missing', () => {
    const config = validConfig();
    config.providers.deepseek.models['deepseek-flash'] = { cacheHitUsd: 0.006, outputUsd: 1.2 } as ModelPrice;
    expect(configIssues(config)).toContainEqual(expect.stringMatching(/^providers\.deepseek\.models\.deepseek-flash\.inputUsd: /));
  });

  it('names the budget field for a negative cap', () => {
    const config = validConfig();
    config.budget.totalUsd = -1;
    expect(configIssues(config)).toContainEqual(expect.stringMatching(/^budget\.totalUsd: /));
  });

  it('names the tier effort for an unknown effort', () => {
    const config = validConfig();
    config.tiers['pro-high'].effort = 'extreme' as Effort;
    expect(configIssues(config)).toContainEqual(expect.stringMatching(/^tiers\.pro-high\.effort: /));
  });
});
```
Run: `npm test -- test/migrate-config.test.ts test/config-schema.test.ts`
Expected: both files fail with `Failed to resolve import "../src/config/migrate-config"`

Step 2: Append the version 2 schema to `src/config/config-schema.ts`, after the `ModelPrice` type (the end of the file)
```ts
const repairProxySchema = z.object({
  port: z.number().int().min(1).max(65_535),
  logPath: z.string().min(1),
  telemetryPath: z.string().min(1),
});

const providerSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.url(),
  keychainService: z.string().min(1),
  models: z.record(z.string().min(1), modelPriceSchema),
  efforts: z.array(effortSchema).min(1),
  enabled: z.boolean(),
  repairProxy: repairProxySchema.nullable(),
});

const workerTierSchema = z.object({ provider: z.string().min(1), model: z.string().min(1), effort: effortSchema });

export const configSchema = sharedFieldsSchema
  .extend({
    version: z.literal(2),
    providers: z.record(z.string().regex(/^[a-z0-9-]+$/, 'use lowercase letters, digits and dashes'), providerSchema),
    tiers: z.object({ 'flash-low': workerTierSchema, 'flash-high': workerTierSchema, 'pro-high': workerTierSchema }),
    proxy: z.object({ dir: z.string().min(1) }),
  })
  .superRefine((config, context) => {
    const agentReferences: [string[], string][] = [
      [['claude', 'defaultAgent'], config.claude.defaultAgent],
      ...Object.entries(config.claude.taskTypes).map(([taskType, name]): [string[], string] => [['claude', 'taskTypes', taskType], name]),
    ];
    for (const [path, name] of agentReferences) {
      if (!config.claude.agents[name]) {
        context.addIssue({ code: 'custom', path, message: `claude agent ${name} is not defined in claude.agents` });
      }
    }
    for (const [tierName, tier] of Object.entries(config.tiers)) {
      const provider = config.providers[tier.provider];
      if (!provider) {
        context.addIssue({ code: 'custom', path: ['tiers', tierName, 'provider'], message: `provider ${tier.provider} does not exist` });
      } else if (!provider.enabled) {
        context.addIssue({ code: 'custom', path: ['tiers', tierName, 'provider'], message: `provider ${tier.provider} is disabled` });
      } else if (!provider.models[tier.model]) {
        context.addIssue({ code: 'custom', path: ['tiers', tierName, 'model'], message: `model ${tier.model} has no entry in providers.${tier.provider}.models` });
      }
    }
  });

export type Provider = z.infer<typeof providerSchema>;
export type RepairProxy = z.infer<typeof repairProxySchema>;

export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.map(String).join('.') || 'config'}: ${issue.message}`);
}

export function configIssues(input: unknown): string[] {
  const parsed = configSchema.safeParse(input);
  return parsed.success ? [] : formatIssues(parsed.error);
}
```
Run: `npx tsc --noEmit src/config/config-schema.ts --module esnext --moduleResolution bundler --target es2023 --strict --skipLibCheck`
Expected: no output, exit code 0

Step 3: Write `src/config/migrate-config.ts`
```ts
import { EFFORT_ORDER, formatIssues, v1ConfigSchema, type Effort } from './config-schema';

const DEEPSEEK_PROXY_PORT = 8787;

const hasVersion = (raw: unknown) => typeof raw === 'object' && raw !== null && 'version' in raw;
const deepseekTier = (tier: { model: string; effort: Effort }) => ({ provider: 'deepseek', model: tier.model, effort: tier.effort });

export function migrateConfig(raw: unknown): unknown {
  if (hasVersion(raw)) return raw;
  const parsed = v1ConfigSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`The version 1 config is invalid: ${formatIssues(parsed.error).join('; ')}`);
  const { tiers, prices, proxy, ...shared } = parsed.data;
  return {
    version: 2,
    ...shared,
    providers: {
      deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/anthropic',
        keychainService: 'deepseek_api_key',
        models: prices,
        efforts: [...EFFORT_ORDER],
        enabled: true,
        repairProxy: { port: DEEPSEEK_PROXY_PORT, logPath: proxy.logPath, telemetryPath: proxy.telemetryPath },
      },
      openrouter: {
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api',
        keychainService: 'openrouter_api_key',
        models: {},
        efforts: [...EFFORT_ORDER],
        enabled: false,
        repairProxy: null,
      },
    },
    tiers: {
      'flash-low': deepseekTier(tiers['flash-low']),
      'flash-high': deepseekTier(tiers['flash-high']),
      'pro-high': deepseekTier(tiers['pro-high']),
    },
    proxy: { dir: proxy.dir },
  };
}
```
Run: `npm test -- test/migrate-config.test.ts test/config-schema.test.ts && npm run typecheck`
Expected: both files pass, `0 failed`; `tsc` prints nothing

Commit:
```bash
git add src/config/migrate-config.ts src/config/config-schema.ts test/migrate-config.test.ts test/config-schema.test.ts
git commit -m "feat(config): add the version 2 schema with providers and the version 1 migration" -m "Plan-task: 6"
```

### Task 7: Load every config as version 2

Depends on: Task 5, Task 6
Risk: the `DelegateConfig` shape every module reads switches to version 2

Files:
- Modify: `src/config/config-schema.ts` (`DelegateConfig` type)
- Modify: `src/config/delegate-config.ts` (whole file)
- Modify: `src/delegate/delegate.ts` (`runDeepseekTask`, `workerEnvironment`)
- Modify: `src/doctor/doctor-checks.ts` (`checkProxy`)
- Test: `test/delegate-config.test.ts` (whole file)
- Test: `test/delegate.test.ts` (`harness`)

Step 1: Write the failing loader test, `test/delegate-config.test.ts` (whole file)
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
  it('loads the shipped config as version 2 with its caps and defaults', () => {
    const config = loadConfig(DEFAULT_CONFIG_PATH);
    expect(config.version).toBe(2);
    expect(config.budget).toEqual({ totalUsd: 10, perCallUsd: 0.25 });
    expect(config.retryThreshold).toBeNull();
    expect(config.exploreRedirect).toBe(false);
    expect(config.workerTimeoutMs).toBe(600_000);
    expect(config.testTimeoutMs).toBe(300_000);
    expect(config.providers.deepseek.repairProxy?.telemetryPath.startsWith('~')).toBe(false);
  });

  it('names the current DeepSeek model ids, not the retired deepseek-v4-flash', () => {
    const models = Object.values(loadConfig(DEFAULT_CONFIG_PATH).tiers).map((tier) => tier.model);
    expect(new Set(models)).toEqual(new Set(['deepseek-flash', 'deepseek-v4-pro']));
  });

  it('loads a version 2 file as written', () => {
    const migrated = loadConfig(DEFAULT_CONFIG_PATH);
    expect(loadConfig(writeConfig(migrated))).toEqual(migrated);
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
Run: `npm test -- test/delegate-config.test.ts`
Expected: `loads the shipped config as version 2` fails on `expected undefined to be 2`

Step 2: Switch the type and the loader to version 2

`src/config/config-schema.ts`: the line `export type DelegateConfig = z.infer<typeof v1ConfigSchema>;` is deleted, and this line is added after `export type RepairProxy = z.infer<typeof repairProxySchema>;`:
```ts
export type DelegateConfig = z.infer<typeof configSchema>;
```

`src/config/delegate-config.ts` (whole file; the re-exports from Task 1 are gone):
```ts
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configSchema, formatIssues, type DelegateConfig, type Provider } from './config-schema';
import { migrateConfig } from './migrate-config';

export const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('../../config/routing.json', import.meta.url));

const expandHome = (path: string) => (path.startsWith('~/') ? join(homedir(), path.slice(2)) : path);

function expandProxyPaths(provider: Provider): Provider {
  const { repairProxy } = provider;
  if (!repairProxy) return provider;
  return { ...provider, repairProxy: { ...repairProxy, logPath: expandHome(repairProxy.logPath), telemetryPath: expandHome(repairProxy.telemetryPath) } };
}

export function loadConfig(path = process.env.DEEPSEEK_DELEGATE_CONFIG ?? DEFAULT_CONFIG_PATH): DelegateConfig {
  const parsed = configSchema.safeParse(migrateConfig(JSON.parse(readFileSync(path, 'utf8'))));
  if (!parsed.success) throw new Error(`${path} is not a valid routemax config: ${formatIssues(parsed.error).join('; ')}`);
  const providers = Object.fromEntries(Object.entries(parsed.data.providers).map(([id, provider]) => [id, expandProxyPaths(provider)]));
  return { ...parsed.data, providers };
}
```
Run: `npm test -- test/delegate-config.test.ts`
Expected: every test in the file passes, `0 failed`

Step 3: Read prices, telemetry and the proxy paths from the tier's provider

`src/delegate/delegate.ts`: the `config-schema` import (line 4) becomes:
```ts
import type { DelegateConfig, Effort, RepairProxy, WorkerTier } from '../config/config-schema';
```
`runDeepseekTask` (whole function):
```ts
async function runDeepseekTask(request: DelegateRequest, tier: WorkerTier, base: DecisionBase, deps: DelegateDeps, startedAt: number): Promise<DelegateResult> {
  const { config } = deps;
  const tierConfig = config.tiers[tier];
  const { model } = tierConfig;
  const provider = config.providers[tierConfig.provider];
  const effort = resolveEffort(config.effortMap, tierConfig.effort, request.claudeEffort);
  const logPath = decisionLogPath(deps.homeDir);
  let env: Record<string, string>;
  try {
    env = await workerEnvironment(deps, provider.repairProxy, model, effort);
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
    costOf: (stream) => stream.costUsd(provider.models, model),
  });
  const workerReason = workerEscalation(outcome);
  const testOutcome = workerReason === null && testCommand ? await runTestCommand(testCommand, deps.cwd, config.testTimeoutMs) : null;
  const retries = provider.repairProxy ? await countProxyRetries(provider.repairProxy.telemetryPath, outcome.startedAt, outcome.endedAt) : 0;
  const reason = workerReason ?? testEscalation(testOutcome) ?? retryEscalation(retries, config.retryThreshold);
  const costUsd = outcome.stream.costUsd(provider.models, model);
  const status = reason ? 'escalate' : 'done';
  await appendDecision(logPath, { ...base, ...outcome.stream.usage, model, effort, costUsd, status, reason, durationMs: Date.now() - startedAt, retries });
  const report = { summary: truncate(outcome.stream.result?.text ?? '', SUMMARY_LIMIT), changedFiles: outcome.stream.changedFiles, tier, model, effort, costUsd };
  return reason ? { status: 'escalate', reason, ...report } : { status: 'done', ...report };
}
```
`workerEnvironment` (whole function):
```ts
async function workerEnvironment(deps: DelegateDeps, repairProxy: RepairProxy | null, model: string, effort: Effort): Promise<Record<string, string>> {
  if (!repairProxy) throw new Error("The tier's provider has no repairProxy in the routemax config.");
  const path = envVarsPath(deps.homeDir);
  const envVarsText = await readFile(path, 'utf8').catch(() => {
    throw new Error(`${path} is missing; run npm run setup in routemax first.`);
  });
  const envVars = parseEnvVars(envVarsText);
  const baseUrl = envVars.ANTHROPIC_BASE_URL ?? '';
  if (!URL.canParse(baseUrl) || new URL(baseUrl).hostname !== '127.0.0.1') {
    throw new Error('ANTHROPIC_BASE_URL in env.vars must point at the repair-proxy on 127.0.0.1.');
  }
  await deps.ensureProxy({ dir: deps.config.proxy.dir, logPath: repairProxy.logPath, telemetryPath: repairProxy.telemetryPath, healthUrl: new URL('/healthz', baseUrl).href });
  const apiKey = await deps.readApiKey();
  return buildWorkerEnv({ inherited: deps.env, envVars, model, apiKey, effort });
}
```

`src/doctor/doctor-checks.ts`, `checkProxy` (whole function):
```ts
async function checkProxy(deps: DoctorDeps, baseUrl: string | null): Promise<DoctorCheck> {
  if (!baseUrl) return fix('repair-proxy', 'Not checked until env.vars is fixed.');
  const repairProxy = deps.config.providers.deepseek?.repairProxy;
  if (!repairProxy) return fix('repair-proxy', 'providers.deepseek has no repairProxy in the routemax config.');
  try {
    const state = await deps.ensureProxy({ dir: deps.config.proxy.dir, logPath: repairProxy.logPath, telemetryPath: repairProxy.telemetryPath, healthUrl: new URL('/healthz', baseUrl).href });
    return pass('repair-proxy', state === 'started' ? 'The repair-proxy was down and is started now.' : 'The repair-proxy answers.');
  } catch {
    return fix('repair-proxy', `The repair-proxy does not start; see ${repairProxy.logPath}.`);
  }
}
```

`test/delegate.test.ts`, the `config` constant inside `harness` (lines 35-42 after Task 4) becomes:
```ts
  const shipped = loadConfig(DEFAULT_CONFIG_PATH);
  const config: DelegateConfig = {
    ...shipped,
    claudeBin: FAKE_CLAUDE,
    providers: {
      ...shipped.providers,
      deepseek: { ...shipped.providers.deepseek, repairProxy: { port: 8787, logPath: join(root, 'proxy.log'), telemetryPath } },
    },
    projects: options.testCommand ? { [cwd]: { testCommand: options.testCommand } } : {},
    ...options.config,
  };
```
Run: `npm run typecheck && npm test`
Expected: `tsc` prints nothing; vitest ends with every test file passed and `0 failed`, including `test/integration/delegate-stdio.test.ts` (it writes a version 1 config that `loadConfig` now migrates), `test/delegate.test.ts` `counts proxy retries` (`retries: 3`) and `test/doctor.test.ts` `reports a proxy that does not start`

Commit:
```bash
git add src/config/config-schema.ts src/config/delegate-config.ts src/delegate/delegate.ts src/doctor/doctor-checks.ts test/delegate-config.test.ts test/delegate.test.ts
git commit -m "feat(config): load every config as version 2 with providers" -m "Plan-task: 7"
```

### Task 8: Write the live config once and keep the version 1 original

Depends on: Task 7
Risk: first write of a persisted file in the owner's home (`~/.config/routemax/config.json`) and a never-overwritten backup

Files:
- Create: `src/config/routemax-paths.ts`
- Modify: `src/config/delegate-config.ts` (whole file)
- Test: `test/delegate-config.test.ts` (imports and a new `ensureLiveConfig` block)

Step 1: Write the failing live-config tests

`test/delegate-config.test.ts`: the import block (lines 1-5) becomes:
```ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, ensureLiveConfig, loadConfig } from '../src/config/delegate-config';
import { liveConfigPath, v1BackupPath } from '../src/config/routemax-paths';
```
and this block is appended at the end of the file:
```ts
describe('ensureLiveConfig', () => {
  const seedText = readFileSync(DEFAULT_CONFIG_PATH, 'utf8');

  function tempHome() {
    const home = mkdtempSync(join(tmpdir(), 'routemax-home-'));
    const seedPath = join(home, 'routing.json');
    writeFileSync(seedPath, seedText);
    return { home, seedPath };
  }

  it('writes the live config once from the seed and keeps the version 1 original', () => {
    const { home, seedPath } = tempHome();
    const livePath = ensureLiveConfig(home, seedPath);
    expect(livePath).toBe(liveConfigPath(home));
    expect(JSON.parse(readFileSync(livePath, 'utf8')).version).toBe(2);
    expect(loadConfig(livePath).budget.totalUsd).toBe(10);
    expect(readFileSync(v1BackupPath(home), 'utf8')).toBe(seedText);

    const liveText = readFileSync(livePath, 'utf8');
    writeFileSync(seedPath, seedText.replace('"totalUsd": 10', '"totalUsd": 20'));
    expect(ensureLiveConfig(home, seedPath)).toBe(livePath);
    expect(readFileSync(livePath, 'utf8')).toBe(liveText);
    expect(readFileSync(v1BackupPath(home), 'utf8')).toBe(seedText);
  });

  it('never overwrites an existing version 1 backup', () => {
    const { home, seedPath } = tempHome();
    ensureLiveConfig(home, seedPath);
    rmSync(liveConfigPath(home));
    writeFileSync(seedPath, seedText.replace('"totalUsd": 10', '"totalUsd": 20'));
    ensureLiveConfig(home, seedPath);
    expect(loadConfig(liveConfigPath(home)).budget.totalUsd).toBe(20);
    expect(readFileSync(v1BackupPath(home), 'utf8')).toBe(seedText);
  });

  it('writes nothing when the seed is invalid', () => {
    const { home, seedPath } = tempHome();
    writeFileSync(seedPath, seedText.replace('"totalUsd": 10', '"totalUsd": -1'));
    expect(() => ensureLiveConfig(home, seedPath)).toThrow(/budget\.totalUsd/);
    expect(() => readFileSync(liveConfigPath(home))).toThrow(/ENOENT/);
  });
});
```
Run: `npm test -- test/delegate-config.test.ts`
Expected: the file fails with `Failed to resolve import "../src/config/routemax-paths"`

Step 2: Create `src/config/routemax-paths.ts`
```ts
import { join } from 'node:path';

export const liveConfigPath = (homeDir: string) => join(homeDir, '.config', 'routemax', 'config.json');
export const backupsDir = (homeDir: string) => join(homeDir, '.local', 'state', 'routemax', 'backups');
export const v1BackupPath = (homeDir: string) => join(backupsDir(homeDir), 'routing.v1.json');
```
Run: `npm test -- test/delegate-config.test.ts`
Expected: the `ensureLiveConfig` tests fail with `ensureLiveConfig is not a function`; the `loadConfig` tests pass

Step 3: Add `ensureLiveConfig` and make it the default path of `loadConfig`, in `src/config/delegate-config.ts` (whole file). The live file is created by hard-linking a fully written temporary file, so a second process starting at the same moment sees either no file or the whole file, and a lost race (`EEXIST`) keeps the winner's file.
```ts
import { constants, copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configSchema, formatIssues, type DelegateConfig, type Provider } from './config-schema';
import { migrateConfig } from './migrate-config';
import { liveConfigPath, v1BackupPath } from './routemax-paths';

export const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('../../config/routing.json', import.meta.url));

const expandHome = (path: string) => (path.startsWith('~/') ? join(homedir(), path.slice(2)) : path);
const isFileExists = (error: unknown) => (error as NodeJS.ErrnoException).code === 'EEXIST';

function expandProxyPaths(provider: Provider): Provider {
  const { repairProxy } = provider;
  if (!repairProxy) return provider;
  return { ...provider, repairProxy: { ...repairProxy, logPath: expandHome(repairProxy.logPath), telemetryPath: expandHome(repairProxy.telemetryPath) } };
}

function readValidConfig(path: string): { migrated: unknown; config: DelegateConfig } {
  const migrated = migrateConfig(JSON.parse(readFileSync(path, 'utf8')));
  const parsed = configSchema.safeParse(migrated);
  if (!parsed.success) throw new Error(`${path} is not a valid routemax config: ${formatIssues(parsed.error).join('; ')}`);
  return { migrated, config: parsed.data };
}

export function ensureLiveConfig(homeDir: string, seedPath = DEFAULT_CONFIG_PATH): string {
  const livePath = liveConfigPath(homeDir);
  if (existsSync(livePath)) return livePath;
  const { migrated } = readValidConfig(seedPath);
  const backupPath = v1BackupPath(homeDir);
  mkdirSync(dirname(backupPath), { recursive: true });
  try {
    copyFileSync(seedPath, backupPath, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!isFileExists(error)) throw error;
  }
  mkdirSync(dirname(livePath), { recursive: true });
  const tempPath = `${livePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(migrated, null, 2)}\n`);
  try {
    linkSync(tempPath, livePath);
  } catch (error) {
    if (!isFileExists(error)) throw error;
  } finally {
    unlinkSync(tempPath);
  }
  return livePath;
}

export function loadConfig(path = process.env.DEEPSEEK_DELEGATE_CONFIG ?? ensureLiveConfig(homedir())): DelegateConfig {
  const { config } = readValidConfig(path);
  const providers = Object.fromEntries(Object.entries(config.providers).map(([id, provider]) => [id, expandProxyPaths(provider)]));
  return { ...config, providers };
}
```
Run: `npm test -- test/delegate-config.test.ts && npm run typecheck`
Expected: every test in the file passes, `0 failed`; `tsc` prints nothing

Commit:
```bash
git add src/config/routemax-paths.ts src/config/delegate-config.ts test/delegate-config.test.ts
git commit -m "feat(config): write the live config once to ~/.config/routemax and back up the version 1 file" -m "Plan-task: 8"
```

### Task 9: Point the budget messages at the live config

Depends on: Task 8

Files:
- Modify: `src/delegate/delegate.ts` (`budgetRefusal`)
- Modify: `src/doctor/doctor-checks.ts` (`checkBudget`)

Step 1: Replace `config/routing.json` in both messages

`src/delegate/delegate.ts`, `budgetRefusal` (whole function):
```ts
async function budgetRefusal(logPath: string, budget: DelegateConfig['budget']): Promise<string | null> {
  const spentUsd = await readSpentUsd(logPath);
  if (spentUsd + budget.perCallUsd <= budget.totalUsd) return null;
  return `Budget cap reached: $${spentUsd.toFixed(2)} of $${budget.totalUsd.toFixed(2)} spent, and one call may cost up to $${budget.perCallUsd.toFixed(2)}. Raise budget.totalUsd in ~/.config/routemax/config.json to continue.`;
}
```

`src/doctor/doctor-checks.ts`, `checkBudget` (whole function):
```ts
async function checkBudget(deps: DoctorDeps): Promise<DoctorCheck> {
  const { totalUsd, perCallUsd } = deps.config.budget;
  const spentUsd = await readSpentUsd(decisionLogPath(deps.homeDir));
  const spent = `$${spentUsd.toFixed(2)} of $${totalUsd.toFixed(2)} spent`;
  if (spentUsd + perCallUsd <= totalUsd) return pass('budget', `${spent}.`);
  return fix('budget', `${spent}; the next call could pass the cap. Raise budget.totalUsd in ~/.config/routemax/config.json.`);
}
```
Run: `npm run typecheck && npm test && grep -rn "config/routing.json" src`
Expected: `tsc` prints nothing; vitest `0 failed`; grep prints only the `DEFAULT_CONFIG_PATH` line in `src/config/delegate-config.ts`

Commit:
```bash
git add src/delegate/delegate.ts src/doctor/doctor-checks.ts
git commit -m "fix(config): point the budget messages at the live config" -m "Plan-task: 9"
```

### Phase 2: Providers in the worker path

### Task 10: Write the stdio test config as version 2 with the fake proxy's port

Depends on: Task 9

Files:
- Test: `test/integration/delegate-stdio.test.ts` (imports, `beforeAll` config lines 46-47)

Step 1: Import the migration and the config type

Add after the `DEFAULT_CONFIG_PATH` import (line 8):
```ts
import type { DelegateConfig } from '../../src/config/config-schema';
import { migrateConfig } from '../../src/config/migrate-config';
```
Lines 46-47, which build `config` from the seed and set `config.proxy`, become:
```ts
  const config = migrateConfig(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'))) as DelegateConfig;
  config.providers.deepseek.repairProxy = { port, logPath: join(root, 'proxy.log'), telemetryPath: join(root, 'telemetry.jsonl') };
  config.proxy = { dir: join(root, 'proxy') };
```
Run: `npm run typecheck && npm test -- test/integration/delegate-stdio.test.ts`
Expected: `tsc` prints nothing; the file passes, `0 failed`

Commit:
```bash
git add test/integration/delegate-stdio.test.ts
git commit -m "test(integration): write the stdio config as version 2 with the fake proxy port" -m "Plan-task: 10"
```

### Task 11: Start one repair-proxy per provider

Depends on: Task 10

Files:
- Modify: `src/proxy/ensure-proxy.ts` (`ProxyStart`, `proxyUrl`, `ensureProxy`)
- Modify: `src/delegate/delegate.ts` (`config-schema` import, `runDeepseekTask` call, `workerEnvironment`)
- Modify: `src/doctor/doctor-checks.ts` (`checkProxy`)
- Test: `test/ensure-proxy.test.ts` (whole file)

Step 1: Write the failing proxy test, `test/ensure-proxy.test.ts` (whole file)
```ts
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureProxy, isProxyHealthy, proxyUrl } from '../src/proxy/ensure-proxy';
import { freePort } from './helpers/free-port';

const UPSTREAM = 'https://upstream.example/anthropic';
const tempDir = () => mkdtempSync(join(tmpdir(), 'routemax-proxy-'));
const start = (dir: string, port: number) => ({ dir, port, upstreamBaseUrl: UPSTREAM, logPath: join(dir, 'proxy.log'), telemetryPath: join(dir, 'telemetry.jsonl') });

describe('ensureProxy', () => {
  it('leaves a healthy proxy alone', async () => {
    const server = createServer((_request, response) => response.end('{"ok":true}')).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    try {
      expect(await ensureProxy(start(tempDir(), port))).toBe('running');
    } finally {
      server.close();
    }
  });

  it('starts a stopped proxy detached on the provider port, upstream and telemetry path, and leaves it running', async () => {
    const dir = tempDir();
    const port = await freePort();
    const pidFile = join(dir, 'proxy.pid');
    const envFile = join(dir, 'proxy-env.txt');
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(
      join(dir, 'node_modules', '.bin', 'tsx'),
      `#!/bin/sh\necho $$ > "${pidFile}"\necho "$TELEMETRY_PATH $UPSTREAM_BASE_URL" > "${envFile}"\nexec node -e "require('node:http').createServer((q, s) => s.end('{}')).listen(Number(process.env.PORT), '127.0.0.1')"\n`,
      { mode: 0o755 },
    );
    try {
      expect(await ensureProxy(start(dir, port))).toBe('started');
      expect(await isProxyHealthy(`${proxyUrl(port)}/healthz`)).toBe(true);
      expect(readFileSync(envFile, 'utf8').trim()).toBe(`${join(dir, 'telemetry.jsonl')} ${UPSTREAM}`);
    } finally {
      process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGTERM');
    }
  });

  it('names the log when the proxy cannot start', async () => {
    const dir = tempDir();
    await expect(ensureProxy(start(dir, await freePort()))).rejects.toThrow(`deepseek-proxy did not start; see ${join(dir, 'proxy.log')}`);
  });
});
```
Run: `npm test -- test/ensure-proxy.test.ts`
Expected: `leaves a healthy proxy alone` and `starts a stopped proxy detached on the provider port` fail (the old `ensureProxy` reads `start.healthUrl`, which is `undefined`); `names the log` passes

Step 2: Pass the port and upstream to the proxy, `src/proxy/ensure-proxy.ts` from line 10 to the end of the file
```ts
export interface ProxyStart {
  dir: string;
  port: number;
  upstreamBaseUrl: string;
  logPath: string;
  // The proxy defaults its telemetry path to its own HOME; passing it keeps the proxy writing where the delegate reads retries.
  telemetryPath: string;
}

export const proxyUrl = (port: number) => `http://127.0.0.1:${port}`;

export async function isProxyHealthy(healthUrl: string): Promise<boolean> {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureProxy(start: ProxyStart): Promise<'running' | 'started'> {
  const healthUrl = `${proxyUrl(start.port)}/healthz`;
  if (await isProxyHealthy(healthUrl)) return 'running';
  const log = openSync(start.logPath, 'a');
  const proxy = spawn(join(start.dir, 'node_modules', '.bin', 'tsx'), ['src/server.ts'], {
    cwd: start.dir,
    env: { ...process.env, PORT: String(start.port), UPSTREAM_BASE_URL: start.upstreamBaseUrl, TELEMETRY_PATH: start.telemetryPath },
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
    if (await isProxyHealthy(healthUrl)) return 'started';
  }
  throw new Error(`deepseek-proxy did not start; see ${start.logPath}`);
}
```
Run: `npm test -- test/ensure-proxy.test.ts`
Expected: all three tests pass, `0 failed`

Step 3: Start the tier provider's proxy from `delegate` and the doctor

`src/delegate/delegate.ts`, the `config-schema` import becomes:
```ts
import type { DelegateConfig, Effort, Provider, WorkerTier } from '../config/config-schema';
```
In `runDeepseekTask`, the line `env = await workerEnvironment(deps, provider.repairProxy, model, effort);` becomes:
```ts
    env = await workerEnvironment(deps, provider, model, effort);
```
`workerEnvironment` (whole function):
```ts
async function workerEnvironment(deps: DelegateDeps, provider: Provider, model: string, effort: Effort): Promise<Record<string, string>> {
  const { repairProxy } = provider;
  if (!repairProxy) throw new Error("The tier's provider has no repairProxy in the routemax config.");
  const path = envVarsPath(deps.homeDir);
  const envVarsText = await readFile(path, 'utf8').catch(() => {
    throw new Error(`${path} is missing; run npm run setup in routemax first.`);
  });
  const envVars = parseEnvVars(envVarsText);
  const baseUrl = envVars.ANTHROPIC_BASE_URL ?? '';
  if (!URL.canParse(baseUrl) || new URL(baseUrl).hostname !== '127.0.0.1') {
    throw new Error('ANTHROPIC_BASE_URL in env.vars must point at the repair-proxy on 127.0.0.1.');
  }
  await deps.ensureProxy({ dir: deps.config.proxy.dir, port: repairProxy.port, upstreamBaseUrl: provider.baseUrl, logPath: repairProxy.logPath, telemetryPath: repairProxy.telemetryPath });
  const apiKey = await deps.readApiKey();
  return buildWorkerEnv({ inherited: deps.env, envVars, model, apiKey, effort });
}
```
`src/doctor/doctor-checks.ts`, `checkProxy` (whole function):
```ts
async function checkProxy(deps: DoctorDeps, baseUrl: string | null): Promise<DoctorCheck> {
  if (!baseUrl) return fix('repair-proxy', 'Not checked until env.vars is fixed.');
  const provider = deps.config.providers.deepseek;
  const repairProxy = provider?.repairProxy;
  if (!provider || !repairProxy) return fix('repair-proxy', 'providers.deepseek has no repairProxy in the routemax config.');
  try {
    const state = await deps.ensureProxy({ dir: deps.config.proxy.dir, port: repairProxy.port, upstreamBaseUrl: provider.baseUrl, logPath: repairProxy.logPath, telemetryPath: repairProxy.telemetryPath });
    return pass('repair-proxy', state === 'started' ? 'The repair-proxy was down and is started now.' : 'The repair-proxy answers.');
  } catch {
    return fix('repair-proxy', `The repair-proxy does not start; see ${repairProxy.logPath}.`);
  }
}
```
Run: `npm run typecheck && npm test`
Expected: `tsc` prints nothing; vitest `0 failed`, including `test/integration/delegate-stdio.test.ts` and `test/doctor.test.ts` `reports a proxy that does not start`

Commit:
```bash
git add src/proxy/ensure-proxy.ts src/delegate/delegate.ts src/doctor/doctor-checks.ts test/ensure-proxy.test.ts
git commit -m "feat(proxy): start one repair-proxy per provider with its port and upstream" -m "Plan-task: 11"
```

### Task 12: Point the worker at its provider

Depends on: Task 11

Files:
- Modify: `src/worker/worker-env.ts` (whole file)
- Modify: `src/delegate/delegate.ts` (`ensure-proxy` import, `workerEnvironment`)
- Test: `test/worker-env.test.ts` (`buildWorkerEnv` describe)
- Test: `test/delegate.test.ts` (imports, `HarnessOptions`, `harness`, three tests)

Step 1: Write the failing worker environment tests

`test/worker-env.test.ts`, the whole `buildWorkerEnv` describe block:
```ts
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
    baseUrl: 'https://openrouter.ai/api',
    model: 'deepseek-v4-flash',
    apiKey: 'sk-fake-key',
    effort: 'high',
  });

  it('drops inherited Claude Code and delegate variables and empties the inherited API key', () => {
    expect(env.ANTHROPIC_API_KEY).toBe('');
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
    expect(env.PATH).toBe('/usr/bin');
  });

  it('layers env.vars, then the provider URL, tier model, key, effort and depth', () => {
    expect(env).toMatchObject({
      ANTHROPIC_BASE_URL: 'https://openrouter.ai/api',
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
`test/delegate.test.ts`:
- add after the `delegate-result` import: `import type { ProxyStart } from '../src/proxy/ensure-proxy';`
- in `HarnessOptions`, the line `baseUrl?: string;` becomes `ensureProxy?: DelegateDeps['ensureProxy'];`
- in `harness`, the `env.vars` line becomes `writeFileSync(join(home, '.claude-deepseek', 'env.vars'), 'ANTHROPIC_BASE_URL=http://127.0.0.1:8787\nANTHROPIC_MODEL=deepseek-v4-pro\n');`
- in `harness`, the line `ensureProxy: async () => 'running',` becomes `ensureProxy: options.ensureProxy ?? (async () => 'running'),`
- in the test `runs a flash-high worker and returns summary, changed files, tier, model, effort and cost`, the line `hasApiKey: false,` becomes `hasApiKey: true,`
- the whole test `refuses a base URL that is not the proxy on 127.0.0.1` is replaced by:
```ts
  it("starts the provider's repair-proxy with its port and upstream", async () => {
    const starts: ProxyStart[] = [];
    const { deps } = harness({ ensureProxy: async (start) => starts.push(start) });
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done' });
    expect(starts).toEqual([expect.objectContaining({ port: 8787, upstreamBaseUrl: 'https://api.deepseek.com/anthropic' })]);
  });

  it('starts no proxy and still runs for a provider without a repair-proxy', async () => {
    const starts: ProxyStart[] = [];
    const { deps } = harness({ ensureProxy: async (start) => starts.push(start) });
    const { deepseek } = deps.config.providers;
    deps.config = { ...deps.config, providers: { ...deps.config.providers, deepseek: { ...deepseek, repairProxy: null } } };
    expect(await delegate(request(), deps)).toMatchObject({ status: 'done' });
    expect(starts).toEqual([]);
  });
```
Run: `npm test -- test/worker-env.test.ts test/delegate.test.ts`
Expected: `drops inherited Claude Code and delegate variables and empties the inherited API key` fails on `expected undefined to be ''`; `layers env.vars, then the provider URL, tier model, key, effort and depth` fails on `ANTHROPIC_BASE_URL`; `runs a flash-high worker` fails on `hasApiKey`; `starts no proxy and still runs for a provider without a repair-proxy` fails with `status: 'refused'`

Step 2: Take the base URL from the provider, `src/worker/worker-env.ts` (whole file)
```ts
import type { Effort } from '../config/config-schema';

const NOT_INHERITED = /^(ANTHROPIC_|CLAUDE_CODE_|CLAUDECODE$|CLAUDE_CONFIG_DIR$|DEEPSEEK_DELEGATE_)/;

export interface WorkerEnvInput {
  inherited: NodeJS.ProcessEnv;
  envVars: Record<string, string>;
  baseUrl: string;
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
    ANTHROPIC_BASE_URL: input.baseUrl,
    ANTHROPIC_MODEL: input.model,
    CLAUDE_CODE_SUBAGENT_MODEL: input.model,
    ANTHROPIC_AUTH_TOKEN: input.apiKey,
    ANTHROPIC_API_KEY: '',
    CLAUDE_CODE_EFFORT_LEVEL: input.effort,
    DEEPSEEK_DELEGATE_DEPTH: '1',
  };
}
```
`src/delegate/delegate.ts`, the line `import type { ProxyStart } from '../proxy/ensure-proxy';` becomes:
```ts
import { proxyUrl, type ProxyStart } from '../proxy/ensure-proxy';
```
`workerEnvironment` (whole function):
```ts
async function workerEnvironment(deps: DelegateDeps, provider: Provider, model: string, effort: Effort): Promise<Record<string, string>> {
  const path = envVarsPath(deps.homeDir);
  const envVarsText = await readFile(path, 'utf8').catch(() => {
    throw new Error(`${path} is missing; run npm run setup in routemax first.`);
  });
  const { repairProxy } = provider;
  if (repairProxy) {
    await deps.ensureProxy({ dir: deps.config.proxy.dir, port: repairProxy.port, upstreamBaseUrl: provider.baseUrl, logPath: repairProxy.logPath, telemetryPath: repairProxy.telemetryPath });
  }
  const baseUrl = repairProxy ? proxyUrl(repairProxy.port) : provider.baseUrl;
  const apiKey = await deps.readApiKey();
  return buildWorkerEnv({ inherited: deps.env, envVars: parseEnvVars(envVarsText), baseUrl, model, apiKey, effort });
}
```
Run: `npm run typecheck && npm test`
Expected: `tsc` prints nothing; vitest `0 failed`, including `test/integration/delegate-stdio.test.ts` (its fake upstream checks `Bearer sk-fake-DO-NOT-LEAK` on the provider's proxy port)

Commit:
```bash
git add src/worker/worker-env.ts src/delegate/delegate.ts test/worker-env.test.ts test/delegate.test.ts
git commit -m "feat(worker): point the worker at its provider and empty ANTHROPIC_API_KEY" -m "Plan-task: 12"
```

### Task 13: Read the key from the provider's Keychain service

Depends on: Task 12
Risk: the Keychain lookup of a secret changes its service name source

Files:
- Modify: `src/worker/read-api-key.ts` (whole file)
- Modify: `src/delegate/delegate.ts` (`DelegateDeps`, `workerEnvironment` key line)
- Modify: `src/doctor/doctor-checks.ts` (`DoctorDeps`, `checkApiKey`)
- Test: `test/read-api-key.test.ts` (the `describe` block)

Step 1: Write the failing Keychain test, `test/read-api-key.test.ts`, the whole `readApiKey` describe block
```ts
describe('readApiKey', () => {
  it('returns the password of the given Keychain service', async () => {
    fakeSecurity('[ "$1" = find-generic-password ] && [ "$4" = -s ] && [ "$5" = openrouter_api_key ] && [ "$6" = -w ] || exit 2\necho sk-fake-keychain');
    await expect(readApiKey('openrouter_api_key')).resolves.toBe('sk-fake-keychain');
  });

  it('fails closed with a message that holds no secret when the item is missing', async () => {
    fakeSecurity('echo sk-fake-partial >&2\nexit 44');
    const error = await readApiKey('deepseek_api_key').catch((caught: Error) => caught);
    expect(String(error)).toContain('API key not found in Keychain (service deepseek_api_key).');
    expect(String(error)).not.toContain('sk-fake-partial');
  });
});
```
Run: `npm test -- test/read-api-key.test.ts`
Expected: `returns the password of the given Keychain service` fails with `DeepSeek API key not found in Keychain (service deepseek_api_key).`; the second test passes

Step 2: Take the service as an argument, `src/worker/read-api-key.ts` (whole file)
```ts
import { execFile } from 'node:child_process';
import { userInfo } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function readApiKey(keychainService: string): Promise<string> {
  const missingKey = `API key not found in Keychain (service ${keychainService}).`;
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('security', ['find-generic-password', '-a', userInfo().username, '-s', keychainService, '-w']));
  } catch {
    throw new Error(missingKey);
  }
  const key = stdout.trim();
  if (!key) throw new Error(missingKey);
  return key;
}
```
Run: `npm test -- test/read-api-key.test.ts`
Expected: both tests pass, `0 failed`

Step 3: Pass the provider's service from `delegate` and the doctor

`src/delegate/delegate.ts`, `DelegateDeps` (whole interface):
```ts
export interface DelegateDeps {
  config: DelegateConfig;
  homeDir: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  readApiKey: (keychainService: string) => Promise<string>;
  ensureProxy: (start: ProxyStart) => Promise<unknown>;
}
```
In `workerEnvironment`, the line `const apiKey = await deps.readApiKey();` becomes:
```ts
  const apiKey = await deps.readApiKey(provider.keychainService);
```
`src/doctor/doctor-checks.ts`, in `DoctorDeps` the line `readApiKey: () => Promise<string>;` becomes:
```ts
  readApiKey: (keychainService: string) => Promise<string>;
```
`checkApiKey` (whole function):
```ts
async function checkApiKey(deps: DoctorDeps): Promise<DoctorCheck> {
  try {
    await deps.readApiKey(deps.config.providers.deepseek.keychainService);
    return pass('DeepSeek key', 'The DeepSeek key is in Keychain.');
  } catch {
    return fix('DeepSeek key', 'No DeepSeek key in Keychain. Store it once: security add-generic-password -a "$USER" -s deepseek_api_key -w');
  }
}
```
Run: `npm run typecheck && npm test`
Expected: `tsc` prints nothing; vitest `0 failed`, including `test/delegate.test.ts` `keeps the key out of the decision log and the result` and `fails closed without starting a worker when the key lookup fails`, and `test/integration/delegate-stdio.test.ts` (its fake `security` prints the key for any service)

Commit:
```bash
git add src/worker/read-api-key.ts src/delegate/delegate.ts src/doctor/doctor-checks.ts test/read-api-key.test.ts
git commit -m "feat(worker): read the key from the provider's Keychain service" -m "Plan-task: 13"
```

### Task 14: Plan a route with the provider's accepted effort

Depends on: Task 9

Files:
- Create: `src/routing/plan-route.ts`
- Modify: `src/routing/resolve-effort.ts` (whole file)
- Test: `test/plan-route.test.ts`

Step 1: Write the failing test, `test/plan-route.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import type { DelegateConfig } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import type { DelegateRequest } from '../src/delegate/delegate-result';
import { planRoute } from '../src/routing/plan-route';
import { fitEffort } from '../src/routing/resolve-effort';

const shipped = loadConfig(DEFAULT_CONFIG_PATH);
const request = (overrides: Partial<DelegateRequest> = {}): DelegateRequest => ({
  task: 'Add a greeting file.',
  taskType: 'boilerplate',
  requestedTier: 'flash-low',
  flags: [],
  ...overrides,
});

describe('fitEffort', () => {
  it.each([
    ['max', ['low', 'high'], 'high'],
    ['medium', ['high', 'low'], 'low'],
    ['low', ['medium', 'max'], 'medium'],
    ['high', ['low', 'medium', 'high', 'xhigh', 'max'], 'high'],
  ] as const)('fits %s into %j as %s', (effort, accepted, expected) => {
    expect(fitEffort(effort, [...accepted])).toBe(expected);
  });
});

describe('planRoute', () => {
  it('plans a boilerplate task on flash-high with the tier provider, model and effort', () => {
    expect(planRoute(shipped, request())).toEqual({ tier: 'flash-high', raisedBy: 'boilerplate-tests-edits', provider: 'deepseek', model: 'deepseek-flash', effort: 'high' });
  });

  it('names the Claude agent for a claude-tier task', () => {
    expect(planRoute(shipped, request({ taskType: 'security' }))).toMatchObject({ tier: 'claude', agent: 'claude-opus-xhigh' });
  });

  it('lowers the effort to one the provider accepts', () => {
    const config: DelegateConfig = { ...shipped, providers: { ...shipped.providers, deepseek: { ...shipped.providers.deepseek, efforts: ['low', 'high'] } } };
    expect(planRoute(config, request({ taskType: 'search', claudeEffort: 'xhigh' }))).toMatchObject({ tier: 'flash-low', effort: 'high' });
  });
});
```
Run: `npm test -- test/plan-route.test.ts`
Expected: the file fails with `Failed to resolve import "../src/routing/plan-route"`

Step 2: Add the effort fallback, `src/routing/resolve-effort.ts` (whole file)
```ts
import { EFFORT_ORDER, type DelegateConfig, type Effort } from '../config/config-schema';

export function resolveEffort(effortMap: DelegateConfig['effortMap'], tierEffort: Effort, claudeEffort?: Effort): Effort {
  if (!claudeEffort) return tierEffort;
  const mapped = effortMap[claudeEffort];
  return EFFORT_ORDER.indexOf(mapped) > EFFORT_ORDER.indexOf(tierEffort) ? mapped : tierEffort;
}

export function fitEffort(effort: Effort, accepted: Effort[]): Effort {
  const rank = (value: Effort) => EFFORT_ORDER.indexOf(value);
  const ascending = [...accepted].sort((left, right) => rank(left) - rank(right));
  return ascending.filter((value) => rank(value) <= rank(effort)).at(-1) ?? ascending[0];
}
```
Run: `npm test -- test/resolve-effort.test.ts`
Expected: every test passes, `0 failed`

Step 3: Write `src/routing/plan-route.ts`
```ts
import type { DelegateConfig, Effort, WorkerTier } from '../config/config-schema';
import { fitEffort, resolveEffort } from './resolve-effort';
import { routeTask, type RouteRequest } from './route-task';

export interface PlanRequest extends RouteRequest {
  claudeEffort?: Effort;
}

export interface ClaudeRoutePlan {
  tier: 'claude';
  raisedBy: string | null;
  agent: string;
}

export interface WorkerRoutePlan {
  tier: WorkerTier;
  raisedBy: string | null;
  provider: string;
  model: string;
  effort: Effort;
}

export type RoutePlan = ClaudeRoutePlan | WorkerRoutePlan;

export function planRoute(config: DelegateConfig, request: PlanRequest): RoutePlan {
  const { tier, raisedBy } = routeTask(config.rules, request);
  if (tier === 'claude') return { tier, raisedBy, agent: config.claude.taskTypes[request.taskType] ?? config.claude.defaultAgent };
  const workerTier = config.tiers[tier];
  const effort = resolveEffort(config.effortMap, workerTier.effort, request.claudeEffort);
  return { tier, raisedBy, provider: workerTier.provider, model: workerTier.model, effort: fitEffort(effort, config.providers[workerTier.provider].efforts) };
}
```
Run: `npm run typecheck && npm test -- test/plan-route.test.ts test/resolve-effort.test.ts`
Expected: `tsc` prints nothing; both files pass, `0 failed`

Commit:
```bash
git add src/routing/plan-route.ts src/routing/resolve-effort.ts test/plan-route.test.ts
git commit -m "feat(routing): plan a route with the provider's accepted effort" -m "Plan-task: 14"
```

### Task 15: Route delegate through planRoute and log the provider

Depends on: Task 13, Task 14

Files:
- Modify: `src/decision-log/decision-log.ts` (`DecisionRecord`, `DecisionBase`)
- Modify: `src/delegate/delegate.ts` (imports, `delegate`, `runDeepseekTask`)
- Test: `test/decision-log.test.ts` (`record`)
- Test: `test/delegate.test.ts` (three tests)

Step 1: Write the failing delegate tests, `test/delegate.test.ts`

The whole test `runs a flash-high worker and returns summary, changed files, tier, model, effort and cost`:
```ts
  it('runs a flash-high worker and returns summary, changed files, tier, model, effort and cost', async () => {
    const { deps, cwd, recordPath, home } = harness();
    const result = await delegate(request(), deps);
    expect(result).toMatchObject({
      status: 'done',
      summary: 'Did the thing.',
      changedFiles: [join(realpathSync(cwd), 'a.txt')],
      tier: 'flash-high',
      model: 'deepseek-flash',
      effort: 'high',
    });
    expect(result.status === 'done' && result.costUsd).toBeGreaterThan(0);
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    expect(record).toMatchObject({
      depth: '1',
      model: 'deepseek-flash',
      subagentModel: 'deepseek-flash',
      effort: 'high',
      hasAuthToken: true,
      hasApiKey: true,
      cwd: realpathSync(cwd),
    });
    expect(record.args).not.toContain('--dangerously-skip-permissions');
    expect(logLines(home)[0]).toMatchObject({ taskType: 'boilerplate', requestedTier: 'flash-low', finalTier: 'flash-high', raisedBy: 'boilerplate-tests-edits', provider: 'deepseek', status: 'done', reason: null, retries: 0 });
  });
```
In `returns use_claude for a claude-tier task without starting a worker`, the line `expect(logLines(home)[0]).toMatchObject({ status: 'use_claude', costUsd: 0 });` becomes:
```ts
    expect(logLines(home)[0]).toMatchObject({ status: 'use_claude', costUsd: 0, provider: null });
```
Add after `raises the worker effort for a higher Claude effort`:
```ts
  it('lowers the worker effort to one the provider accepts', async () => {
    const { deps } = harness();
    const { deepseek } = deps.config.providers;
    deps.config = { ...deps.config, providers: { ...deps.config.providers, deepseek: { ...deepseek, efforts: ['low', 'high'] } } };
    expect(await delegate(request({ taskType: 'search', claudeEffort: 'xhigh' }), deps)).toMatchObject({ tier: 'flash-low', effort: 'high' });
  });
```
Run: `npm test -- test/delegate.test.ts`
Expected: `runs a flash-high worker` fails on `provider` (`undefined`), `returns use_claude` fails on `provider`, `lowers the worker effort` fails with `effort: 'max'`

Step 2: Add `provider` to the decision record, `src/decision-log/decision-log.ts`, the `DecisionRecord` interface and the `DecisionBase` type
```ts
export interface DecisionRecord extends TokenUsage {
  ts: string;
  cwd: string;
  taskType: string;
  requestedTier: Tier;
  finalTier: Tier;
  raisedBy: string | null;
  provider: string | null;
  model: string | null;
  effort: Effort | null;
  costUsd: number;
  status: DelegateStatus;
  reason: EscalationReason | null;
  durationMs: number;
  retries: number;
}

export type DecisionBase = Pick<DecisionRecord, 'ts' | 'cwd' | 'taskType' | 'requestedTier' | 'finalTier' | 'raisedBy' | 'provider'>;
```
`test/decision-log.test.ts`, in `record`, add after `raisedBy: null,`:
```ts
  provider: 'deepseek',
```
Run: `npm test -- test/decision-log.test.ts`
Expected: every test passes, `0 failed`

Step 3: Route through `planRoute`, `src/delegate/delegate.ts`

The `config-schema` import becomes:
```ts
import type { DelegateConfig, Effort, Provider } from '../config/config-schema';
```
The two lines `import { resolveEffort } from '../routing/resolve-effort';` and `import { routeTask } from '../routing/route-task';` become:
```ts
import { planRoute, type WorkerRoutePlan } from '../routing/plan-route';
```
`delegate` (whole function):
```ts
export async function delegate(request: DelegateRequest, deps: DelegateDeps): Promise<DelegateResult> {
  if (Number(deps.env.DEEPSEEK_DELEGATE_DEPTH ?? 0) >= 1) {
    return { status: 'refused', message: 'delegate is not available inside a delegate worker.' };
  }
  const startedAt = Date.now();
  const plan = planRoute(deps.config, request);
  const logPath = decisionLogPath(deps.homeDir);
  const base: DecisionBase = {
    ts: new Date(startedAt).toISOString(),
    cwd: deps.cwd,
    taskType: request.taskType,
    requestedTier: request.requestedTier,
    finalTier: plan.tier,
    raisedBy: plan.raisedBy,
    provider: plan.tier === 'claude' ? null : plan.provider,
  };
  if (plan.tier === 'claude') {
    const agent = deps.config.claude.agents[plan.agent];
    await appendDecision(logPath, { ...base, ...NO_RUN, model: agent.model, effort: agent.effort, status: 'use_claude', reason: null, durationMs: Date.now() - startedAt });
    const next = `Do this task yourself through the Agent tool with subagent_type "${plan.agent}" (${agent.model}, effort ${agent.effort}), passing the full task.`;
    return { status: 'use_claude', tier: 'claude', agent: plan.agent, model: agent.model, effort: agent.effort, next };
  }
  const refusal = await budgetRefusal(logPath, deps.config.budget);
  if (refusal) return refuse(logPath, base, refusal, startedAt);
  return runDeepseekTask(request, plan, base, deps, startedAt);
}
```
`runDeepseekTask` (whole function):
```ts
async function runDeepseekTask(request: DelegateRequest, plan: WorkerRoutePlan, base: DecisionBase, deps: DelegateDeps, startedAt: number): Promise<DelegateResult> {
  const { config } = deps;
  const { tier, model, effort } = plan;
  const provider = config.providers[plan.provider];
  const logPath = decisionLogPath(deps.homeDir);
  let env: Record<string, string>;
  try {
    env = await workerEnvironment(deps, provider, model, effort);
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
    costOf: (stream) => stream.costUsd(provider.models, model),
  });
  const workerReason = workerEscalation(outcome);
  const testOutcome = workerReason === null && testCommand ? await runTestCommand(testCommand, deps.cwd, config.testTimeoutMs) : null;
  const retries = provider.repairProxy ? await countProxyRetries(provider.repairProxy.telemetryPath, outcome.startedAt, outcome.endedAt) : 0;
  const reason = workerReason ?? testEscalation(testOutcome) ?? retryEscalation(retries, config.retryThreshold);
  const costUsd = outcome.stream.costUsd(provider.models, model);
  const status = reason ? 'escalate' : 'done';
  await appendDecision(logPath, { ...base, ...outcome.stream.usage, model, effort, costUsd, status, reason, durationMs: Date.now() - startedAt, retries });
  const report = { summary: truncate(outcome.stream.result?.text ?? '', SUMMARY_LIMIT), changedFiles: outcome.stream.changedFiles, tier, model, effort, costUsd };
  return reason ? { status: 'escalate', reason, ...report } : { status: 'done', ...report };
}
```
Run: `npm run typecheck && npm test`
Expected: `tsc` prints nothing; vitest `0 failed`, including the three tests from Step 1, `test/decision-log.test.ts` and `test/integration/delegate-stdio.test.ts`

Commit:
```bash
git add src/decision-log/decision-log.ts src/delegate/delegate.ts test/decision-log.test.ts test/delegate.test.ts
git commit -m "feat(delegate): route through planRoute and log the provider" -m "Plan-task: 15"
```

### Phase 3: MCP server switch and live config

### Task 16: Build the Claude handoff in one place

Depends on: Task 15

Files:
- Modify: `src/routing/plan-route.ts` (`planRoute`, new `claudeAgentFor`)
- Modify: `src/delegate/delegate-result.ts` (`DelegateResult`, new `ClaudeHandoff`)
- Modify: `src/delegate/delegate.ts` (imports, `delegate`, new `claudeHandoff`)

Step 1: Extract `claudeAgentFor`, `src/routing/plan-route.ts`

Add before `planRoute`:
```ts
export function claudeAgentFor(config: DelegateConfig, taskType: string): string {
  return config.claude.taskTypes[taskType] ?? config.claude.defaultAgent;
}
```
In `planRoute`, the line `if (tier === 'claude') return { tier, raisedBy, agent: config.claude.taskTypes[request.taskType] ?? config.claude.defaultAgent };` becomes:
```ts
  if (tier === 'claude') return { tier, raisedBy, agent: claudeAgentFor(config, request.taskType) };
```
Run: `npm test -- test/plan-route.test.ts`
Expected: every test passes, `0 failed`

Step 2: Name the handoff type with the optional `reason` Task 17 sets, `src/delegate/delegate-result.ts`

`DelegateResult` (whole type) becomes, with `ClaudeHandoff` before it (`reason` stays unset until Task 17, which keeps Task 17 at four files):
```ts
export interface ClaudeHandoff {
  status: 'use_claude';
  tier: 'claude';
  agent: string;
  model: string;
  effort: Effort;
  next: string;
  reason?: 'disabled';
}

export type DelegateResult =
  | ({ status: 'done' } & WorkerReport)
  | ({ status: 'escalate'; reason: EscalationReason } & WorkerReport)
  | ClaudeHandoff
  | { status: 'refused'; message: string };
```
Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 3: Build the handoff through `claudeHandoff`, `src/delegate/delegate.ts`

The line `import type { DelegateRequest, DelegateResult, EscalationReason } from './delegate-result';` becomes:
```ts
import type { ClaudeHandoff, DelegateRequest, DelegateResult, EscalationReason } from './delegate-result';
```
The line `import { planRoute, type WorkerRoutePlan } from '../routing/plan-route';` becomes:
```ts
import { claudeAgentFor, planRoute, type WorkerRoutePlan } from '../routing/plan-route';
```
`delegate` (whole function) and the new `claudeHandoff` after it:
```ts
export async function delegate(request: DelegateRequest, deps: DelegateDeps): Promise<DelegateResult> {
  if (Number(deps.env.DEEPSEEK_DELEGATE_DEPTH ?? 0) >= 1) {
    return { status: 'refused', message: 'delegate is not available inside a delegate worker.' };
  }
  const startedAt = Date.now();
  const plan = planRoute(deps.config, request);
  const logPath = decisionLogPath(deps.homeDir);
  const base: DecisionBase = {
    ts: new Date(startedAt).toISOString(),
    cwd: deps.cwd,
    taskType: request.taskType,
    requestedTier: request.requestedTier,
    finalTier: plan.tier,
    raisedBy: plan.raisedBy,
    provider: plan.tier === 'claude' ? null : plan.provider,
  };
  if (plan.tier === 'claude') {
    const handoff = claudeHandoff(deps.config, plan.agent);
    await appendDecision(logPath, { ...base, ...NO_RUN, model: handoff.model, effort: handoff.effort, status: 'use_claude', reason: null, durationMs: Date.now() - startedAt });
    return handoff;
  }
  const refusal = await budgetRefusal(logPath, deps.config.budget);
  if (refusal) return refuse(logPath, base, refusal, startedAt);
  return runDeepseekTask(request, plan, base, deps, startedAt);
}

function claudeHandoff(config: DelegateConfig, agentName: string): ClaudeHandoff {
  const agent = config.claude.agents[agentName];
  const next = `Do this task yourself through the Agent tool with subagent_type "${agentName}" (${agent.model}, effort ${agent.effort}), passing the full task.`;
  return { status: 'use_claude', tier: 'claude', agent: agentName, model: agent.model, effort: agent.effort, next };
}
```
Run: `npm run typecheck && npm test -- test/delegate.test.ts test/plan-route.test.ts`
Expected: `tsc` prints nothing; both files pass, `0 failed`, with no test edited (behavior unchanged)

Commit:
```bash
git add src/routing/plan-route.ts src/delegate/delegate-result.ts src/delegate/delegate.ts
git commit -m "refactor(delegate): build the Claude handoff in one place" -m "Plan-task: 16"
```

### Task 17: Hand every call to Claude while the switch file says off

Depends on: Task 16

Files:
- Create: `src/router-switch/router-switch.ts`
- Modify: `src/decision-log/decision-log.ts` (new `DecisionStatus`, `DecisionRecord.status`)
- Modify: `src/delegate/delegate.ts` (imports, `delegate`, new `handOffWhileDisabled`)
- Test: `test/delegate.test.ts`

Step 1: Write `src/router-switch/router-switch.ts`
```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const routerSwitchPath = (homeDir: string) => join(homeDir, '.local', 'state', 'deepseek-delegate', 'enabled');

export function isRouterEnabled(homeDir: string): boolean {
  try {
    return readFileSync(routerSwitchPath(homeDir), 'utf8').trim() !== 'off';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
}
```
Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 2: Test the off and on switch, `test/delegate.test.ts`

Add after the `delegate` import (line 8):
```ts
import { routerSwitchPath } from '../src/router-switch/router-switch';
```
Add after the helper `logLines`:
```ts
function writeSwitch(home: string, state: 'on' | 'off'): void {
  mkdirSync(dirname(routerSwitchPath(home)), { recursive: true });
  writeFileSync(routerSwitchPath(home), `${state}\n`);
}
```
Add after the test `returns use_claude for a claude-tier task without starting a worker`:
```ts
  it('hands a worker task to the mapped Claude agent without a worker and logs it as disabled while the switch is off', async () => {
    const { deps, recordPath, home } = harness();
    writeSwitch(home, 'off');
    const result = await delegate(request({ taskType: 'search' }), deps);
    expect(result).toEqual({
      status: 'use_claude',
      tier: 'claude',
      agent: 'claude-opus-high',
      model: 'opus',
      effort: 'high',
      next: 'Do this task yourself through the Agent tool with subagent_type "claude-opus-high" (opus, effort high), passing the full task.',
      reason: 'disabled',
    });
    expect(existsSync(recordPath)).toBe(false);
    expect(logLines(home)).toHaveLength(1);
    expect(logLines(home)[0]).toMatchObject({ taskType: 'search', finalTier: 'claude', raisedBy: null, provider: null, model: 'opus', effort: 'high', status: 'disabled', reason: null, costUsd: 0, retries: 0 });
  });

  it('runs a worker again once the switch file says on', async () => {
    const { deps, recordPath, home } = harness();
    writeSwitch(home, 'on');
    const result = await delegate(request(), deps);
    expect(result.status).toBe('done');
    expect(existsSync(recordPath)).toBe(true);
  });
```
Run: `npm test -- test/delegate.test.ts`
Expected: `hands a worker task to the mapped Claude agent without a worker and logs it as disabled while the switch is off` fails on `toEqual` with the received `status: 'done'`; every other test passes

Step 3: Add the `disabled` log status, `src/decision-log/decision-log.ts`

`disabled` is a decision log status only: the call itself still returns `use_claude`, so `DelegateStatus` stays unchanged. Add after the imports:
```ts
export type DecisionStatus = DelegateStatus | 'disabled';
```
In `DecisionRecord`, the line `status: DelegateStatus;` becomes:
```ts
  status: DecisionStatus;
```
Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 4: Check the switch in `delegate`, `src/delegate/delegate.ts`

Add before the line `import { claudeAgentFor, planRoute, type WorkerRoutePlan } from '../routing/plan-route';`:
```ts
import { isRouterEnabled } from '../router-switch/router-switch';
```
In `delegate`, the line `const startedAt = Date.now();` becomes:
```ts
  const startedAt = Date.now();
  if (!isRouterEnabled(deps.homeDir)) return handOffWhileDisabled(request, deps, startedAt);
```
Add after `claudeHandoff`:
```ts
async function handOffWhileDisabled(request: DelegateRequest, deps: DelegateDeps, startedAt: number): Promise<ClaudeHandoff> {
  const handoff = claudeHandoff(deps.config, claudeAgentFor(deps.config, request.taskType));
  const base: DecisionBase = {
    ts: new Date(startedAt).toISOString(),
    cwd: deps.cwd,
    taskType: request.taskType,
    requestedTier: request.requestedTier,
    finalTier: 'claude',
    raisedBy: null,
    provider: null,
  };
  await appendDecision(decisionLogPath(deps.homeDir), { ...base, ...NO_RUN, model: handoff.model, effort: handoff.effort, status: 'disabled', reason: null, durationMs: Date.now() - startedAt });
  return { ...handoff, reason: 'disabled' };
}
```
Run: `npm run typecheck && npm test -- test/delegate.test.ts test/decision-log.test.ts`
Expected: `tsc` prints nothing; both files pass, `0 failed`, including the two tests from Step 2

Commit:
```bash
git add src/router-switch/router-switch.ts src/decision-log/decision-log.ts src/delegate/delegate.ts test/delegate.test.ts
git commit -m "feat(delegate): hand every call to Claude and log it as disabled while the switch is off" -m "Plan-task: 17"
```

### Task 18: Reload the config in a running server

Depends on: Task 17

Files:
- Modify: `src/config/delegate-config.ts` (`loadConfig`, new `activeConfigPath`)
- Create: `src/config/watch-config.ts`
- Modify: `src/server.ts` (whole file)
- Test: `test/integration/delegate-stdio.test.ts` (imports, `callDelegate`, `delegate tool surface`'s `connect`, new describe)

Step 1: Share one session helper and test the reload, `test/integration/delegate-stdio.test.ts`

The import `import { Client } from '@modelcontextprotocol/sdk/client/index.js';` keeps its place; add after the `StdioClientTransport` import:
```ts
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
```
The function `callDelegate` (whole function, lines 65-84 before Task 10) is replaced by:
```ts
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
```
In the `describe('delegate tool surface'` block, delete its local `connect` function (the six lines from `async function connect(): Promise<Client> {` to its closing `}`); its tests now use the module-level `connect`.

Add at the end of the file:
```ts
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
```
Run: `npm test -- test/integration/delegate-stdio.test.ts`
Expected: `routes the next call with a saved routing change and keeps the config when the file turns invalid` fails with a timeout at `await schemaChanged` (the running server never re-reads the file); every other test passes

Step 2: Export the active config path, `src/config/delegate-config.ts`

The line `export function loadConfig(path = process.env.DEEPSEEK_DELEGATE_CONFIG ?? ensureLiveConfig(homedir())): DelegateConfig {` becomes:
```ts
export const activeConfigPath = () => process.env.DEEPSEEK_DELEGATE_CONFIG ?? ensureLiveConfig(homedir());

export function loadConfig(path = activeConfigPath()): DelegateConfig {
```

Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 3: Write `src/config/watch-config.ts`
```ts
import { watchFile } from 'node:fs';
import type { DelegateConfig } from './config-schema';
import { loadConfig } from './delegate-config';

export const WATCH_INTERVAL_MS = 500;

export function watchConfig(path: string, onReload: (config: DelegateConfig) => void): void {
  watchFile(path, { interval: WATCH_INTERVAL_MS, persistent: false }, () => {
    let config: DelegateConfig;
    try {
      config = loadConfig(path);
    } catch (error) {
      process.stderr.write(`routemax: ${path} is invalid, keeping the previous config. ${(error as Error).message}\n`);
      return;
    }
    onReload(config);
  });
}
```

Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 4: Rebuild the tool schema on reload, `src/server.ts` (whole file)
```ts
import { homedir } from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { EFFORT_ORDER, TIER_ORDER, type DelegateConfig } from './config/config-schema';
import { activeConfigPath, loadConfig } from './config/delegate-config';
import { watchConfig } from './config/watch-config';
import { delegate } from './delegate/delegate';
import type { DelegateRequest } from './delegate/delegate-result';
import { ensureProxy } from './proxy/ensure-proxy';
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

await server.connect(new StdioServerTransport());
```
Run: `npm run typecheck && npm test -- test/integration/delegate-stdio.test.ts`
Expected: `tsc` prints nothing; the file passes, `0 failed`, including `routes the next call with a saved routing change and keeps the config when the file turns invalid`

Commit:
```bash
git add src/config/delegate-config.ts src/config/watch-config.ts src/server.ts test/integration/delegate-stdio.test.ts
git commit -m "feat(server): reload the config and the tool schema without a restart" -m "Plan-task: 18"
```

### Task 19: Drop delegate from the tool list while the switch is off

Depends on: Task 18

Files:
- Modify: `src/router-switch/router-switch.ts` (new `watchRouterSwitch`)
- Modify: `src/server.ts` (imports, tail after `watchConfig`)
- Test: `test/integration/delegate-stdio.test.ts` (imports, new describe)

Step 1: Test the switch in an open session, `test/integration/delegate-stdio.test.ts`

The `node:path` import becomes:
```ts
import { dirname, join } from 'node:path';
```
Add after the `decision-log` import:
```ts
import { routerSwitchPath } from '../../src/router-switch/router-switch';
```
Add at the end of the file:
```ts
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
```
Run: `npm test -- test/integration/delegate-stdio.test.ts`
Expected: `drops delegate while off, answers a stale call with use_claude, and brings it back when on` fails with a timeout at `await dropped` (no watcher disables the tool); every other test passes

Step 2: Add `watchRouterSwitch`, `src/router-switch/router-switch.ts`

The imports become:
```ts
import { readFileSync, watchFile } from 'node:fs';
import { join } from 'node:path';
import { WATCH_INTERVAL_MS } from '../config/watch-config';
```
Add at the end of the file:
```ts
export function watchRouterSwitch(homeDir: string, onChange: (enabled: boolean) => void): void {
  let enabled = isRouterEnabled(homeDir);
  watchFile(routerSwitchPath(homeDir), { interval: WATCH_INTERVAL_MS, persistent: false }, () => {
    let next: boolean;
    try {
      next = isRouterEnabled(homeDir);
    } catch (error) {
      process.stderr.write(`routemax: cannot read ${routerSwitchPath(homeDir)}, keeping the switch ${enabled ? 'on' : 'off'}. ${(error as Error).message}\n`);
      return;
    }
    if (next === enabled) return;
    enabled = next;
    onChange(next);
  });
}
```

Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 3: Disable the tool and answer every call through one handler, `src/server.ts`

Add after the `@modelcontextprotocol/sdk/server/stdio.js` import:
```ts
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
```
The `config-schema` import becomes:
```ts
import { EFFORT_ORDER, TIER_ORDER, formatIssues, type DelegateConfig } from './config/config-schema';
```
Add after the `ensure-proxy` import:
```ts
import { isRouterEnabled, watchRouterSwitch } from './router-switch/router-switch';
```
Between the `watchConfig(configPath, (next) => {` block and the last line `await server.connect(new StdioServerTransport());`, add:
```ts
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
```
Run: `npm run typecheck && npm test -- test/integration/delegate-stdio.test.ts test/delegate.test.ts`
Expected: `tsc` prints nothing; both files pass, `0 failed`, including `drops delegate while off, answers a stale call with use_claude, and brings it back when on` and `rejects a task type outside the routing rules`

Commit:
```bash
git add src/router-switch/router-switch.ts src/server.ts test/integration/delegate-stdio.test.ts
git commit -m "feat(server): drop delegate from the tool list while the switch is off" -m "Plan-task: 19"
```

### Phase 4: Doctor lines for the switch, the command and every provider

### Task 20: Report the router switch in the doctor

Depends on: Task 19

Files:
- Modify: `src/doctor/doctor-checks.ts` (imports, new `checkRouter`, `runDoctorChecks`)
- Test: `test/doctor.test.ts`

Step 1: Test the router line, `test/doctor.test.ts`

The `node:path` import becomes:
```ts
import { dirname, join } from 'node:path';
```
Add after the `decision-log` import:
```ts
import { routerSwitchPath } from '../src/router-switch/router-switch';
```
In `reports OK on every line after a complete setup`, the name list assertion becomes:
```ts
    expect(checks.map((check) => check.name)).toEqual(['router', 'env.vars', 'DeepSeek key', 'repair-proxy', 'MCP server', 'Claude agents', 'budget', 'Max settings']);
```
In `says what to do on every line when nothing is set up`, the line `expect(checks.every((check) => !check.ok)).toBe(true);` becomes (the router line is never a fix, on or off):
```ts
    expect(checks.filter((check) => check.name !== 'router').every((check) => !check.ok)).toBe(true);
```
Add after the test `reports a proxy that does not start`:
```ts
  it('reports the router as off without asking for a fix', async () => {
    const root = mkdtempSync(join(tmpdir(), 'routemax-doctor-'));
    const deps = doctorDeps(root);
    mkdirSync(dirname(routerSwitchPath(deps.homeDir)), { recursive: true });
    writeFileSync(routerSwitchPath(deps.homeDir), 'off\n');
    const checks = await runDoctorChecks(deps);
    expect(checks.find((check) => check.name === 'router')).toMatchObject({ ok: true, message: expect.stringContaining('The router is off') });
  });
```
Run: `npm test -- test/doctor.test.ts`
Expected: `reports OK on every line after a complete setup` fails on the name list (no `router`); `reports the router as off without asking for a fix` fails with `expected undefined to match object`

Step 2: Add `checkRouter`, `src/doctor/doctor-checks.ts`

Add after the `decision-log` import:
```ts
import { isRouterEnabled, routerSwitchPath } from '../router-switch/router-switch';
```
Add before `checkServer`:
```ts
function checkRouter(homeDir: string): DoctorCheck {
  const path = routerSwitchPath(homeDir);
  try {
    if (isRouterEnabled(homeDir)) return pass('router', 'The router is on: delegate hands tasks to workers.');
    return pass('router', `The router is off: every delegate call goes to Claude. Switch it on on the routemax page or write on to ${path}.`);
  } catch (error) {
    return fix('router', `${path} cannot be read (${(error as Error).message}).`);
  }
}
```
In `runDoctorChecks`, add as the first element of the returned array:
```ts
    checkRouter(deps.homeDir),
```
Run: `npm run typecheck && npm test -- test/doctor.test.ts`
Expected: `tsc` prints nothing; the file passes, `0 failed`, including `reports the router as off without asking for a fix`

Commit:
```bash
git add src/doctor/doctor-checks.ts test/doctor.test.ts
git commit -m "feat(doctor): report whether the router is on or off" -m "Plan-task: 20"
```

### Task 21: Find a command on PATH

Depends on: Task 19

Files:
- Create: `src/doctor/command-on-path.ts`
- Test: `test/command-on-path.test.ts`

Step 1: Write the failing test, `test/command-on-path.test.ts`
```ts
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commandOnPath } from '../src/doctor/command-on-path';

function binDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'routemax-path-'));
  writeFileSync(join(dir, 'routemax'), '#!/bin/sh\n');
  chmodSync(join(dir, 'routemax'), 0o755);
  writeFileSync(join(dir, 'plain'), 'not executable\n');
  return dir;
}

describe('commandOnPath', () => {
  it('finds an executable in a later PATH entry', async () => {
    const dir = binDir();
    await expect(commandOnPath('routemax', ['/nonexistent-routemax-dir', dir].join(delimiter))).resolves.toBe(true);
  });

  it('ignores a file that is not executable and a name that is missing', async () => {
    const dir = binDir();
    await expect(commandOnPath('plain', dir)).resolves.toBe(false);
    await expect(commandOnPath('missing', dir)).resolves.toBe(false);
    await expect(commandOnPath('routemax', '')).resolves.toBe(false);
  });
});
```
Run: `npm test -- test/command-on-path.test.ts`
Expected: the file fails to load: `Failed to resolve import "../src/doctor/command-on-path"`

Step 2: Write `src/doctor/command-on-path.ts`
```ts
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

export async function commandOnPath(name: string, pathVariable = process.env.PATH ?? ''): Promise<boolean> {
  for (const dir of pathVariable.split(delimiter).filter(Boolean)) {
    try {
      await access(join(dir, name), constants.X_OK);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}
```
Run: `npm run typecheck && npm test -- test/command-on-path.test.ts`
Expected: `tsc` prints nothing; both tests pass, `0 failed`

Commit:
```bash
git add src/doctor/command-on-path.ts test/command-on-path.test.ts
git commit -m "feat(doctor): find a command on PATH" -m "Plan-task: 21"
```

### Task 22: Check that routemax is on PATH

Depends on: Task 20, Task 21

Files:
- Modify: `src/doctor/doctor-checks.ts` (`DoctorDeps`, new `checkRoutemaxCommand`, `runDoctorChecks`)
- Modify: `src/doctor/run-doctor.ts` (imports, `runDoctorChecks` deps)
- Test: `test/doctor.test.ts`

Step 1: Test the command line, `test/doctor.test.ts`

In `doctorDeps`, add after `ensureProxy: async () => 'running',`:
```ts
    commandOnPath: async () => true,
```
In `reports OK on every line after a complete setup`, the name list assertion becomes:
```ts
    expect(checks.map((check) => check.name)).toEqual(['router', 'routemax command', 'env.vars', 'DeepSeek key', 'repair-proxy', 'MCP server', 'Claude agents', 'budget', 'Max settings']);
```
In `says what to do on every line when nothing is set up`, add after `readApiKey: async () => Promise.reject(new Error('no key')),`:
```ts
        commandOnPath: async () => false,
```
and add after the line `const byName = Object.fromEntries(checks.map((check) => [check.name, check]));`:
```ts
    expect(byName['routemax command'].message).toContain('npm link');
```
Run: `npm test -- test/doctor.test.ts`
Expected: `reports OK on every line after a complete setup` fails on the name list (no `routemax command`); `says what to do on every line when nothing is set up` fails with `Cannot read properties of undefined (reading 'message')`

Step 2: Add `checkRoutemaxCommand`, `src/doctor/doctor-checks.ts`

In `DoctorDeps`, add after the `ensureProxy` line:
```ts
  commandOnPath: (name: string) => Promise<boolean>;
```
Add after `checkRouter`:
```ts
async function checkRoutemaxCommand(deps: DoctorDeps): Promise<DoctorCheck> {
  if (await deps.commandOnPath('routemax')) return pass('routemax command', 'routemax is on PATH, so routemax ui works in every terminal.');
  return fix('routemax command', `routemax is not on PATH. Run npm link in ${deps.repoRoot}.`);
}
```
In `runDoctorChecks`, add after `checkRouter(deps.homeDir),`:
```ts
    await checkRoutemaxCommand(deps),
```
`src/doctor/run-doctor.ts`: add after the line `import { runDoctorChecks } from './doctor-checks';`:
```ts
import { commandOnPath } from './command-on-path';
```
and in the object passed to `runDoctorChecks`, add after `ensureProxy,`:
```ts
  commandOnPath,
```
Run: `npm run typecheck && npm test -- test/doctor.test.ts`
Expected: `tsc` prints nothing; the file passes, `0 failed`

Commit:
```bash
git add src/doctor/doctor-checks.ts src/doctor/run-doctor.ts test/doctor.test.ts
git commit -m "feat(doctor): check that routemax is on PATH" -m "Plan-task: 22"
```

### Task 23: Check the key and repair-proxy of every enabled provider

Depends on: Task 22

Files:
- Modify: `src/doctor/doctor-checks.ts` (imports, `checkEnvVars`, remove `proxyBaseUrl`, `checkApiKey` and `checkProxy`, new `checkProviderKey`, `checkProviderProxy`, `checkProviders`, `runDoctorChecks`)
- Test: `test/doctor.test.ts`

Step 1: Test the per-provider lines, `test/doctor.test.ts`

Add after the `delegate-config` import:
```ts
import type { Provider } from '../src/config/config-schema';
```
In `reports OK on every line after a complete setup`, the name list assertion becomes:
```ts
    expect(checks.map((check) => check.name)).toEqual(['router', 'routemax command', 'env.vars', 'DeepSeek key', 'DeepSeek repair-proxy', 'MCP server', 'Claude agents', 'budget', 'Max settings']);
```
In `says what to do on every line when nothing is set up`, the line `expect(byName['repair-proxy'].message).toContain('env.vars');` becomes:
```ts
    expect(byName['DeepSeek repair-proxy'].message).toContain('env.vars');
```
In `reports a proxy that does not start`, the line with `check.name === 'repair-proxy'` becomes:
```ts
    expect(checks.find((check) => check.name === 'DeepSeek repair-proxy')).toMatchObject({ ok: false, message: expect.stringContaining('/tmp/deepseek-proxy.log') });
```
Add after the test `reports a proxy that does not start`:
```ts
  it('checks the key of every enabled provider and a proxy only where one is set', async () => {
    const root = mkdtempSync(join(tmpdir(), 'routemax-doctor-'));
    await createDeepseekHome(join(root, 'home'));
    fakeClaude(root);
    const config = loadConfig(DEFAULT_CONFIG_PATH);
    const openrouter: Provider = { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api', keychainService: 'openrouter_api_key', models: {}, efforts: [], enabled: true, repairProxy: null };
    const spare: Provider = { ...openrouter, name: 'Spare', keychainService: 'spare_api_key', enabled: false };
    const startedPorts: number[] = [];
    const checks = await runDoctorChecks(
      doctorDeps(root, {
        config: { ...config, providers: { ...config.providers, openrouter, spare } },
        readApiKey: async (service) => (service === 'openrouter_api_key' ? Promise.reject(new Error('no key')) : SECRET),
        ensureProxy: async (start) => {
          startedPorts.push(start.port);
          return 'running';
        },
      }),
    );
    const names = checks.map((check) => check.name);
    expect(names).toEqual(expect.arrayContaining(['DeepSeek key', 'DeepSeek repair-proxy', 'OpenRouter key']));
    expect(names).not.toContain('OpenRouter repair-proxy');
    expect(names).not.toContain('Spare key');
    expect(checks.find((check) => check.name === 'OpenRouter key')).toMatchObject({ ok: false, message: expect.stringContaining('-s openrouter_api_key -w') });
    expect(startedPorts).toEqual([config.providers.deepseek.repairProxy?.port]);
  });
```
Run: `npm test -- test/doctor.test.ts`
Expected: `reports OK on every line after a complete setup` fails on the name list (`repair-proxy` instead of `DeepSeek repair-proxy`); `checks the key of every enabled provider and a proxy only where one is set` fails on `arrayContaining` (no `OpenRouter key`)

Step 2: Check every enabled provider, `src/doctor/doctor-checks.ts`

The `config-schema` type import becomes:
```ts
import type { DelegateConfig, Provider, RepairProxy } from '../config/config-schema';
```
Delete `proxyBaseUrl`, `checkApiKey` and `checkProxy`. `checkEnvVars` (whole function), followed by the three new functions:
```ts
async function checkEnvVars(homeDir: string): Promise<DoctorCheck> {
  const text = await readFile(envVarsPath(homeDir), 'utf8').catch(() => null);
  if (text !== null && parseEnvVars(text).CLAUDE_CONFIG_DIR === deepseekHomeDir(homeDir)) {
    return pass('env.vars', 'The worker runs with its own Claude home, ~/.claude-deepseek.');
  }
  return fix('env.vars', `~/.claude-deepseek/env.vars is missing or does not point CLAUDE_CONFIG_DIR at ~/.claude-deepseek. ${RUN_SETUP}`);
}

async function checkProviderKey(deps: DoctorDeps, provider: Provider): Promise<DoctorCheck> {
  const name = `${provider.name} key`;
  try {
    await deps.readApiKey(provider.keychainService);
    return pass(name, `The ${provider.name} key is in Keychain.`);
  } catch {
    return fix(name, `No ${provider.name} key in Keychain. Store it once: security add-generic-password -a "$USER" -s ${provider.keychainService} -w`);
  }
}

async function checkProviderProxy(deps: DoctorDeps, provider: Provider, repairProxy: RepairProxy, envVarsOk: boolean): Promise<DoctorCheck> {
  const name = `${provider.name} repair-proxy`;
  if (!envVarsOk) return fix(name, 'Not checked until env.vars is fixed.');
  try {
    const state = await deps.ensureProxy({ dir: deps.config.proxy.dir, port: repairProxy.port, upstreamBaseUrl: provider.baseUrl, logPath: repairProxy.logPath, telemetryPath: repairProxy.telemetryPath });
    return pass(name, state === 'started' ? `The ${provider.name} repair-proxy was down and is started now.` : `The ${provider.name} repair-proxy answers on port ${repairProxy.port}.`);
  } catch {
    return fix(name, `The ${provider.name} repair-proxy does not start; see ${repairProxy.logPath}.`);
  }
}

async function checkProviders(deps: DoctorDeps, envVarsOk: boolean): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  for (const provider of Object.values(deps.config.providers).filter((candidate) => candidate.enabled)) {
    checks.push(await checkProviderKey(deps, provider));
    if (provider.repairProxy) checks.push(await checkProviderProxy(deps, provider, provider.repairProxy, envVarsOk));
  }
  return checks;
}
```
`runDoctorChecks` (whole function):
```ts
export async function runDoctorChecks(deps: DoctorDeps): Promise<DoctorCheck[]> {
  const envVars = await checkEnvVars(deps.homeDir);
  const setupChecks = [checkRouter(deps.homeDir), await checkRoutemaxCommand(deps), envVars];
  const providerChecks = await checkProviders(deps, envVars.ok);
  return setupChecks.concat(providerChecks, [
    await checkServer(deps.registration),
    await checkAgents(deps),
    await checkBudget(deps),
    await checkMaxSettings(deps.homeDir),
  ]);
}
```
Run: `npm run typecheck && npm test`
Expected: `tsc` prints nothing; vitest `0 failed`, including every test in `test/doctor.test.ts`

Commit:
```bash
git add src/doctor/doctor-checks.ts test/doctor.test.ts
git commit -m "feat(doctor): check the key and repair-proxy of every enabled provider" -m "Plan-task: 23"
```

### Phase 5: UI HTTP server and API

### Task 24: Refuse a request without the token, a foreign Host or a foreign Origin

Depends on: Task 23
Risk: trust boundary between the browser and the local server that writes config, keys and the switch

Files:
- Create: `src/ui/request-guard.ts`
- Test: `test/request-guard.test.ts`

Step 1: Write the failing test, `test/request-guard.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { isAllowedRequest, TOKEN_HEADER } from '../src/ui/request-guard';

const PORT = 4321;
const TOKEN = 'secret-token';

function request(url: string, method: string, headers: Record<string, string>) {
  return { url, method, headers };
}

const apiGet = { host: `127.0.0.1:${PORT}`, [TOKEN_HEADER]: TOKEN };
const apiPut = { ...apiGet, origin: `http://127.0.0.1:${PORT}`, 'content-type': 'application/json; charset=utf-8' };

describe('isAllowedRequest', () => {
  it('lets through an API read with the token and the own Host, on 127.0.0.1 and localhost', () => {
    expect(isAllowedRequest(request('/api/config', 'GET', apiGet), PORT, TOKEN)).toBe(true);
    expect(isAllowedRequest(request('/api/config', 'GET', { ...apiGet, host: `localhost:${PORT}` }), PORT, TOKEN)).toBe(true);
  });

  it('refuses an API request without the token or with a wrong one', () => {
    expect(isAllowedRequest(request('/api/config', 'GET', { host: `127.0.0.1:${PORT}` }), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/api/config', 'GET', { ...apiGet, [TOKEN_HEADER]: 'secret-tokeX' }), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/api/config', 'GET', { ...apiGet, [TOKEN_HEADER]: 'short' }), PORT, TOKEN)).toBe(false);
  });

  it('refuses a foreign Host, including the own host on another port', () => {
    expect(isAllowedRequest(request('/api/config', 'GET', { ...apiGet, host: `evil.test:${PORT}` }), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/api/config', 'GET', { ...apiGet, host: '127.0.0.1:9999' }), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/', 'GET', { host: `evil.test:${PORT}` }), PORT, TOKEN)).toBe(false);
  });

  it('refuses a write without the own Origin or without a JSON content type', () => {
    expect(isAllowedRequest(request('/api/config', 'PUT', apiPut), PORT, TOKEN)).toBe(true);
    expect(isAllowedRequest(request('/api/config', 'PUT', { ...apiPut, origin: 'http://evil.test' }), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/api/config', 'PUT', { ...apiPut, origin: `http://localhost:${PORT}` }), PORT, TOKEN)).toBe(false);
    const { origin: _origin, ...withoutOrigin } = apiPut;
    expect(isAllowedRequest(request('/api/config', 'PUT', withoutOrigin), PORT, TOKEN)).toBe(false);
    expect(isAllowedRequest(request('/api/config', 'PUT', { ...apiPut, 'content-type': 'text/plain' }), PORT, TOKEN)).toBe(false);
  });

  it('serves the static page with the own Host and no token', () => {
    expect(isAllowedRequest(request('/', 'GET', { host: `127.0.0.1:${PORT}` }), PORT, TOKEN)).toBe(true);
    expect(isAllowedRequest(request('/assets/index.js', 'GET', { host: `localhost:${PORT}` }), PORT, TOKEN)).toBe(true);
    expect(isAllowedRequest(request('/', 'POST', { host: `127.0.0.1:${PORT}` }), PORT, TOKEN)).toBe(false);
  });
});
```
Run: `npm test -- test/request-guard.test.ts`
Expected: the file fails to load: `Failed to resolve import "../src/ui/request-guard"`

Step 2: Write `src/ui/request-guard.ts`
```ts
import { timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

export const TOKEN_HEADER = 'x-routemax-token';

export interface GuardedRequest {
  url: string;
  method: string;
  headers: IncomingHttpHeaders;
}

function tokenMatches(sent: string | string[] | undefined, token: string): boolean {
  if (typeof sent !== 'string') return false;
  const sentBytes = Buffer.from(sent);
  const tokenBytes = Buffer.from(token);
  return sentBytes.length === tokenBytes.length && timingSafeEqual(sentBytes, tokenBytes);
}

function isJson(contentType: string | undefined): boolean {
  return (contentType ?? '').split(';')[0].trim().toLowerCase() === 'application/json';
}

export function isAllowedRequest(request: GuardedRequest, port: number, token: string): boolean {
  const host = request.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false;
  const isRead = request.method === 'GET' || request.method === 'HEAD';
  if (!request.url.startsWith('/api/')) return isRead;
  if (!tokenMatches(request.headers[TOKEN_HEADER], token)) return false;
  if (isRead) return true;
  return request.headers.origin === `http://${host}` && isJson(request.headers['content-type']);
}
```
Run: `npm run typecheck && npm test -- test/request-guard.test.ts`
Expected: `tsc` prints nothing; all five tests pass, `0 failed`

Commit:
```bash
git add src/ui/request-guard.ts test/request-guard.test.ts
git commit -m "feat(ui): refuse requests without the token, own Host or own Origin" -m "Plan-task: 24"
```

### Task 25: Resolve a static file under the build folder only

Depends on: Task 24
Risk: path traversal from a URL into the file system

Files:
- Create: `src/ui/static-files.ts`
- Test: `test/static-files.test.ts`

Step 1: Write the failing test, `test/static-files.test.ts`
```ts
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentTypeOf, resolveStaticPath } from '../src/ui/static-files';

const ROOT = '/srv/routemax/web/dist';

describe('resolveStaticPath', () => {
  it('maps an asset under the root and drops the query', () => {
    expect(resolveStaticPath(ROOT, '/assets/index-abc.js?v=1')).toBe(join(ROOT, 'assets', 'index-abc.js'));
  });

  it('falls back to index.html for the root and for a page path without an extension', () => {
    expect(resolveStaticPath(ROOT, '/')).toBe(join(ROOT, 'index.html'));
    expect(resolveStaticPath(ROOT, '/history')).toBe(join(ROOT, 'index.html'));
  });

  it('refuses a path that leaves the root, plain or percent-encoded', () => {
    expect(resolveStaticPath(ROOT, '/../package.json')).toBeNull();
    expect(resolveStaticPath(ROOT, '/assets/%2e%2e/%2e%2e/%2e%2e/package.json')).toBeNull();
    expect(resolveStaticPath(ROOT, '/%2e%2e%2fsecret.txt')).toBeNull();
    expect(resolveStaticPath(ROOT, '/bad%escape.js')).toBeNull();
  });

  it('names the content type by extension', () => {
    expect(contentTypeOf('/x/index.html')).toBe('text/html; charset=utf-8');
    expect(contentTypeOf('/x/a.js')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeOf('/x/a.bin')).toBe('application/octet-stream');
  });
});
```
Run: `npm test -- test/static-files.test.ts`
Expected: the file fails to load: `Failed to resolve import "../src/ui/static-files"`

Step 2: Write `src/ui/static-files.ts`
```ts
import { extname, resolve, sep } from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function contentTypeOf(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function resolveStaticPath(root: string, url: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.split('?')[0]);
  } catch {
    return null;
  }
  const rootDir = resolve(root);
  const candidate = resolve(rootDir, `.${pathname}`);
  if (candidate !== rootDir && !candidate.startsWith(`${rootDir}${sep}`)) return null;
  if (candidate === rootDir || extname(candidate) === '') return resolve(rootDir, 'index.html');
  return candidate;
}
```
Run: `npm run typecheck && npm test -- test/static-files.test.ts`
Expected: `tsc` prints nothing; all four tests pass, `0 failed`

Commit:
```bash
git add src/ui/static-files.ts test/static-files.test.ts
git commit -m "feat(ui): resolve static files under the build folder only" -m "Plan-task: 25"
```

### Task 26: Save and restore the live config with a stale check and a previous version

Depends on: Task 25

Files:
- Create: `src/config/config-store.ts`
- Modify: `src/config/routemax-paths.ts` (new `previousConfigPath`)
- Test: `test/config-store.test.ts`

Step 1: Write the failing test, `test/config-store.test.ts`
```ts
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH } from '../src/config/delegate-config';
import { readStoredConfig, restorePrevious, saveConfig, textHash } from '../src/config/config-store';
import { migrateConfig } from '../src/config/migrate-config';

function store() {
  const dir = mkdtempSync(join(tmpdir(), 'routemax-store-'));
  const configPath = join(dir, 'config.json');
  const previousPath = join(dir, 'backups', 'config.prev.json');
  const seed = migrateConfig(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'))) as Record<string, any>;
  writeFileSync(configPath, `${JSON.stringify(seed, null, 2)}\n`);
  return { configPath, previousPath, seed };
}

describe('config store', () => {
  it('saves a valid config, keeps the previous text and returns the new hash', () => {
    const { configPath, previousPath, seed } = store();
    const before = readFileSync(configPath, 'utf8');
    const loaded = readStoredConfig(configPath, previousPath);
    expect(loaded).toEqual({ config: seed, hash: textHash(before), previousExists: false });
    const changed = { ...seed, budget: { ...seed.budget, totalUsd: 42 } };
    const outcome = saveConfig(configPath, previousPath, changed, loaded.hash);
    expect(outcome).toEqual({ ok: true, hash: textHash(readFileSync(configPath, 'utf8')) });
    expect(JSON.parse(readFileSync(configPath, 'utf8')).budget.totalUsd).toBe(42);
    expect(readFileSync(previousPath, 'utf8')).toBe(before);
  });

  it('refuses a save based on a config that changed on disk and leaves the file unchanged', () => {
    const { configPath, previousPath, seed } = store();
    const before = readFileSync(configPath, 'utf8');
    const outcome = saveConfig(configPath, previousPath, seed, textHash('something older'));
    expect(outcome).toMatchObject({ ok: false, kind: 'stale' });
    expect(readFileSync(configPath, 'utf8')).toBe(before);
  });

  it('refuses an invalid config naming the field and leaves the file unchanged', () => {
    const { configPath, previousPath, seed } = store();
    const before = readFileSync(configPath, 'utf8');
    const hash = textHash(before);
    const negativeCap = saveConfig(configPath, previousPath, { ...seed, budget: { ...seed.budget, totalUsd: -1 } }, hash);
    expect(negativeCap).toMatchObject({ ok: false, kind: 'invalid' });
    expect(negativeCap.ok ? '' : negativeCap.issues.join('\n')).toContain('budget.totalUsd');
    const unknownProvider = saveConfig(configPath, previousPath, { ...seed, tiers: { ...seed.tiers, 'flash-low': { ...seed.tiers['flash-low'], provider: 'nope' } } }, hash);
    expect(unknownProvider.ok ? '' : unknownProvider.issues.join('\n')).toContain('tiers');
    const badEffort = saveConfig(configPath, previousPath, { ...seed, tiers: { ...seed.tiers, 'flash-low': { ...seed.tiers['flash-low'], effort: 'huge' } } }, hash);
    expect(badEffort.ok ? '' : badEffort.issues.join('\n')).toContain('effort');
    expect(readFileSync(configPath, 'utf8')).toBe(before);
  });

  it('restores the previous version, and a second restore undoes the first', () => {
    const { configPath, previousPath, seed } = store();
    const original = readFileSync(configPath, 'utf8');
    const saved = saveConfig(configPath, previousPath, { ...seed, retryThreshold: 7 }, textHash(original));
    if (!saved.ok) throw new Error(saved.issues.join('\n'));
    const edited = readFileSync(configPath, 'utf8');
    expect(restorePrevious(configPath, previousPath, saved.hash)).toEqual({ ok: true, hash: textHash(original) });
    expect(readFileSync(configPath, 'utf8')).toBe(original);
    expect(restorePrevious(configPath, previousPath, textHash(original))).toEqual({ ok: true, hash: textHash(edited) });
    expect(readFileSync(configPath, 'utf8')).toBe(edited);
  });

  it('refuses a restore without a previous version', () => {
    const { configPath, previousPath } = store();
    expect(restorePrevious(configPath, previousPath, textHash(readFileSync(configPath, 'utf8')))).toMatchObject({ ok: false, kind: 'missing' });
  });
});
```
Run: `npm test -- test/config-store.test.ts`
Expected: the file fails to load: `Failed to resolve import "../src/config/config-store"`

Step 2: Add the previous-version path, `src/config/routemax-paths.ts`, after the line `export const v1BackupPath = (homeDir: string) => join(backupsDir(homeDir), 'routing.v1.json');`
```ts
export const previousConfigPath = (homeDir: string) => join(backupsDir(homeDir), 'config.prev.json');
```
Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 3: Write `src/config/config-store.ts`
```ts
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { configIssues } from './config-schema';

export interface StoredConfig {
  config: unknown;
  hash: string;
  previousExists: boolean;
}

export type StoreOutcome = { ok: true; hash: string } | { ok: false; kind: 'stale' | 'invalid' | 'missing'; issues: string[] };

const STALE: StoreOutcome = { ok: false, kind: 'stale', issues: ['The config changed on disk since the page loaded. Reload the page.'] };

export const textHash = (text: string) => createHash('sha256').update(text).digest('hex');

function writeByRename(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, text);
  renameSync(temporaryPath, path);
}

export function readStoredConfig(configPath: string, previousPath: string): StoredConfig {
  const text = readFileSync(configPath, 'utf8');
  return { config: JSON.parse(text), hash: textHash(text), previousExists: existsSync(previousPath) };
}

export function saveConfig(configPath: string, previousPath: string, config: unknown, baseHash: string): StoreOutcome {
  const current = readFileSync(configPath, 'utf8');
  if (textHash(current) !== baseHash) return STALE;
  const issues = configIssues(config);
  if (issues.length > 0) return { ok: false, kind: 'invalid', issues };
  const text = `${JSON.stringify(config, null, 2)}\n`;
  writeByRename(previousPath, current);
  writeByRename(configPath, text);
  return { ok: true, hash: textHash(text) };
}

export function restorePrevious(configPath: string, previousPath: string, baseHash: string): StoreOutcome {
  if (!existsSync(previousPath)) return { ok: false, kind: 'missing', issues: ['There is no previous version to restore.'] };
  const current = readFileSync(configPath, 'utf8');
  if (textHash(current) !== baseHash) return STALE;
  const previous = readFileSync(previousPath, 'utf8');
  writeByRename(previousPath, current);
  writeByRename(configPath, previous);
  return { ok: true, hash: textHash(previous) };
}
```
Run: `npm run typecheck && npm test -- test/config-store.test.ts`
Expected: `tsc` prints nothing; all five tests pass, `0 failed`

Commit:
```bash
git add src/config/config-store.ts src/config/routemax-paths.ts test/config-store.test.ts
git commit -m "feat(config): save and restore the live config with a stale check" -m "Plan-task: 26"
```

### Task 27: Re-add the live config to the chezmoi source after a write

Depends on: Task 26
Risk: runs an external process (`chezmoi`) on a path from config

Files:
- Create: `src/config/sync-chezmoi.ts`
- Test: `test/sync-chezmoi.test.ts`

Step 1: Write the failing test with a fake `chezmoi`, `test/sync-chezmoi.test.ts`
```ts
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { syncChezmoi } from '../src/config/sync-chezmoi';

function fakeChezmoi(sourceName: string, sourcePathExit: number) {
  const dir = mkdtempSync(join(tmpdir(), 'routemax-chezmoi-'));
  const target = join(dir, 'config.json');
  const source = join(dir, sourceName);
  const log = join(dir, 'calls.log');
  writeFileSync(target, '{"version":2}\n');
  const bin = join(dir, 'chezmoi');
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      `echo "$@" >> '${log}'`,
      `if [ "$1" = source-path ]; then echo '${source}'; exit ${sourcePathExit}; fi`,
      `if [ "$1" = re-add ]; then cp "$2" '${source}'; fi`,
      '',
    ].join('\n'),
  );
  chmodSync(bin, 0o755);
  return { bin, target, source, log };
}

describe('syncChezmoi', () => {
  it('re-adds a managed file so the source matches the target', async () => {
    const { bin, target, source, log } = fakeChezmoi('dot_config.json', 0);
    await expect(syncChezmoi(target, bin)).resolves.toMatchObject({ state: 'synced' });
    expect(readFileSync(source, 'utf8')).toBe(readFileSync(target, 'utf8'));
    expect(readFileSync(log, 'utf8')).toBe(`source-path ${target}\nre-add ${target}\n`);
  });

  it('leaves a template alone and says what to do by hand', async () => {
    const { bin, target, log } = fakeChezmoi('dot_config.json.tmpl', 0);
    const sync = await syncChezmoi(target, bin);
    expect(sync.state).toBe('template');
    expect(sync.message).toContain('.tmpl');
    expect(readFileSync(log, 'utf8')).not.toContain('re-add');
  });

  it('reports an unmanaged file and a missing chezmoi without failing', async () => {
    const { bin, target } = fakeChezmoi('dot_config.json', 1);
    await expect(syncChezmoi(target, bin)).resolves.toMatchObject({ state: 'unmanaged' });
    await expect(syncChezmoi(target, join(tmpdir(), 'no-such-chezmoi-bin'))).resolves.toMatchObject({ state: 'no-chezmoi' });
  });
});
```
Run: `npm test -- test/sync-chezmoi.test.ts`
Expected: the file fails to load: `Failed to resolve import "../src/config/sync-chezmoi"`

Step 2: Write `src/config/sync-chezmoi.ts`
```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ChezmoiSync {
  state: 'synced' | 'no-chezmoi' | 'unmanaged' | 'template' | 'failed';
  message: string;
}

export async function syncChezmoi(targetPath: string, chezmoiBin = 'chezmoi'): Promise<ChezmoiSync> {
  let sourcePath: string;
  try {
    ({ stdout: sourcePath } = await execFileAsync(chezmoiBin, ['source-path', targetPath]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: 'no-chezmoi', message: 'chezmoi is not installed, so the chezmoi source was not updated.' };
    return { state: 'unmanaged', message: `chezmoi does not manage ${targetPath}. Add it once with: chezmoi add ${targetPath}` };
  }
  const source = sourcePath.trim();
  if (source.endsWith('.tmpl')) return { state: 'template', message: `The chezmoi source ${source} is a template, so it was not updated. Copy the change into it by hand.` };
  try {
    await execFileAsync(chezmoiBin, ['re-add', targetPath]);
    return { state: 'synced', message: `The chezmoi source ${source} matches the saved config.` };
  } catch {
    return { state: 'failed', message: `chezmoi re-add ${targetPath} failed. Run it by hand.` };
  }
}
```
Run: `npm run typecheck && npm test -- test/sync-chezmoi.test.ts`
Expected: `tsc` prints nothing; all three tests pass, `0 failed`

Commit:
```bash
git add src/config/sync-chezmoi.ts test/sync-chezmoi.test.ts
git commit -m "feat(config): re-add the live config to the chezmoi source" -m "Plan-task: 27"
```

### Task 28: Serve the guarded API and the static page on 127.0.0.1

Depends on: Task 27
Risk: trust boundary between the browser and the local server; the guard must run before any handler

Files:
- Create: `src/ui/ui-server.ts`
- Create: `test/helpers/ui-client.ts`
- Test: `test/ui-server.test.ts`

Step 1: Write the HTTP test client, `test/helpers/ui-client.ts` (`fetch` cannot set `Host`, so the tests use `node:http`)
```ts
import { request } from 'node:http';
import { TOKEN_HEADER } from '../../src/ui/request-guard';

export interface UiReply {
  status: number;
  text: string;
  json: () => unknown;
}

export function uiCall(port: number, method: string, path: string, headers: Record<string, string>, body?: unknown): Promise<UiReply> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const outgoing = request({ host: '127.0.0.1', port, method, path, headers }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
      incoming.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: incoming.statusCode ?? 0, text, json: () => JSON.parse(text) });
      });
    });
    outgoing.on('error', reject);
    outgoing.end(payload);
  });
}

export function pageHeaders(port: number, token: string, write = false): Record<string, string> {
  const headers: Record<string, string> = { host: `127.0.0.1:${port}`, [TOKEN_HEADER]: token };
  if (write) Object.assign(headers, { origin: `http://127.0.0.1:${port}`, 'content-type': 'application/json' });
  return headers;
}
```
Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 2: Write the failing test, `test/ui-server.test.ts`
```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';

let server: UiServer;

beforeAll(async () => {
  const dist = mkdtempSync(join(tmpdir(), 'routemax-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<main>routemax</main>');
  writeFileSync(join(dist, 'assets', 'app.js'), 'console.log(1);');
  server = await startUiServer(dist, [
    { method: 'GET', pattern: /^\/api\/ping$/, handle: async () => ({ status: 200, body: { pong: true } }) },
    { method: 'PUT', pattern: /^\/api\/echo\/([\w-]+)$/, handle: async ({ params, body }) => ({ status: 200, body: { id: params[0], body } }) },
  ]);
});

afterAll(() => server.close());

describe('startUiServer', () => {
  it('listens on 127.0.0.1 only and prints a page URL with the token in the fragment', () => {
    expect(server.address).toBe('127.0.0.1');
    expect(server.url).toBe(`http://127.0.0.1:${server.port}/#token=${server.token}`);
    expect(server.token.length).toBeGreaterThanOrEqual(43);
  });

  it('answers an API call that passes the guard', async () => {
    const reply = await uiCall(server.port, 'GET', '/api/ping', pageHeaders(server.port, server.token));
    expect(reply.status).toBe(200);
    expect(reply.json()).toEqual({ pong: true });
    const echo = await uiCall(server.port, 'PUT', '/api/echo/deepseek', pageHeaders(server.port, server.token, true), { a: 1 });
    expect(echo.json()).toEqual({ id: 'deepseek', body: { a: 1 } });
  });

  it('refuses without the token, with a foreign Host or a foreign Origin: 403 and an empty body', async () => {
    const own = pageHeaders(server.port, server.token, true);
    const replies = await Promise.all([
      uiCall(server.port, 'GET', '/api/ping', { host: `127.0.0.1:${server.port}` }),
      uiCall(server.port, 'GET', '/api/ping', { ...own, host: `evil.test:${server.port}` }),
      uiCall(server.port, 'PUT', '/api/echo/x', { ...own, origin: 'http://evil.test' }, {}),
    ]);
    for (const reply of replies) expect([reply.status, reply.text]).toEqual([403, '']);
  });

  it('answers 404 for an unknown API path and 422 for a body that is not JSON', async () => {
    const unknown = await uiCall(server.port, 'GET', '/api/nothing', pageHeaders(server.port, server.token));
    expect(unknown.status).toBe(404);
    const broken = await uiCall(server.port, 'PUT', '/api/echo/x', pageHeaders(server.port, server.token, true));
    expect(broken.status).toBe(422);
    expect(broken.json()).toEqual({ error: 'invalid', issues: ['The request body is not JSON.'] });
  });

  it('serves the page, an asset and the page again for an app path, and 404 for a missing asset', async () => {
    const host = { host: `localhost:${server.port}` };
    expect((await uiCall(server.port, 'GET', '/', host)).text).toBe('<main>routemax</main>');
    expect((await uiCall(server.port, 'GET', '/history', host)).text).toBe('<main>routemax</main>');
    expect((await uiCall(server.port, 'GET', '/assets/app.js', host)).text).toBe('console.log(1);');
    expect((await uiCall(server.port, 'GET', '/assets/missing.js', host)).status).toBe(404);
  });
});
```
Run: `npm test -- test/ui-server.test.ts`
Expected: the file fails to load: `Failed to resolve import "../src/ui/ui-server"`

Step 3: Write `src/ui/ui-server.ts`
```ts
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isAllowedRequest } from './request-guard';
import { contentTypeOf, resolveStaticPath } from './static-files';

export interface ApiRequest {
  params: string[];
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface ApiRoute {
  method: string;
  pattern: RegExp;
  handle: (request: ApiRequest) => Promise<ApiResponse>;
}

export interface UiServer {
  address: string;
  port: number;
  token: string;
  url: string;
  close: () => Promise<void>;
}

const MAX_BODY_BYTES = 1_000_000;
const NOT_JSON: ApiResponse = { status: 422, body: { error: 'invalid', issues: ['The request body is not JSON.'] } };

function send(response: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    response.writeHead(status, { 'content-length': '0' }).end();
    return;
  }
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function answerApi(request: IncomingMessage, pathname: string, routes: ApiRoute[]): Promise<ApiResponse> {
  for (const route of routes) {
    const match = route.method === request.method ? route.pattern.exec(pathname) : null;
    if (!match) continue;
    let body: unknown = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        body = JSON.parse(await readBody(request));
      } catch {
        return NOT_JSON;
      }
    }
    return route.handle({ params: match.slice(1), body });
  }
  return { status: 404, body: { error: 'missing', issues: [`No API route ${request.method} ${pathname}.`] } };
}

async function serveStatic(distDir: string, url: string, response: ServerResponse): Promise<void> {
  const filePath = resolveStaticPath(distDir, url);
  if (!filePath) return send(response, 404);
  try {
    const content = await readFile(filePath);
    response.writeHead(200, { 'content-type': contentTypeOf(filePath) }).end(content);
  } catch {
    send(response, 404);
  }
}

export async function startUiServer(distDir: string, routes: ApiRoute[], token = randomBytes(32).toString('base64url')): Promise<UiServer> {
  let port = 0;
  const server = createServer((request, response) => {
    const url = request.url ?? '/';
    if (!isAllowedRequest({ url, method: request.method ?? 'GET', headers: request.headers }, port, token)) return send(response, 403);
    if (!url.startsWith('/api/')) return void serveStatic(distDir, url, response);
    const pathname = url.split('?')[0];
    answerApi(request, pathname, routes).then(
      (reply) => send(response, reply.status, reply.body),
      (error: unknown) => {
        console.error(`routemax ui: ${request.method} ${pathname} failed (${(error as Error).name})`);
        send(response, 500, { error: 'failed', issues: ['The server could not finish the request. See the terminal running routemax ui.'] });
      },
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  port = address.port;
  return {
    address: address.address,
    port,
    token,
    url: `http://127.0.0.1:${port}/#token=${token}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
```
The 500 log line names only the error class, never its message, because a handler error may carry request data such as a key.
Run: `npm run typecheck && npm test -- test/ui-server.test.ts`
Expected: `tsc` prints nothing; all five tests pass, `0 failed`

Commit:
```bash
git add src/ui/ui-server.ts test/helpers/ui-client.ts test/ui-server.test.ts
git commit -m "feat(ui): serve the guarded API and the static page on 127.0.0.1" -m "Plan-task: 28"
```

### Task 29: Read and write the router switch over the API

Depends on: Task 28

Files:
- Create: `src/ui/api-routes.ts`
- Modify: `src/router-switch/router-switch.ts` (new `setRouterEnabled`, imports)
- Create: `test/helpers/ui-deps.ts`
- Test: `test/switch-api.test.ts`

Step 1: Write the failing test, `test/switch-api.test.ts`
```ts
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isRouterEnabled, routerSwitchPath } from '../src/router-switch/router-switch';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

let server: UiServer;
let homeDir = '';

beforeAll(async () => {
  homeDir = mkdtempSync(join(tmpdir(), 'routemax-switch-'));
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes(testUiDeps(homeDir)));
});

afterAll(() => server.close());

describe('switch API', () => {
  it('reads a missing switch file as on', async () => {
    const reply = await uiCall(server.port, 'GET', '/api/switch', pageHeaders(server.port, server.token));
    expect(reply.json()).toEqual({ enabled: true });
  });

  it('writes off and on to the switch file', async () => {
    const off = await uiCall(server.port, 'PUT', '/api/switch', pageHeaders(server.port, server.token, true), { enabled: false });
    expect(off.json()).toEqual({ enabled: false });
    expect(readFileSync(routerSwitchPath(homeDir), 'utf8').trim()).toBe('off');
    expect(isRouterEnabled(homeDir)).toBe(false);
    await uiCall(server.port, 'PUT', '/api/switch', pageHeaders(server.port, server.token, true), { enabled: true });
    expect(readFileSync(routerSwitchPath(homeDir), 'utf8').trim()).toBe('on');
  });

  it('refuses a body without a boolean enabled and leaves the file unchanged', async () => {
    const reply = await uiCall(server.port, 'PUT', '/api/switch', pageHeaders(server.port, server.token, true), { enabled: 'off' });
    expect(reply.status).toBe(422);
    expect((reply.json() as { issues: string[] }).issues[0]).toMatch(/^enabled: /);
    expect(readFileSync(routerSwitchPath(homeDir), 'utf8').trim()).toBe('on');
  });

  it('refuses a switch write from a foreign Origin with 403 and leaves the file unchanged', async () => {
    const headers = { ...pageHeaders(server.port, server.token, true), origin: 'http://evil.test' };
    const reply = await uiCall(server.port, 'PUT', '/api/switch', headers, { enabled: false });
    expect([reply.status, reply.text]).toEqual([403, '']);
    expect(isRouterEnabled(homeDir)).toBe(true);
  });
});
```
Write `test/helpers/ui-deps.ts`, the one place that builds `UiDeps` for API tests (later Phase 5 tasks add their fields here):
```ts
import type { UiDeps } from '../../src/ui/api-routes';

export const testUiDeps = (homeDir: string): UiDeps => ({ homeDir });
```
Run: `npm test -- test/switch-api.test.ts`
Expected: the file fails to load: `Failed to resolve import "../src/ui/api-routes"`

Step 2: Add the switch writer, `src/router-switch/router-switch.ts`

The imports (as Task 19 left them) become:
```ts
import { mkdirSync, readFileSync, watchFile, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { WATCH_INTERVAL_MS } from '../config/watch-config';
```
Add after `isRouterEnabled`:
```ts
export function setRouterEnabled(homeDir: string, enabled: boolean): void {
  const path = routerSwitchPath(homeDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, enabled ? 'on\n' : 'off\n');
}
```
Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 3: Write `src/ui/api-routes.ts`, the one place that lists every API route (later Phase 5 tasks add theirs here)
```ts
import { z } from 'zod';
import { formatIssues } from '../config/config-schema';
import { isRouterEnabled, setRouterEnabled } from '../router-switch/router-switch';
import type { ApiResponse, ApiRoute } from './ui-server';

export interface UiDeps {
  homeDir: string;
}

const switchBodySchema = z.object({ enabled: z.boolean() });

export const invalid = (issues: string[]): ApiResponse => ({ status: 422, body: { error: 'invalid', issues } });

export function apiRoutes(deps: UiDeps): ApiRoute[] {
  return [
    { method: 'GET', pattern: /^\/api\/switch$/, handle: async () => ({ status: 200, body: { enabled: isRouterEnabled(deps.homeDir) } }) },
    {
      method: 'PUT',
      pattern: /^\/api\/switch$/,
      handle: async ({ body }) => {
        const parsed = switchBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        setRouterEnabled(deps.homeDir, parsed.data.enabled);
        return { status: 200, body: { enabled: parsed.data.enabled } };
      },
    },
  ];
}
```
Run: `npm run typecheck && npm test -- test/switch-api.test.ts`
Expected: `tsc` prints nothing; all four tests pass, `0 failed`

Commit:
```bash
git add src/ui/api-routes.ts src/router-switch/router-switch.ts test/helpers/ui-deps.ts test/switch-api.test.ts
git commit -m "feat(ui): read and write the router switch over the API" -m "Plan-task: 29"
```

### Task 30: Read, save and restore the config over the API

Depends on: Task 26, Task 27, Task 29

Files:
- Modify: `src/ui/api-routes.ts` (config routes, `UiDeps.configPath`, `UiDeps.chezmoiBin`)
- Modify: `test/helpers/ui-deps.ts`
- Test: `test/config-api.test.ts`

Step 1: Write the failing test, `test/config-api.test.ts`
```ts
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { textHash } from '../src/config/config-store';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

let server: UiServer;
let configPath = '';
let chezmoiSource = '';

function fakeChezmoi(dir: string): string {
  chezmoiSource = join(dir, 'dot_config.json');
  const bin = join(dir, 'chezmoi');
  writeFileSync(
    bin,
    ['#!/bin/sh', `if [ "$1" = source-path ]; then echo '${chezmoiSource}'; fi`, `if [ "$1" = re-add ]; then cp "$2" '${chezmoiSource}'; fi`, ''].join('\n'),
  );
  chmodSync(bin, 0o755);
  return bin;
}

beforeAll(async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'routemax-config-api-'));
  const deps = { ...testUiDeps(homeDir), chezmoiBin: fakeChezmoi(homeDir) };
  configPath = deps.configPath;
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes(deps));
});

afterAll(() => server.close());

const call = (method: string, path: string, body?: unknown) =>
  uiCall(server.port, method, path, pageHeaders(server.port, server.token, method !== 'GET'), body);

async function loaded() {
  return (await call('GET', '/api/config')).json() as { config: Record<string, any>; hash: string; previousExists: boolean };
}

describe('config API', () => {
  it('returns the live config with the hash of its text', async () => {
    const { config, hash, previousExists } = await loaded();
    expect(hash).toBe(textHash(readFileSync(configPath, 'utf8')));
    expect(config).toEqual(JSON.parse(readFileSync(configPath, 'utf8')));
    expect(previousExists).toBe(false);
  });

  it('refuses a restore without a previous version with 404', async () => {
    const reply = await call('POST', '/api/config/restore', { baseHash: (await loaded()).hash });
    expect(reply.status).toBe(404);
    expect(reply.json()).toMatchObject({ error: 'missing' });
  });

  it('refuses a missing model price with the field named and leaves the file unchanged', async () => {
    const before = readFileSync(configPath, 'utf8');
    const { config, hash } = await loaded();
    delete config.providers.deepseek.models['deepseek-flash'].outputUsd;
    const reply = await call('PUT', '/api/config', { config, baseHash: hash });
    expect(reply.status).toBe(422);
    expect(reply.json()).toMatchObject({ error: 'invalid' });
    expect((reply.json() as { issues: string[] }).issues).toContainEqual(expect.stringMatching(/^providers\.deepseek\.models\.deepseek-flash\.outputUsd: /));
    expect(readFileSync(configPath, 'utf8')).toBe(before);
  });

  it('refuses a save on a stale hash with 409 and leaves the file unchanged', async () => {
    const before = readFileSync(configPath, 'utf8');
    const { config } = await loaded();
    const reply = await call('PUT', '/api/config', { config, baseHash: textHash('an older text') });
    expect(reply.status).toBe(409);
    expect(reply.json()).toMatchObject({ error: 'stale' });
    expect(readFileSync(configPath, 'utf8')).toBe(before);
  });

  it('refuses a save body without baseHash', async () => {
    const reply = await call('PUT', '/api/config', { config: {} });
    expect(reply.status).toBe(422);
    expect((reply.json() as { issues: string[] }).issues[0]).toMatch(/^baseHash: /);
  });

  it('saves, restores and undoes the restore, with the chezmoi source matching after each', async () => {
    const original = readFileSync(configPath, 'utf8');
    const { config, hash } = await loaded();
    config.budget.totalUsd = 42;
    const saved = await call('PUT', '/api/config', { config, baseHash: hash });
    expect(saved.status).toBe(200);
    expect(saved.json()).toMatchObject({ hash: textHash(readFileSync(configPath, 'utf8')), chezmoi: { state: 'synced' } });
    expect(JSON.parse(readFileSync(configPath, 'utf8')).budget.totalUsd).toBe(42);
    expect(readFileSync(chezmoiSource, 'utf8')).toBe(readFileSync(configPath, 'utf8'));
    expect((await loaded()).previousExists).toBe(true);

    const restored = await call('POST', '/api/config/restore', { baseHash: (saved.json() as { hash: string }).hash });
    expect(restored.status).toBe(200);
    expect(readFileSync(configPath, 'utf8')).toBe(original);
    expect(readFileSync(chezmoiSource, 'utf8')).toBe(original);

    const undone = await call('POST', '/api/config/restore', { baseHash: textHash(original) });
    expect(undone.status).toBe(200);
    expect(JSON.parse(readFileSync(configPath, 'utf8')).budget.totalUsd).toBe(42);
    expect(readFileSync(chezmoiSource, 'utf8')).toBe(readFileSync(configPath, 'utf8'));
  });
});
```
Run: `npm test -- test/config-api.test.ts`
Expected: every test fails: `/api/config` answers `404`, and `configPath` is `undefined` because `testUiDeps` does not set it yet, so `readFileSync` throws `TypeError [ERR_INVALID_ARG_TYPE]`

Step 2: Write the seed config in the test deps, `test/helpers/ui-deps.ts` (whole file)
```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG_PATH } from '../../src/config/delegate-config';
import { migrateConfig } from '../../src/config/migrate-config';
import type { UiDeps } from '../../src/ui/api-routes';

export function testUiDeps(homeDir: string): UiDeps {
  const configPath = join(homeDir, 'config.json');
  if (!existsSync(configPath)) {
    const seed = migrateConfig(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8')));
    writeFileSync(configPath, `${JSON.stringify(seed, null, 2)}\n`);
  }
  return { homeDir, configPath, chezmoiBin: join(homeDir, 'no-chezmoi') };
}
```
The default `chezmoiBin` names a file that does not exist, so a save in a test that keeps it gets `chezmoi.state: 'no-chezmoi'` and never touches the user's chezmoi source.

Run: `npm test -- test/switch-api.test.ts`
Expected: the four switch tests still pass, `0 failed` (vitest does not type-check; `tsc` reports the missing `UiDeps` fields until Step 3)

Step 3: Add the config routes, `src/ui/api-routes.ts` (whole file)
```ts
import { z } from 'zod';
import { formatIssues } from '../config/config-schema';
import { readStoredConfig, restorePrevious, saveConfig, type StoreOutcome } from '../config/config-store';
import { previousConfigPath } from '../config/routemax-paths';
import { syncChezmoi } from '../config/sync-chezmoi';
import { isRouterEnabled, setRouterEnabled } from '../router-switch/router-switch';
import type { ApiResponse, ApiRoute } from './ui-server';

export interface UiDeps {
  homeDir: string;
  configPath: string;
  chezmoiBin: string;
}

const switchBodySchema = z.object({ enabled: z.boolean() });
const saveBodySchema = z.object({ config: z.unknown(), baseHash: z.string() });
const restoreBodySchema = z.object({ baseHash: z.string() });
const STORE_ERROR_STATUS = { stale: 409, invalid: 422, missing: 404 } as const;

export const invalid = (issues: string[]): ApiResponse => ({ status: 422, body: { error: 'invalid', issues } });
const ok = (body: unknown): ApiResponse => ({ status: 200, body });

async function storeReply(deps: UiDeps, outcome: StoreOutcome): Promise<ApiResponse> {
  if (!outcome.ok) return { status: STORE_ERROR_STATUS[outcome.kind], body: { error: outcome.kind, issues: outcome.issues } };
  return ok({ hash: outcome.hash, chezmoi: await syncChezmoi(deps.configPath, deps.chezmoiBin) });
}

function switchRoutes(deps: UiDeps): ApiRoute[] {
  return [
    { method: 'GET', pattern: /^\/api\/switch$/, handle: async () => ok({ enabled: isRouterEnabled(deps.homeDir) }) },
    {
      method: 'PUT',
      pattern: /^\/api\/switch$/,
      handle: async ({ body }) => {
        const parsed = switchBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        setRouterEnabled(deps.homeDir, parsed.data.enabled);
        return ok({ enabled: parsed.data.enabled });
      },
    },
  ];
}

function configRoutes(deps: UiDeps): ApiRoute[] {
  const previousPath = previousConfigPath(deps.homeDir);
  return [
    { method: 'GET', pattern: /^\/api\/config$/, handle: async () => ok(readStoredConfig(deps.configPath, previousPath)) },
    {
      method: 'PUT',
      pattern: /^\/api\/config$/,
      handle: async ({ body }) => {
        const parsed = saveBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        return storeReply(deps, saveConfig(deps.configPath, previousPath, parsed.data.config, parsed.data.baseHash));
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/config\/restore$/,
      handle: async ({ body }) => {
        const parsed = restoreBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        return storeReply(deps, restorePrevious(deps.configPath, previousPath, parsed.data.baseHash));
      },
    },
  ];
}

export function apiRoutes(deps: UiDeps): ApiRoute[] {
  return [...switchRoutes(deps), ...configRoutes(deps)];
}
```
Run: `npm run typecheck && npm test -- test/config-api.test.ts test/switch-api.test.ts`
Expected: `tsc` prints nothing; both files pass (six config tests, four switch tests), `0 failed`

Commit:
```bash
git add src/ui/api-routes.ts test/helpers/ui-deps.ts test/config-api.test.ts
git commit -m "feat(ui): read, save and restore the config over the API" -m "Plan-task: 30"
```

### Task 31: Serve the decision history and the spend stats

Depends on: Task 30

Files:
- Create: `src/ui/decision-stats.ts`
- Modify: `src/ui/api-routes.ts` (history and stats routes, imports)
- Test: `test/decision-stats.test.ts`
- Test: `test/stats-api.test.ts`

Step 1: Write the failing unit test, `test/decision-stats.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import type { DecisionRecord } from '../src/decision-log/decision-log';
import { decisionStats } from '../src/ui/decision-stats';

// Wednesday 23 September 2026, noon local time; that week starts on Monday 21 September.
const NOW = new Date(2026, 8, 23, 12);
const at = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString();

const record = (overrides: Partial<DecisionRecord>): DecisionRecord => ({
  ts: at(23, 9),
  cwd: '/tmp/project',
  taskType: 'search',
  requestedTier: 'flash-low',
  finalTier: 'flash-low',
  raisedBy: null,
  provider: 'deepseek',
  model: 'deepseek-flash',
  effort: 'low',
  costUsd: 0.02,
  status: 'done',
  reason: null,
  durationMs: 1000,
  retries: 0,
  inputTokens: 10,
  outputTokens: 10,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  ...overrides,
});

describe('decisionStats', () => {
  it('counts today and the week from Monday, with tier, model and escalation tallies', () => {
    const records = [
      record({}),
      record({ ts: at(23, 10), finalTier: 'pro-high', model: 'deepseek-v4-pro', costUsd: 0.1, status: 'escalate', reason: 'exit-code' }),
      record({ ts: at(21, 8), costUsd: 0.03 }),
      record({ ts: at(20, 23), costUsd: 0.5 }),
    ];
    const stats = decisionStats(records, 10, NOW);
    expect(stats.today.calls).toBe(2);
    expect(stats.today.costUsd).toBeCloseTo(0.12, 10);
    expect(stats.today.byTier).toEqual({ 'flash-low': { calls: 1, costUsd: 0.02 }, 'pro-high': { calls: 1, costUsd: 0.1 } });
    expect(stats.today.byModel).toEqual({ 'deepseek-flash': { calls: 1, costUsd: 0.02 }, 'deepseek-v4-pro': { calls: 1, costUsd: 0.1 } });
    expect(stats.today.escalations).toEqual({ 'exit-code': 1 });
    expect(stats.week.calls).toBe(3);
    expect(stats.budget).toEqual({ totalUsd: 10, spentUsd: expect.closeTo(0.65, 10), leftUsd: expect.closeTo(9.35, 10) });
  });

  it('adds spend per provider up to the total spend and counts a disabled call with cost 0', () => {
    const records = [
      record({ costUsd: 0.2 }),
      record({ provider: 'openrouter', model: 'openai/gpt-5', costUsd: 0.3 }),
      record({ provider: null, finalTier: 'claude', model: null, effort: null, costUsd: 0, status: 'disabled' }),
    ];
    const stats = decisionStats(records, 10, NOW);
    expect(stats.spendByProvider).toEqual({ deepseek: 0.2, openrouter: 0.3 });
    const byProvider = Object.values(stats.spendByProvider).reduce((sum, cost) => sum + cost, 0);
    expect(byProvider).toBeCloseTo(stats.budget.spentUsd, 10);
    expect(stats.today.calls).toBe(3);
    expect(stats.today.byTier.claude).toEqual({ calls: 1, costUsd: 0 });
  });

  it('never reports a negative budget left', () => {
    expect(decisionStats([record({ costUsd: 12 })], 10, NOW).budget.leftUsd).toBe(0);
  });
});
```
Run: `npm test -- test/decision-stats.test.ts`
Expected: the file fails to load: `Failed to resolve import "../src/ui/decision-stats"`

Step 2: Write `src/ui/decision-stats.ts`
```ts
import { readFile } from 'node:fs/promises';
import type { DecisionRecord } from '../decision-log/decision-log';

export interface Tally {
  calls: number;
  costUsd: number;
}

export interface PeriodStats extends Tally {
  byTier: Record<string, Tally>;
  byModel: Record<string, Tally>;
  escalations: Record<string, number>;
}

export interface DecisionStats {
  budget: { totalUsd: number; spentUsd: number; leftUsd: number };
  spendByProvider: Record<string, number>;
  today: PeriodStats;
  week: PeriodStats;
}

// Lines written before providers existed carry no provider field; they all ran on DeepSeek.
const LEGACY_PROVIDER = 'deepseek';

export async function readDecisions(logPath: string): Promise<DecisionRecord[]> {
  let text: string;
  try {
    text = await readFile(logPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const record = JSON.parse(line) as DecisionRecord;
      return 'provider' in record ? record : { ...record, provider: LEGACY_PROVIDER };
    });
}

function addTally(tallies: Record<string, Tally>, key: string, costUsd: number): void {
  const tally = (tallies[key] ??= { calls: 0, costUsd: 0 });
  tally.calls += 1;
  tally.costUsd += costUsd;
}

function periodStats(records: DecisionRecord[]): PeriodStats {
  const stats: PeriodStats = { calls: 0, costUsd: 0, byTier: {}, byModel: {}, escalations: {} };
  for (const record of records) {
    stats.calls += 1;
    stats.costUsd += record.costUsd;
    addTally(stats.byTier, record.finalTier, record.costUsd);
    if (record.model) addTally(stats.byModel, record.model, record.costUsd);
    if (record.reason) stats.escalations[record.reason] = (stats.escalations[record.reason] ?? 0) + 1;
  }
  return stats;
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfWeek(date: Date): Date {
  const monday = startOfDay(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

// A record without a provider (a disabled call, a budget refusal) cost 0, so leaving it out keeps
// the per-provider spend equal to the total spend.
export function decisionStats(records: DecisionRecord[], totalUsd: number, now: Date): DecisionStats {
  const spendByProvider: Record<string, number> = {};
  for (const record of records) {
    if (record.provider !== null) spendByProvider[record.provider] = (spendByProvider[record.provider] ?? 0) + record.costUsd;
  }
  const spentUsd = records.reduce((sum, record) => sum + record.costUsd, 0);
  const since = (start: Date) => records.filter((record) => new Date(record.ts) >= start);
  return {
    budget: { totalUsd, spentUsd, leftUsd: Math.max(0, totalUsd - spentUsd) },
    spendByProvider,
    today: periodStats(since(startOfDay(now))),
    week: periodStats(since(startOfWeek(now))),
  };
}
```
Run: `npm run typecheck && npm test -- test/decision-stats.test.ts`
Expected: `tsc` prints nothing; all three tests pass, `0 failed`

Step 3: Write the failing API test, `test/stats-api.test.ts`
```ts
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

let server: UiServer;
let configPath = '';

const line = (fields: Record<string, unknown>) =>
  JSON.stringify({
    ts: new Date().toISOString(),
    cwd: '/tmp/project',
    taskType: 'search',
    requestedTier: 'flash-low',
    finalTier: 'flash-low',
    raisedBy: null,
    model: 'deepseek-flash',
    effort: 'low',
    costUsd: 0.01,
    status: 'done',
    reason: null,
    durationMs: 1000,
    retries: 0,
    inputTokens: 10,
    outputTokens: 10,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    ...fields,
  });

beforeAll(async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'routemax-stats-api-'));
  const deps = testUiDeps(homeDir);
  configPath = deps.configPath;
  const logPath = decisionLogPath(homeDir);
  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(
    logPath,
    [
      line({ costUsd: 0.25 }),
      line({ provider: 'openrouter', model: 'openai/gpt-5', costUsd: 0.5 }),
      line({ provider: null, finalTier: 'claude', model: null, effort: null, costUsd: 0, status: 'disabled' }),
      '',
    ].join('\n'),
  );
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes(deps));
});

afterAll(() => server.close());

const get = (path: string) => uiCall(server.port, 'GET', path, pageHeaders(server.port, server.token));

describe('history and stats API', () => {
  it('returns every log line, a line without provider as deepseek and a disabled call with cost 0', async () => {
    const { records } = (await get('/api/history')).json() as { records: Array<Record<string, unknown>> };
    expect(records.map((record) => [record.provider, record.status, record.costUsd])).toEqual([
      ['deepseek', 'done', 0.25],
      ['openrouter', 'done', 0.5],
      [null, 'disabled', 0],
    ]);
  });

  it('adds spend per provider up to the total spend, against the budget of the live config', async () => {
    const stats = (await get('/api/stats')).json() as { budget: { totalUsd: number; spentUsd: number }; spendByProvider: Record<string, number>; today: { calls: number } };
    expect(stats.spendByProvider).toEqual({ deepseek: 0.25, openrouter: 0.5 });
    expect(stats.budget.spentUsd).toBe(0.75);
    expect(stats.budget.totalUsd).toBe(JSON.parse(readFileSync(configPath, 'utf8')).budget.totalUsd);
  });
});
```
Run: `npm test -- test/stats-api.test.ts`
Expected: both tests fail: the server answers `404` for `/api/history` and `/api/stats`, so `records` and `spendByProvider` are `undefined`

Step 4: Add the history and stats routes, `src/ui/api-routes.ts`

The imports become:
```ts
import { z } from 'zod';
import { formatIssues } from '../config/config-schema';
import { readStoredConfig, restorePrevious, saveConfig, type StoreOutcome } from '../config/config-store';
import { loadConfig } from '../config/delegate-config';
import { previousConfigPath } from '../config/routemax-paths';
import { syncChezmoi } from '../config/sync-chezmoi';
import { decisionLogPath } from '../decision-log/decision-log';
import { isRouterEnabled, setRouterEnabled } from '../router-switch/router-switch';
import { decisionStats, readDecisions } from './decision-stats';
import type { ApiResponse, ApiRoute } from './ui-server';
```
Add before `export function apiRoutes`:
```ts
function decisionRoutes(deps: UiDeps): ApiRoute[] {
  const logPath = decisionLogPath(deps.homeDir);
  return [
    { method: 'GET', pattern: /^\/api\/history$/, handle: async () => ok({ records: await readDecisions(logPath) }) },
    {
      method: 'GET',
      pattern: /^\/api\/stats$/,
      handle: async () => ok(decisionStats(await readDecisions(logPath), loadConfig(deps.configPath).budget.totalUsd, new Date())),
    },
  ];
}
```
In `apiRoutes`, the return line becomes:
```ts
  return [...switchRoutes(deps), ...configRoutes(deps), ...decisionRoutes(deps)];
```
Run: `npm run typecheck && npm test -- test/decision-stats.test.ts test/stats-api.test.ts test/config-api.test.ts`
Expected: `tsc` prints nothing; the three files pass, `0 failed`

Commit:
```bash
git add src/ui/decision-stats.ts src/ui/api-routes.ts test/decision-stats.test.ts test/stats-api.test.ts
git commit -m "feat(ui): serve the decision history and spend per provider" -m "Plan-task: 31"
```

### Task 32: Build the doctor deps in one place

Depends on: Task 22, Task 23

Files:
- Create: `src/doctor/doctor-deps.ts`
- Modify: `src/doctor/run-doctor.ts` (whole file)
- Test: `test/doctor-deps.test.ts`

Step 1: Write the failing test, `test/doctor-deps.test.ts`
```ts
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { commandOnPath } from '../src/doctor/command-on-path';
import { doctorDeps } from '../src/doctor/doctor-deps';
import { ensureProxy } from '../src/proxy/ensure-proxy';
import { serverRegistration } from '../src/setup/register-server';
import { readApiKey } from '../src/worker/read-api-key';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

describe('doctorDeps', () => {
  it('builds the deps npm run doctor uses, with the registration from the config claudeBin', () => {
    const config = loadConfig(DEFAULT_CONFIG_PATH);
    expect(doctorDeps(ROOT, config, '/tmp/routemax-home')).toEqual({
      homeDir: '/tmp/routemax-home',
      repoRoot: ROOT,
      config,
      registration: serverRegistration(ROOT, config.claudeBin),
      readApiKey,
      ensureProxy,
      commandOnPath,
    });
  });
});
```
Run: `npm test -- test/doctor-deps.test.ts`
Expected: the file fails to load: `Failed to resolve import "../src/doctor/doctor-deps"`

Step 2: Write `src/doctor/doctor-deps.ts`
```ts
import { homedir } from 'node:os';
import type { DelegateConfig } from '../config/config-schema';
import { ensureProxy } from '../proxy/ensure-proxy';
import { serverRegistration } from '../setup/register-server';
import { readApiKey } from '../worker/read-api-key';
import { commandOnPath } from './command-on-path';
import type { DoctorDeps } from './doctor-checks';

export function doctorDeps(repoRoot: string, config: DelegateConfig, homeDir = homedir()): DoctorDeps {
  return { homeDir, repoRoot, config, registration: serverRegistration(repoRoot, config.claudeBin), readApiKey, ensureProxy, commandOnPath };
}
```
Run: `npm run typecheck && npm test -- test/doctor-deps.test.ts`
Expected: `tsc` prints nothing; the test passes, `0 failed`

Step 3: Build the deps through `doctorDeps`, `src/doctor/run-doctor.ts` (whole file; the output lines stay as they are)
```ts
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/delegate-config';
import { runDoctorChecks } from './doctor-checks';
import { doctorDeps } from './doctor-deps';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const checks = await runDoctorChecks(doctorDeps(repoRoot, loadConfig()));

for (const check of checks) console.log(`${check.ok ? 'OK ' : 'FIX'}  ${check.name}: ${check.message}`);
const failed = checks.filter((check) => !check.ok).length;
console.log(failed ? `${failed} to fix.` : 'All good: delegate is ready. Restart Claude Code if it was open during setup.');
process.exitCode = failed ? 1 : 0;
```
Run: `npm run typecheck && npm test -- test/doctor-deps.test.ts test/doctor.test.ts && npm run doctor`
Expected: `tsc` prints nothing; both test files pass, `0 failed`; `npm run doctor` prints the same line names in the same order as before the change: router, routemax command, env.vars, DeepSeek key, DeepSeek repair-proxy, MCP server, Claude agents, budget, Max settings (`routemax command` stays `FIX` until Phase 8 runs `npm link`)

Commit:
```bash
git add src/doctor/doctor-deps.ts src/doctor/run-doctor.ts test/doctor-deps.test.ts
git commit -m "refactor(doctor): build the doctor deps in one place" -m "Plan-task: 32"
```

### Task 33: Run the doctor over the API

Depends on: Task 31, Task 32

Files:
- Modify: `src/ui/api-routes.ts` (doctor route, `UiDeps.doctorDeps`, imports)
- Modify: `test/helpers/ui-deps.ts` (return line)
- Test: `test/doctor-api.test.ts`

Step 1: Write the failing test, `test/doctor-api.test.ts`
```ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { runDoctorChecks, type DoctorDeps } from '../src/doctor/doctor-checks';
import { setRouterEnabled } from '../src/router-switch/router-switch';
import { serverRegistration } from '../src/setup/register-server';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

let server: UiServer;
let doctor: DoctorDeps;

beforeAll(async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'routemax-doctor-api-'));
  doctor = {
    homeDir,
    repoRoot: ROOT,
    config: loadConfig(DEFAULT_CONFIG_PATH),
    registration: serverRegistration(ROOT, join(homeDir, 'bin', 'claude')),
    readApiKey: async () => 'sk-doctor-api-DO-NOT-PRINT',
    ensureProxy: async () => 'running',
    commandOnPath: async () => true,
  };
  setRouterEnabled(homeDir, false);
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes({ ...testUiDeps(homeDir), doctorDeps: () => doctor }));
});

afterAll(() => server.close());

describe('doctor API', () => {
  it('returns the same checks as npm run doctor, with the router off as OK', async () => {
    const reply = await uiCall(server.port, 'GET', '/api/doctor', pageHeaders(server.port, server.token));
    const { checks } = reply.json() as { checks: Array<{ name: string; ok: boolean; message: string }> };
    expect(checks).toEqual(await runDoctorChecks(doctor));
    expect(checks.find((check) => check.name === 'router')).toMatchObject({ ok: true, message: expect.stringMatching(/^The router is off/) });
    expect(reply.text).not.toContain('sk-doctor-api-DO-NOT-PRINT');
  });
});
```
Run: `npm test -- test/doctor-api.test.ts`
Expected: the test fails: `/api/doctor` answers `404`, so `checks` is `undefined` and `toEqual` fails

Step 2: Add the doctor route, `src/ui/api-routes.ts`

Add after the line `import { decisionLogPath } from '../decision-log/decision-log';`:
```ts
import { runDoctorChecks, type DoctorDeps } from '../doctor/doctor-checks';
```
`UiDeps` becomes:
```ts
export interface UiDeps {
  homeDir: string;
  configPath: string;
  chezmoiBin: string;
  doctorDeps: () => DoctorDeps;
}
```
`doctorDeps` is a factory so that each request reads the live config; `routemax ui` passes `() => doctorDeps(repoRoot, loadConfig(configPath))` from `src/doctor/doctor-deps.ts`.

Add before `export function apiRoutes`:
```ts
function doctorRoutes(deps: UiDeps): ApiRoute[] {
  return [{ method: 'GET', pattern: /^\/api\/doctor$/, handle: async () => ok({ checks: await runDoctorChecks(deps.doctorDeps()) }) }];
}
```
In `apiRoutes`, the return line becomes:
```ts
  return [...switchRoutes(deps), ...configRoutes(deps), ...decisionRoutes(deps), ...doctorRoutes(deps)];
```
Run: `npm test -- test/doctor-api.test.ts`
Expected: the test passes, `0 failed` (`tsc` reports the missing `doctorDeps` in `test/helpers/ui-deps.ts` until Step 3)

Step 3: Give the other API tests a doctor factory that fails loudly, `test/helpers/ui-deps.ts`, the `return` line becomes:
```ts
  return {
    homeDir,
    configPath,
    chezmoiBin: join(homeDir, 'no-chezmoi'),
    doctorDeps: () => {
      throw new Error('This test gives no doctor deps; pass doctorDeps to apiRoutes.');
    },
  };
```
Run: `npm run typecheck && npm test -- test/doctor-api.test.ts test/switch-api.test.ts test/config-api.test.ts test/stats-api.test.ts`
Expected: `tsc` prints nothing; the four files pass, `0 failed`

Commit:
```bash
git add src/ui/api-routes.ts test/helpers/ui-deps.ts test/doctor-api.test.ts
git commit -m "feat(ui): run the doctor over the API" -m "Plan-task: 33"
```

### Task 34: Store a provider key over the API without echoing it

Depends on: Task 33
Risk: a secret crosses the HTTP boundary into the Keychain

Files:
- Create: `src/worker/store-api-key.ts`
- Modify: `src/ui/api-routes.ts` (keys routes, `missing`, imports)
- Test: `test/keys-api.test.ts`

Step 1: Write the failing test, `test/keys-api.test.ts`
```ts
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall, type UiReply } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

const FAKE_KEY = 'sk-keys-api-DO-NOT-LEAK';

let server: UiServer;
let homeDir = '';
const replies: UiReply[] = [];
const consoleLines: string[] = [];

function fakeSecurity(home: string): string {
  const bin = join(home, 'bin');
  const keychain = join(home, 'keychain');
  mkdirSync(bin, { recursive: true });
  mkdirSync(keychain, { recursive: true });
  const script = [
    '#!/bin/sh',
    `printf '%s\\n' "$*" >> "${join(home, 'security-argv.log')}"`,
    'if [ "$1" = -i ]; then',
    '  read -r line',
    `  service=$(printf '%s' "$line" | sed -E 's/.* -s "([^"]*)".*/\\1/')`,
    `  key=$(printf '%s' "$line" | sed -E 's/.* -w "([^"]*)".*/\\1/')`,
    `  printf '%s\\n' "$key" > "${keychain}/$service"`,
    '  exit 0',
    'fi',
    `[ "$1" = find-generic-password ] && [ -f "${keychain}/$5" ] || exit 44`,
    `cat "${keychain}/$5"`,
    '',
  ];
  writeFileSync(join(bin, 'security'), script.join('\n'), { mode: 0o755 });
  return bin;
}

async function call(method: string, path: string, body?: unknown): Promise<UiReply> {
  const reply = await uiCall(server.port, method, path, pageHeaders(server.port, server.token, method !== 'GET'), body);
  replies.push(reply);
  return reply;
}

beforeAll(async () => {
  homeDir = mkdtempSync(join(tmpdir(), 'routemax-keys-api-'));
  vi.stubEnv('PATH', `${fakeSecurity(homeDir)}:${process.env.PATH}`);
  for (const method of ['log', 'warn', 'error'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      consoleLines.push(args.map(String).join(' '));
    });
  }
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes(testUiDeps(homeDir)));
});

afterAll(async () => {
  await server.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('keys API', () => {
  it('reports a provider without a key as not present', async () => {
    expect((await call('GET', '/api/keys')).json()).toMatchObject({ keys: { deepseek: { present: false } } });
  });

  it('stores a key through security -i on stdin and reports it present', async () => {
    const reply = await call('PUT', '/api/keys/deepseek', { key: FAKE_KEY });
    expect(reply.status).toBe(200);
    expect(reply.json()).toEqual({ present: true });
    expect((await call('GET', '/api/keys')).json()).toMatchObject({ keys: { deepseek: { present: true } } });
    expect(readFileSync(join(homeDir, 'security-argv.log'), 'utf8')).not.toContain(FAKE_KEY);
  });

  it('refuses a key with a quote without repeating it', async () => {
    const reply = await call('PUT', '/api/keys/deepseek', { key: `${FAKE_KEY}" -U` });
    expect(reply.status).toBe(422);
    expect(reply.json()).toEqual({ error: 'invalid', issues: ['key: The key is empty or holds a quote, a backslash or a control character.'] });
  });

  it('answers 404 for an unknown provider', async () => {
    expect((await call('PUT', '/api/keys/__proto__', { key: FAKE_KEY })).status).toBe(404);
  });

  it('never returns or logs the key', async () => {
    await call('GET', '/api/config');
    for (const reply of replies) expect(reply.text).not.toContain(FAKE_KEY);
    expect(consoleLines.join('\n')).not.toContain(FAKE_KEY);
  });
});
```
Run: `npm test -- test/keys-api.test.ts`
Expected: the file fails: `/api/keys` answers `404`, so `json()` has no `keys` and the first three tests fail

Step 2: Write `src/worker/store-api-key.ts`

`security -i` reads the command from stdin, so the key never appears in a process argument list; a quote, backslash or control character would break out of the quoted argument, so it is refused before anything runs.
```ts
import { spawn } from 'node:child_process';
import { userInfo } from 'node:os';

const UNSAFE_CHARACTER = /["\\\p{Cc}]/u;

export function keyIssues(key: string): string[] {
  if (key.length === 0 || UNSAFE_CHARACTER.test(key)) return ['key: The key is empty or holds a quote, a backslash or a control character.'];
  return [];
}

export async function storeApiKey(keychainService: string, key: string): Promise<void> {
  const account = userInfo().username;
  if (keyIssues(key).length > 0) throw new Error('The key is empty or holds a quote, a backslash or a control character.');
  if (UNSAFE_CHARACTER.test(keychainService) || UNSAFE_CHARACTER.test(account)) {
    throw new Error(`The Keychain service ${JSON.stringify(keychainService)} or the account name holds a quote, a backslash or a control character.`);
  }
  const command = `add-generic-password -U -a "${account}" -s "${keychainService}" -w "${key}"\n`;
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const child = spawn('security', ['-i'], { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', reject);
    child.on('close', resolve);
    child.stdin.on('error', reject);
    child.stdin.end(command);
  });
  if (exitCode !== 0) throw new Error(`security could not store the key for Keychain service ${keychainService} (exit code ${exitCode}).`);
}
```
Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 3: Add the keys routes, `src/ui/api-routes.ts`

The imports become:
```ts
import { z } from 'zod';
import { formatIssues } from '../config/config-schema';
import { readStoredConfig, restorePrevious, saveConfig, type StoreOutcome } from '../config/config-store';
import { loadConfig } from '../config/delegate-config';
import { previousConfigPath } from '../config/routemax-paths';
import { syncChezmoi } from '../config/sync-chezmoi';
import { decisionLogPath } from '../decision-log/decision-log';
import { runDoctorChecks, type DoctorDeps } from '../doctor/doctor-checks';
import { isRouterEnabled, setRouterEnabled } from '../router-switch/router-switch';
import { readApiKey } from '../worker/read-api-key';
import { keyIssues, storeApiKey } from '../worker/store-api-key';
import { decisionStats, readDecisions } from './decision-stats';
import type { ApiResponse, ApiRoute } from './ui-server';
```
Add after the line `const restoreBodySchema = z.object({ baseHash: z.string() });`:
```ts
const keyBodySchema = z.object({ key: z.string() });
```
Add after the line `const ok = (body: unknown): ApiResponse => ({ status: 200, body });`:
```ts
const missing = (issues: string[]): ApiResponse => ({ status: 404, body: { error: 'missing', issues } });
const hasKey = (keychainService: string): Promise<boolean> => readApiKey(keychainService).then(() => true, () => false);
```
Add before `export function apiRoutes` (`Object.hasOwn` keeps `__proto__` and other inherited names from counting as a provider):
```ts
function keyRoutes(deps: UiDeps): ApiRoute[] {
  return [
    {
      method: 'GET',
      pattern: /^\/api\/keys$/,
      handle: async () => {
        const { providers } = loadConfig(deps.configPath);
        const keys = await Promise.all(Object.entries(providers).map(async ([id, provider]) => [id, { present: await hasKey(provider.keychainService) }] as const));
        return ok({ keys: Object.fromEntries(keys) });
      },
    },
    {
      method: 'PUT',
      pattern: /^\/api\/keys\/([^/]+)$/,
      handle: async ({ params: [providerId], body }) => {
        const { providers } = loadConfig(deps.configPath);
        if (!Object.hasOwn(providers, providerId)) return missing([`providers.${providerId}: no such provider`]);
        const parsed = keyBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        const issues = keyIssues(parsed.data.key);
        if (issues.length > 0) return invalid(issues);
        await storeApiKey(providers[providerId].keychainService, parsed.data.key);
        return ok({ present: await hasKey(providers[providerId].keychainService) });
      },
    },
  ];
}
```
In `apiRoutes`, the return line becomes:
```ts
  return [...switchRoutes(deps), ...configRoutes(deps), ...decisionRoutes(deps), ...doctorRoutes(deps), ...keyRoutes(deps)];
```
Run: `npm run typecheck && npm test -- test/keys-api.test.ts test/config-api.test.ts`
Expected: `tsc` prints nothing; both files pass, `0 failed`

Commit:
```bash
git add src/worker/store-api-key.ts src/ui/api-routes.ts test/keys-api.test.ts
git commit -m "feat(ui): store a provider key over the API without echoing it" -m "Plan-task: 34"
```

### Task 35: Preview a route over the API with the real router

Depends on: Task 34

Files:
- Modify: `src/ui/api-routes.ts` (route preview, imports)
- Test: `test/route-preview-api.test.ts`

Step 1: Write the failing test with the seed cases of `test/route-task.test.ts`, `test/route-preview-api.test.ts`
```ts
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Tier } from '../src/config/config-schema';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { decisionLogPath } from '../src/decision-log/decision-log';
import { planRoute, type PlanRequest } from '../src/routing/plan-route';
import { apiRoutes } from '../src/ui/api-routes';
import { startUiServer, type UiServer } from '../src/ui/ui-server';
import { pageHeaders, uiCall } from './helpers/ui-client';
import { testUiDeps } from './helpers/ui-deps';

const config = loadConfig(DEFAULT_CONFIG_PATH);
const request = (taskType: string, requestedTier: Tier, task = 'Do the task.', flags: string[] = []): PlanRequest => ({ task, taskType, requestedTier, flags });

const SEED_CASES: Array<[string, PlanRequest]> = [
  ['search at flash-low', request('search', 'flash-low')],
  ['boilerplate', request('boilerplate', 'flash-low')],
  ['tests', request('tests', 'flash-low')],
  ['build', request('build', 'flash-low')],
  ['security', request('security', 'flash-low')],
  ['migration', request('migration', 'flash-low')],
  ['the OAuth keyword', request('simple-edit', 'flash-low', 'Fix the OAuth callback')],
  ['a read-only search with a keyword', request('search', 'flash-low', 'Find where the auth token is read')],
  ['a read-only summary with a keyword', request('summarize', 'flash-low', 'Summarize the migration scripts')],
  ['author as a whole word', request('simple-edit', 'flash-low', 'Rename the author field')],
  ['the irreversible flag', request('search', 'flash-low', 'Find old rows', ['irreversible'])],
  ['search requested at pro-high', request('search', 'pro-high')],
  ['an unknown type at flash-high', request('unknown-type', 'flash-high')],
  ['a build with Claude effort high', { ...request('build', 'flash-low'), claudeEffort: 'high' }],
];

let server: UiServer;
let homeDir = '';

beforeAll(async () => {
  homeDir = mkdtempSync(join(tmpdir(), 'routemax-preview-api-'));
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes(testUiDeps(homeDir)));
});

afterAll(() => server.close());

const preview = (body: unknown) => uiCall(server.port, 'POST', '/api/route-preview', pageHeaders(server.port, server.token, true), body);

describe('route preview API', () => {
  it.each(SEED_CASES)('returns the same plan as the router for %s', async (_name, planRequest) => {
    const reply = await preview({ config, request: planRequest });
    expect(reply.status).toBe(200);
    expect(reply.json()).toEqual(planRoute(config, planRequest));
  });

  it('plans a seed search on the DeepSeek flash tier', async () => {
    expect((await preview({ config, request: request('search', 'flash-low') })).json()).toMatchObject({ tier: 'flash-low', provider: 'deepseek', model: 'deepseek-flash' });
  });

  it('refuses an invalid config with the field named', async () => {
    const broken = structuredClone(config) as unknown as { providers: Record<string, { models: Record<string, Record<string, unknown>> }> };
    delete broken.providers.deepseek.models['deepseek-flash'].outputUsd;
    const reply = await preview({ config: broken, request: request('search', 'flash-low') });
    expect(reply.status).toBe(422);
    expect((reply.json() as { issues: string[] }).issues).toEqual(expect.arrayContaining([expect.stringMatching(/^providers\.deepseek\.models\.deepseek-flash\.outputUsd/)]));
  });

  it('runs no worker and writes no decision', () => {
    expect(existsSync(decisionLogPath(homeDir))).toBe(false);
  });
});
```
Run: `npm test -- test/route-preview-api.test.ts`
Expected: every preview test fails with `expected 404 to be 200`; `runs no worker and writes no decision` passes

Step 2: Add the route preview, `src/ui/api-routes.ts`

The imports become:
```ts
import { z } from 'zod';
import { configSchema, effortSchema, formatIssues, TIER_ORDER } from '../config/config-schema';
import { readStoredConfig, restorePrevious, saveConfig, type StoreOutcome } from '../config/config-store';
import { loadConfig } from '../config/delegate-config';
import { previousConfigPath } from '../config/routemax-paths';
import { syncChezmoi } from '../config/sync-chezmoi';
import { decisionLogPath } from '../decision-log/decision-log';
import { runDoctorChecks, type DoctorDeps } from '../doctor/doctor-checks';
import { isRouterEnabled, setRouterEnabled } from '../router-switch/router-switch';
import { planRoute } from '../routing/plan-route';
import { readApiKey } from '../worker/read-api-key';
import { keyIssues, storeApiKey } from '../worker/store-api-key';
import { decisionStats, readDecisions } from './decision-stats';
import type { ApiResponse, ApiRoute } from './ui-server';
```
Add after the line `const keyBodySchema = z.object({ key: z.string() });`:
```ts
const planRequestSchema = z.object({
  task: z.string(),
  taskType: z.string(),
  requestedTier: z.enum(TIER_ORDER),
  claudeEffort: effortSchema.optional(),
  flags: z.array(z.string()).default([]),
});
const previewBodySchema = z.object({ config: z.unknown(), request: planRequestSchema });
```
Add before `export function apiRoutes` (the preview plans against the config the page sends, not the saved file, so an unsaved edit can be tried):
```ts
function previewRoutes(): ApiRoute[] {
  return [
    {
      method: 'POST',
      pattern: /^\/api\/route-preview$/,
      handle: async ({ body }) => {
        const parsed = previewBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        const config = configSchema.safeParse(parsed.data.config);
        if (!config.success) return invalid(formatIssues(config.error));
        return ok(planRoute(config.data, parsed.data.request));
      },
    },
  ];
}
```
In `apiRoutes`, the return line becomes:
```ts
  return [...switchRoutes(deps), ...configRoutes(deps), ...decisionRoutes(deps), ...doctorRoutes(deps), ...keyRoutes(deps), ...previewRoutes()];
```
Run: `npm run typecheck && npm test -- test/route-preview-api.test.ts test/route-task.test.ts`
Expected: `tsc` prints nothing; both files pass, `0 failed`

Commit:
```bash
git add src/ui/api-routes.ts test/route-preview-api.test.ts
git commit -m "feat(ui): preview a route over the API with the real router" -m "Plan-task: 35"
```

### Task 36: Test one provider through delegate and keep the latest result

Depends on: Task 35

Files:
- Create: `src/ui/provider-test.ts`
- Modify: `src/config/routemax-paths.ts` (new `providerTestsPath`)
- Test: `test/provider-test.test.ts`

Step 1: Write the failing test, `test/provider-test.test.ts`
```ts
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config/delegate-config';
import { providerTestsPath } from '../src/config/routemax-paths';
import { decisionLogPath } from '../src/decision-log/decision-log';
import type { DelegateDeps } from '../src/delegate/delegate';
import { setRouterEnabled } from '../src/router-switch/router-switch';
import { readProviderTests, recordProviderTest, testProvider, type ProviderTestResult } from '../src/ui/provider-test';

function routerOffDeps(): DelegateDeps {
  const homeDir = mkdtempSync(join(tmpdir(), 'routemax-provider-test-'));
  setRouterEnabled(homeDir, false);
  return {
    config: loadConfig(DEFAULT_CONFIG_PATH),
    homeDir,
    cwd: homeDir,
    env: {},
    readApiKey: async () => {
      throw new Error('No key is read while the router is off.');
    },
    ensureProxy: async () => {
      throw new Error('No proxy starts while the router is off.');
    },
  };
}

describe('testProvider', () => {
  it('fails with the router off and logs the call as provider-test', async () => {
    const deps = routerOffDeps();
    expect(await testProvider(deps, 'deepseek', 'deepseek-flash')).toEqual({
      providerId: 'deepseek',
      model: 'deepseek-flash',
      passed: false,
      costUsd: 0,
      testedAt: expect.any(String),
      detail: 'The router is off; switch it on to test a provider.',
    });
    const lines = readFileSync(decisionLogPath(deps.homeDir), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(lines).toEqual([expect.objectContaining({ taskType: 'provider-test', status: 'disabled', costUsd: 0 })]);
  });

  it('leaves the given config unchanged', async () => {
    const deps = routerOffDeps();
    const before = structuredClone(deps.config);
    await testProvider(deps, 'deepseek', 'deepseek-flash');
    expect(deps.config).toEqual(before);
  });
});

describe('provider test results', () => {
  const result: ProviderTestResult = { providerId: 'deepseek', model: 'deepseek-flash', passed: false, costUsd: 0, testedAt: '2026-09-25T10:00:00.000Z', detail: 'The worker stopped with upstream_error.' };

  it('lives beside the routemax backups', () => {
    expect(providerTestsPath('/home/test')).toBe('/home/test/.local/state/routemax/provider-tests.json');
  });

  it('reads nothing before the first test', () => {
    expect(readProviderTests(providerTestsPath(mkdtempSync(join(tmpdir(), 'routemax-provider-tests-'))))).toEqual({});
  });

  it('keeps the latest result per provider', () => {
    const path = providerTestsPath(mkdtempSync(join(tmpdir(), 'routemax-provider-tests-')));
    recordProviderTest(path, result);
    recordProviderTest(path, { ...result, providerId: 'openrouter', model: 'openrouter-model' });
    recordProviderTest(path, { ...result, passed: true, costUsd: 0.002, detail: 'The deepseek-flash worker finished the test task.' });
    expect(readProviderTests(path)).toEqual({
      deepseek: { ...result, passed: true, costUsd: 0.002, detail: 'The deepseek-flash worker finished the test task.' },
      openrouter: { ...result, providerId: 'openrouter', model: 'openrouter-model' },
    });
  });
});
```
Run: `npm test -- test/provider-test.test.ts`
Expected: the file fails to load: `Failed to resolve import "../src/ui/provider-test"`

Step 2: Add the results path, `src/config/routemax-paths.ts`, after the line `export const previousConfigPath = (homeDir: string) => join(backupsDir(homeDir), 'config.prev.json');`
```ts
export const providerTestsPath = (homeDir: string) => join(homeDir, '.local', 'state', 'routemax', 'provider-tests.json');
```
Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 3: Write `src/ui/provider-test.ts`

The test runs a copy of the config in which `flash-low` points at the provider and model under test with the provider's lowest listed effort, the provider is enabled and no rule can raise the tier; it goes through `delegate()`, so it obeys the switch, is logged with `taskType: 'provider-test'` and counts against the budget.
```ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { DelegateConfig } from '../config/config-schema';
import { delegate, type DelegateDeps } from '../delegate/delegate';
import type { DelegateResult } from '../delegate/delegate-result';

export interface ProviderTestResult {
  providerId: string;
  model: string;
  passed: boolean;
  costUsd: number;
  testedAt: string;
  detail: string;
}

type ProviderTestOutcome = Pick<ProviderTestResult, 'passed' | 'costUsd' | 'detail'>;

const TEST_TASK = 'Read hello.txt in the current folder and reply with its only line.';

function providerTestConfig(config: DelegateConfig, providerId: string, model: string): DelegateConfig {
  const copy = structuredClone(config);
  const provider = copy.providers[providerId];
  provider.enabled = true;
  copy.tiers['flash-low'] = { provider: providerId, model, effort: provider.efforts[0] };
  copy.rules = [];
  return copy;
}

function outcomeOf(result: DelegateResult): ProviderTestOutcome {
  switch (result.status) {
    case 'done':
      return { passed: true, costUsd: result.costUsd, detail: `The ${result.model} worker finished the test task.` };
    case 'escalate':
      return { passed: false, costUsd: result.costUsd, detail: `The worker stopped with ${result.reason}.` };
    case 'use_claude':
      return { passed: false, costUsd: 0, detail: result.reason === 'disabled' ? 'The router is off; switch it on to test a provider.' : 'The router handed the test to Claude.' };
    case 'refused':
      return { passed: false, costUsd: 0, detail: result.message };
  }
}

export async function testProvider(deps: DelegateDeps, providerId: string, model: string): Promise<ProviderTestResult> {
  const cwd = mkdtempSync(join(tmpdir(), 'routemax-provider-test-'));
  writeFileSync(join(cwd, 'hello.txt'), 'routemax provider test\n');
  try {
    const request = { task: TEST_TASK, taskType: 'provider-test', requestedTier: 'flash-low' as const, flags: [] };
    const outcome = await delegate(request, { ...deps, config: providerTestConfig(deps.config, providerId, model), cwd }).then(
      outcomeOf,
      (error: unknown): ProviderTestOutcome => ({ passed: false, costUsd: 0, detail: error instanceof Error ? error.message : String(error) }),
    );
    return { providerId, model, ...outcome, testedAt: new Date().toISOString() };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

export function readProviderTests(path: string): Record<string, ProviderTestResult> {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, ProviderTestResult>;
}

export function recordProviderTest(path: string, result: ProviderTestResult): void {
  const results = { ...readProviderTests(path), [result.providerId]: result };
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(results, null, 2)}\n`);
  renameSync(tempPath, path);
}
```
Run: `npm run typecheck && npm test -- test/provider-test.test.ts`
Expected: `tsc` prints nothing; the file passes, `0 failed`

Commit:
```bash
git add src/ui/provider-test.ts src/config/routemax-paths.ts test/provider-test.test.ts
git commit -m "feat(ui): test one provider through delegate and keep the latest result" -m "Plan-task: 36"
```

### Task 37: Run a provider test over the API against a fake upstream

Depends on: Task 36

Files:
- Modify: `src/ui/api-routes.ts` (provider test routes, `UiDeps.delegateDeps`, imports)
- Modify: `test/helpers/ui-deps.ts` (return line)
- Test: `test/integration/provider-test-http.test.ts`

Step 1: Write the failing test, `test/integration/provider-test-http.test.ts`

The setup follows `test/integration/delegate-stdio.test.ts`: a real `claude -p` worker talks to `test/fixtures/fake-upstream.mjs`, which `ensureProxy` starts as the repair-proxy of both providers on one port. The failing provider differs only in its Keychain service, for which the injected `readApiKey` returns a wrong key, so the fake upstream answers 401 through `FAKE_UPSTREAM_EXPECTED_AUTH`. `ensureProxy` passes `process.env` to the proxy, hence `vi.stubEnv`.
```ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DelegateConfig } from '../../src/config/config-schema';
import { DEFAULT_CONFIG_PATH } from '../../src/config/delegate-config';
import { migrateConfig } from '../../src/config/migrate-config';
import { ensureProxy } from '../../src/proxy/ensure-proxy';
import { apiRoutes } from '../../src/ui/api-routes';
import { startUiServer, type UiServer } from '../../src/ui/ui-server';
import { freePort } from '../helpers/free-port';
import { pageHeaders, uiCall } from '../helpers/ui-client';
import { testUiDeps } from '../helpers/ui-deps';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FAKE_UPSTREAM = join(ROOT, 'test/fixtures/fake-upstream.mjs');
const FAKE_KEY = 'sk-fake-DO-NOT-LEAK';
const TEST_TIMEOUT_MS = 180_000;

let server: UiServer;
let pidFile = '';

beforeAll(async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'routemax-provider-http-')));
  const home = join(root, 'home');
  const deepseekHome = join(home, '.claude-deepseek');
  for (const dir of [deepseekHome, join(root, 'proxy', 'node_modules', '.bin')]) mkdirSync(dir, { recursive: true });
  const port = await freePort();
  pidFile = join(root, 'upstream.pid');
  writeFileSync(join(deepseekHome, 'env.vars'), `ANTHROPIC_BASE_URL=http://127.0.0.1:${port}\nCLAUDE_CONFIG_DIR=${deepseekHome}\nANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash\n`);
  writeFileSync(join(deepseekHome, 'mcp.json'), '{"mcpServers":{}}\n');
  writeFileSync(join(deepseekHome, 'settings.json'), '{}\n');
  writeFileSync(join(root, 'proxy', 'node_modules', '.bin', 'tsx'), `#!/bin/sh\nexec node "${FAKE_UPSTREAM}"\n`, { mode: 0o755 });
  vi.stubEnv('FAKE_UPSTREAM_PORT', String(port));
  vi.stubEnv('FAKE_UPSTREAM_PID_FILE', pidFile);
  vi.stubEnv('FAKE_UPSTREAM_EXPECTED_AUTH', `Bearer ${FAKE_KEY}`);

  const config = migrateConfig(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'))) as DelegateConfig;
  config.proxy = { dir: join(root, 'proxy') };
  config.workerTimeoutMs = 120_000;
  config.providers.deepseek.repairProxy = { port, logPath: join(root, 'proxy.log'), telemetryPath: join(root, 'telemetry.jsonl') };
  config.providers.broken = { ...config.providers.deepseek, name: 'Broken', keychainService: 'bad_api_key' };
  const deps = testUiDeps(home);
  writeFileSync(deps.configPath, `${JSON.stringify(config, null, 2)}\n`);
  server = await startUiServer(mkdtempSync(join(tmpdir(), 'routemax-dist-')), apiRoutes({
    ...deps,
    delegateDeps: () => ({
      config,
      homeDir: home,
      cwd: root,
      env: { ...process.env, HOME: home },
      readApiKey: async (service) => (service === 'bad_api_key' ? 'sk-wrong-key' : FAKE_KEY),
      ensureProxy,
    }),
  }));
});

afterAll(async () => {
  await server.close();
  vi.unstubAllEnvs();
  if (existsSync(pidFile)) process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGTERM');
});

const testOn = (providerId: string) =>
  uiCall(server.port, 'POST', `/api/providers/${providerId}/test`, pageHeaders(server.port, server.token, true), { model: 'deepseek-flash' });

describe('provider test over HTTP', () => {
  it('passes a working provider with its cost', async () => {
    const reply = await testOn('deepseek');
    expect(reply.status).toBe(200);
    expect(reply.json()).toMatchObject({ providerId: 'deepseek', model: 'deepseek-flash', passed: true });
    expect((reply.json() as { costUsd: number }).costUsd).toBeGreaterThan(0);
  }, TEST_TIMEOUT_MS);

  it('fails a provider whose upstream refuses the key, with its cost', async () => {
    const reply = await testOn('broken');
    expect(reply.json()).toMatchObject({ providerId: 'broken', passed: false, costUsd: expect.any(Number) });
    expect(reply.text).not.toContain('sk-wrong-key');
  }, TEST_TIMEOUT_MS);

  it('keeps both results for the page', async () => {
    const reply = await uiCall(server.port, 'GET', '/api/provider-tests', pageHeaders(server.port, server.token));
    expect(reply.json()).toMatchObject({ deepseek: { passed: true }, broken: { passed: false } });
    expect(reply.text).not.toContain(FAKE_KEY);
  });

  it('answers 404 for an unknown provider and 422 for an unknown model', async () => {
    expect((await testOn('nope')).status).toBe(404);
    const reply = await uiCall(server.port, 'POST', '/api/providers/deepseek/test', pageHeaders(server.port, server.token, true), { model: 'nope' });
    expect(reply.status).toBe(422);
  });
});
```
Run: `npm test -- test/integration/provider-test-http.test.ts`
Expected: every test fails: both routes answer `404`, so `passed` and the stored results are missing (`vitest` does not type-check the unknown `delegateDeps` field)

Step 2: Add the provider test routes, `src/ui/api-routes.ts`

The imports become:
```ts
import { z } from 'zod';
import { configSchema, effortSchema, formatIssues, TIER_ORDER } from '../config/config-schema';
import { readStoredConfig, restorePrevious, saveConfig, type StoreOutcome } from '../config/config-store';
import { loadConfig } from '../config/delegate-config';
import { previousConfigPath, providerTestsPath } from '../config/routemax-paths';
import { syncChezmoi } from '../config/sync-chezmoi';
import { decisionLogPath } from '../decision-log/decision-log';
import type { DelegateDeps } from '../delegate/delegate';
import { runDoctorChecks, type DoctorDeps } from '../doctor/doctor-checks';
import { isRouterEnabled, setRouterEnabled } from '../router-switch/router-switch';
import { planRoute } from '../routing/plan-route';
import { readApiKey } from '../worker/read-api-key';
import { keyIssues, storeApiKey } from '../worker/store-api-key';
import { decisionStats, readDecisions } from './decision-stats';
import { readProviderTests, recordProviderTest, testProvider } from './provider-test';
import type { ApiResponse, ApiRoute } from './ui-server';
```
`UiDeps` becomes (`delegateDeps` is a factory like `doctorDeps`, so each test reads the live config):
```ts
export interface UiDeps {
  homeDir: string;
  configPath: string;
  chezmoiBin: string;
  doctorDeps: () => DoctorDeps;
  delegateDeps: () => DelegateDeps;
}
```
Add after the line `const previewBodySchema = z.object({ config: z.unknown(), request: planRequestSchema });`:
```ts
const providerTestBodySchema = z.object({ model: z.string() });
```
Add before `export function apiRoutes`:
```ts
function providerTestRoutes(deps: UiDeps): ApiRoute[] {
  const resultsPath = providerTestsPath(deps.homeDir);
  return [
    { method: 'GET', pattern: /^\/api\/provider-tests$/, handle: async () => ok(readProviderTests(resultsPath)) },
    {
      method: 'POST',
      pattern: /^\/api\/providers\/([^/]+)\/test$/,
      handle: async ({ params: [providerId], body }) => {
        const delegateDeps = deps.delegateDeps();
        const { providers } = delegateDeps.config;
        if (!Object.hasOwn(providers, providerId)) return missing([`providers.${providerId}: no such provider`]);
        const parsed = providerTestBodySchema.safeParse(body);
        if (!parsed.success) return invalid(formatIssues(parsed.error));
        const { model } = parsed.data;
        if (!Object.hasOwn(providers[providerId].models, model)) return invalid([`providers.${providerId}.models.${model}: no such model`]);
        const result = await testProvider(delegateDeps, providerId, model);
        recordProviderTest(resultsPath, result);
        return ok(result);
      },
    },
  ];
}
```
In `apiRoutes`, the return line becomes:
```ts
  return [...switchRoutes(deps), ...configRoutes(deps), ...decisionRoutes(deps), ...doctorRoutes(deps), ...keyRoutes(deps), ...previewRoutes(), ...providerTestRoutes(deps)];
```
Run: `npm test -- test/integration/provider-test-http.test.ts`
Expected: the four tests pass, `0 failed` (`tsc` reports the missing `delegateDeps` in `test/helpers/ui-deps.ts` until Step 3)

Step 3: Give the other API tests a delegate factory that fails loudly, `test/helpers/ui-deps.ts`, the `return` line becomes:
```ts
  return {
    homeDir,
    configPath,
    chezmoiBin: join(homeDir, 'no-chezmoi'),
    doctorDeps: () => {
      throw new Error('This test gives no doctor deps; pass doctorDeps to apiRoutes.');
    },
    delegateDeps: () => {
      throw new Error('This test gives no delegate deps; pass delegateDeps to apiRoutes.');
    },
  };
```
Run: `npm run typecheck && npm test -- test/integration/provider-test-http.test.ts test/keys-api.test.ts test/route-preview-api.test.ts test/doctor-api.test.ts`
Expected: `tsc` prints nothing; the four files pass, `0 failed`

Commit:
```bash
git add src/ui/api-routes.ts test/helpers/ui-deps.ts test/integration/provider-test-http.test.ts
git commit -m "feat(ui): run a provider test over the API" -m "Plan-task: 37"
```

### Task 38: Start the page with `routemax ui`

Depends on: Task 37

Files:
- Create: `src/ui/run-ui.ts`
- Create: `bin/routemax.mjs`
- Modify: `package.json`
- Test: `test/integration/routemax-bin.test.ts`

Step 1: Write the failing test, `test/integration/routemax-bin.test.ts`

The child gets a temporary `HOME` (so `activeConfigPath()` creates a live config there, not in the user's home), a fake `security` that finds no key, `ROUTEMAX_NO_OPEN` so no browser opens, and `ROUTEMAX_UI_DIST` pointing at a one-file build.
```ts
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { pageHeaders, uiCall } from '../helpers/ui-client';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BIN = join(ROOT, 'bin', 'routemax.mjs');
const URL_LINE = /routemax ui: (http:\/\/127\.0\.0\.1:(\d+)\/#token=(\S+))/;

const children: ChildProcess[] = [];

function startBin(args: string[], distDir: string): { child: ChildProcess; output: () => string } {
  const root = mkdtempSync(join(tmpdir(), 'routemax-bin-'));
  mkdirSync(join(root, 'bin'));
  writeFileSync(join(root, 'bin', 'security'), '#!/bin/sh\nexit 44\n', { mode: 0o755 });
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: join(root, 'home'), PATH: `${join(root, 'bin')}:${process.env.PATH}`, ROUTEMAX_UI_DIST: distDir, ROUTEMAX_NO_OPEN: '1' };
  delete env.DEEPSEEK_DELEGATE_CONFIG;
  const child = spawn(process.execPath, [BIN, ...args], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let text = '';
  child.stdout?.on('data', (chunk) => (text += String(chunk)));
  child.stderr?.on('data', (chunk) => (text += String(chunk)));
  return { child, output: () => text };
}

async function waitForUrl(output: () => string): Promise<RegExpMatchArray> {
  for (let waited = 0; waited < 20_000; waited += 100) {
    const match = output().match(URL_LINE);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`routemax ui printed no URL:\n${output()}`);
}

const exitCodeOf = (child: ChildProcess) => new Promise<number | null>((resolve) => child.once('exit', resolve));

afterEach(() => {
  for (const child of children.splice(0)) child.kill('SIGKILL');
});

describe('routemax ui', () => {
  it('serves the page and every section from another folder, and stops on Ctrl-C', async () => {
    const distDir = mkdtempSync(join(tmpdir(), 'routemax-dist-'));
    writeFileSync(join(distDir, 'index.html'), '<!doctype html><title>routemax test page</title>\n');
    const { child, output } = startBin(['ui'], distDir);
    const [, , portText, token] = await waitForUrl(output);
    const port = Number(portText);
    expect((await uiCall(port, 'GET', '/', { host: `127.0.0.1:${port}` })).text).toContain('routemax test page');
    for (const path of ['/api/config', '/api/switch', '/api/stats', '/api/history', '/api/keys', '/api/provider-tests']) {
      expect((await uiCall(port, 'GET', path, pageHeaders(port, token))).status, path).toBe(200);
    }
    expect((await uiCall(port, 'GET', '/api/config', pageHeaders(port, token))).json()).toMatchObject({ config: { version: 2 } });
    const exited = exitCodeOf(child);
    child.kill('SIGINT');
    expect(await exited).toBe(0);
  }, 30_000);

  it('says to run npm run setup when the page is not built', async () => {
    const { child, output } = startBin(['ui'], mkdtempSync(join(tmpdir(), 'routemax-empty-dist-')));
    expect(await exitCodeOf(child)).toBe(1);
    expect(output()).toContain('npm run setup');
  }, 30_000);

  it('prints the usage for an unknown command', async () => {
    const { child, output } = startBin(['nope'], ROOT);
    expect(await exitCodeOf(child)).toBe(2);
    expect(output()).toContain('Usage: routemax ui');
  }, 30_000);
});
```
Run: `npm test -- test/integration/routemax-bin.test.ts`
Expected: every test fails: `node` exits with `Cannot find module` for `bin/routemax.mjs`, so no URL is printed and the exit codes are `1`, not `0` or `2`

Step 2: Write `src/ui/run-ui.ts`

`runUi` wires the real deps: the live config path from `activeConfigPath()` (Task 18), the doctor deps from `src/doctor/doctor-deps.ts` (Task 32), and the same delegate deps as `src/server.ts`. `open` is the macOS command that opens a URL in the default browser.
```ts
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activeConfigPath, loadConfig } from '../config/delegate-config';
import { doctorDeps } from '../doctor/doctor-deps';
import { ensureProxy } from '../proxy/ensure-proxy';
import { readApiKey } from '../worker/read-api-key';
import { apiRoutes, type UiDeps } from './api-routes';
import { startUiServer } from './ui-server';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

function liveUiDeps(homeDir: string, configPath: string): UiDeps {
  return {
    homeDir,
    configPath,
    chezmoiBin: 'chezmoi',
    doctorDeps: () => doctorDeps(REPO_ROOT, loadConfig(configPath), homeDir),
    delegateDeps: () => ({ config: loadConfig(configPath), homeDir, cwd: process.cwd(), env: process.env, readApiKey, ensureProxy }),
  };
}

export async function runUi(): Promise<void> {
  const distDir = process.env.ROUTEMAX_UI_DIST ?? join(REPO_ROOT, 'web', 'dist');
  if (!existsSync(join(distDir, 'index.html'))) {
    console.error(`The routemax page is not built: ${join(distDir, 'index.html')} is missing. Run \`npm run setup\` in ${REPO_ROOT}.`);
    process.exitCode = 1;
    return;
  }
  const homeDir = homedir();
  const server = await startUiServer(distDir, apiRoutes(liveUiDeps(homeDir, activeConfigPath())));
  console.log(`routemax ui: ${server.url}`);
  console.log('Press Ctrl-C to stop.');
  if (!process.env.ROUTEMAX_NO_OPEN) spawn('open', [server.url], { stdio: 'ignore', detached: true }).unref();
  process.once('SIGINT', () => {
    void server.close().then(() => process.exit(0));
  });
}
```
Run: `npm run typecheck`
Expected: `tsc` prints nothing

Step 3: Write `bin/routemax.mjs` and make it executable

`tsImport` from `tsx/esm/api` (tsx 4.23.15, `node_modules/tsx/dist/esm/api/index.d.mts`: `tsImport(specifier: string, options: string | Options): Promise<any>`) loads the TypeScript entry without a build step; Node resolves `npm link`'s symlink to the repository, so `tsx` comes from its `node_modules`.
```js
#!/usr/bin/env node
import { tsImport } from 'tsx/esm/api';

const [command] = process.argv.slice(2);
if (command !== 'ui') {
  console.error('Usage: routemax ui');
  process.exit(2);
}
const { runUi } = await tsImport('../src/ui/run-ui.ts', import.meta.url);
await runUi();
```
Run: `chmod +x bin/routemax.mjs && npm test -- test/integration/routemax-bin.test.ts`
Expected: the three tests pass, `0 failed`

Step 4: Declare the command, `package.json`, add after the line `"private": true,`:
```json
  "bin": { "routemax": "bin/routemax.mjs" },
```
Run: `npm run typecheck && npm test`
Expected: `tsc` prints nothing; every test file passes, `0 failed`

Commit:
```bash
git add src/ui/run-ui.ts bin/routemax.mjs package.json test/integration/routemax-bin.test.ts
git commit -m "feat(ui): start the page with routemax ui" -m "Plan-task: 38"
```

### Phase 6: Frontend scaffold and project skills

### Task 39: Install the project skills into `.claude/skills`

Depends on: none

Files:
- Create: `.claude/skills`
- Create: `skills-lock.json`

Step 1: Install the twelve skills project-local and copied
```bash
npx -y skills@1.7.0 add jakubkrehel/skills --skill better-ui better-typography better-colors better-layout better-accessibility better-writing interface-review break --agent claude-code --copy --yes
npx -y skills@1.7.0 add vercel-labs/agent-skills --skill vercel-react-best-practices vercel-composition-patterns web-design-guidelines --agent claude-code --copy --yes
npx -y skills@1.7.0 add shadcn/ui --skill shadcn --agent claude-code --copy --yes
```
Run: `ls .claude/skills/*/SKILL.md | wc -l; ls -d .agents 2>&1; ls ~/.claude/skills/better-ui 2>&1; grep -c '"source"' skills-lock.json`
Expected: `12`; `.agents` and `~/.claude/skills/better-ui` both report `No such file or directory`; `12`. `ls .claude/skills` lists `better-accessibility better-colors better-layout better-typography better-ui better-writing break interface-review shadcn vercel-composition-patterns vercel-react-best-practices web-design-guidelines`.

Commit:
```bash
git add .claude/skills skills-lock.json
git commit -m "chore(skills): install the project UI skills" -m "Plan-task: 39"
```

### Task 40: Add the `web` workspace with its dependencies

Depends on: none

Files:
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Modify: `package.json` (`workspaces`, `scripts.build:web`)
- Modify: `package-lock.json`

Step 1: Create `web/package.json`

The shadcn dependencies are the exact set `shadcn@4.21.0 init --base base --preset nova` adds (Phase 6 notes), declared here so Task 42's init changes no package file.
```json
{
  "name": "routemax-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@base-ui/react": "^1.8.0",
    "@fontsource-variable/geist": "^5.3.0",
    "class-variance-authority": "^0.7.1",
    "cn": "^0.4.0",
    "lucide-react": "^1.48.0",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "shadcn": "^4.21.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.7.2",
    "vite": "^8.3.1"
  }
}
```
Run: `node -e "JSON.parse(require('fs').readFileSync('web/package.json','utf8'))"`
Expected: no output, exit code 0.

Step 2: Create `web/tsconfig.json`

The browser build gets its own TypeScript project because the root `tsconfig.json` has no DOM lib and no JSX; `paths` is the `@/` alias shadcn's `components.json` uses.
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```
Run: `node -e "JSON.parse(require('fs').readFileSync('web/tsconfig.json','utf8'))"`
Expected: no output, exit code 0.

Step 3: Declare the workspace in the root `package.json`

Add the `workspaces` key after `"engines"` and the `build:web` script after `"typecheck"`, leaving every other key as it is:
```json
  "workspaces": ["web"],
```
```json
    "build:web": "npm run build --workspace web"
```
Run: `npm install --no-audit --no-fund && npm ls vite react --workspace web && ls web/package-lock.json 2>&1; npm run typecheck && npm test`
Expected: `npm ls` lists `vite@8.` and `react@19.` under `routemax-web`; `web/package-lock.json` reports `No such file or directory`; typecheck prints nothing; every test file passes, `0 failed`.

Commit:
```bash
git add web/package.json web/tsconfig.json package.json package-lock.json
git commit -m "build(web): add the web workspace for the dashboard" -m "Plan-task: 40"
```

### Task 41: Build a first page into `web/dist`

Depends on: Task 40

Files:
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/index.css`

Step 1: Create `web/vite.config.ts` and `web/index.html`

`outDir` is `dist` relative to `web/`, the folder `src/ui/static-files.ts` serves (Task 25); the root `.gitignore` line `dist/` already keeps it out of git.
```ts
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: 'dist', emptyOutDir: true },
});
```
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>routemax</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
Run: `ls web/vite.config.ts web/index.html`
Expected: both paths print.

Step 2: Create `web/src/index.css` and `web/src/main.tsx`

`web/src/index.css` holds one line now; Task 42's shadcn init fills it:
```css
@import "tailwindcss";
```
`web/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('index.html has no #root element');

createRoot(rootElement).render(
  <StrictMode>
    <h1 className="p-4 text-lg font-semibold">routemax</h1>
  </StrictMode>,
);
```
Run: `npm run build:web && ls web/dist web/dist/assets`
Expected: the build ends with `built in`; `web/dist` holds `index.html` and `assets` holds one `index-*.js` and one `index-*.css`.

Commit:
```bash
git add web/vite.config.ts web/index.html web/src/main.tsx web/src/index.css
git commit -m "feat(web): build a first page into web/dist" -m "Plan-task: 41"
```

### Task 42: Initialize shadcn on Base UI

Depends on: Task 41

Files:
- Create: `web/components.json`
- Create: `web/src/lib/utils.ts`
- Modify: `web/src/index.css`

Step 1: Run the shadcn CLI in the workspace

`--preset nova` answers the preset prompt the CLI shows otherwise (checked with shadcn 4.21.0) and yields `"style": "base-nova"`.
```bash
cd web && npx -y shadcn@4.21.0 init --base base --preset nova --yes </dev/null
```
Run: `grep '"style"' web/components.json && cat web/src/lib/utils.ts && git status --short && head -4 web/src/index.css && npm run build:web`
Expected: `"style": "base-nova",`; `export { cn } from "cn"`; `git status` lists only `web/components.json`, `web/src/lib/` and `web/src/index.css` (when it also lists a package or lock file, stop with `PLAN DRIFT: Task 42` and the diff); `index.css` starts with `@import "tailwindcss";`, `@import "tw-animate-css";`, `@import "shadcn/tailwind.css";`, `@import "@fontsource-variable/geist";`; the build ends with `built in`.

Commit:
```bash
git add web/components.json web/src/lib/utils.ts web/src/index.css
git commit -m "feat(web): initialize shadcn on Base UI" -m "Plan-task: 42"
```

### Task 43: Send the page token with every API request

Depends on: Task 41
Risk: security boundary (the per-start token that gates every `/api/` request)

Files:
- Create: `web/src/lib/api-client.ts`
- Test: `web/src/lib/api-client.test.ts`
- Modify: `package.json` (the `"typecheck": "tsc --noEmit",` line inside `"scripts"`)

Step 1: Write the failing test, `web/src/lib/api-client.test.ts`

The root `npm test` runs it (vitest's default include finds `*.test.ts` under `web/src`); a fake store and fetch keep it free of the DOM.
```ts
import { describe, expect, it } from 'vitest';
import { ApiError, captureToken, createApiClient, TOKEN_HEADER, type TokenStore } from './api-client';

function memoryStore(initial: Record<string, string> = {}): TokenStore & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) };
}

interface SentRequest { path: string; init: RequestInit }

function fakeFetch(response: () => Response): { fetch: typeof fetch; sent: SentRequest[] } {
  const sent: SentRequest[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    sent.push({ path: String(input), init: init ?? {} });
    return response();
  }) as typeof fetch;
  return { fetch: fetchImpl, sent };
}

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('captureToken', () => {
  it('moves a #token= fragment into the store', () => {
    const store = memoryStore();
    expect(captureToken('#token=abc_DEF-123', store)).toBe(true);
    expect(store.items.get('routemax-token')).toBe('abc_DEF-123');
  });

  it('ignores a hash without a token', () => {
    const store = memoryStore();
    expect(captureToken('#history', store)).toBe(false);
    expect(captureToken('', store)).toBe(false);
    expect(store.items.size).toBe(0);
  });
});

describe('createApiClient', () => {
  it('sends the token header on a GET and returns the JSON body', async () => {
    const { fetch, sent } = fakeFetch(json({ enabled: true }));
    const api = createApiClient(memoryStore({ 'routemax-token': 'tok' }), fetch);
    await expect(api.request('GET', '/api/switch')).resolves.toEqual({ enabled: true });
    expect(sent[0].path).toBe('/api/switch');
    expect(new Headers(sent[0].init.headers).get(TOKEN_HEADER)).toBe('tok');
    expect(sent[0].init.body).toBeUndefined();
  });

  it('sends a JSON body and content type on a PUT', async () => {
    const { fetch, sent } = fakeFetch(json({ enabled: false }));
    const api = createApiClient(memoryStore({ 'routemax-token': 'tok' }), fetch);
    await api.request('PUT', '/api/switch', { enabled: false });
    expect(sent[0].init.method).toBe('PUT');
    expect(new Headers(sent[0].init.headers).get('content-type')).toBe('application/json');
    expect(sent[0].init.body).toBe('{"enabled":false}');
  });

  it('turns a 422 into an ApiError with the issues', async () => {
    const { fetch } = fakeFetch(json({ error: 'invalid', issues: ['budget.totalUsd: Too small'] }, 422));
    const api = createApiClient(memoryStore({ 'routemax-token': 'tok' }), fetch);
    const failure = await api.request('PUT', '/api/config', {}).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 422, kind: 'invalid', issues: ['budget.totalUsd: Too small'] });
  });

  it('turns an empty 403 into a forbidden ApiError', async () => {
    const { fetch } = fakeFetch(() => new Response(null, { status: 403 }));
    const api = createApiClient(memoryStore({ 'routemax-token': 'tok' }), fetch);
    await expect(api.request('GET', '/api/config')).rejects.toMatchObject({ status: 403, kind: 'forbidden' });
  });

  it('refuses to call the API without a token', async () => {
    const { fetch, sent } = fakeFetch(json({}));
    const api = createApiClient(memoryStore(), fetch);
    await expect(api.request('GET', '/api/config')).rejects.toMatchObject({ kind: 'no-token' });
    expect(sent).toHaveLength(0);
  });
});
```
Run: `npm test -- web/src/lib/api-client.test.ts`
Expected: FAIL, `Failed to resolve import "./api-client"`.

Step 2: Create `web/src/lib/api-client.ts`

Header name, fragment and error shape follow the Phase 5 notes. The store and fetch are parameters so the test runs in Node; Task 44 builds the browser instance.
```ts
export const TOKEN_HEADER = 'x-routemax-token';
const TOKEN_KEY = 'routemax-token';
const TOKEN_FRAGMENT = /^#token=([A-Za-z0-9_-]+)$/;

export interface TokenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ApiMethod = 'GET' | 'PUT' | 'POST';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly kind: string,
    readonly issues: string[],
  ) {
    super(issues.length > 0 ? issues.join('\n') : `The request failed with status ${status}.`);
    this.name = 'ApiError';
  }
}

/** Stores the token from a `#token=` fragment; returns whether the hash held one. */
export function captureToken(hash: string, store: TokenStore): boolean {
  const match = TOKEN_FRAGMENT.exec(hash);
  if (match === null) return false;
  store.setItem(TOKEN_KEY, match[1]);
  return true;
}

function errorFromResponse(status: number, text: string): ApiError {
  if (status === 403 || text === '') return new ApiError(status, 'forbidden', []);
  try {
    const body = JSON.parse(text) as { error?: unknown; issues?: unknown };
    const kind = typeof body.error === 'string' ? body.error : 'failed';
    const issues = Array.isArray(body.issues) ? body.issues.filter((issue): issue is string => typeof issue === 'string') : [];
    return new ApiError(status, kind, issues);
  } catch {
    return new ApiError(status, 'failed', []);
  }
}

export function createApiClient(store: TokenStore, fetchImpl: typeof fetch) {
  return {
    async request<T>(method: ApiMethod, path: string, body?: unknown): Promise<T> {
      const token = store.getItem(TOKEN_KEY);
      if (token === null) {
        throw new ApiError(0, 'no-token', ['Open the page with the link routemax ui prints: it carries the access token.']);
      }
      const headers: Record<string, string> = { [TOKEN_HEADER]: token };
      if (method !== 'GET') headers['content-type'] = 'application/json';
      const response = await fetchImpl(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      if (!response.ok) throw errorFromResponse(response.status, await response.text());
      return (await response.json()) as T;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
```
Run: `npm test -- web/src/lib/api-client.test.ts`
Expected: PASS, 7 tests.

Step 3: Type-check the web workspace with the root `typecheck`

The root `package.json` today reads `"typecheck": "tsc --noEmit",` inside `"scripts"`; the root `tsconfig.json` includes only `src` and `test`, so `web/src` is checked only by `web/package.json`'s own `"typecheck": "tsc --noEmit"` script (which uses `web/tsconfig.json`, include `src`). Change that one line so the root script also runs the workspace's; the `"scripts"` block of the root `package.json` must read:
```json
  "scripts": {
    "start": "tsx src/server.ts",
    "doctor": "tsx src/doctor/run-doctor.ts",
    "setup": "npm install --no-audit --no-fund && tsx src/setup/run-setup.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit && npm run typecheck --workspace web",
    "build:web": "npm run build --workspace web"
  },
```
Run: `npm run typecheck && npm test`
Expected: typecheck exits 0 with no `error TS` line; every test file passes, `0 failed`.

Commit:
```bash
git add web/src/lib/api-client.ts web/src/lib/api-client.test.ts package.json
git commit -m "feat(web): send the page token with every API request" -m "Plan-task: 43"
```

### Task 44: Show the router state through the API client

Depends on: Task 38, Task 42, Task 43

Files:
- Create: `web/src/lib/browser-api.ts`
- Create: `web/src/app.tsx`
- Modify: `web/src/main.tsx`

Step 1: Create `web/src/lib/browser-api.ts` (the one client instance every page imports) and `web/src/app.tsx` (a bare status line that proves the token path; Phase 7's shell task replaces it)
```ts
import { createApiClient } from './api-client';

export const api = createApiClient(window.sessionStorage, (input, init) => window.fetch(input, init));
```
```tsx
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { api } from '@/lib/browser-api';

type SwitchState = { kind: 'loading' } | { kind: 'loaded'; enabled: boolean } | { kind: 'failed'; message: string };

export function App() {
  const [switchState, setSwitchState] = useState<SwitchState>({ kind: 'loading' });

  useEffect(() => {
    api
      .request<{ enabled: boolean }>('GET', '/api/switch')
      .then(({ enabled }) => setSwitchState({ kind: 'loaded', enabled }))
      .catch((error: unknown) =>
        setSwitchState({ kind: 'failed', message: error instanceof ApiError ? error.message : 'The server did not answer.' }),
      );
  }, []);

  return (
    <main className="p-4">
      <h1 className="text-lg font-semibold">routemax</h1>
      <p>
        {switchState.kind === 'loading' && 'Loading…'}
        {switchState.kind === 'loaded' && `Router: ${switchState.enabled ? 'on' : 'off'}`}
        {switchState.kind === 'failed' && switchState.message}
      </p>
    </main>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 2: Capture the token before the first render in `web/src/main.tsx`

The fragment is removed from the address bar once stored, so the token does not stay in the visible URL or in a copied link.
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { captureToken } from './lib/api-client';
import './index.css';

if (captureToken(window.location.hash, window.sessionStorage)) {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('index.html has no #root element');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```
Run: `npm run build:web && npm test -- test/integration/routemax-bin.test.ts`
Expected: the build ends with `built in`; the bin test passes.

Step 3: Open the page through the real command
Run: `node bin/routemax.mjs ui`, open the printed URL, then reload the tab
Expected: the page shows `Router: on` (or `off`, matching the switch file), the address bar no longer shows `#token=`, and after the reload it still shows the router state (the token is kept in `sessionStorage`). Ctrl-C stops the server.

Commit:
```bash
git add web/src/lib/browser-api.ts web/src/app.tsx web/src/main.tsx
git commit -m "feat(web): show the router state through the API client" -m "Plan-task: 44"
```

### Phase 7: Pages

### Task 45: Add the page libraries, the shadcn components and the API types

Depends on: Task 44

Files:
- Modify: `web/package.json`
- Modify: `package-lock.json`
- Create: `web/src/components/ui` (the files `shadcn add` writes)
- Create: `web/src/lib/api-types.ts`

Step 1: Install the table and form libraries into the `web` workspace

The versions are the registry's latest on 2026-09-25 (`npm view`).
Run: `npm install --workspace web --no-audit --no-fund @tanstack/react-table@^9.2.4 react-hook-form@^7.88.0 @hookform/resolvers@^5.9.1`
Expected: `web/package.json` `dependencies` lists `@tanstack/react-table`, `react-hook-form` and `@hookform/resolvers`; `git status --short` shows `package-lock.json` modified and no `web/package-lock.json`.

Step 2: Add the shadcn components from `web/`

`chart` installs Recharts itself. Phase 6 notes did not confirm which lock file the CLI's install writes: a new `web/package-lock.json` stops this task with `PLAN DRIFT: Task 45`.
Run: `cd web && npx shadcn@4.21.0 add button card switch badge input label table progress alert chart --yes`
Expected: `web/src/components/ui/` holds `button.tsx`, `card.tsx`, `switch.tsx`, `badge.tsx`, `input.tsx`, `label.tsx`, `table.tsx`, `progress.tsx`, `alert.tsx` and `chart.tsx`; `web/package.json` gains `recharts`; `git status --short` shows no `web/package-lock.json`.

Step 3: Create `web/src/lib/api-types.ts`

The config and route types come from the browser-safe sources (`config-schema.ts` imports only `zod`); `DecisionRecord` is mirrored because `src/decision-log/decision-log.ts` imports `node:fs` and the web project has no Node types. The shapes are the Phase 5 API contract.
```ts
import type { DelegateConfig, Effort, Tier } from '../../../src/config/config-schema';
import type { PlanRequest, RoutePlan } from '../../../src/routing/plan-route';

export type { DelegateConfig, PlanRequest, RoutePlan };

export interface SwitchResponse {
  enabled: boolean;
}

export interface ConfigResponse {
  config: DelegateConfig;
  hash: string;
  previousExists: boolean;
}

export type ChezmoiState = 'synced' | 'no-chezmoi' | 'unmanaged' | 'template' | 'failed';

export interface SaveResponse {
  hash: string;
  chezmoi: { state: ChezmoiState; message: string };
}

export interface CallsAndCost {
  calls: number;
  costUsd: number;
}

export interface PeriodStats extends CallsAndCost {
  byTier: Record<string, CallsAndCost>;
  byModel: Record<string, CallsAndCost>;
  escalations: Record<string, number>;
}

export interface StatsResponse {
  budget: { totalUsd: number; spentUsd: number; leftUsd: number };
  spendByProvider: Record<string, number>;
  today: PeriodStats;
  week: PeriodStats;
}

export type DecisionStatus = 'done' | 'escalate' | 'use_claude' | 'refused' | 'disabled';

export interface DecisionRecord {
  ts: string;
  cwd: string;
  taskType: string;
  requestedTier: Tier;
  finalTier: Tier;
  raisedBy: string | null;
  provider: string | null;
  model: string | null;
  effort: Effort | null;
  costUsd: number;
  status: DecisionStatus;
  reason: string | null;
  durationMs: number;
  retries: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface HistoryResponse {
  records: DecisionRecord[];
}

export interface DoctorCheck {
  name: string;
  ok: boolean;
  message: string;
}

export interface DoctorResponse {
  checks: DoctorCheck[];
}

export interface KeysResponse {
  keys: Record<string, { present: boolean }>;
}

export interface ProviderTestResult {
  providerId: string;
  model: string;
  passed: boolean;
  costUsd: number;
  testedAt: string;
  detail: string;
}

export type ProviderTestsResponse = Record<string, ProviderTestResult>;
```
Run: `npm run typecheck && npm run build:web`
Expected: typecheck exits 0 with no `error TS` line (a `Cannot find module 'node:…'` error means `plan-route.ts` pulls in Node code: stop with `PLAN DRIFT: Task 45`); the build ends with `built in`.

Commit:
```bash
git add web/package.json package-lock.json web/src/components/ui web/src/lib/api-types.ts
git commit -m "feat(web): add the page libraries, shadcn components and API types" -m "Plan-task: 45"
```

### Task 46: Serve the page on demo data

Depends on: Task 44

Files:
- Create: `scripts/demo-ui.mjs`

Step 1: Create `scripts/demo-ui.mjs`

The design reviews and the page walkthroughs need history, stats and provider tests without touching the owner's home: the script builds a throwaway `HOME` with five decision lines timed relative to now (a done call, a `tests-failed` escalation, a `disabled` line, a provider test, and an old line without `provider`) and two provider test results, then starts `routemax ui` with that `HOME`. `routemax ui` seeds the live config there (Task 38). The Keychain is not under `HOME`: the key form stores into the owner's real Keychain, so the demo is never used to save a key.
```js
#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEMO_HOME = '/tmp/routemax-demo';
const HOUR_MS = 3_600_000;

const isoHoursAgo = (hours) => new Date(Date.now() - hours * HOUR_MS).toISOString();

function decision(hoursAgo, fields) {
  return {
    ts: isoHoursAgo(hoursAgo),
    cwd: '/Users/demo/code/shop-api',
    taskType: 'tests',
    requestedTier: 'flash-low',
    finalTier: 'flash-low',
    raisedBy: null,
    provider: 'deepseek',
    model: 'deepseek-flash',
    effort: 'low',
    costUsd: 0.0021,
    status: 'done',
    reason: null,
    durationMs: 41_000,
    retries: 0,
    inputTokens: 18_000,
    outputTokens: 2_400,
    cacheReadTokens: 9_000,
    cacheCreationTokens: 0,
    ...fields,
  };
}

const { provider: _dropped, ...withoutProvider } = decision(30, { cwd: '/Users/demo/code/blog', taskType: 'search', costUsd: 0.0009 });

const decisions = [
  withoutProvider,
  decision(5, { cwd: '/tmp/routemax-provider-test-demo', taskType: 'provider-test', costUsd: 0.0004, durationMs: 6_000 }),
  decision(3, {
    taskType: 'boilerplate',
    requestedTier: 'flash-high',
    finalTier: 'pro-high',
    raisedBy: 'keyword',
    model: 'deepseek-v4-pro',
    effort: 'high',
    costUsd: 0.0187,
    status: 'escalate',
    reason: 'tests-failed',
    retries: 2,
  }),
  decision(1, { cwd: '/Users/demo/code/blog', taskType: 'search', finalTier: 'claude', provider: null, model: 'opus', effort: 'high', costUsd: 0, status: 'disabled', durationMs: 0 }),
  decision(0.5, {}),
];

const providerTests = {
  deepseek: { providerId: 'deepseek', model: 'deepseek-flash', passed: true, costUsd: 0.0004, testedAt: isoHoursAgo(5), detail: 'The worker answered and the check passed.' },
  openrouter: { providerId: 'openrouter', model: 'qwen3-coder', passed: false, costUsd: 0, testedAt: isoHoursAgo(4), detail: 'HTTP 401 from the provider: the key was refused.' },
};

rmSync(DEMO_HOME, { recursive: true, force: true });
const delegateState = join(DEMO_HOME, '.local', 'state', 'deepseek-delegate');
const routemaxState = join(DEMO_HOME, '.local', 'state', 'routemax');
mkdirSync(delegateState, { recursive: true });
mkdirSync(routemaxState, { recursive: true });
writeFileSync(join(delegateState, 'decisions.jsonl'), decisions.map((line) => JSON.stringify(line)).join('\n') + '\n');
writeFileSync(join(routemaxState, 'provider-tests.json'), JSON.stringify(providerTests, null, 2) + '\n');

console.log(`demo HOME: ${DEMO_HOME} (do not store a real key through this page)`);
const demoEnv = { ...process.env, HOME: DEMO_HOME };
delete demoEnv.DEEPSEEK_DELEGATE_CONFIG;
const child = spawn(process.execPath, [join(ROOT, 'bin', 'routemax.mjs'), 'ui'], { stdio: 'inherit', env: demoEnv });
child.on('exit', (code) => process.exit(code ?? 0));
```
Run: `npm run build:web && ROUTEMAX_NO_OPEN=1 node scripts/demo-ui.mjs`, then in a second terminal `wc -l /tmp/routemax-demo/.local/state/deepseek-delegate/decisions.jsonl && ls /tmp/routemax-demo/.config/routemax`
Expected: the first terminal prints `demo HOME: /tmp/routemax-demo …` and `routemax ui: http://127.0.0.1:<port>/#token=<token>`; `wc` prints `5`; the live `config.json` exists under the demo home; `~/.local/state/deepseek-delegate/decisions.jsonl` in the real home is unchanged. Ctrl-C stops the server.

Commit:
```bash
git add scripts/demo-ui.mjs
git commit -m "chore(web): serve the page on demo data" -m "Plan-task: 46"
```

### Task 47: Frame the page in a shell with five sections

Depends on: Task 45, Task 46
Design: design-ui

Files:
- Create: `web/src/hooks/use-section.ts`
- Create: `web/src/components/app-shell.tsx`
- Modify: `web/src/app.tsx` (whole file)
- Modify: `web/src/index.css` (`@custom-variant dark`, `.dark`, `:root` token values)

Step 1: Pick the direction with the owner

Load design-ui, run `node scripts/demo-ui.mjs`, and render two or three directions over the shell of Steps 2-3 as that skill's rung 3 prescribes; the owner picks one. Replace `Direction: pending at rung 3` in this plan's `## Visual direction` with the pick in one line (the plan is untracked, so it stays out of the commit). No page task starts before the pick.
Run: none (the owner's pick is the result)
Expected: the `Direction:` line names the picked direction.

Step 2: Create `web/src/hooks/use-section.ts`

Sections are paths (`/overview`, `/history`, …): the static server answers any extension-less path with `index.html` (Task 25), so a reload or a copied link opens the same section, and `main.tsx` keeps the pathname when it strips the token.
```ts
import { useCallback, useEffect, useState } from 'react';

export const SECTIONS = ['overview', 'history', 'routing', 'providers', 'settings'] as const;
export type Section = (typeof SECTIONS)[number];

function sectionFromPath(pathname: string): Section {
  const name = pathname.replace(/^\/+|\/+$/g, '');
  return SECTIONS.find((section) => section === name) ?? 'overview';
}

export function useSection(): [Section, (next: Section) => void] {
  const [section, setSection] = useState<Section>(() => sectionFromPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setSection(sectionFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: Section) => {
    window.history.pushState(null, '', `/${next}`);
    setSection(next);
  }, []);

  return [section, navigate];
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 3: Create `web/src/components/app-shell.tsx` and replace `web/src/app.tsx`

`SECTION_PAGES` is the one registry each page task extends; a section without a page shows a plain line. A modified click (new tab, new window) keeps the browser's default.
```tsx
import type { MouseEvent, ReactNode } from 'react';
import { SECTIONS, type Section } from '@/hooks/use-section';
import { cn } from '@/lib/utils';

const SECTION_LABELS: Record<Section, string> = {
  overview: 'Overview',
  history: 'History',
  routing: 'Routing',
  providers: 'Providers',
  settings: 'Settings',
};

interface AppShellProps {
  section: Section;
  onNavigate: (next: Section) => void;
  children: ReactNode;
}

export function AppShell({ section, onNavigate, children }: AppShellProps) {
  function follow(event: MouseEvent<HTMLAnchorElement>, next: Section) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(next);
  }

  return (
    <div className="app-shell min-h-svh bg-background text-foreground">
      <header className="app-shell-header border-b">
        <div className="app-shell-bar mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <span className="app-shell-name font-semibold">routemax</span>
          <nav aria-label="Sections" className="app-shell-nav flex gap-1">
            {SECTIONS.map((name) => (
              <a
                key={name}
                href={`/${name}`}
                aria-current={name === section ? 'page' : undefined}
                onClick={(event) => follow(event, name)}
                className={cn(
                  'app-shell-link rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground',
                  name === section && 'bg-muted text-foreground',
                )}
              >
                {SECTION_LABELS[name]}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="app-shell-main mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
```
```tsx
import type { ComponentType } from 'react';
import { AppShell } from '@/components/app-shell';
import { type Section, useSection } from '@/hooks/use-section';

const SECTION_PAGES: Partial<Record<Section, ComponentType>> = {};

export function App() {
  const [section, navigate] = useSection();
  const Page = SECTION_PAGES[section];
  return (
    <AppShell section={section} onNavigate={navigate}>
      {Page === undefined ? <p className="text-muted-foreground">This section is not built yet.</p> : <Page />}
    </AppShell>
  );
}
```
Run: `npm run build:web`
Expected: the build ends with `built in`.

Step 4: Follow the system theme and write the picked tokens in `web/src/index.css`

Replace the line `@custom-variant dark (&:is(.dark *));` with:
```css
@custom-variant dark (@media (prefers-color-scheme: dark));
```
Move every declaration of the `.dark { … }` block, with the same variable names, into `@media (prefers-color-scheme: dark) { :root { … } }` and delete the `.dark` block. Set the `:root` values, the dark values and the font import to the picked direction; no other file holds a color, radius or font value.
Run: `npm run build:web && node scripts/demo-ui.mjs`, open the printed URL, click History, reload, press Back, then switch the system appearance between light and dark
Expected: the address bar reads `/history` after the click and the reload still shows History; Back returns to `/overview` with Overview marked as the current section; the page follows the system appearance with no toggle on the page; at 1280 px wide there is no horizontal scroll bar; `grep -c '\.dark' web/src/index.css` prints `0`.

Commit:
```bash
git add web/src/hooks/use-section.ts web/src/components/app-shell.tsx web/src/app.tsx web/src/index.css
git commit -m "feat(web): frame the page in a shell with five sections" -m "Plan-task: 47"
```

### Task 48: Switch the router from Overview

Depends on: Task 47
Design: design-ui

Files:
- Create: `web/src/lib/format.ts`
- Create: `web/src/features/overview/router-switch-card.tsx`
- Create: `web/src/features/overview/overview-page.tsx`
- Modify: `web/src/app.tsx` (`SECTION_PAGES`)

Step 1: Create `web/src/lib/format.ts`

Every page formats money, times and failures the same way; `$0.00` is how a `disabled` line's cost reads.
```ts
import { ApiError } from './api-client';

const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function formatUsd(amount: number): string {
  return usdFormat.format(amount);
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : timeFormat.format(date);
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'The routemax ui server did not answer. Check that it is still running.';
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 2: Create `web/src/features/overview/router-switch-card.tsx`

A failed save puts the switch back and says why. The copy tells the owner that an open session may still list `delegate` until it refreshes, while `delegate` itself already hands every call back to Claude (Task 17).
```tsx
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { SwitchResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';

type SwitchState =
  | { kind: 'loading' }
  | { kind: 'ready'; enabled: boolean; saving: boolean; error: string | null }
  | { kind: 'failed'; message: string };

export function RouterSwitchCard() {
  const [state, setState] = useState<SwitchState>({ kind: 'loading' });

  useEffect(() => {
    api
      .request<SwitchResponse>('GET', '/api/switch')
      .then(({ enabled }) => setState({ kind: 'ready', enabled, saving: false, error: null }))
      .catch((error: unknown) => setState({ kind: 'failed', message: describeError(error) }));
  }, []);

  async function changeSwitch(enabled: boolean) {
    if (state.kind !== 'ready') return;
    const previous = state.enabled;
    setState({ kind: 'ready', enabled, saving: true, error: null });
    try {
      const response = await api.request<SwitchResponse>('PUT', '/api/switch', { enabled });
      setState({ kind: 'ready', enabled: response.enabled, saving: false, error: null });
    } catch (error) {
      setState({ kind: 'ready', enabled: previous, saving: false, error: describeError(error) });
    }
  }

  return (
    <Card className="router-switch-card">
      <CardHeader>
        <CardTitle>Router</CardTitle>
        <CardDescription>
          {state.kind === 'ready' && state.enabled && 'On: Claude sessions hand tasks to delegate.'}
          {state.kind === 'ready' && !state.enabled && 'Off: every task stays on Claude.'}
          {state.kind === 'loading' && 'Loading…'}
        </CardDescription>
      </CardHeader>
      <CardContent className="router-switch-body flex flex-col gap-4">
        {state.kind === 'failed' ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : (
          <div className="router-switch-row flex items-center gap-3">
            <Switch
              id="router-switch"
              className="router-switch"
              checked={state.kind === 'ready' && state.enabled}
              disabled={state.kind !== 'ready' || state.saving}
              onCheckedChange={(checked: boolean) => void changeSwitch(checked)}
              aria-describedby="router-switch-note"
            />
            <Label htmlFor="router-switch">Route tasks to cheaper models</Label>
          </div>
        )}
        {state.kind === 'ready' && state.error !== null && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <p id="router-switch-note" className="router-switch-note text-sm text-muted-foreground">
          An open Claude session may keep showing delegate until it refreshes its tool list. While the router is off, delegate hands every call back to Claude.
        </p>
      </CardContent>
    </Card>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 3: Create `web/src/features/overview/overview-page.tsx` and register it in `web/src/app.tsx`
```tsx
import { RouterSwitchCard } from './router-switch-card';

export function OverviewPage() {
  return (
    <div className="overview-page grid gap-6">
      <RouterSwitchCard />
    </div>
  );
}
```
`web/src/app.tsx` must read:
```tsx
import type { ComponentType } from 'react';
import { AppShell } from '@/components/app-shell';
import { OverviewPage } from '@/features/overview/overview-page';
import { type Section, useSection } from '@/hooks/use-section';

const SECTION_PAGES: Partial<Record<Section, ComponentType>> = {
  overview: OverviewPage,
};

export function App() {
  const [section, navigate] = useSection();
  const Page = SECTION_PAGES[section];
  return (
    <AppShell section={section} onNavigate={navigate}>
      {Page === undefined ? <p className="text-muted-foreground">This section is not built yet.</p> : <Page />}
    </AppShell>
  );
}
```
Run: `npm run build:web && node scripts/demo-ui.mjs`, open the printed URL, turn the switch off, then `cat /tmp/routemax-demo/.local/state/deepseek-delegate/enabled` in a second terminal, then turn it on again
Expected: Overview shows the switch first and on; after turning it off the card reads `Off: every task stays on Claude.` and `cat` prints `off`; after turning it on it prints `on`; stopping the server and flipping the switch shows the red line `The routemax ui server did not answer. Check that it is still running.` with the switch back where it was.

Step 4: Review the switch

Run the project skills `interface-review` and `web-design-guidelines` on `router-switch-card.tsx` in the demo page (spec acceptance 12).
Run: `npm run build:web`
Expected: every finding is fixed in the four files of this task or named with a reason in the run report; the build ends with `built in`.

Commit:
```bash
git add web/src/lib/format.ts web/src/features/overview/router-switch-card.tsx web/src/features/overview/overview-page.tsx web/src/app.tsx
git commit -m "feat(web): switch the router from Overview" -m "Plan-task: 48"
```

### Task 49: Show spend and period stats on Overview

Depends on: Task 48
Design: design-ui

Files:
- Create: `web/src/features/overview/spend-card.tsx`
- Create: `web/src/features/overview/period-card.tsx`
- Modify: `web/src/features/overview/overview-page.tsx` (whole file)

Step 1: Create `web/src/features/overview/spend-card.tsx`

The bar fills up to the budget cap and stops at full when spend passes it.
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { StatsResponse } from '@/lib/api-types';
import { formatUsd } from '@/lib/format';

interface SpendCardProps {
  budget: StatsResponse['budget'];
  spendByProvider: StatsResponse['spendByProvider'];
}

export function SpendCard({ budget, spendByProvider }: SpendCardProps) {
  const usedPercent = budget.totalUsd > 0 ? Math.min(100, (budget.spentUsd / budget.totalUsd) * 100) : 100;
  const providers = Object.entries(spendByProvider).sort(([, left], [, right]) => right - left);

  return (
    <Card className="spend-card">
      <CardHeader>
        <CardTitle>Spend</CardTitle>
        <CardDescription>
          {formatUsd(budget.spentUsd)} of {formatUsd(budget.totalUsd)} spent, {formatUsd(budget.leftUsd)} left
        </CardDescription>
      </CardHeader>
      <CardContent className="spend-card-body flex flex-col gap-4">
        <Progress value={usedPercent} aria-label="Budget used" />
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No spend yet.</p>
        ) : (
          <dl className="spend-card-providers grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            {providers.map(([providerId, amount]) => (
              <div key={providerId} className="contents">
                <dt>{providerId}</dt>
                <dd className="text-right tabular-nums">{formatUsd(amount)}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 2: Create `web/src/features/overview/period-card.tsx`

One card per period: calls and cost, a row per tier, a bar per model through shadcn chart, and the escalation reasons.
```tsx
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { PeriodStats } from '@/lib/api-types';
import { formatUsd } from '@/lib/format';

const MODEL_CHART: ChartConfig = { costUsd: { label: 'Cost (USD)', color: 'var(--chart-1)' } };

interface PeriodCardProps {
  title: string;
  stats: PeriodStats;
}

export function PeriodCard({ title, stats }: PeriodCardProps) {
  const tiers = Object.entries(stats.byTier);
  const models = Object.entries(stats.byModel).map(([model, { calls, costUsd }]) => ({ model, calls, costUsd }));
  const escalations = Object.entries(stats.escalations);

  return (
    <Card className="period-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {stats.calls} {stats.calls === 1 ? 'call' : 'calls'}, {formatUsd(stats.costUsd)}
        </CardDescription>
      </CardHeader>
      <CardContent className="period-card-body flex flex-col gap-4">
        {stats.calls === 0 ? (
          <p className="text-sm text-muted-foreground">No calls in this period.</p>
        ) : (
          <>
            <section aria-label={`${title} by tier`}>
              <h3 className="period-card-heading text-sm font-medium">By tier</h3>
              <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm">
                {tiers.map(([tier, { calls, costUsd }]) => (
                  <div key={tier} className="contents">
                    <dt>{tier}</dt>
                    <dd className="text-right tabular-nums">{calls}</dd>
                    <dd className="text-right tabular-nums">{formatUsd(costUsd)}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section aria-label={`${title} cost by model`}>
              <h3 className="period-card-heading text-sm font-medium">By model</h3>
              <ChartContainer config={MODEL_CHART} className="period-card-chart h-40 w-full">
                <BarChart data={models} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="model" width={140} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="costUsd" fill="var(--color-costUsd)" radius={4} />
                </BarChart>
              </ChartContainer>
            </section>
            <section aria-label={`${title} escalations`}>
              <h3 className="period-card-heading text-sm font-medium">Escalations</h3>
              {escalations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No escalations.</p>
              ) : (
                <ul className="text-sm">
                  {escalations.map(([reason, count]) => (
                    <li key={reason}>
                      {reason}: {count}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 3: Load the stats in `web/src/features/overview/overview-page.tsx`
```tsx
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { StatsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';
import { PeriodCard } from './period-card';
import { RouterSwitchCard } from './router-switch-card';
import { SpendCard } from './spend-card';

type StatsState = { kind: 'loading' } | { kind: 'loaded'; stats: StatsResponse } | { kind: 'failed'; message: string };

export function OverviewPage() {
  const [statsState, setStatsState] = useState<StatsState>({ kind: 'loading' });

  useEffect(() => {
    api
      .request<StatsResponse>('GET', '/api/stats')
      .then((stats) => setStatsState({ kind: 'loaded', stats }))
      .catch((error: unknown) => setStatsState({ kind: 'failed', message: describeError(error) }));
  }, []);

  return (
    <div className="overview-page grid gap-6">
      <RouterSwitchCard />
      {statsState.kind === 'loading' && <p className="text-sm text-muted-foreground">Loading stats…</p>}
      {statsState.kind === 'failed' && (
        <Alert variant="destructive">
          <AlertDescription>{statsState.message}</AlertDescription>
        </Alert>
      )}
      {statsState.kind === 'loaded' && (
        <div className="overview-stats grid gap-6 lg:grid-cols-3">
          <SpendCard budget={statsState.stats.budget} spendByProvider={statsState.stats.spendByProvider} />
          <PeriodCard title="Today" stats={statsState.stats.today} />
          <PeriodCard title="This week" stats={statsState.stats.week} />
        </div>
      )}
    </div>
  );
}
```
Run: `npm run build:web && node scripts/demo-ui.mjs`, open the printed URL
Expected: below the switch, Spend shows the budget bar and one row per provider (`deepseek`); Today and This week show the calls and cost of the demo lines dated in each period, a row per tier, a bar per model, and This week lists `tests-failed: 1` under Escalations; the page has no horizontal scroll bar at 1280 px.

Commit:
```bash
git add web/src/features/overview/spend-card.tsx web/src/features/overview/period-card.tsx web/src/features/overview/overview-page.tsx
git commit -m "feat(web): show spend and period stats on Overview" -m "Plan-task: 49"
```

### Task 50: Show doctor health on Overview and refresh it every 30 seconds

Depends on: Task 49
Design: design-ui

Files:
- Create: `web/src/hooks/use-poll.ts`
- Create: `web/src/features/overview/health-card.tsx`
- Modify: `web/src/features/overview/overview-page.tsx` (whole file)

Step 1: Create `web/src/hooks/use-poll.ts`

It loads at once, then every 30 seconds while the tab is visible, and again when the tab gets focus or becomes visible. A failed refresh keeps the last value and adds the error. `load` must be a module-level function, because a new function per render restarts the poll.
```ts
import { useCallback, useEffect, useState } from 'react';
import { describeError } from '@/lib/format';

export type PollState<T> =
  | { kind: 'loading' }
  | { kind: 'loaded'; value: T; error: string | null }
  | { kind: 'failed'; message: string };

const POLL_INTERVAL_MS = 30_000;

export function usePoll<T>(load: () => Promise<T>): { state: PollState<T>; refresh: () => void } {
  const [state, setState] = useState<PollState<T>>({ kind: 'loading' });

  const refresh = useCallback(() => {
    load().then(
      (value) => setState({ kind: 'loaded', value, error: null }),
      (error: unknown) =>
        setState((previous) =>
          previous.kind === 'loaded' ? { ...previous, error: describeError(error) } : { kind: 'failed', message: describeError(error) },
        ),
    );
  }, [load]);

  useEffect(() => {
    refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const timer = window.setInterval(refreshWhenVisible, POLL_INTERVAL_MS);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh]);

  return { state, refresh };
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 2: Create `web/src/features/overview/health-card.tsx`
```tsx
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DoctorResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { usePoll } from '@/hooks/use-poll';

const loadDoctor = () => api.request<DoctorResponse>('GET', '/api/doctor');

export function HealthCard() {
  const { state, refresh } = usePoll(loadDoctor);
  const failing = state.kind === 'loaded' ? state.value.checks.filter((check) => !check.ok).length : 0;

  return (
    <Card className="health-card">
      <CardHeader>
        <CardTitle>Health</CardTitle>
        <CardDescription>
          {state.kind === 'loading' && 'Running the checks…'}
          {state.kind === 'loaded' && (failing === 0 ? 'All checks pass.' : `${failing} ${failing === 1 ? 'check fails' : 'checks fail'}.`)}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={refresh}>
            Run again
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="health-card-body flex flex-col gap-3">
        {state.kind === 'failed' && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        {state.kind === 'loaded' && state.error !== null && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        {state.kind === 'loaded' && (
          <ul className="health-card-checks flex flex-col gap-2 text-sm">
            {state.value.checks.map((check) => (
              <li key={check.name} className="flex items-start gap-3">
                <Badge variant={check.ok ? 'secondary' : 'destructive'}>{check.ok ? 'ok' : 'fail'}</Badge>
                <span>
                  <span className="font-medium">{check.name}</span>: {check.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0 (a missing `CardAction` export in the generated `card.tsx` means the base-nova card differs: move the button into `CardContent` instead).

Step 3: Poll the stats too and add the health card in `web/src/features/overview/overview-page.tsx`
```tsx
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePoll } from '@/hooks/use-poll';
import type { StatsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { HealthCard } from './health-card';
import { PeriodCard } from './period-card';
import { RouterSwitchCard } from './router-switch-card';
import { SpendCard } from './spend-card';

const loadStats = () => api.request<StatsResponse>('GET', '/api/stats');

export function OverviewPage() {
  const { state: statsState } = usePoll(loadStats);

  return (
    <div className="overview-page grid gap-6">
      <RouterSwitchCard />
      {statsState.kind === 'loading' && <p className="text-sm text-muted-foreground">Loading stats…</p>}
      {statsState.kind === 'failed' && (
        <Alert variant="destructive">
          <AlertDescription>{statsState.message}</AlertDescription>
        </Alert>
      )}
      {statsState.kind === 'loaded' && (
        <div className="overview-stats grid gap-6 lg:grid-cols-3">
          {statsState.error !== null && (
            <Alert variant="destructive" className="lg:col-span-3">
              <AlertDescription>{statsState.error}</AlertDescription>
            </Alert>
          )}
          <SpendCard budget={statsState.value.budget} spendByProvider={statsState.value.spendByProvider} />
          <PeriodCard title="Today" stats={statsState.value.today} />
          <PeriodCard title="This week" stats={statsState.value.week} />
        </div>
      )}
      <HealthCard />
    </div>
  );
}
```
Run: `npm run build:web && node scripts/demo-ui.mjs`, open the printed URL, append one line to the demo `decisions.jsonl` (copy the last line with a new `ts`), wait 30 seconds, then switch to another tab and back
Expected: Health lists every doctor check with `ok` or `fail`; within 30 seconds of the append Today counts one more call; returning to the tab reloads both without a page reload; `Run again` reruns the checks.

Commit:
```bash
git add web/src/hooks/use-poll.ts web/src/features/overview/health-card.tsx web/src/features/overview/overview-page.tsx
git commit -m "feat(web): show doctor health on Overview and refresh every 30 seconds" -m "Plan-task: 50"
```

### Task 51: List every routing decision on History

Depends on: Task 50
Design: design-ui

Files:
- Create: `web/src/features/history/history-table.tsx`
- Create: `web/src/features/history/history-page.tsx`
- Modify: `web/src/app.tsx` (`SECTION_PAGES`)

Step 1: Create `web/src/features/history/history-table.tsx`

TanStack Table 9.2.4 API as read from its packed types (Phase 7 design, Session 7): features and row models are passed per table, and sort and filter functions are named imports. No filter is set at start, so `disabled` lines always show until the owner filters them out. Statuses stay raw. The `initialState` option name is not confirmed for v9, so the page passes the records newest first and the table starts unsorted. If `tsc` rejects the plain column array, wrap it in `columnHelper.columns([…])`.
```tsx
import {
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  columnFilteringFeature,
  filterFn_equalsString,
  flexRender,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DecisionRecord } from '@/lib/api-types';
import { formatTime, formatUsd } from '@/lib/format';

export interface HistoryRow extends DecisionRecord {
  project: string;
  modelName: string;
}

const features = tableFeatures({ rowSortingFeature, columnFilteringFeature });
const columnHelper = createColumnHelper<typeof features, HistoryRow>();
const FILTERED_COLUMNS = ['project', 'status', 'modelName'] as const;

const columns = [
  columnHelper.accessor('ts', { header: 'Time', sortFn: sortFn_text, cell: (cell) => formatTime(cell.getValue()) }),
  columnHelper.accessor('project', { header: 'Project', sortFn: sortFn_text, filterFn: filterFn_equalsString }),
  columnHelper.accessor('taskType', { header: 'Task type', sortFn: sortFn_text }),
  columnHelper.accessor('finalTier', { header: 'Tier', sortFn: sortFn_text }),
  columnHelper.accessor('modelName', { header: 'Model', sortFn: sortFn_text, filterFn: filterFn_equalsString }),
  columnHelper.accessor('status', { header: 'Status', sortFn: sortFn_text, filterFn: filterFn_equalsString }),
  columnHelper.accessor('reason', { header: 'Reason', sortFn: sortFn_text, cell: (cell) => cell.getValue() ?? '' }),
  columnHelper.accessor('costUsd', { header: 'Cost', sortFn: sortFn_basic, cell: (cell) => formatUsd(cell.getValue()) }),
];

function sortMark(sorted: false | 'asc' | 'desc'): string {
  if (sorted === 'asc') return ' ↑';
  if (sorted === 'desc') return ' ↓';
  return '';
}

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const table = useTable({
    _features: features,
    _rowModels: { sortedRowModel: createSortedRowModel(), filteredRowModel: createFilteredRowModel() },
    columns,
    data: rows,
  });
  const options = useMemo(
    () => Object.fromEntries(FILTERED_COLUMNS.map((key) => [key, [...new Set(rows.map((row) => row[key]))].sort()])),
    [rows],
  );

  return (
    <Table className="history-table">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const filterValues: string[] | undefined = options[header.column.id];
              return (
                <TableHead key={header.id} className="history-table-head align-top">
                  <button type="button" className="history-table-sort font-medium" onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sortMark(header.column.getIsSorted())}
                  </button>
                  {filterValues !== undefined && (
                    <select
                      aria-label={`Filter by ${header.column.id === 'modelName' ? 'model' : header.column.id}`}
                      className="history-table-filter mt-1 block w-full rounded-md border bg-background px-1 py-0.5 text-sm"
                      value={String(header.column.getFilterValue() ?? '')}
                      onChange={(event) => header.column.setFilterValue(event.target.value === '' ? undefined : event.target.value)}
                    >
                      <option value="">All</option>
                      {filterValues.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id} className={cell.column.id === 'costUsd' ? 'text-right tabular-nums' : undefined}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 2: Create `web/src/features/history/history-page.tsx` and register it in `web/src/app.tsx`

The project is the last segment of the call's `cwd`; a line without a model reads `none`.
```tsx
import { useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePoll } from '@/hooks/use-poll';
import type { DecisionRecord, HistoryResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { HistoryTable, type HistoryRow } from './history-table';

const loadHistory = () => api.request<HistoryResponse>('GET', '/api/history');

function toRow(record: DecisionRecord): HistoryRow {
  const project = record.cwd.split('/').filter(Boolean).at(-1) ?? record.cwd;
  return { ...record, project, modelName: record.model ?? 'none' };
}

export function HistoryPage() {
  const { state } = usePoll(loadHistory);
  const rows = useMemo(() => (state.kind === 'loaded' ? state.value.records.map(toRow).reverse() : []), [state]);

  return (
    <div className="history-page flex flex-col gap-4">
      <h1 className="text-lg font-semibold">History</h1>
      {state.kind === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
      {state.kind === 'failed' && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.kind === 'loaded' && state.error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.kind === 'loaded' &&
        (rows.length === 0 ? <p className="text-sm text-muted-foreground">No calls logged yet.</p> : <HistoryTable rows={rows} />)}
    </div>
  );
}
```
`web/src/app.tsx` must read:
```tsx
import type { ComponentType } from 'react';
import { AppShell } from '@/components/app-shell';
import { HistoryPage } from '@/features/history/history-page';
import { OverviewPage } from '@/features/overview/overview-page';
import { type Section, useSection } from '@/hooks/use-section';

const SECTION_PAGES: Partial<Record<Section, ComponentType>> = {
  overview: OverviewPage,
  history: HistoryPage,
};

export function App() {
  const [section, navigate] = useSection();
  const Page = SECTION_PAGES[section];
  return (
    <AppShell section={section} onNavigate={navigate}>
      {Page === undefined ? <p className="text-muted-foreground">This section is not built yet.</p> : <Page />}
    </AppShell>
  );
}
```
Run: `npm run build:web && node scripts/demo-ui.mjs`, open the printed URL at `/history`, pick `disabled` under Status, clear it, pick `blog` under Project, then click the Cost header twice
Expected: five rows, newest first; the `disabled` row shows `opus`, tier `claude` and `$0.00` without any filter set; the Status filter leaves only that row; the Project filter leaves the two `blog` rows; Cost sorts ascending then descending with ` ↑` and ` ↓`; the line without `provider` is listed; no horizontal scroll bar at 1280 px.

Step 3: Review the table

Run the project skills `interface-review` and `web-design-guidelines` on `history-table.tsx` in the demo page (spec acceptance 12).
Run: `npm run build:web`
Expected: every finding is fixed in the three files of this task or named with a reason in the run report; the build ends with `built in`.

Commit:
```bash
git add web/src/features/history/history-table.tsx web/src/features/history/history-page.tsx web/src/app.tsx
git commit -m "feat(web): list every routing decision on History" -m "Plan-task: 51"
```

### Task 52: Load, save and restore the live config in a shared form

Depends on: Task 51
Design: design-ui

Files:
- Create: `web/src/hooks/use-config-form.ts`
- Create: `web/src/components/save-bar.tsx`

Step 1: Create `web/src/hooks/use-config-form.ts`

Routing, Providers and Settings each edit the whole live config through one react-hook-form instance and save it with the hash they loaded (Phase 5 notes: 409 `stale`, 422 `invalid`). The resolver runs the same `configSchema` the server runs; when it refuses, the issues shown are `configIssues(getValues())`, the server's own wording. Warnings never pass through here, so they cannot block a save.
```ts
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { ApiError } from '@/lib/api-client';
import type { ConfigResponse, DelegateConfig, SaveResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';
import { configIssues, configSchema } from '../../../src/config/config-schema';

export type ConfigFormValues = z.input<typeof configSchema>;
export type ConfigForm = UseFormReturn<ConfigFormValues, unknown, DelegateConfig>;

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; chezmoiMessage: string }
  | { kind: 'stale' }
  | { kind: 'invalid'; issues: string[] }
  | { kind: 'failed'; message: string };

interface LoadedBase {
  hash: string;
  previousExists: boolean;
}

const loadConfig = () => api.request<ConfigResponse>('GET', '/api/config');

function failureState(error: unknown): SaveState {
  if (error instanceof ApiError && error.status === 409) return { kind: 'stale' };
  if (error instanceof ApiError && error.status === 422) return { kind: 'invalid', issues: error.issues };
  return { kind: 'failed', message: describeError(error) };
}

export function useConfigForm() {
  const form = useForm<ConfigFormValues, unknown, DelegateConfig>({ resolver: zodResolver(configSchema) });
  const [base, setBase] = useState<LoadedBase | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });

  const reload = useCallback(() => {
    loadConfig().then(
      (response) => {
        form.reset(response.config);
        setBase({ hash: response.hash, previousExists: response.previousExists });
        setLoadError(null);
        setSaveState({ kind: 'idle' });
      },
      (error: unknown) => setLoadError(describeError(error)),
    );
  }, [form]);

  useEffect(reload, [reload]);

  const save = form.handleSubmit(
    async (config) => {
      if (base === null) return;
      setSaveState({ kind: 'saving' });
      try {
        const response = await api.request<SaveResponse>('PUT', '/api/config', { config, baseHash: base.hash });
        form.reset(config);
        setBase({ hash: response.hash, previousExists: true });
        setSaveState({ kind: 'saved', chezmoiMessage: response.chezmoi.message });
      } catch (error) {
        setSaveState(failureState(error));
      }
    },
    () => setSaveState({ kind: 'invalid', issues: configIssues(form.getValues()) }),
  );

  const restore = useCallback(async () => {
    if (base === null) return;
    setSaveState({ kind: 'saving' });
    try {
      const response = await api.request<SaveResponse>('POST', '/api/config/restore', { baseHash: base.hash });
      const fresh = await loadConfig();
      form.reset(fresh.config);
      setBase({ hash: fresh.hash, previousExists: fresh.previousExists });
      setSaveState({ kind: 'saved', chezmoiMessage: response.chezmoi.message });
    } catch (error) {
      setSaveState(failureState(error));
    }
  }, [base, form]);

  return { form, ready: base !== null, previousExists: base?.previousExists ?? false, loadError, saveState, save, restore, reload };
}
```
Run: `npm run typecheck`
Expected: exit code 0 (a resolver type error on `zodResolver(configSchema)` means `@hookform/resolvers` 5.9.1 infers other form types than planned: stop with `PLAN DRIFT: Task 52`).

Step 2: Create `web/src/components/save-bar.tsx`

The bar sits at the bottom of every config page. Warnings show above the buttons and never disable Save (spec acceptance 10).
```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { SaveState } from '@/hooks/use-config-form';

interface SaveBarProps {
  saveState: SaveState;
  dirty: boolean;
  previousExists: boolean;
  warnings?: string[];
  onSave: () => void;
  onRestore: () => void;
  onReload: () => void;
}

function SaveStatus({ saveState, onReload }: { saveState: SaveState; onReload: () => void }) {
  switch (saveState.kind) {
    case 'idle':
      return null;
    case 'saving':
      return <p className="save-bar-status text-sm text-muted-foreground">Saving…</p>;
    case 'saved':
      return <p className="save-bar-status text-sm">Saved. {saveState.chezmoiMessage}</p>;
    case 'stale':
      return (
        <Alert variant="destructive">
          <AlertTitle>The config changed since this page loaded it</AlertTitle>
          <AlertDescription>
            Nothing was saved. Reload to see the current version; the edits on this page are then lost.
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onReload}>
              Reload
            </Button>
          </AlertDescription>
        </Alert>
      );
    case 'invalid':
      return (
        <Alert variant="destructive">
          <AlertTitle>Not saved: fix these fields first</AlertTitle>
          <AlertDescription>
            <ul className="save-bar-issues list-disc pl-4">
              {saveState.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      );
    case 'failed':
      return (
        <Alert variant="destructive">
          <AlertDescription>{saveState.message}</AlertDescription>
        </Alert>
      );
  }
}

export function SaveBar({ saveState, dirty, previousExists, warnings = [], onSave, onRestore, onReload }: SaveBarProps) {
  const busy = saveState.kind === 'saving';
  return (
    <div className="save-bar sticky bottom-0 flex flex-col gap-2 border-t bg-background py-3">
      {warnings.length > 0 && (
        <Alert className="save-bar-warnings">
          <AlertTitle>Check before saving</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <SaveStatus saveState={saveState} onReload={onReload} />
      <div className="save-bar-actions flex items-center gap-2">
        <Button type="button" onClick={onSave} disabled={!dirty || busy}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onRestore} disabled={!previousExists || busy}>
          Restore previous version
        </Button>
        {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
      </div>
    </div>
  );
}
```
Run: `npm run typecheck && npm run build:web`
Expected: typecheck exits 0; the build ends with `built in`. The bar is seen on a page from Task 53 on.

Commit:
```bash
git add web/src/hooks/use-config-form.ts web/src/components/save-bar.tsx
git commit -m "feat(web): load, save and restore the live config in a shared form" -m "Plan-task: 52"
```

### Task 53: Edit the routing rules on Routing

Depends on: Task 52
Design: design-ui

Files:
- Create: `web/src/features/routing/list-input.tsx`
- Create: `web/src/features/routing/rule-editor.tsx`
- Create: `web/src/features/routing/routing-page.tsx`
- Modify: `web/src/app.tsx` (`SECTION_PAGES`)

Step 1: Create `web/src/features/routing/list-input.tsx`

A comma-separated text field over a string array. It keeps the typed text while the owner types, so a trailing comma is not stripped mid-word, and takes the form's value again after a reload or a restore.
```tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface ListInputProps {
  id: string;
  value: string[] | undefined;
  onChange: (next: string[]) => void;
}

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

export function ListInput({ id, value, onChange }: ListInputProps) {
  const joined = (value ?? []).join(', ');
  const [text, setText] = useState(joined);
  const [shownJoined, setShownJoined] = useState(joined);
  if (joined !== shownJoined) {
    setShownJoined(joined);
    setText(joined);
  }
  return (
    <Input
      id={id}
      value={text}
      onChange={(event) => {
        const next = splitList(event.target.value);
        setText(event.target.value);
        setShownJoined(next.join(', '));
        onChange(next);
      }}
    />
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 2: Create `web/src/features/routing/rule-editor.tsx`

`routeTask` raises a task to the highest tier among the rules it matches, and on a tie the first rule is the one named (`src/routing/route-task.ts`), so order only decides the `raisedBy` name; the copy says so. The rule objects carry their own `id`, so the field array keys on `fieldKey` to leave `id` alone. The tier select is a native select like the History filters.
```tsx
import { Controller, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import { TIER_ORDER } from '../../../../src/config/config-schema';
import { ListInput } from './list-input';

const LIST_FIELDS = [
  ['taskTypes', 'Task types'],
  ['keywords', 'Keywords in the task'],
  ['keywordExemptTaskTypes', 'Task types exempt from keywords'],
  ['flags', 'Flags'],
] as const;

export function RuleEditor({ form }: { form: ConfigForm }) {
  const { fields, append, move, remove } = useFieldArray({ control: form.control, name: 'rules', keyName: 'fieldKey' });

  return (
    <section className="rule-editor flex flex-col gap-3">
      <h2 className="text-base font-semibold">Rules</h2>
      <p className="text-sm text-muted-foreground">
        A task goes to the highest tier among the rules it matches. When two rules raise it to the same tier, the upper one is named in History.
      </p>
      {fields.map((field, index) => (
        <fieldset key={field.fieldKey} className="rule-editor-rule grid grid-cols-2 gap-3 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Rule {index + 1}</legend>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`rule-${index}-id`}>Name</Label>
            <Input id={`rule-${index}-id`} {...form.register(`rules.${index}.id`)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`rule-${index}-tier`}>Raise to tier</Label>
            <select id={`rule-${index}-tier`} className="rule-editor-select rounded-md border bg-background px-2 py-1 text-sm" {...form.register(`rules.${index}.tier`)}>
              {TIER_ORDER.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>
          {LIST_FIELDS.map(([name, label]) => (
            <div key={name} className="flex flex-col gap-1">
              <Label htmlFor={`rule-${index}-${name}`}>{label}</Label>
              <Controller
                control={form.control}
                name={`rules.${index}.${name}`}
                render={({ field: listField }) => <ListInput id={`rule-${index}-${name}`} value={listField.value} onChange={listField.onChange} />}
              />
            </div>
          ))}
          <div className="rule-editor-actions col-span-2 flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => move(index, index - 1)}>
              Move up
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>
              Move down
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
              Remove rule
            </Button>
          </div>
        </fieldset>
      ))}
      <Button type="button" variant="outline" className="self-start" onClick={() => append({ id: '', taskTypes: [], keywords: [], keywordExemptTaskTypes: [], flags: [], tier: 'flash-low' })}>
        Add rule
      </Button>
    </section>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0 (`keyName` is deprecated in react-hook-form 7 but still typed; a type error on it stops with `PLAN DRIFT: Task 53`).

Step 3: Create `web/src/features/routing/routing-page.tsx` and register it in `web/src/app.tsx`
```tsx
import { SaveBar } from '@/components/save-bar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfigForm } from '@/hooks/use-config-form';
import { RuleEditor } from './rule-editor';

export function RoutingPage() {
  const { form, ready, previousExists, loadError, saveState, save, restore, reload } = useConfigForm();

  return (
    <div className="routing-page flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Routing</h1>
      {loadError !== null && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {!ready && loadError === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {ready && (
        <>
          <RuleEditor form={form} />
          <SaveBar
            saveState={saveState}
            dirty={form.formState.isDirty}
            previousExists={previousExists}
            onSave={() => void save()}
            onRestore={() => void restore()}
            onReload={reload}
          />
        </>
      )}
    </div>
  );
}
```
`web/src/app.tsx`: add `import { RoutingPage } from '@/features/routing/routing-page';` after the `OverviewPage` import, and `routing: RoutingPage,` after `history: HistoryPage,` in `SECTION_PAGES`.
Run: `npm run build:web && node scripts/demo-ui.mjs`, open the printed URL at `/routing`; move `build-with-spec` up and click Save; reload the browser tab; clear the Name of rule 1 and click Save; reload the tab, then open `/routing` in a second tab, save a change there, and click Save in the first tab
Expected: four rules as in `config/routing.json`; after the first Save a `Saved.` line with the chezmoi sentence (the demo home has no chezmoi source) and, after the tab reload, `build-with-spec` is still second; the empty name shows `Not saved: fix these fields first` with a line starting `rules.0.id:` and the file under `/tmp/routemax-demo/.config/routemax` unchanged; the second-tab save leaves the first tab with `The config changed since this page loaded it` and a Reload button that brings in the second tab's change.

Step 4: Review the rule editor

Run the project skills `interface-review` and `web-design-guidelines` on `rule-editor.tsx` in the demo page (spec acceptance 12).
Run: `npm run build:web`
Expected: every finding is fixed in the files of this task or named with a reason in the run report; the build ends with `built in`.

Commit:
```bash
git add web/src/features/routing/list-input.tsx web/src/features/routing/rule-editor.tsx web/src/features/routing/routing-page.tsx web/src/app.tsx
git commit -m "feat(web): edit the routing rules on Routing" -m "Plan-task: 53"
```

### Task 54: Pick each tier's provider, model and effort, with test warnings

Depends on: Task 53
Design: design-ui

Files:
- Create: `web/src/features/routing/tier-warnings.test.ts`
- Create: `web/src/features/routing/tier-warnings.ts`
- Create: `web/src/features/routing/tier-editor.tsx`
- Modify: `web/src/features/routing/routing-page.tsx`

Step 1: Write the failing test `web/src/features/routing/tier-warnings.test.ts`

Relative imports only, so the root vitest (no `@` alias) runs it as it runs `web/src/lib/api-client.test.ts`.
```ts
import { describe, expect, it } from 'vitest';
import type { ProviderTestResult } from '../../lib/api-types';
import { tierWarnings } from './tier-warnings';

const passed: ProviderTestResult = {
  providerId: 'deepseek',
  model: 'deepseek-flash',
  passed: true,
  costUsd: 0.0004,
  testedAt: '2026-09-25T10:00:00.000Z',
  detail: 'The worker answered and the check passed.',
};
const failed: ProviderTestResult = { ...passed, providerId: 'openrouter', model: 'qwen3-coder', passed: false, costUsd: 0, detail: 'HTTP 401 from the provider: the key was refused.' };

describe('tierWarnings', () => {
  it('warns nothing for tiers on a provider whose last test passed', () => {
    expect(tierWarnings({ 'flash-low': { provider: 'deepseek' }, 'pro-high': { provider: 'deepseek' } }, { deepseek: passed })).toEqual([]);
  });

  it('warns for a tier on a provider that was never tested', () => {
    expect(tierWarnings({ 'flash-low': { provider: 'openrouter' } }, { deepseek: passed })).toEqual([
      'flash-low uses openrouter, which has never been tested. Run a test on the Providers page.',
    ]);
  });

  it('warns with the detail for a tier on a provider whose last test failed', () => {
    expect(tierWarnings({ 'flash-high': { provider: 'openrouter' } }, { deepseek: passed, openrouter: failed })).toEqual([
      'flash-high uses openrouter, whose last test failed: HTTP 401 from the provider: the key was refused.',
    ]);
  });

  it('treats a provider named like an object property as never tested', () => {
    expect(tierWarnings({ 'flash-low': { provider: 'constructor' } }, {})).toEqual([
      'flash-low uses constructor, which has never been tested. Run a test on the Providers page.',
    ]);
  });
});
```
Run: `npm test -- web/src/features/routing/tier-warnings.test.ts`
Expected: fails with `Failed to resolve import "./tier-warnings"`.

Step 2: Create `web/src/features/routing/tier-warnings.ts`
```ts
import type { ProviderTestsResponse } from '../../lib/api-types';

export function tierWarnings(tiers: Record<string, { provider: string }>, tests: ProviderTestsResponse): string[] {
  return Object.entries(tiers).flatMap(([tierName, tier]) => {
    const result = Object.hasOwn(tests, tier.provider) ? tests[tier.provider] : undefined;
    if (result === undefined) return [`${tierName} uses ${tier.provider}, which has never been tested. Run a test on the Providers page.`];
    if (!result.passed) return [`${tierName} uses ${tier.provider}, whose last test failed: ${result.detail}`];
    return [];
  });
}
```
Run: `npm test -- web/src/features/routing/tier-warnings.test.ts`
Expected: `4 passed`.

Step 3: Create `web/src/features/routing/tier-editor.tsx`

Changing a tier's provider sets its model to that provider's first model, so the model select never holds a model of another provider.
```tsx
import { useWatch } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

const WORKER_TIERS = ['flash-low', 'flash-high', 'pro-high'] as const;
const SELECT_CLASS = 'tier-editor-select rounded-md border bg-background px-2 py-1 text-sm';

export function TierEditor({ form }: { form: ConfigForm }) {
  const providers = useWatch({ control: form.control, name: 'providers' }) ?? {};
  const tiers = useWatch({ control: form.control, name: 'tiers' });
  const modelsOf = (providerId: string) => (Object.hasOwn(providers, providerId) ? Object.keys(providers[providerId].models) : []);

  return (
    <section className="tier-editor flex flex-col gap-3">
      <h2 className="text-base font-semibold">Tiers</h2>
      <p className="text-sm text-muted-foreground">Each worker tier runs on one provider and model. Claude tasks go to the agents below.</p>
      {WORKER_TIERS.map((tierName) => (
        <div key={tierName} className="tier-editor-row grid grid-cols-[8rem_1fr_1fr_8rem] items-end gap-3">
          <span className="font-medium">{tierName}</span>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`tier-${tierName}-provider`}>Provider</Label>
            <select
              id={`tier-${tierName}-provider`}
              className={SELECT_CLASS}
              {...form.register(`tiers.${tierName}.provider`, {
                onChange: (event: { target: { value: string } }) =>
                  form.setValue(`tiers.${tierName}.model`, modelsOf(event.target.value)[0] ?? '', { shouldDirty: true }),
              })}
            >
              {Object.entries(providers).map(([providerId, provider]) => (
                <option key={providerId} value={providerId}>
                  {provider.enabled ? provider.name : `${provider.name} (disabled)`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`tier-${tierName}-model`}>Model</Label>
            <select id={`tier-${tierName}-model`} className={SELECT_CLASS} {...form.register(`tiers.${tierName}.model`)}>
              {modelsOf(tiers?.[tierName]?.provider ?? '').map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`tier-${tierName}-effort`}>Effort</Label>
            <select id={`tier-${tierName}-effort`} className={SELECT_CLASS} {...form.register(`tiers.${tierName}.effort`)}>
              {EFFORT_ORDER.map((effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </section>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 4: Show the tiers and their warnings in `web/src/features/routing/routing-page.tsx`

Add these imports after `import { useConfigForm } from '@/hooks/use-config-form';`:
```tsx
import { usePoll } from '@/hooks/use-poll';
import type { ProviderTestsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { useWatch } from 'react-hook-form';
import { TierEditor } from './tier-editor';
import { tierWarnings } from './tier-warnings';

const loadProviderTests = () => api.request<ProviderTestsResponse>('GET', '/api/provider-tests');
```
In `RoutingPage`, after the `useConfigForm()` line, add:
```tsx
  const tests = usePoll(loadProviderTests).state;
  const tiers = useWatch({ control: form.control, name: 'tiers' });
  const warnings = tiers === undefined || tests.kind !== 'loaded' ? [] : tierWarnings(tiers, tests.value);
```
Replace `<RuleEditor form={form} />` with:
```tsx
          <TierEditor form={form} />
          <RuleEditor form={form} />
```
and add `warnings={warnings}` to the `SaveBar` props after `previousExists={previousExists}`.
Run: `npm run typecheck && npm run build:web && node scripts/demo-ui.mjs`, open `/routing`, set `flash-low` to effort `medium`, click Save
Expected: three tier rows on DeepSeek with the models of `config/routing.json`; no `Check before saving` block (the demo's deepseek test passed); the save shows `Saved.`. The openrouter half of acceptance 10 is in Final verification: the demo's openrouter provider has no models until the Providers page adds one.

Commit:
```bash
git add web/src/features/routing/tier-warnings.test.ts web/src/features/routing/tier-warnings.ts web/src/features/routing/tier-editor.tsx web/src/features/routing/routing-page.tsx
git commit -m "feat(web): pick each tier's provider, model and effort with test warnings" -m "Plan-task: 54"
```

### Task 55: Edit the effort map and the Claude agents on Routing

Depends on: Task 54
Design: design-ui

Files:
- Create: `web/src/features/routing/effort-map-editor.tsx`
- Create: `web/src/features/routing/claude-agents-editor.tsx`
- Modify: `web/src/features/routing/routing-page.tsx`

Step 1: Create `web/src/features/routing/effort-map-editor.tsx`

`effortMap` is a record keyed by the effort enum, so every effort has a row and each key is a plain word that `register` can path into.
```tsx
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

export function EffortMapEditor({ form }: { form: ConfigForm }) {
  return (
    <section className="effort-map-editor flex flex-col gap-3">
      <h2 className="text-base font-semibold">Effort map</h2>
      <p className="text-sm text-muted-foreground">The effort a task asks for on Claude, and the worker effort it maps to.</p>
      <div className="effort-map-editor-grid grid grid-cols-5 gap-3">
        {EFFORT_ORDER.map((claudeEffort) => (
          <div key={claudeEffort} className="flex flex-col gap-1">
            <Label htmlFor={`effort-map-${claudeEffort}`}>{claudeEffort}</Label>
            <select id={`effort-map-${claudeEffort}`} className="effort-map-editor-select rounded-md border bg-background px-2 py-1 text-sm" {...form.register(`effortMap.${claudeEffort}`)}>
              {EFFORT_ORDER.map((workerEffort) => (
                <option key={workerEffort} value={workerEffort}>
                  {workerEffort}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 2: Create `web/src/features/routing/claude-agents-editor.tsx`

Agent names and task types are record keys that can hold a dot, which `register` would read as a nested path, so both records go through one `Controller` each and change by copy. A new agent starts with an empty model, which the save check names until the owner fills it in.
```tsx
import { useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER, type Effort } from '../../../../src/config/config-schema';

const SELECT_CLASS = 'claude-agents-editor-select rounded-md border bg-background px-2 py-1 text-sm';

export function ClaudeAgentsEditor({ form }: { form: ConfigForm }) {
  const agents = useWatch({ control: form.control, name: 'claude.agents' }) ?? {};
  const agentNames = Object.keys(agents);
  const [newAgent, setNewAgent] = useState('');
  const [newTaskType, setNewTaskType] = useState('');

  return (
    <section className="claude-agents-editor flex flex-col gap-3">
      <h2 className="text-base font-semibold">Claude agents</h2>
      <p className="text-sm text-muted-foreground">Tasks on the claude tier go to the agent named for their task type, or to the default agent.</p>
      <Controller
        control={form.control}
        name="claude.agents"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            {Object.entries(field.value ?? {}).map(([name, agent]) => (
              <div key={name} className="claude-agents-editor-row grid grid-cols-[10rem_1fr_8rem_auto] items-end gap-3">
                <span className="font-medium">{name}</span>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`agent-${name}-model`}>Model</Label>
                  <Input id={`agent-${name}-model`} value={agent.model} onChange={(event) => field.onChange({ ...field.value, [name]: { ...agent, model: event.target.value } })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`agent-${name}-effort`}>Effort</Label>
                  <select id={`agent-${name}-effort`} className={SELECT_CLASS} value={agent.effort} onChange={(event) => field.onChange({ ...field.value, [name]: { ...agent, effort: event.target.value as Effort } })}>
                    {EFFORT_ORDER.map((effort) => (
                      <option key={effort} value={effort}>
                        {effort}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== name)))}>
                  Remove agent
                </Button>
              </div>
            ))}
            <div className="claude-agents-editor-add flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="agent-new-name">New agent</Label>
                <Input id="agent-new-name" value={newAgent} onChange={(event) => setNewAgent(event.target.value.trim())} />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={newAgent === '' || Object.hasOwn(field.value ?? {}, newAgent)}
                onClick={() => {
                  field.onChange({ ...field.value, [newAgent]: { model: '', effort: 'medium' } });
                  setNewAgent('');
                }}
              >
                Add agent
              </Button>
            </div>
          </div>
        )}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor="claude-default-agent">Default agent</Label>
        <select id="claude-default-agent" className={SELECT_CLASS} {...form.register('claude.defaultAgent')}>
          {agentNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <h3 className="text-sm font-semibold">Agent per task type</h3>
      <Controller
        control={form.control}
        name="claude.taskTypes"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            {Object.entries(field.value ?? {}).map(([taskType, agentName]) => (
              <div key={taskType} className="claude-agents-editor-row grid grid-cols-[10rem_1fr_auto] items-end gap-3">
                <Label htmlFor={`task-type-${taskType}`}>{taskType}</Label>
                <select id={`task-type-${taskType}`} className={SELECT_CLASS} value={agentName} onChange={(event) => field.onChange({ ...field.value, [taskType]: event.target.value })}>
                  {agentNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== taskType)))}>
                  Remove
                </Button>
              </div>
            ))}
            <div className="claude-agents-editor-add flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="task-type-new">New task type</Label>
                <Input id="task-type-new" value={newTaskType} onChange={(event) => setNewTaskType(event.target.value.trim())} />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={newTaskType === '' || Object.hasOwn(field.value ?? {}, newTaskType)}
                onClick={() => {
                  field.onChange({ ...field.value, [newTaskType]: form.getValues('claude.defaultAgent') });
                  setNewTaskType('');
                }}
              >
                Add task type
              </Button>
            </div>
          </div>
        )}
      />
    </section>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 3: Show both editors in `web/src/features/routing/routing-page.tsx`

Add after `import { useConfigForm } from '@/hooks/use-config-form';`:
```tsx
import { ClaudeAgentsEditor } from './claude-agents-editor';
import { EffortMapEditor } from './effort-map-editor';
```
Replace `<TierEditor form={form} />` with:
```tsx
          <TierEditor form={form} />
          <EffortMapEditor form={form} />
          <ClaudeAgentsEditor form={form} />
```
Run: `npm run typecheck && npm run build:web && node scripts/demo-ui.mjs`, open `/routing`; set effort map `max` to `high`; add task type `review.security`; click Save and reload the tab; then clear the model of one agent and click Save
Expected: the effort map shows five selects with the values of `config/routing.json`, and the agents and task types of that file; after the first Save `Saved.`, and after the reload `max` still maps to `high` and a `review.security` row names the default agent; `grep -rc 'review.security' /tmp/routemax-demo/.config/routemax` counts at least 1 in the live file, stored as one key, not nested; the empty model shows `Not saved: fix these fields first` with a line starting `claude.agents.`.

Commit:
```bash
git add web/src/features/routing/effort-map-editor.tsx web/src/features/routing/claude-agents-editor.tsx web/src/features/routing/routing-page.tsx
git commit -m "feat(web): edit the effort map and the Claude agents on Routing" -m "Plan-task: 55"
```

### Task 56: Preview a route on Routing from the values on the page

Depends on: Task 55
Design: design-ui

Files:
- Create: `web/src/features/routing/route-preview.tsx`
- Modify: `web/src/features/routing/routing-page.tsx`

Step 1: Create `web/src/features/routing/route-preview.tsx`

The preview sends `form.getValues()`, so it shows the route the page would save, saved or not; the server answers 422 with the field named when those values are invalid, and runs no worker.
```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import type { PlanRequest, RoutePlan } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';
import { EFFORT_ORDER, TIER_ORDER, type Effort, type Tier } from '../../../../src/config/config-schema';
import { ListInput } from './list-input';

type PreviewState = { kind: 'idle' } | { kind: 'running' } | { kind: 'planned'; plan: RoutePlan } | { kind: 'failed'; message: string };

const SELECT_CLASS = 'route-preview-select rounded-md border bg-background px-2 py-1 text-sm';

function describePlan(plan: RoutePlan): string {
  const raised = plan.raisedBy === null ? 'No rule raised it.' : `Raised by rule ${plan.raisedBy}.`;
  if (plan.tier === 'claude') return `claude, agent ${plan.agent}. ${raised}`;
  return `${plan.tier} on ${plan.provider} / ${plan.model} at effort ${plan.effort}. ${raised}`;
}

export function RoutePreview({ form }: { form: ConfigForm }) {
  const [task, setTask] = useState('');
  const [taskType, setTaskType] = useState('');
  const [requestedTier, setRequestedTier] = useState<Tier>('flash-low');
  const [flags, setFlags] = useState<string[]>([]);
  const [claudeEffort, setClaudeEffort] = useState<Effort | ''>('');
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });

  async function preview() {
    const request: PlanRequest = { task, taskType, requestedTier, flags };
    if (claudeEffort !== '') request.claudeEffort = claudeEffort;
    setState({ kind: 'running' });
    try {
      const plan = await api.request<RoutePlan>('POST', '/api/route-preview', { config: form.getValues(), request });
      setState({ kind: 'planned', plan });
    } catch (error) {
      setState({ kind: 'failed', message: describeError(error) });
    }
  }

  return (
    <section className="route-preview flex flex-col gap-3">
      <h2 className="text-base font-semibold">Route preview</h2>
      <p className="text-sm text-muted-foreground">Shows where a task would go with the values on this page, saved or not. It runs no worker.</p>
      <div className="flex flex-col gap-1">
        <Label htmlFor="preview-task">Task</Label>
        <Input id="preview-task" value={task} onChange={(event) => setTask(event.target.value)} />
      </div>
      <div className="route-preview-grid grid grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="preview-task-type">Task type</Label>
          <Input id="preview-task-type" value={taskType} onChange={(event) => setTaskType(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="preview-tier">Requested tier</Label>
          <select id="preview-tier" className={SELECT_CLASS} value={requestedTier} onChange={(event) => setRequestedTier(event.target.value as Tier)}>
            {TIER_ORDER.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="preview-flags">Flags</Label>
          <ListInput id="preview-flags" value={flags} onChange={setFlags} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="preview-effort">Effort on Claude</Label>
          <select id="preview-effort" className={SELECT_CLASS} value={claudeEffort} onChange={(event) => setClaudeEffort(event.target.value as Effort | '')}>
            <option value="">none</option>
            {EFFORT_ORDER.map((effort) => (
              <option key={effort} value={effort}>
                {effort}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="button" variant="outline" className="self-start" disabled={state.kind === 'running'} onClick={() => void preview()}>
        Preview route
      </Button>
      <p className="route-preview-result text-sm" aria-live="polite">
        {state.kind === 'running' && 'Planning…'}
        {state.kind === 'planned' && describePlan(state.plan)}
        {state.kind === 'failed' && <span className="whitespace-pre-line text-destructive">{state.message}</span>}
      </p>
    </section>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 2: Show the preview in `web/src/features/routing/routing-page.tsx`

Add `import { RoutePreview } from './route-preview';` after `import { EffortMapEditor } from './effort-map-editor';`, and `<RoutePreview form={form} />` on the line after `<RuleEditor form={form} />`.
Run: `npm run typecheck && npm run build:web && node scripts/demo-ui.mjs`, open `/routing`; type task `write tests for the budget module`, task type `tests`, requested tier `flash-low`, click Preview route; then set `flash-low` effort to another value without saving and preview again; then clear the Name of rule 1 and preview; in a second terminal `wc -l /tmp/routemax-demo/.local/state/deepseek-delegate/decisions.jsonl`
Expected: the first preview prints a line of the form `<tier> on deepseek / <model> at effort <effort>.` followed by the rule sentence; the second preview follows the unsaved effort when the tier stays `flash-low`; the third shows a line starting `rules.0.id:`; the decision log still has 5 lines.

Commit:
```bash
git add web/src/features/routing/route-preview.tsx web/src/features/routing/routing-page.tsx
git commit -m "feat(web): preview a route on Routing from the values on the page" -m "Plan-task: 56"
```

### Task 57: Edit and add providers on Providers

Depends on: Task 56
Design: design-ui

Files:
- Create: `web/src/features/providers/provider-fields.tsx`
- Create: `web/src/features/providers/add-provider-form.tsx`
- Create: `web/src/features/providers/providers-page.tsx`
- Modify: `web/src/app.tsx` (`SECTION_PAGES`)

Step 1: Create `web/src/features/providers/provider-fields.tsx`

Provider ids match `^[a-z0-9-]+$` (the schema refuses others), so `register` can path through them. `repairProxy` is one nullable object and goes through one `Controller`.
```tsx
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

const TEXT_FIELDS = [
  ['name', 'Name'],
  ['baseUrl', 'Base URL'],
  ['keychainService', 'Keychain service'],
] as const;

export function ProviderFields({ form, providerId }: { form: ConfigForm; providerId: string }) {
  const field = (name: string) => `provider-${providerId}-${name}`;
  return (
    <div className="provider-fields flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{providerId}</h2>
        <Controller
          control={form.control}
          name={`providers.${providerId}.enabled`}
          render={({ field: enabled }) => (
            <Label className="flex items-center gap-2">
              <Switch checked={enabled.value} onCheckedChange={(checked) => enabled.onChange(checked)} />
              {enabled.value ? 'Enabled' : 'Disabled: no tier can use it'}
            </Label>
          )}
        />
      </div>
      <div className="provider-fields-grid grid grid-cols-3 gap-3">
        {TEXT_FIELDS.map(([name, label]) => (
          <div key={name} className="flex flex-col gap-1">
            <Label htmlFor={field(name)}>{label}</Label>
            <Input id={field(name)} {...form.register(`providers.${providerId}.${name}`)} />
          </div>
        ))}
      </div>
      <Controller
        control={form.control}
        name={`providers.${providerId}.efforts`}
        render={({ field: efforts }) => (
          <fieldset className="flex gap-3">
            <legend className="text-sm font-medium">Efforts it accepts</legend>
            {EFFORT_ORDER.map((effort) => (
              <label key={effort} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={efforts.value.includes(effort)}
                  onChange={(event) => efforts.onChange(event.target.checked ? EFFORT_ORDER.filter((kept) => kept === effort || efforts.value.includes(kept)) : efforts.value.filter((kept) => kept !== effort))}
                />
                {effort}
              </label>
            ))}
          </fieldset>
        )}
      />
      <Controller
        control={form.control}
        name={`providers.${providerId}.repairProxy`}
        render={({ field: proxy }) =>
          proxy.value === null ? (
            <p className="text-sm text-muted-foreground">No repair proxy.</p>
          ) : (
            <div className="provider-fields-grid grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor={field('proxy-port')}>Repair proxy port</Label>
                <Input id={field('proxy-port')} type="number" value={Number.isNaN(proxy.value.port) ? '' : proxy.value.port} onChange={(event) => proxy.onChange({ ...proxy.value, port: event.target.valueAsNumber })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={field('proxy-log')}>Proxy log</Label>
                <Input id={field('proxy-log')} value={proxy.value.logPath} onChange={(event) => proxy.onChange({ ...proxy.value, logPath: event.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={field('proxy-telemetry')}>Proxy telemetry</Label>
                <Input id={field('proxy-telemetry')} value={proxy.value.telemetryPath} onChange={(event) => proxy.onChange({ ...proxy.value, telemetryPath: event.target.value })} />
              </div>
            </div>
          )
        }
      />
    </div>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0; a type error on the `providers.${providerId}.repairProxy` path or on `onCheckedChange` stops with `PLAN DRIFT: Task 57`.

Step 2: Create `web/src/features/providers/add-provider-form.tsx`

A new provider starts disabled with no models, so no tier can point at it before it has a model, and its Keychain service follows the migration's `<id>_api_key` naming.
```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

const PROVIDER_ID = /^[a-z0-9-]+$/;

export function AddProviderForm({ form }: { form: ConfigForm }) {
  const [providerId, setProviderId] = useState('');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const taken = Object.hasOwn(form.getValues('providers') ?? {}, providerId);
  const problem = providerId === '' ? null : !PROVIDER_ID.test(providerId) ? 'Use lowercase letters, digits and dashes.' : taken ? 'A provider with this id exists.' : null;

  function add() {
    form.setValue(
      `providers.${providerId}`,
      { name, baseUrl, keychainService: `${providerId}_api_key`, models: {}, efforts: [...EFFORT_ORDER], enabled: false, repairProxy: null },
      { shouldDirty: true },
    );
    setProviderId('');
    setName('');
    setBaseUrl('');
  }

  return (
    <section className="add-provider-form flex flex-col gap-3 rounded-lg border p-3">
      <h2 className="text-base font-semibold">Add a provider</h2>
      <div className="add-provider-form-grid grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-provider-id">Id</Label>
          <Input id="new-provider-id" value={providerId} aria-invalid={problem !== null} onChange={(event) => setProviderId(event.target.value.trim())} />
          {problem !== null && <p className="text-sm text-destructive">{problem}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-provider-name">Name</Label>
          <Input id="new-provider-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-provider-url">Base URL</Label>
          <Input id="new-provider-url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value.trim())} />
        </div>
      </div>
      <Button type="button" variant="outline" className="self-start" disabled={providerId === '' || problem !== null || name.trim() === '' || baseUrl === ''} onClick={add}>
        Add provider
      </Button>
    </section>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 3: Create `web/src/features/providers/providers-page.tsx` and register it in `web/src/app.tsx`
```tsx
import { useWatch } from 'react-hook-form';
import { SaveBar } from '@/components/save-bar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfigForm } from '@/hooks/use-config-form';
import { AddProviderForm } from './add-provider-form';
import { ProviderFields } from './provider-fields';

export function ProvidersPage() {
  const { form, ready, previousExists, loadError, saveState, save, restore, reload } = useConfigForm();
  const providers = useWatch({ control: form.control, name: 'providers' }) ?? {};

  return (
    <div className="providers-page flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Providers</h1>
      {loadError !== null && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {!ready && loadError === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {ready && (
        <>
          {Object.keys(providers).map((providerId) => (
            <section key={providerId} className="providers-page-provider flex flex-col gap-4 rounded-lg border p-4">
              <ProviderFields form={form} providerId={providerId} />
            </section>
          ))}
          <AddProviderForm form={form} />
          <SaveBar
            saveState={saveState}
            dirty={form.formState.isDirty}
            previousExists={previousExists}
            onSave={() => void save()}
            onRestore={() => void restore()}
            onReload={reload}
          />
        </>
      )}
    </div>
  );
}
```
`web/src/app.tsx`: add `import { ProvidersPage } from '@/features/providers/providers-page';` after the `OverviewPage` import, and `providers: ProvidersPage,` after `routing: RoutingPage,` in `SECTION_PAGES`.
Run: `npm run typecheck && npm run build:web && node scripts/demo-ui.mjs`, open `/providers`; type id `Bad_ID`; then add id `local-test`, name `Local test`, base URL `http://127.0.0.1:9/v1`, click Add provider, click Save and reload the tab
Expected: two provider sections, `deepseek` enabled and `openrouter` disabled (the Task 6 migration seeds both); `Bad_ID` shows `Use lowercase letters, digits and dashes.` and Add provider stays disabled; after the save `Saved.`, and after the reload a `local-test` section, disabled, with Keychain service `local-test_api_key` and all five efforts checked.

Commit:
```bash
git add web/src/features/providers/provider-fields.tsx web/src/features/providers/add-provider-form.tsx web/src/features/providers/providers-page.tsx web/src/app.tsx
git commit -m "feat(web): edit and add providers on Providers" -m "Plan-task: 57"
```

### Task 58: Edit provider models, store a key and test a provider on Providers

Depends on: Task 57
Design: design-ui

Files:
- Create: `web/src/features/providers/provider-models.tsx`
- Create: `web/src/features/providers/provider-key-form.tsx`
- Create: `web/src/features/providers/provider-test-panel.tsx`
- Modify: `web/src/features/providers/providers-page.tsx`

Step 1: Create `web/src/features/providers/provider-models.tsx`

Model names are record keys that can hold a dot (`deepseek-v3.2`), so the models record goes through one `Controller`. A new model starts with empty prices (`NaN`), which the save check names, so no price is saved as 0 by accident.
```tsx
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';

const PRICE_FIELDS = [
  ['inputUsd', 'Input USD'],
  ['cacheHitUsd', 'Cache hit USD'],
  ['outputUsd', 'Output USD'],
] as const;

export function ProviderModels({ form, providerId }: { form: ConfigForm; providerId: string }) {
  const [newModel, setNewModel] = useState('');
  return (
    <Controller
      control={form.control}
      name={`providers.${providerId}.models`}
      render={({ field }) => (
        <div className="provider-models flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Models and prices</h3>
          {Object.entries(field.value ?? {}).map(([model, price]) => (
            <div key={model} className="provider-models-row grid grid-cols-[12rem_1fr_1fr_1fr_auto] items-end gap-3">
              <span className="font-medium">{model}</span>
              {PRICE_FIELDS.map(([priceField, label]) => (
                <div key={priceField} className="flex flex-col gap-1">
                  <Label htmlFor={`model-${providerId}-${model}-${priceField}`}>{label}</Label>
                  <Input
                    id={`model-${providerId}-${model}-${priceField}`}
                    type="number"
                    step="any"
                    value={Number.isNaN(price[priceField]) ? '' : price[priceField]}
                    onChange={(event) => field.onChange({ ...field.value, [model]: { ...price, [priceField]: event.target.valueAsNumber } })}
                  />
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== model)))}>
                Remove model
              </Button>
            </div>
          ))}
          <div className="provider-models-add flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`model-${providerId}-new`}>New model</Label>
              <Input id={`model-${providerId}-new`} value={newModel} onChange={(event) => setNewModel(event.target.value.trim())} />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={newModel === '' || Object.hasOwn(field.value ?? {}, newModel)}
              onClick={() => {
                field.onChange({ ...field.value, [newModel]: { inputUsd: Number.NaN, cacheHitUsd: Number.NaN, outputUsd: Number.NaN } });
                setNewModel('');
              }}
            >
              Add model
            </Button>
          </div>
        </div>
      )}
    />
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 2: Create `web/src/features/providers/provider-key-form.tsx`

The key input is uncontrolled and read once through `FormData` on submit, so the key never sits in React state; the form is reset after the PUT. The server never returns the key, only `present`.
```tsx
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';

interface ProviderKeyFormProps {
  providerId: string;
  present: boolean | undefined;
  onStored: () => void;
}

export function ProviderKeyForm({ providerId, present, onStored }: ProviderKeyFormProps) {
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyForm = event.currentTarget;
    const key = new FormData(keyForm).get('key');
    if (typeof key !== 'string' || key === '') return;
    try {
      await api.request<{ present: boolean }>('PUT', `/api/keys/${encodeURIComponent(providerId)}`, { key });
      keyForm.reset();
      setMessage('Key stored in the Keychain.');
      onStored();
    } catch (error) {
      setMessage(describeError(error));
    }
  }

  return (
    <form className="provider-key-form flex flex-col gap-1" onSubmit={(event) => void submit(event)}>
      <Label htmlFor={`key-${providerId}`}>API key</Label>
      <p className="text-sm text-muted-foreground">
        {present === undefined ? 'Checking the Keychain…' : present ? 'A key is stored in the Keychain.' : 'No key in the Keychain yet.'}
      </p>
      <div className="flex gap-2">
        <Input id={`key-${providerId}`} name="key" type="password" autoComplete="off" />
        <Button type="submit" variant="outline">
          Store key
        </Button>
      </div>
      {message !== null && (
        <p className="text-sm" aria-live="polite">
          {message}
        </p>
      )}
    </form>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 3: Create `web/src/features/providers/provider-test-panel.tsx`

A test calls a real worker and counts against the budget, so the button names that; it waits for a save while the page has unsaved changes, so the test runs the values the owner sees.
```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { ProviderTestResult } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { describeError, formatTime, formatUsd } from '@/lib/format';

interface ProviderTestPanelProps {
  providerId: string;
  models: string[];
  result: ProviderTestResult | undefined;
  dirty: boolean;
  onTested: () => void;
}

export function ProviderTestPanel({ providerId, models, result, dirty, onTested }: ProviderTestPanelProps) {
  const [model, setModel] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = models.includes(model) ? model : (models[0] ?? '');

  async function runTest() {
    setRunning(true);
    setError(null);
    try {
      await api.request<ProviderTestResult>('POST', `/api/providers/${encodeURIComponent(providerId)}/test`, { model: chosen });
      onTested();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="provider-test-panel flex flex-col gap-1">
      <Label htmlFor={`test-${providerId}-model`}>Test</Label>
      <p className="text-sm">
        {result === undefined
          ? 'Never tested.'
          : `${result.passed ? 'Last test passed' : 'Last test failed'} on ${result.model} at ${formatTime(result.testedAt)}, cost ${formatUsd(result.costUsd)}: ${result.detail}`}
      </p>
      <div className="flex gap-2">
        <select id={`test-${providerId}-model`} className="provider-test-panel-select rounded-md border bg-background px-2 py-1 text-sm" value={chosen} onChange={(event) => setModel(event.target.value)}>
          {models.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" disabled={running || dirty || chosen === ''} onClick={() => void runTest()}>
          {running ? 'Testing…' : 'Run a paid test call'}
        </Button>
      </div>
      {dirty && <p className="text-sm text-muted-foreground">Save first: the test runs the saved config.</p>}
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 4: Show models, key and test per provider in `web/src/features/providers/providers-page.tsx`

Add after `import { useConfigForm } from '@/hooks/use-config-form';`:
```tsx
import { usePoll } from '@/hooks/use-poll';
import type { KeysResponse, ProviderTestsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { ProviderKeyForm } from './provider-key-form';
import { ProviderModels } from './provider-models';
import { ProviderTestPanel } from './provider-test-panel';

const loadKeys = () => api.request<KeysResponse>('GET', '/api/keys');
const loadProviderTests = () => api.request<ProviderTestsResponse>('GET', '/api/provider-tests');
```
In `ProvidersPage`, after the `providers` line, add:
```tsx
  const keys = usePoll(loadKeys);
  const tests = usePoll(loadProviderTests);
  const keyPresent = (providerId: string) =>
    keys.state.kind === 'loaded' && Object.hasOwn(keys.state.value.keys, providerId) ? keys.state.value.keys[providerId].present : undefined;
  const lastTest = (providerId: string) => (tests.state.kind === 'loaded' && Object.hasOwn(tests.state.value, providerId) ? tests.state.value[providerId] : undefined);
```
Replace `<ProviderFields form={form} providerId={providerId} />` with:
```tsx
              <ProviderFields form={form} providerId={providerId} />
              <ProviderModels form={form} providerId={providerId} />
              <ProviderKeyForm providerId={providerId} present={keyPresent(providerId)} onStored={keys.refresh} />
              <ProviderTestPanel
                providerId={providerId}
                models={Object.keys(providers[providerId].models ?? {})}
                result={lastTest(providerId)}
                dirty={form.formState.isDirty}
                onTested={tests.refresh}
              />
```
Run: `npm run typecheck && npm run build:web && node scripts/demo-ui.mjs`, open `/providers`; on `openrouter` add model `qwen3-coder` and click Save; then give it input `0.1`, cache hit `0.01` and output `0.3`, enable `openrouter` and click Save. Do not submit a key form and do not press a test button: the Keychain and a test's worker call are not under the demo `HOME`.
Expected: `deepseek` lists the models of `config/routing.json` and `Last test passed on deepseek-flash`; `openrouter` shows `Last test failed on qwen3-coder` with `HTTP 401 from the provider: the key was refused.`; each key form shows a Keychain line (it reads the owner's real Keychain; reading stores nothing); the first Save shows `Not saved: fix these fields first` with a line naming `providers.openrouter.models.qwen3-coder`; the second shows `Saved.`; while the page is dirty each test button is disabled with `Save first: the test runs the saved config.`

Commit:
```bash
git add web/src/features/providers/provider-models.tsx web/src/features/providers/provider-key-form.tsx web/src/features/providers/provider-test-panel.tsx web/src/features/providers/providers-page.tsx
git commit -m "feat(web): edit provider models, store a key and test a provider" -m "Plan-task: 58"
```

### Task 59: Edit budget, timeouts and project commands on Settings

Depends on: Task 58
Design: design-ui

Files:
- Create: `web/src/features/settings/project-commands.tsx`
- Create: `web/src/features/settings/settings-page.tsx`
- Modify: `web/src/app.tsx` (`SECTION_PAGES`)

Step 1: Create `web/src/features/settings/project-commands.tsx`

Project keys are folder paths that hold dots and slashes, so the `projects` record goes through one `Controller`.
```tsx
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';

export function ProjectCommands({ form }: { form: ConfigForm }) {
  const [newFolder, setNewFolder] = useState('');
  return (
    <Controller
      control={form.control}
      name="projects"
      render={({ field }) => (
        <section className="project-commands flex flex-col gap-2">
          <h2 className="text-base font-semibold">Test command per project</h2>
          {Object.entries(field.value ?? {}).map(([folder, project], index) => (
            <div key={folder} className="project-commands-row grid grid-cols-[1fr_1fr_auto] items-end gap-3">
              <span className="truncate font-mono text-sm" title={folder}>
                {folder}
              </span>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`project-${index}-command`}>Test command</Label>
                <Input id={`project-${index}-command`} value={project.testCommand} onChange={(event) => field.onChange({ ...field.value, [folder]: { testCommand: event.target.value } })} />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(Object.fromEntries(Object.entries(field.value).filter(([other]) => other !== folder)))}>
                Remove
              </Button>
            </div>
          ))}
          <div className="project-commands-add flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="project-new-folder">Project folder</Label>
              <Input id="project-new-folder" value={newFolder} onChange={(event) => setNewFolder(event.target.value.trim())} />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={newFolder === '' || Object.hasOwn(field.value ?? {}, newFolder)}
              onClick={() => {
                field.onChange({ ...field.value, [newFolder]: { testCommand: '' } });
                setNewFolder('');
              }}
            >
              Add project
            </Button>
          </div>
        </section>
      )}
    />
  );
}
```
Run: `npm run typecheck`
Expected: exit code 0.

Step 2: Create `web/src/features/settings/settings-page.tsx` and register it in `web/src/app.tsx`

An empty retry threshold is `null` (no retry limit), not 0, so it uses `setValueAs` instead of `valueAsNumber`.
```tsx
import { Controller } from 'react-hook-form';
import { SaveBar } from '@/components/save-bar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useConfigForm } from '@/hooks/use-config-form';
import { ProjectCommands } from './project-commands';

const NUMBER_FIELDS = [
  ['budget.totalUsd', 'Total budget (USD)'],
  ['budget.perCallUsd', 'Budget per call (USD)'],
  ['workerTimeoutMs', 'Worker timeout (ms)'],
  ['testTimeoutMs', 'Test timeout (ms)'],
] as const;

const TEXT_FIELDS = [
  ['claudeBin', 'Claude command'],
  ['proxy.dir', 'Proxy folder'],
] as const;

const toNullableNumber = (value: unknown) => (value === '' || value === null ? null : Number(value));

export function SettingsPage() {
  const { form, ready, previousExists, loadError, saveState, save, restore, reload } = useConfigForm();

  return (
    <div className="settings-page flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Settings</h1>
      {loadError !== null && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {!ready && loadError === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {ready && (
        <>
          <section className="settings-page-grid grid grid-cols-2 gap-3">
            {NUMBER_FIELDS.map(([name, label]) => (
              <div key={name} className="flex flex-col gap-1">
                <Label htmlFor={`setting-${name}`}>{label}</Label>
                <Input id={`setting-${name}`} type="number" step="any" {...form.register(name, { valueAsNumber: true })} />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <Label htmlFor="setting-retryThreshold">Retry threshold (empty for none)</Label>
              <Input id="setting-retryThreshold" type="number" {...form.register('retryThreshold', { setValueAs: toNullableNumber })} />
            </div>
            {TEXT_FIELDS.map(([name, label]) => (
              <div key={name} className="flex flex-col gap-1">
                <Label htmlFor={`setting-${name}`}>{label}</Label>
                <Input id={`setting-${name}`} {...form.register(name)} />
              </div>
            ))}
            <Controller
              control={form.control}
              name="exploreRedirect"
              render={({ field }) => (
                <Label className="flex items-center gap-2">
                  <Switch checked={field.value} onCheckedChange={(checked) => field.onChange(checked)} />
                  Explore redirect
                </Label>
              )}
            />
          </section>
          <ProjectCommands form={form} />
          <SaveBar
            saveState={saveState}
            dirty={form.formState.isDirty}
            previousExists={previousExists}
            onSave={() => void save()}
            onRestore={() => void restore()}
            onReload={reload}
          />
        </>
      )}
    </div>
  );
}
```
`web/src/app.tsx`: add `import { SettingsPage } from '@/features/settings/settings-page';` after the `RoutingPage` import, and `settings: SettingsPage,` after `providers: ProvidersPage,` in `SECTION_PAGES`.
Run: `npm run typecheck && npm run build:web && node scripts/demo-ui.mjs`, open `/settings`; clear Retry threshold, add project folder `/tmp/demo.project` with test command `npm test`, click Save and reload the tab; then set Total budget to `-1` and click Save; then click Restore previous version
Expected: the values of `config/routing.json`; after the first Save `Saved.`, and `grep -A1 '"retryThreshold"' -r /tmp/routemax-demo/.config/routemax` shows `null`; after the reload the `/tmp/demo.project` row is back with `npm test`; `-1` shows `Not saved: fix these fields first` with a line starting `budget.totalUsd:`; the restore brings back the retry threshold of the seed.

Commit:
```bash
git add web/src/features/settings/project-commands.tsx web/src/features/settings/settings-page.tsx web/src/app.tsx
git commit -m "feat(web): edit budget, timeouts and project commands on Settings" -m "Plan-task: 59"
```

### Phase 8: Setup, README and the switch in an open session

### Task 60: Add the live config to the chezmoi source once

Depends on: none
Risk: runs an external process (`chezmoi`) that writes the chezmoi source

Files:
- Create: `src/setup/add-live-config-to-chezmoi.ts`
- Test: `test/add-live-config-to-chezmoi.test.ts`

Step 1: Write the failing test with a fake `chezmoi`, `test/add-live-config-to-chezmoi.test.ts`
```ts
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addLiveConfigToChezmoi } from '../src/setup/add-live-config-to-chezmoi';

function fakeChezmoi(sourcePathExit: number) {
  const dir = mkdtempSync(join(tmpdir(), 'routemax-setup-chezmoi-'));
  const configPath = join(dir, 'config.json');
  const log = join(dir, 'calls.log');
  writeFileSync(configPath, '{"version":2}\n');
  writeFileSync(log, '');
  const bin = join(dir, 'chezmoi');
  writeFileSync(bin, ['#!/bin/sh', `echo "$@" >> '${log}'`, `if [ "$1" = source-path ]; then exit ${sourcePathExit}; fi`, ''].join('\n'));
  chmodSync(bin, 0o755);
  return { bin, configPath, log };
}

describe('addLiveConfigToChezmoi', () => {
  it('adds a live config chezmoi does not manage yet', async () => {
    const { bin, configPath, log } = fakeChezmoi(1);
    await expect(addLiveConfigToChezmoi(configPath, bin)).resolves.toBe(`Added ${configPath} to the chezmoi source.`);
    expect(readFileSync(log, 'utf8')).toBe(`source-path ${configPath}\nadd ${configPath}\n`);
  });

  it('leaves a managed live config alone', async () => {
    const { bin, configPath, log } = fakeChezmoi(0);
    await expect(addLiveConfigToChezmoi(configPath, bin)).resolves.toBe(`${configPath} is already in the chezmoi source.`);
    expect(readFileSync(log, 'utf8')).toBe(`source-path ${configPath}\n`);
  });

  it('says what to run by hand when chezmoi is missing', async () => {
    const { configPath } = fakeChezmoi(1);
    await expect(addLiveConfigToChezmoi(configPath, join(tmpdir(), 'no-such-chezmoi-bin'))).resolves.toBe(
      `chezmoi is missing; run chezmoi add ${configPath} to keep the config.`,
    );
  });
});
```
Run: `npm test -- test/add-live-config-to-chezmoi.test.ts`
Expected: the file fails to load: `Failed to resolve import "../src/setup/add-live-config-to-chezmoi"`

Step 2: Write `src/setup/add-live-config-to-chezmoi.ts`

The config holds no key (the key stays in Keychain), so unlike `addDeepseekHomeToChezmoi` it needs no secret check. A failing `chezmoi add` throws, so setup stops loudly as it does for `~/.claude-deepseek/`.
```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function addLiveConfigToChezmoi(configPath: string, chezmoiBin: string): Promise<string> {
  try {
    await execFileAsync(chezmoiBin, ['source-path', configPath]);
    return `${configPath} is already in the chezmoi source.`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return `chezmoi is missing; run chezmoi add ${configPath} to keep the config.`;
  }
  await execFileAsync(chezmoiBin, ['add', configPath]);
  return `Added ${configPath} to the chezmoi source.`;
}
```
Run: `npm run typecheck && npm test -- test/add-live-config-to-chezmoi.test.ts`
Expected: `tsc` prints nothing; the three tests pass, `0 failed`

Commit:
```bash
git add src/setup/add-live-config-to-chezmoi.ts test/add-live-config-to-chezmoi.test.ts
git commit -m "feat(setup): add the live config to the chezmoi source" -m "Plan-task: 60"
```

### Task 61: Build the page, link `routemax` and add the config to chezmoi in setup

Depends on: Task 60, Task 18, Task 22, Task 38, Task 41
Risk: `npm link` writes a symlink into the global npm prefix and `chezmoi add` writes the user's chezmoi source; both run on the real machine, as the spec asks

Files:
- Modify: `package.json`
- Modify: `src/setup/run-setup.ts`

Step 1: Build the page and link the command in the `setup` script, `package.json`

The line `"setup": "npm install --no-audit --no-fund && tsx src/setup/run-setup.ts",` becomes:
```json
    "setup": "npm install --no-audit --no-fund && npm run build:web && npm link --no-audit --no-fund && tsx src/setup/run-setup.ts",
```
`routemax ui` builds nothing (Task 38), so the build belongs to setup. Whether `npm link` on this npm version also links the `web` workspace was not checked; Step 3 checks only the `routemax` link.
Run: `node -p "require('./package.json').scripts.setup"`
Expected: `npm install --no-audit --no-fund && npm run build:web && npm link --no-audit --no-fund && tsx src/setup/run-setup.ts`

Step 2: Add the live config to chezmoi, `src/setup/run-setup.ts`

The line `import { loadConfig } from '../config/delegate-config';` becomes:
```ts
import { activeConfigPath, loadConfig } from '../config/delegate-config';
import { addLiveConfigToChezmoi } from './add-live-config-to-chezmoi';
```
After the line `for (const message of agents.messages) console.log(message);` add:
```ts

console.log(await addLiveConfigToChezmoi(activeConfigPath(), 'chezmoi'));
```
`activeConfigPath()` (Task 18) runs the migration first when the live config is missing (Task 8's `ensureLiveConfig`), so the file exists before `chezmoi add` sees it.

Run: `npm run typecheck && npm test`
Expected: `tsc` prints nothing; every test file passes, `0 failed`

Step 3: Run setup twice and the doctor
Run: `npm run setup && npm run setup && ls web/dist/index.html && command -v routemax && chezmoi source-path ~/.config/routemax/config.json && npm run doctor`
Expected: the first setup prints `Added /Users/<you>/.config/routemax/config.json to the chezmoi source.` (or `/Users/<you>/.config/routemax/config.json is already in the chezmoi source.` when it was added before) and the second prints `is already in the chezmoi source.`; `web/dist/index.html` exists; `command -v routemax` prints a path under `$(npm prefix -g)/bin`; `chezmoi source-path` prints a path in the chezmoi source; `npm run doctor` prints `OK` on every line, `routemax command` included (`routemax is on PATH, so routemax ui works in every terminal.`)

Commit:
```bash
git add package.json src/setup/run-setup.ts
git commit -m "feat(setup): build the page, link routemax and add the live config to chezmoi" -m "Plan-task: 61"
```

### Task 62: Describe the page and the live config in the README

Depends on: Task 61

Files:
- Modify: `README.md`

Step 1: Name the new setup steps, `README.md`

The paragraph starting `Setup installs the dependencies, creates` becomes:
```markdown
Setup installs the dependencies, builds the page, links the `routemax` command with `npm link`, creates `~/.claude-deepseek/` and adds its files to your chezmoi source, writes the config to `~/.config/routemax/config.json` and adds it to your chezmoi source, adds the Claude agent files through chezmoi, and registers the server for every project. Running it again changes nothing that is already in place.
```
Run: `grep -c 'links the .routemax. command' README.md`
Expected: `1`

Step 2: Add the UI section, `README.md`, before the line `## Details`:
```markdown
## The page

Run `routemax ui` in any terminal. It opens a local page in your browser and runs until Ctrl-C.

- Overview: the switch that turns `delegate` on and off in open sessions, spend per provider and the doctor lines.
- History: every `delegate` call with its tier, provider, cost and status.
- Routing: the rules, each tier's provider, model and effort, the effort map, the Claude agents, and a preview of where a task would go.
- Providers: base URL, models and prices, the Keychain key and a test call per provider.
- Settings: budget, timeouts and the test command per project.

Switched off, a `delegate` call returns `use_claude` with `reason: "disabled"` and starts no worker. A save checks every field first, keeps the previous version for Restore, and runs `chezmoi re-add` on the config. The page listens only on 127.0.0.1 and needs the token in the URL it opens.

```
Run: `grep -n '^## ' README.md`
Expected: the headings in order `## Install`, `## The page`, `## Details`

Step 3: Point the config section at the live file, `README.md`

The heading `### config/routing.json` becomes `### The config file`. The line `The server reads the file when it starts. After an edit, reconnect the server with `/mcp` or restart Claude Code.` becomes:
```markdown
The config lives in `~/.config/routemax/config.json`. The first run of setup, the server, the doctor or the page creates it from `config/routing.json` and keeps that original in `~/.local/state/routemax/backups/`. The server re-reads the file after every change, so an edit on the page or by hand applies to the next `delegate` call without a restart; an invalid file is ignored and the previous config stays.
```
The line starting `- `tiers`:` becomes:
```markdown
- `tiers`: the provider, model and effort of `flash-low`, `flash-high` and `pro-high`.
```
The line starting `- `prices`:` becomes:
```markdown
- `providers`: per provider its base URL, Keychain service, models with USD per 1M tokens, efforts, whether it is enabled, and its repair-proxy (port, log file and telemetry file) or `null`.
```
The line starting `- `proxy`:` becomes:
```markdown
- `proxy`: the repair-proxy folder. A proxy that `delegate` or `npm run doctor` starts writes its telemetry to its provider's telemetry path.
```
Run: `grep -c '^## The page' README.md; grep -c 'config/routing.json' README.md; grep -c '`prices`' README.md`
Expected: `1`; `1` (only the migration sentence); `0`

Walkthrough: open `README.md` and read `## The page` and `### The config file`.

Commit:
```bash
git add README.md
git commit -m "docs: describe routemax ui and the live config" -m "Plan-task: 62"
```

### Task 63: Check the switch in an open Claude Code session (manual acceptance 3)

Depends on: Task 61, Task 48
Risk: manual, in the user's real Claude Code session; the result decides whether the README gets a fallback paragraph

Files:
- Modify: `README.md` (only when Step 2 fails)

Step 1: Confirm the Claude Code version the spec names
Run: `claude --version`
Expected: `2.1.282 (Claude Code)`. On another version, run Step 2 anyway and name the version in the run report and, on a failure, in the README paragraph.

Step 2: Switch off and on during one open session
1. Start `claude` in any project and run `/mcp`: `deepseek-delegate` is connected and lists the tool `delegate`.
2. In another terminal run `routemax ui` and press the switch on Overview to off.
3. Without restarting, run `/mcp` in the same session again and ask the session whether it has a tool named `delegate`.
4. Press the switch to on, then repeat 3.
Run: `cat ~/.local/state/deepseek-delegate/enabled` after 2 and after 4
Expected: `off` after 2 and `on` after 4; in 3 `delegate` is gone from the session's tools, and after 4 it is back. Record pass or fail for both directions in the run report.

Step 3 (only when Step 2 fails): Write the result and the fallback, `README.md`, at the end of `## The page`:
```markdown
In Claude Code 2.1.282 an open session keeps `delegate` in its tool list after the switch turns off (anthropics/claude-code#77314). The switch still holds: a call while off returns `use_claude` with `reason: "disabled"`, starts no worker, and the session does the task itself.
```
Run: `grep -c 'claude-code#77314' README.md`
Expected: `1`

Commit:
```bash
# only when Step 3 ran
git add README.md
git commit -m "docs: note that open sessions keep delegate listed when switched off" -m "Plan-task: 63"
```

## Final verification

- `npm run typecheck`: prints nothing, exit code 0.
- `npm test`: every test file passes, `0 failed`.
- Migration: `npm test -- test/migrate-config.test.ts test/delegate-config.test.ts` passes: a copy of the current `config/routing.json` migrates into a version 2 file with every value preserved (checked field by field), the v1 original is kept in backups, and a second run changes nothing.
- Switch, server side (acceptance 2 and the automated half of 3): `npm test -- test/delegate.test.ts test/integration/delegate-stdio.test.ts` passes: with the file saying `off`, a `delegate` call returns `use_claude` with `reason: "disabled"` and starts no worker, `delegate` leaves `tools/list` after `notifications/tools/list_changed`, and with `on` calls run again.
- Switch in History: with the switch file saying `off`, a `delegate` call writes one `decisions.jsonl` line with `status: "disabled"` and `costUsd: 0` (`test/delegate.test.ts`).
- Doctor (acceptance 2 and 13): `npm test -- test/doctor.test.ts test/command-on-path.test.ts` passes: switch off, `npm run doctor` says the router is off as `OK`, not `FIX`; the doctor checks that `routemax` is on `PATH`; each enabled provider gets its own key line and, when it has a repair-proxy, its own proxy line. After setup has run `npm link` (Phase 8), `npm run doctor` passes with a `router` and a `routemax command` line.
- Save, restore and validation, store side (acceptance 6 and 7): `npm test -- test/config-store.test.ts test/sync-chezmoi.test.ts` passes: an invalid save (unknown provider in a tier, negative cap, bad effort) is refused with the field named and the file on disk unchanged; a save leaves a previous version, restore brings it back, a restore can be undone, and the chezmoi source matches after each (with a fake `chezmoi`).
- Security, guard side (acceptance 8): `npm test -- test/request-guard.test.ts test/static-files.test.ts` passes: a request without the token, with a foreign `Origin`, or with a foreign `Host` is refused, and a static path cannot leave the build folder.
- Security and switch, HTTP side (acceptance 2 and 8): `npm test -- test/ui-server.test.ts test/switch-api.test.ts` passes: the server listens only on `127.0.0.1`; a request without the token, with a foreign `Origin`, or with a foreign `Host` gets 403 with an empty body; switch off on the page API makes the file say `off`, and switch on makes it say `on`.
- Save, restore and validation, HTTP side (acceptance 6 and 7): `npm test -- test/config-api.test.ts` passes: a save with a missing model price is refused with 422 naming `providers.deepseek.models.deepseek-flash.outputUsd` and the file unchanged; a stale save gets 409; a save, a restore and the undo of that restore each leave the fake chezmoi source equal to the live file.
- History and spend (acceptance 11 and the owner's disabled-call decision): `npm test -- test/decision-stats.test.ts test/stats-api.test.ts` passes: spend per provider adds up to the total spend, a log line without `provider` counts as `deepseek`, and `GET /api/history` returns a `status: "disabled"` line with `costUsd: 0`.
- Doctor on the page (acceptance 2 and 13): `npm test -- test/doctor-deps.test.ts test/doctor-api.test.ts` passes: `GET /api/doctor` returns the same checks as `npm run doctor` built from the same deps, with the router off reported as `OK`.
- Page start, server side (acceptance 1): `npm test -- test/integration/routemax-bin.test.ts` passes: `routemax ui` started from another folder prints the page URL with a token, serves the page and every section API, and stops on Ctrl-C; without a built page it says to run `npm run setup`; an unknown command prints the usage.
- Security, key side (acceptance 8): `npm test -- test/keys-api.test.ts` passes: a key is stored through `security -i` on stdin and reported present; a key with a quote is refused without repeating it; an unknown provider gets 404; a fake key appears in no response or log line.
- Route preview (acceptance 9): `npm test -- test/route-preview-api.test.ts` passes: `POST /api/route-preview` returns the same tier, provider, model and effort as `planRoute` for the seed cases, refuses an invalid config with the field named, and runs no worker and writes no decision.
- Provider test, server side (acceptance 10): `npm test -- test/provider-test.test.ts test/integration/provider-test-http.test.ts` passes: against a fake upstream a working provider passes and a refused key fails, each with its cost; the latest result per provider is kept for the page; an unknown provider gets 404 and an unknown model 422. The tier warning is the page half (Phase 7).
- Live config (acceptance 4): `npm test -- test/integration/delegate-stdio.test.ts` passes: a routing change saved to the config file changes the tier of the next `delegate` call in an already open session, and an invalid file keeps the previous config.
- Frontend build and token (acceptance 13): `npm run build:web` writes `web/dist/index.html`; `npm run typecheck` also type-checks `web/`; `npm test -- web/src/lib/api-client.test.ts` passes: every API request carries `x-routemax-token` read from `#token=`, and no request is sent without it.
- Project skills: `ls .claude/skills/*/SKILL.md | wc -l` prints `12`, and nothing was installed under `~/.claude/skills/`.
- Pages load (acceptance 1, page half): with `node scripts/demo-ui.mjs` running, Overview, History, Routing, Providers and Settings open with the demo's live config and data, with no error alert.
- Tier warning (acceptance 10, page half): on the demo Providers page enable `openrouter` and give it model `qwen3-coder`, save, then on Routing set `flash-low` to `openrouter` / `qwen3-coder`: `Check before saving` shows `flash-low uses openrouter, whose last test failed: HTTP 401 from the provider: the key was refused.` and Save still saves; `npm test -- web/src/features/routing/tier-warnings.test.ts` passes.
- Reviews (acceptance 12): the run reports of Tasks 48, 51 and 53 list the `interface-review` and `web-design-guidelines` findings on the switch, the History table and the rule editor, each fixed or explained.
- Disabled calls on the page: the demo History lists the `disabled` row at `$0.00` with no filter set.
- Route preview (acceptance 9, page half): on the demo Routing page, Preview route follows an unsaved tier change, names the field of an invalid value, and adds no line to the demo `decisions.jsonl`.
- Demo safety: no walkthrough submitted a key form or pressed a provider test button (the Keychain and a test's worker call are not under the demo `HOME`).
- Setup (acceptance 1 and 13, spec Command and Chezmoi): `npm test -- test/add-live-config-to-chezmoi.test.ts` passes; after `npm run setup`, `web/dist/index.html` exists, `command -v routemax` prints a path, `chezmoi source-path ~/.config/routemax/config.json` prints a path in the chezmoi source, a second `npm run setup` adds nothing, and `npm run doctor` prints `OK` on every line, `routemax command` included.
- README (acceptance 14): `grep -c '^## The page' README.md` prints `1`, and `### The config file` names `~/.config/routemax/config.json`.
- Switch in an open session (acceptance 3, manual): the run report of Task 63 states pass or fail for off and for on on Claude Code 2.1.282; on a failure the README holds the paragraph naming anthropics/claude-code#77314.
- Walkthrough: run `routemax ui` in any folder, press the switch on Overview, and run `/mcp` in an open Claude Code session to see `delegate` leave and come back.
