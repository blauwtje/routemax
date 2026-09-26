import { Controller } from "react-hook-form";
import { SaveBar } from "@/components/save-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdvancedSection } from "@/components/advanced-section";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { SettingsGroup } from "@/components/settings-group";
import { useConfigForm } from "@/hooks/use-config-form";
import { usePoll } from "@/hooks/use-poll";
import type { StatsResponse } from "@/lib/api-types";
import { api } from "@/lib/browser-api";
import { formatUsd } from "@/lib/format";
import { CopyButton } from "./copy-button";
import { PANEL_CLASS } from "./panel-motion";
import { ProjectCommands } from "./project-commands";

const BUDGET_FIELDS = [
  ["budget.totalUsd", "Total budget", "Stops every delegate call once the period's spend reaches this amount."],
  ["budget.perCallUsd", "Budget per call", "Rejects a single delegate call priced above this amount."],
] as const;

// The Budget panel shows current spend from the same /api/stats read the Overview polls.
const loadStats = () => api.request<StatsResponse>("GET", "/api/stats");

// The fold enters one step after the budget panel, on the same page-enter motion the panels use.
const ADVANCED_ENTER_CLASS =
  "motion-safe:animate-[page-enter_var(--dur-page)_var(--ease-out-expo)_both] motion-safe:[animation-delay:40ms]";

// Each group inside the fold starts on the fold's own top rule, so only the later groups draw one.
const ADVANCED_GROUP_CLASS = "first:border-t-0 first:pt-0";

const RETRY_HELP = "How many failed delegate retries to allow before a task escalates to Claude. When off, retries have no limit.";

export function SettingsPage() {
  const {
    form,
    ready,
    previousExists,
    loadError,
    saveState,
    save,
    restore,
    reload,
  } = useConfigForm();
  const { state: statsState } = usePoll(loadStats);
  const budget = statsState.kind === "loaded" ? statsState.value.budget : null;
  const spentPercent = budget && budget.totalUsd > 0 ? Math.min(100, (budget.spentUsd / budget.totalUsd) * 100) : 0;

  return (
    <div className="settings-page flex flex-col gap-6">
      {loadError !== null && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {!ready && loadError === null && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {ready && (
        <>
          <SettingsGroup
            title="Budget"
            description="What delegated DeepSeek work may cost. Claude's own use does not count against it."
            className={PANEL_CLASS[0]}
          >
            {budget && (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-mono text-3xl tabular-nums text-foreground sm:text-4xl">
                    {formatUsd(budget.spentUsd)}
                    <span className="ml-2 text-sm font-sans font-normal text-muted-foreground">
                      of {formatUsd(budget.totalUsd)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono tabular-nums text-foreground">{formatUsd(budget.leftUsd)}</span> left
                  </p>
                </div>
                <Progress
                  value={spentPercent}
                  aria-label={`Budget spent: ${formatUsd(budget.spentUsd)} of ${formatUsd(budget.totalUsd)}, ${formatUsd(budget.leftUsd)} left`}
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {BUDGET_FIELDS.map(([name, label, help]) => (
                <Field key={name} label={label} htmlFor={`setting-${name}`} help={help} prefix="$">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    data-mono
                    className="tabular-nums"
                    {...form.register(name, { valueAsNumber: true })}
                  />
                </Field>
              ))}
            </div>
          </SettingsGroup>

          <AdvancedSection
            summary="Timeouts, retries, Claude, proxy, project commands"
            className={ADVANCED_ENTER_CLASS}
          >
            <SettingsGroup title="Timeouts and retries" className={ADVANCED_GROUP_CLASS}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Worker timeout" htmlFor="setting-workerTimeoutMs" help="A delegate call taking longer than this is treated as failed." suffix="ms">
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    data-mono
                    className="tabular-nums"
                    {...form.register("workerTimeoutMs", { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Test timeout" htmlFor="setting-testTimeoutMs" help="A provider test call taking longer than this is treated as failed." suffix="ms">
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    data-mono
                    className="tabular-nums"
                    {...form.register("testTimeoutMs", { valueAsNumber: true })}
                  />
                </Field>
                <Controller
                  control={form.control}
                  name="retryThreshold"
                  render={({ field }) => {
                    const enabled = field.value !== null && field.value !== undefined;
                    return (
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span id="retry-threshold-label" className="text-[13px] font-semibold text-foreground">
                            Retry threshold
                          </span>
                          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Switch
                              size="sm"
                              checked={enabled}
                              onCheckedChange={(checked) => field.onChange(checked ? 1 : null)}
                              aria-label="Limit retries"
                            />
                            {enabled ? "On" : "Off"}
                          </label>
                        </div>
                        <Input
                          id="setting-retryThreshold"
                          type="number"
                          step="1"
                          min={0}
                          data-mono
                          className="tabular-nums"
                          aria-labelledby="retry-threshold-label"
                          aria-describedby="retry-threshold-help"
                          disabled={!enabled}
                          placeholder="Off"
                          value={enabled ? field.value ?? "" : ""}
                          onChange={(event) =>
                            field.onChange(event.target.value === "" ? null : Number(event.target.value))
                          }
                        />
                        <p id="retry-threshold-help" className="text-xs text-muted-foreground">
                          {RETRY_HELP}
                        </p>
                      </div>
                    );
                  }}
                />
              </div>
            </SettingsGroup>

            <SettingsGroup title="Claude and proxy" className={ADVANCED_GROUP_CLASS}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-end gap-1.5">
                  <Field
                    label="Claude command"
                    htmlFor="setting-claudeBin"
                    help="The binary routemax runs to launch a Claude session."
                    className="min-w-0 flex-1"
                  >
                    <Input autoComplete="off" spellCheck={false} data-mono {...form.register("claudeBin")} />
                  </Field>
                  <CopyButton value={form.watch("claudeBin") ?? ""} label="Claude command" className="mb-0.5" />
                </div>
                <div className="flex items-end gap-1.5">
                  <Field
                    label="Proxy folder"
                    htmlFor="setting-proxy.dir"
                    help="The repair proxy's working directory."
                    className="min-w-0 flex-1"
                  >
                    <Input autoComplete="off" spellCheck={false} data-mono {...form.register("proxy.dir")} />
                  </Field>
                  <CopyButton value={form.watch("proxy.dir") ?? ""} label="proxy folder" className="mb-0.5" />
                </div>
                <Controller
                  control={form.control}
                  name="exploreRedirect"
                  render={({ field }) => (
                    <div className="flex flex-col gap-1.5 border-t border-border pt-4 md:col-span-2">
                      <label className="group/field-label flex items-center gap-3 rounded-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-offset-2">
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                        <span className="text-[13px] font-semibold text-foreground">Explore redirect</span>
                      </label>
                      <p className="pl-[calc(24px+0.75rem)] text-xs text-muted-foreground">
                        Send Explore-tool calls through the redirect target instead of the normal routing path.
                      </p>
                    </div>
                  )}
                />
              </div>
            </SettingsGroup>

            <ProjectCommands form={form} className={ADVANCED_GROUP_CLASS} />
          </AdvancedSection>
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
