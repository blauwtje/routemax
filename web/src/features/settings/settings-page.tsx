import { Controller } from "react-hook-form";
import { SaveBar } from "@/components/save-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingsGroup } from "@/components/settings-group";
import { useConfigForm } from "@/hooks/use-config-form";
import { CopyButton } from "./copy-button";
import { PANEL_CLASS } from "./panel-motion";
import { ProjectCommands } from "./project-commands";

const BUDGET_FIELDS = [
  ["budget.totalUsd", "Total budget", "Stops every delegate call once the period's spend reaches this amount."],
  ["budget.perCallUsd", "Budget per call", "Rejects a single delegate call priced above this amount."],
] as const;

const RETRY_HELP = "How many failed delegate retries to allow before a task escalates to Claude. Off retries without a limit.";

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
          <SettingsGroup title="Budget" className={PANEL_CLASS[0]}>
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

          <SettingsGroup title="Timeouts and retries" className={PANEL_CLASS[1]}>
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

          <SettingsGroup title="Claude and proxy" className={PANEL_CLASS[2]}>
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

          <ProjectCommands form={form} panelClassName={PANEL_CLASS[3]} />
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
