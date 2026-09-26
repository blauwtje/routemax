import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ConfigForm } from '@/hooks/use-config-form';
import { EFFORT_ORDER } from '../../../../src/config/config-schema';

const PROVIDER_ID = /^[a-z0-9-]+$/;

/** Adds a provider to the page's form from a dialog, then hands its id back so the page can open it. */
export function AddProviderForm({ form, onAdded }: { form: ConfigForm; onAdded: (providerId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const taken = Object.hasOwn(form.getValues('providers') ?? {}, providerId);
  const problem = providerId === '' ? null : !PROVIDER_ID.test(providerId) ? 'Use lowercase letters, digits and dashes.' : taken ? 'A provider with this id exists.' : null;

  const disabled = providerId === '' || problem !== null || name.trim() === '' || baseUrl === '';

  function add() {
    form.setValue(
      `providers.${providerId}`,
      { name, baseUrl, keychainService: `${providerId}_api_key`, models: {}, efforts: [...EFFORT_ORDER], enabled: false, repairProxy: null },
      { shouldDirty: true },
    );
    setProviderId('');
    setName('');
    setBaseUrl('');
    setOpen(false);
    onAdded(providerId);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" className="add-provider-form-trigger shrink-0" />}>
        <PlusIcon aria-hidden="true" />
        Add provider
      </DialogTrigger>
      <DialogContent className="add-provider-form gap-5 border border-border bg-surface-1 p-5 sm:max-w-md sm:p-6">
        <DialogHeader className="gap-1 pr-8">
          <DialogTitle className="font-display text-[28px] leading-tight font-normal">Add a provider</DialogTitle>
          <DialogDescription className="text-pretty">It starts disabled with no models, so no tier can use it until it has one.</DialogDescription>
        </DialogHeader>
        <form
          className="add-provider-form-fields flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled) add();
          }}
        >
          <Field label="Id" htmlFor="new-provider-id" error={problem}>
            <Input autoComplete="off" spellCheck={false} data-mono value={providerId} onChange={(event) => setProviderId(event.target.value.trim())} />
          </Field>
          <Field label="Name" htmlFor="new-provider-name">
            <Input autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Base URL" htmlFor="new-provider-url">
            <Input data-mono type="url" autoComplete="off" spellCheck={false} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value.trim())} />
          </Field>
          <DialogFooter className="mx-0 mb-0 border-0 bg-transparent p-0 pt-1">
            <Button type="submit" disabled={disabled}>
              <PlusIcon aria-hidden="true" />
              Add provider
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
