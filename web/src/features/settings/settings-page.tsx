import { SettingsIcon } from "lucide-react";
import { Controller } from "react-hook-form";
import { SaveBar } from "@/components/save-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useConfigForm } from "@/hooks/use-config-form";
import { ProjectCommands } from "./project-commands";

const BUDGET_FIELDS = [
  ["budget.totalUsd", "Total budget (USD)"],
  ["budget.perCallUsd", "Budget per call (USD)"],
] as const;

const TIMEOUT_FIELDS = [
  ["workerTimeoutMs", "Worker timeout (ms)"],
  ["testTimeoutMs", "Test timeout (ms)"],
] as const;

const TEXT_FIELDS = [
  ["claudeBin", "Claude command"],
  ["proxy.dir", "Proxy folder"],
] as const;

const CARD_CLASS =
  "grid gap-3 rounded-xl bg-card p-4 text-card-foreground shadow-(--shadow-card)";
const HEADING_CLASS = "font-heading text-lg font-bold tracking-tight";

const toNullableNumber = (value: unknown) =>
  value === "" || value === null ? null : Number(value);

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

  const numberField = ([name, label]:
    (typeof BUDGET_FIELDS)[number] | (typeof TIMEOUT_FIELDS)[number]) => (
    <div key={name} className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={`setting-${name}`}>{label}</Label>
      <Input
        id={`setting-${name}`}
        type="number"
        step="any"
        className="tabular-nums"
        {...form.register(name, { valueAsNumber: true })}
      />
    </div>
  );

  return (
    <div className="settings-page flex flex-col gap-6">
      <h1 className="flex items-center gap-3 font-heading text-2xl font-bold tracking-tight">
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary"
        >
          <SettingsIcon className="size-5" />
        </span>
        Settings
      </h1>
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
          <section
            aria-labelledby="settings-budget-title"
            className="flex flex-col gap-4"
          >
            <h2 id="settings-budget-title" className={HEADING_CLASS}>
              Budget
            </h2>
            <div className={`${CARD_CLASS} sm:grid-cols-2`}>
              {BUDGET_FIELDS.map(numberField)}
            </div>
          </section>
          <section
            aria-labelledby="settings-timeouts-title"
            className="flex flex-col gap-4"
          >
            <h2 id="settings-timeouts-title" className={HEADING_CLASS}>
              Timeouts and retries
            </h2>
            <div className={`${CARD_CLASS} sm:grid-cols-3`}>
              {TIMEOUT_FIELDS.map(numberField)}
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="setting-retryThreshold">
                  Retry threshold (empty for none)
                </Label>
                <Input
                  id="setting-retryThreshold"
                  type="number"
                  className="tabular-nums"
                  {...form.register("retryThreshold", {
                    setValueAs: toNullableNumber,
                  })}
                />
              </div>
            </div>
          </section>
          <section
            aria-labelledby="settings-claude-title"
            className="flex flex-col gap-4"
          >
            <h2 id="settings-claude-title" className={HEADING_CLASS}>
              Claude and proxy
            </h2>
            <div className={`${CARD_CLASS} md:grid-cols-2`}>
              {TEXT_FIELDS.map(([name, label]) => (
                <div key={name} className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={`setting-${name}`}>{label}</Label>
                  <Input
                    id={`setting-${name}`}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                    {...form.register(name)}
                  />
                </div>
              ))}
              <Controller
                control={form.control}
                name="exploreRedirect"
                render={({ field }) => (
                  <Label className="flex items-center gap-2 border-t border-border pt-3 md:col-span-2">
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                    />
                    Explore redirect
                  </Label>
                )}
              />
            </div>
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
