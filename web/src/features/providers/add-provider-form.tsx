import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

const PROVIDER_ID = /^[a-z0-9-]+$/;

export function AddProviderForm({ form, panelIndex }: { form: ConfigForm; panelIndex: number }) {
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
    <section aria-labelledby="add-provider-form-title">
      <Card
        className="add-provider-form border-dashed border-border-strong motion-safe:transition-[opacity,transform] motion-safe:duration-(--dur-panel) motion-safe:ease-(--ease-out-expo) motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0"
        style={{ transitionDelay: `${Math.min(panelIndex, 5) * 40}ms` }}
      >
        <CardHeader>
          <CardTitle id="add-provider-form-title" className="text-[17px]">
            Add a provider
          </CardTitle>
          <CardDescription className="max-w-prose text-pretty">It starts disabled with no models, so no tier can use it until it has one.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="add-provider-form-grid grid gap-3 md:grid-cols-3">
            <Field label="Id" htmlFor="new-provider-id" error={problem}>
              <Input
                autoComplete="off"
                spellCheck={false}
                value={providerId}
                onChange={(event) => setProviderId(event.target.value.trim())}
              />
            </Field>
            <Field label="Name" htmlFor="new-provider-name">
              <Input autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Base URL" htmlFor="new-provider-url">
              <Input data-mono type="url" autoComplete="off" spellCheck={false} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value.trim())} />
            </Field>
          </div>
          <Button type="button" variant="outline" className="self-start" disabled={providerId === '' || problem !== null || name.trim() === '' || baseUrl === ''} onClick={add}>
            <PlusIcon aria-hidden="true" />
            Add provider
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
