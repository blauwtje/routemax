# routemax dashboard

## Goal

`routemax ui` opens a local page that shows at a glance what the router does, switches `delegate` on and off in open Claude sessions without a restart, and edits every setting, including multiple providers, without touching JSON.

## Problem

Today the only way to see spend and escalations is reading `decisions.jsonl`, the only way to change routing is editing `config/routing.json` and reconnecting the server, and there is no way to stop delegation short of removing the MCP registration. The config knows only DeepSeek, so adding OpenRouter or another provider means code changes.

## Decisions

### Config location and migration

- **Location (you).** The live config is `~/.config/routemax/config.json`. The server, doctor, hook and UI read only this file. `config/routing.json` in the repo stays as the seed for a fresh install. The `DEEPSEEK_DELEGATE_CONFIG` override keeps working, for tests.
- **Chezmoi (you).** Setup adds `~/.config/routemax/config.json` to the chezmoi source, like `~/.claude-deepseek/`. After every save and every restore the UI runs `chezmoi re-add` on that file, so a later `chezmoi apply` never reverts a UI change. It never commits or pushes. When chezmoi is missing, or the source entry is a template, the save still succeeds and the page says what to do by hand. The config holds no key.
- **Migration (you, exo for the shape).** On first start (server, doctor, UI or setup, whichever runs first), when `~/.config/routemax/config.json` is missing, the current `config/routing.json` is converted to the new shape and written there. Every existing value survives: tiers, rules, effort map, Claude agents, budget, timeouts, retry threshold, projects, Explore switch, `claudeBin`, proxy paths and prices. The original file is copied unchanged to `~/.local/state/routemax/backups/routing.v1.json` and is never overwritten. The migrated file carries `"version": 2`; a file without `version` is treated as version 1.
- **Provider shape (you, exo for field names).** `providers` is a map by id. Each provider has `name`, `baseUrl` (Anthropic-compatible), `keychainService`, `models` (id to `inputUsd`, `cacheHitUsd`, `outputUsd` per 1M tokens), `efforts` (the effort values it accepts), `enabled`, and `repairProxy`: `null` or `{ port, logPath, telemetryPath }`. `proxy.dir` stays global. The migrated DeepSeek provider gets `baseUrl` `https://api.deepseek.com/anthropic`, Keychain service `deepseek_api_key`, all five efforts, the two current models with their prices, and `repairProxy` on port 8787 with the current log and telemetry paths.
- **Tiers point at provider plus model (you).** Each worker tier is `{ provider, model, effort }`. The tier set stays `flash-low` < `flash-high` < `pro-high` < `claude`, so the `delegate` input does not change. The schema rejects a tier whose provider or model does not exist, or whose provider is disabled.
- **Effort a provider does not accept (exo).** The resolved effort drops to the highest accepted value at or below it; when none is lower, the lowest accepted value.
- **Worker environment per provider (code: `src/worker/worker-env.ts`).** `ANTHROPIC_BASE_URL` is the provider's proxy URL (`http://127.0.0.1:<port>`) when `repairProxy` is set, else its `baseUrl`. `ANTHROPIC_AUTH_TOKEN` comes from the provider's Keychain service at spawn time, and `ANTHROPIC_API_KEY` is set empty, as OpenRouter's Claude Code guide requires. The rest stays as today.
- **Repair-proxy per provider (code: `deepseek-repair-proxy/src/config.ts:14-16`, `src/proxy/upstream.ts:18`).** The proxy already reads `PORT`, `UPSTREAM_BASE_URL` and `TELEMETRY_PATH` and forwards auth headers unchanged, so one proxy instance runs per provider that has `repairProxy`, started by `ensureProxy` with those three variables. The proxy code does not change. Its repairs target DeepSeek bugs; the provider test below shows whether they help elsewhere.

### Providers

- **Adding providers (you).** The page lists providers, edits them and adds new ones. OpenRouter ships as a disabled preset: `baseUrl` `https://openrouter.ai/api`, Keychain service `openrouter_api_key`, no models until you add them, `repairProxy` off. Enabling it is your choice per provider.
- **Provider test (you).** A "Test provider" button runs one small real worker task that needs one tool call (read a file in a temporary folder and report a line from it) against the chosen provider and model, with the per-call cap. It costs a few cents, is logged in the decision log with `taskType` `provider-test` and counts against the budget. The page shows pass or fail, the cost and the date. When you point a tier at a provider whose last test failed or that has never been tested, the page warns before saving, and saving is still allowed.
- **Keys (you).** The page shows per provider only whether its Keychain entry exists. A key form sends the key once to the local server, which stores it with `security add-generic-password -U` passing the key on stdin, never in argv. The key is never sent back, logged, written to config, stored in the browser or included in an error.

