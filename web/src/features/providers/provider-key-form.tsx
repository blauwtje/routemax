import { useState, type FormEvent } from 'react';
import { KeyRoundIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <form className="provider-key-form flex min-w-0 flex-col gap-1.5" onSubmit={(event) => void submit(event)}>
      <Label htmlFor={`key-${providerId}`}>API key</Label>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${present ? 'bg-status-done' : 'bg-status-disabled'}`} />
        {present === undefined ? 'Checking the Keychain…' : present ? 'A key is stored in the Keychain.' : 'No key in the Keychain yet.'}
      </p>
      <div className="flex gap-2">
        <Input id={`key-${providerId}`} name="key" type="password" autoComplete="off" className="min-w-0" />
        <Button type="submit" variant="outline">
          <KeyRoundIcon aria-hidden="true" />
          Store key
        </Button>
      </div>
      <p className="text-sm empty:hidden" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
