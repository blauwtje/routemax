import { ServerIcon } from 'lucide-react';
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
      <h1 className="flex items-center gap-3 font-heading text-2xl font-bold tracking-tight">
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary">
          <ServerIcon className="size-5" />
        </span>
        Providers
      </h1>
      {loadError !== null && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {!ready && loadError === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {ready && (
        <>
          {Object.keys(providers).map((providerId) => (
            <section
              key={providerId}
              aria-labelledby={`provider-${providerId}-title`}
              className="providers-page-provider flex flex-col gap-4 rounded-xl bg-card p-4 text-card-foreground shadow-(--shadow-card)"
            >
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