### Switch

- **State (you).** One file, `~/.local/state/deepseek-delegate/enabled`, holding `on` or `off`. Missing means on. A big switch at the top of the overview writes it.
- **Live effect (you, docs).** The MCP server watches the file and calls the SDK's `disable()` / `enable()` on the `delegate` tool, which sends `notifications/tools/list_changed`. Claude Code documents that it refreshes tools on that notification (code.claude.com/docs/en/mcp), but anthropics/claude-code#77314 reports stdio servers not being refreshed in 2.1.198. Acceptance 3 checks this on the installed 2.1.282. When it fails there, the tool stays visible and the page says so; the fallback below still holds.
- **Call while off (you).** `delegate` returns `use_claude` with the agent the Claude mapping names for the task type and `reason: "disabled"`, never an error, and starts no worker.
- **Doctor (you).** `npm run doctor` gets a line saying whether the router is on or off. Off is `OK`, not `FIX`.

### Live config

- **Reload (you, exo for the mechanism).** The server watches the config file and re-reads it after a change. A valid file replaces the config for the next call; a call already running keeps the config it started with. An invalid file is ignored, the previous config stays, and the reason goes to stderr. When the task-type list changes, the server updates the tool's input schema through the same notification.

### Page

- **Overview (you).** The switch; budget spent, left and a bar up to the cap, plus spend per provider (you: each provider has its own credit); today and this week (Monday to Sunday, local time): calls, cost, split by tier and by model, escalations by reason; health, the doctor checks run live with `OK` or what to do, refreshed every 30 s and when the tab regains focus.
- **Spend per provider (you, exo for old lines).** Each new decision log line gets a `provider` field. Lines without one count as `deepseek`, because every earlier call went there.
- **History (you).** A table of `decisions.jsonl`: time, project, task type, tier, model, effort, cost, status, reason. Filter and sort on project, status and model.
- **Routing (you).** Edit rules (task types, keywords, exempt task types, flags, tier), worker tiers (provider, model, effort), the effort map, and the Claude agents per task type plus the default agent. A test field takes a task text, task type, requested tier, Claude effort and flags, and shows the tier, provider, model, effort and matching rule, or the Claude agent. It runs nothing and uses the unsaved edits on screen (exo).
- **Budget and limits (you).** Total and per-call cap, worker and test timeouts.
- **Other settings (exo).** Test command per project, the Explore redirect switch, retry threshold, `claudeBin` and proxy paths.
- **Saving (you).** Every save is checked by the same zod schema the server uses, on the server. An invalid config is refused with a message naming the field. The write goes to a temporary file in the same folder, then a rename. The previous version is kept at `~/.local/state/routemax/backups/config.prev.json`, and one click restores it (the restored-from version becomes the new previous, so a restore can be undone). A save based on a config that changed on disk since the page loaded is refused with a message to reload (exo).
- **Language (exo).** The page copy is English, like the rest of the tool, in plain words.

### Command and server

- **Command (you).** `package.json` gets a `bin` named `routemax`, and setup runs `npm link` once, so `routemax ui` works in every terminal. Doctor checks that `routemax` is on `PATH`.
- **Server lifetime (exo).** `routemax ui` builds nothing; setup builds the frontend. The command starts the server in the foreground on a free port, opens the page in the default browser and runs until Ctrl-C. When the build is missing it says to run `npm run setup`.
- **Security (you, exo for the mechanism).** The server binds `127.0.0.1` only. Each start creates a random token, passed to the browser in the URL fragment, kept in `sessionStorage` and sent as a header on every API request. Every request must carry the token and a `Host` of `127.0.0.1:<port>` or `localhost:<port>` (against DNS rebinding); every non-GET request must also carry an `Origin` equal to the page's own origin and a JSON content type. Anything else gets 403 with no body detail. No response, log line or error ever holds a key.
- **Max session (you).** Nothing in this work touches the Max session's settings, model or auth.

### Frontend

