import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { SaveBar } from '@/components/save-bar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfigForm } from '@/hooks/use-config-form';
import { usePoll } from '@/hooks/use-poll';
import type { KeysResponse, ProviderTestsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { AddProviderForm } from './add-provider-form';
import { ProviderRow } from './provider-row';
import { ProviderSheet } from './provider-sheet';

const loadKeys = () => api.request<KeysResponse>('GET', '/api/keys');
const loadProviderTests = () => api.request<ProviderTestsResponse>('GET', '/api/provider-tests');

export function ProvidersPage() {
  const { form, ready, previousExists, loadError, saveState, save, restore, reload } = useConfigForm();
  const providers = useWatch({ control: form.control, name: 'providers' }) ?? {};
  const keys = usePoll(loadKeys);
  const tests = usePoll(loadProviderTests);
  const [openProviderId, setOpenProviderId] = useState<string | null>(null);
  const providerIds = Object.keys(providers);
  const keyPresent = (providerId: string) =>
    keys.state.kind === 'loaded' && Object.hasOwn(keys.state.value.keys, providerId) ? keys.state.value.keys[providerId].present : undefined;
  const lastTest = (providerId: string) => (tests.state.kind === 'loaded' && Object.hasOwn(tests.state.value, providerId) ? tests.state.value[providerId] : undefined);

  return (
    <div className="providers-page flex flex-col gap-8">
      {loadError !== null && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {!ready && loadError === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {ready && (
        <>
          <div className="providers-page-intro flex flex-wrap items-end justify-between gap-4">
            <p className="max-w-[70ch] text-sm text-pretty text-muted-foreground">
              Keys live in ~/.config/routemax/keys.env, never in the config file. A test call is real and billed against the saved configuration.
            </p>
            <AddProviderForm form={form} onAdded={setOpenProviderId} />
          </div>
          <section
            aria-labelledby="providers-page-list-title"
            className="providers-page-list relative overflow-hidden rounded-lg border border-border bg-surface-1 shadow-panel [--provider-row-columns:minmax(0,1fr)_8.5rem_13rem_6.5rem] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[oklch(1_0_0/0.08)] motion-safe:transition-[opacity,transform] motion-safe:duration-(--dur-panel) motion-safe:ease-(--ease-out-expo) motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0"
          >
            <h2 id="providers-page-list-title" className="sr-only">
              Providers
            </h2>
            <div
              aria-hidden="true"
              className="providers-page-list-head hidden grid-cols-(--provider-row-columns) gap-x-4 border-b border-border px-5 py-2 font-mono text-[12px] tracking-wide text-muted-foreground uppercase md:grid"
            >
              <span>Provider</span>
              <span>Key</span>
              <span>Last test</span>
              <span className="justify-self-end">On</span>
            </div>
            {providerIds.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No providers yet. Add one to give a tier somewhere to send tasks.</p>
            ) : (
              <ul className="providers-page-rows divide-y divide-border">
                {providerIds.map((providerId) => (
                  <ProviderRow
                    key={providerId}
                    form={form}
                    providerId={providerId}
                    keyPresent={keyPresent(providerId)}
                    lastTest={lastTest(providerId)}
                    modelCount={Object.keys(providers[providerId].models ?? {}).length}
                    onOpen={setOpenProviderId}
                  />
                ))}
              </ul>
            )}
          </section>
          <ProviderSheet
            form={form}
            providerId={openProviderId !== null && Object.hasOwn(providers, openProviderId) ? openProviderId : null}
            keyPresent={openProviderId === null ? undefined : keyPresent(openProviderId)}
            lastTest={openProviderId === null ? undefined : lastTest(openProviderId)}
            onOpenChange={(open) => {
              if (!open) setOpenProviderId(null);
            }}
            onTested={tests.refresh}
          />
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
