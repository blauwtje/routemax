import { SplitIcon } from 'lucide-react';
import { SaveBar } from '@/components/save-bar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfigForm } from '@/hooks/use-config-form';
import { usePoll } from '@/hooks/use-poll';
import type { ProviderTestsResponse } from '@/lib/api-types';
import { api } from '@/lib/browser-api';
import { useWatch } from 'react-hook-form';
import { RuleEditor } from './rule-editor';
import { TierEditor } from './tier-editor';
import { tierWarnings } from './tier-warnings';

const loadProviderTests = () => api.request<ProviderTestsResponse>('GET', '/api/provider-tests');

export function RoutingPage() {
  const { form, ready, previousExists, loadError, saveState, save, restore, reload } = useConfigForm();
  const tests = usePoll(loadProviderTests).state;
  const tiers = useWatch({ control: form.control, name: 'tiers' });
  const warnings = tiers === undefined || tests.kind !== 'loaded' ? [] : tierWarnings(tiers, tests.value);

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
          <TierEditor form={form} />
          <RuleEditor form={form} />
          <SaveBar
            saveState={saveState}
            dirty={form.formState.isDirty}
            previousExists={previousExists}
            warnings={warnings}
            onSave={() => void save()}
            onRestore={() => void restore()}
            onReload={reload}
          />
        </>
      )}
    </div>
  );
}
