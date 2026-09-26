import { useState, type FormEvent } from 'react';
import { KeyRoundIcon } from 'lucide-react';
import { Field } from '@/components/field';
import { SettingsGroup } from '@/components/settings-group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/browser-api';
import { describeError } from '@/lib/format';

interface ProviderKeyFormProps {
  providerId: string;
  present: boolean | undefined;
  onStored: () => void;
}

export function ProviderKeyForm({ providerId, present, onStored }: ProviderKeyFormProps) {
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyForm = event.currentTarget;
    const key = new FormData(keyForm).get('key');
    if (typeof key !== 'string' || key === '') return;
    try {
      await api.request<{ present: boolean }>('PUT', `/api/keys/${encodeURIComponent(providerId)}`, { key });
      keyForm.reset();
      setMessage('Key stored in the Keychain.');
      onStored();
    } catch (error) {
      setMessage(describeError(error));
    }
  }

  return (
    <SettingsGroup title="API key">
      <form className="provider-key-form flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
        <p className={present ? 'text-sm font-medium text-status-positive' : 'text-sm font-medium text-muted-foreground'}>
          {present === undefined ? 'Checking the Keychain…' : present ? 'Present' : 'Absent'}
        </p>
        <div className="flex flex-col gap-2">
          <Field label="New key" htmlFor={`key-${providerId}`} className="w-full min-w-0">
            <Input id={`key-${providerId}`} name="key" type="password" autoComplete="off" />
          </Field>
          <Button type="submit" variant="outline" className="self-start">
            <KeyRoundIcon aria-hidden="true" />
            Store key
          </Button>
        </div>
        <p className="text-sm empty:hidden" aria-live="polite">
          {message}
        </p>
      </form>
    </SettingsGroup>
  );
}