- **Stack (exo).** Vite + React + TypeScript + Tailwind, built to static files that the routemax server serves itself. Nothing here needs server rendering or routing on a server, so Next.js would add a second server and a build model for no gain.
- **Components (you, docs).** shadcn/ui through its CLI on Base UI, the default since July 2026. Radix is still supported by shadcn; the premise that it is no longer maintained does not hold, and Base UI is chosen as the default, not as a replacement. Use shadcn's official skill (`skills add shadcn/ui`) and its registry MCP when available.
- **Libraries (exo).** Each with its one-line reason:
  - Charts: shadcn charts on Recharts, because they share the theme tokens with the components. Not Tremor, a second design system with fewer stars and no confirmed recent release.
  - Table: TanStack Table (v9), headless, so sorting and filtering come without a styled grid fighting the design.
  - Forms: react-hook-form with the zod resolver, so the page validates with the server's own schema. Not TanStack Form, which shadcn documents too, because react-hook-form has the longer shadcn track record.
  - Icons: Lucide, the shadcn default.
  - Not chosen: AG Grid and MUI (heavy, own look), Chart.js (no shared tokens).
  The build confirms current versions and licenses at install time.
- **Schema sharing (exo).** The zod config schema lives in one module that both the server and the frontend import, so there is one source of truth.
- **Skills (you).** Installed for this project only, into `routemax/.claude/skills/`, never into `~/.claude/`: from `jakubkrehel/skills` `better-ui`, `better-typography`, `better-colors`, `better-layout`, `better-accessibility`, `better-writing`, `interface-review` and `break`; from `vercel-labs/agent-skills` `react-best-practices`, `composition-patterns` and `web-design-guidelines`; shadcn's own skill. `npx skills add` installs project-local by default; vercel-labs/skills#1355 reports it can land in `.agents/skills/` without a `.claude/skills/` link, so the build checks where they landed. They are read before any UI work.

## Out of scope

- Adding, removing or renaming tiers, or changing the `delegate` input.
- Changes to the repair-proxy's code.
- Reaching the page from another machine, or any login beyond the per-start token.
- Committing or pushing the chezmoi source.
- Editing the content of agent files; the page only maps task types to existing agents.
- Per-provider budget caps; there is one total cap, with spend shown per provider.
- History charts beyond today and this week.
- A Radix variant of the components.

## Acceptance

1. `routemax ui` from any folder opens the page in the default browser, and each section above loads with the current config.
2. Switch off on the page: the file says `off`, `npm run doctor` says the router is off, and a `delegate` call returns `use_claude` with `reason: "disabled"`. Switch on: calls run again.
3. Manual, in an open Claude Code 2.1.282 session: switching off removes `delegate` from the session's tools without a restart, and switching on brings it back. When this fails, the result and the fallback are written in the README.
4. A routing change saved on the page changes the tier of the next `delegate` call in an already open session.
5. Migration: a copy of the current `config/routing.json` migrates into a version 2 file with every value preserved (checked field by field), the v1 original is kept in backups, and a second run changes nothing.
6. Validation: an invalid save (unknown provider in a tier, missing model price, negative cap, bad effort) is refused with the field named, and the file on disk is unchanged.
7. Save and restore: a save leaves a previous version, restore brings it back, a restore can be undone, and the chezmoi source matches after each (with a fake `chezmoi` in tests).
8. Security: a request without the token, with a foreign `Origin`, or with a foreign `Host` gets 403; the server listens only on `127.0.0.1`; a key stored through the page never appears in any API response, log line or error (a test sends a fake key and greps every response and log).
9. The routing test field returns the same tier, provider, model and effort as the real router for the seed cases of `test/route-task.test.ts`, and runs no worker.
10. Provider test: against a fake upstream a passing and a failing provider show pass and fail with cost, and pointing a tier at the failing one shows the warning.
11. Spend per provider on the overview adds up to the total spend, with old log lines counted as `deepseek`.
12. `interface-review` and `web-design-guidelines` have run on the switch, the history table and the rule editor; every finding is fixed or explained in the plan's report.
13. `npm test`, `npm run typecheck` and `npm run doctor` pass.
14. The README has one short section on the UI.

## Proof

- The highest automated seam is the UI server over real HTTP on `127.0.0.1` together with the stdio MCP server, as Claude Code drives it, both pointed at a temporary config folder and a fake Anthropic-compatible upstream. It runs acceptance 2, 4 to 11.
- A browser session against `routemax ui` runs acceptance 1 and the design reviews in 12.
- The real Claude Code 2.1.282 session runs acceptance 3 by hand.
- `npm test`, `npm run typecheck` and `npm run doctor` run acceptance 13.

## Visual direction

- **Identity:** new. The page must not look like default shadcn: its own color, typography and density, chosen through the better-* skills. Dark and light theme, following the system. Fits a laptop screen without horizontal scrolling.
- **Ambition:** a calm, good-looking dashboard with its own character, readable at a glance.
- **Who chooses:** you pick between rendered directions before the build of the pages.
