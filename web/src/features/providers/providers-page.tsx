import { ServerIcon } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { SaveBar } from '@/components/save-bar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfigForm } from '@/hooks/use-config-form';
import { usePoll } from '@/hooks/use-poll';
import type { KeysResponse, ProviderTestsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { AddProviderForm } from './add-provider-form';
import { ProviderFields } from './provider-fields';
import { ProviderKeyForm } from './provider-key-form';
import { ProviderModels } from './provider-models';
import { ProviderTestPanel } from './provider-test-panel';

const loadKeys = () => api.request<KeysResponse>('GET', '/api/keys');
const loadProviderTests = () => api.request<ProviderTestsResponse>('GET', '/api/provider-tests');

export function ProvidersPage() {
  const { form, ready, previousExists, loadError, saveState, save, restore, reload } = useConfigForm();
  const providers = useWatch({ control: form.control, name: 'providers' }) ?? {};
  const keys = usePoll(loadKeys);
  const tests = usePoll(loadProviderTests);
  const keyPresent = (providerId: string) =>
    keys.state.kind === 'loaded' && Object.hasOwn(keys.state.value.keys, providerId) ? keys.state.value.keys[providerId].present : undefined;
  const lastTest = (providerId: string) => (tests.state.kind === 'loaded' && Object.hasOwn(tests.state.value, providerId) ? tests.state.value[providerId] : undefined);

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
              <ProviderModels form={form} providerId={providerId} />
              <div className="providers-page-checks grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                <ProviderKeyForm providerId={providerId} present={keyPresent(providerId)} onStored={keys.refresh} />
                <ProviderTestPanel
                  providerId={providerId}
                  models={Object.keys(providers[providerId].models ?? {})}
                  result={lastTest(providerId)}
                  dirty={form.formState.isDirty}
                  onTested={tests.refresh}
                />
              </div>
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
