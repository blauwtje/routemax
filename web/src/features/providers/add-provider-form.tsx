import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

const PROVIDER_ID = /^[a-z0-9-]+$/;

export function AddProviderForm({ form }: { form: ConfigForm }) {
  const [providerId, setProviderId] = useState('');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const taken = Object.hasOwn(form.getValues('providers') ?? {}, providerId);
  const problem = providerId === '' ? null : !PROVIDER_ID.test(providerId) ? 'Use lowercase letters, digits and dashes.' : taken ? 'A provider with this id exists.' : null;

  function add() {
    form.setValue(
      `providers.${providerId}`,
      { name, baseUrl, keychainService: `${providerId}_api_key`, models: {}, efforts: [...EFFORT_ORDER], enabled: false, repairProxy: null },
      { shouldDirty: true },
    );
    setProviderId('');
    setName('');
    setBaseUrl('');
  }

  return (
    <section aria-labelledby="add-provider-form-title" className="add-provider-form flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="add-provider-form-title" className="font-heading text-lg font-bold tracking-tight">
          Add a provider
        </h2>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">It starts disabled with no models, so no tier can use it until it has one.</p>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border p-4">
        <div className="add-provider-form-grid grid gap-3 md:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="new-provider-id">Id</Label>
            <Input
              id="new-provider-id"
              autoComplete="off"
              spellCheck={false}
              value={providerId}
              aria-invalid={problem !== null}
              aria-describedby={problem !== null ? 'new-provider-id-problem' : undefined}
              onChange={(event) => setProviderId(event.target.value.trim())}
            />
            {problem !== null && (
              <p id="new-provider-id-problem" className="text-sm text-destructive">
                {problem}
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="new-provider-name">Name</Label>
            <Input id="new-provider-name" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="new-provider-url">Base URL</Label>
            <Input id="new-provider-url" type="url" autoComplete="off" spellCheck={false} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value.trim())} />
          </div>
        </div>
        <Button type="button" variant="outline" className="self-start" disabled={providerId === '' || problem !== null || name.trim() === '' || baseUrl === ''} onClick={add}>
          <PlusIcon aria-hidden="true" />
          Add provider
        </Button>
      </div>
    </section>
  );
}
