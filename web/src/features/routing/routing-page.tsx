import { SplitIcon } from 'lucide-react';
import { SaveBar } from '@/components/save-bar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfigForm } from '@/hooks/use-config-form';
import { RuleEditor } from './rule-editor';

export function RoutingPage() {
  const { form, ready, previousExists, loadError, saveState, save, restore, reload } = useConfigForm();

  return (
    <div className="routing-page flex flex-col gap-6">
      <h1 className="flex items-center gap-3 font-heading text-2xl font-bold tracking-tight">
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary">
          <SplitIcon className="size-5" />
        </span>
        Routing
      </h1>
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
