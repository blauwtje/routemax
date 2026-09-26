import { useWatch } from 'react-hook-form';
import { SaveBar } from '@/components/save-bar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfigForm } from '@/hooks/use-config-form';
import { usePoll } from '@/hooks/use-poll';
import type { KeysResponse, ProviderTestsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { AddProviderForm } from './add-provider-form';
import { ProviderFields, ProviderSummary } from './provider-fields';
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
    <div className="providers-page flex flex-col gap-8">
      {loadError !== null && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {!ready && loadError === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {ready && (
        <>
          <p className="max-w-[70ch] text-sm text-pretty text-muted-foreground">
            Keys are stored in the macOS Keychain, never in the config file on disk. A test call is real and billed against the saved configuration.
          </p>
          {Object.keys(providers).map((providerId, i) => (
            <details
              key={providerId}
              open={providers[providerId].enabled}
              className="providers-page-provider relative overflow-hidden rounded-lg border border-border bg-surface-1 shadow-panel before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[oklch(1_0_0/0.08)] motion-safe:transition-[opacity,transform] motion-safe:duration-(--dur-panel) motion-safe:ease-(--ease-out-expo) motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0"
              style={{ transitionDelay: `${Math.min(i, 5) * 40}ms` }}
            >
              <ProviderSummary
                form={form}
                providerId={providerId}
                keyPresent={keyPresent(providerId)}
                modelCount={Object.keys(providers[providerId].models ?? {}).length}
              />
              <div className="providers-page-provider-body flex flex-col gap-6 border-t border-border px-4 pt-4 pb-5 sm:px-6">
                <ProviderFields form={form} providerId={providerId} />
                <ProviderModels form={form} providerId={providerId} />
                <div className="providers-page-checks grid gap-4 md:grid-cols-2">
                  <ProviderKeyForm providerId={providerId} present={keyPresent(providerId)} onStored={keys.refresh} />
                  <ProviderTestPanel
                    providerId={providerId}
                    models={Object.keys(providers[providerId].models ?? {})}
                    result={lastTest(providerId)}
                    dirty={form.formState.isDirty}
                    onTested={tests.refresh}
                  />
                </div>
              </div>
            </details>
          ))}
          <AddProviderForm form={form} panelIndex={Object.keys(providers).length} />
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
